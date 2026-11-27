-- Immutable history for user/admin edits of saved 1RMs.
-- Existing values are recorded as a baseline snapshot at migration time;
-- earlier changes cannot be reconstructed retrospectively.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table if not exists public.one_rep_max_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lift text not null check (lift in ('Squat','Bench','Deadlift','Press')),
  old_value numeric null check (old_value >= 0),
  new_value numeric null check (new_value >= 0),
  changed_by uuid null,
  change_source text not null check (change_source in ('user','admin','server','baseline')),
  recorded_at timestamptz not null default now()
);
create index if not exists one_rep_max_history_owner_time_idx
  on public.one_rep_max_history(user_id,recorded_at desc);
alter table public.one_rep_max_history enable row level security;

create policy one_rep_max_history_read on public.one_rep_max_history
  for select to authenticated using (
    user_id = (select auth.uid()) or public.is_workout_admin()
  );
revoke all on public.one_rep_max_history from anon, authenticated;
grant select on public.one_rep_max_history to authenticated;

create or replace function app_private.audit_one_rep_max_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  lift_name text;
  old_weight numeric;
  new_weight numeric;
  actor uuid := auth.uid();
  source_name text;
begin
  source_name := case
    when actor is null then 'server'
    when actor = new.user_id then 'user'
    else 'admin'
  end;
  for lift_name in select unnest(array['Squat','Bench','Deadlift','Press']) loop
    new_weight := case lift_name
      when 'Squat' then new.squat when 'Bench' then new.bench
      when 'Deadlift' then new.deadlift when 'Press' then new.press end;
    old_weight := null;
    if tg_op = 'UPDATE' then
      old_weight := case lift_name
        when 'Squat' then old.squat when 'Bench' then old.bench
        when 'Deadlift' then old.deadlift when 'Press' then old.press end;
    end if;
    if old_weight is distinct from new_weight then
      insert into public.one_rep_max_history (
        user_id,lift,old_value,new_value,changed_by,change_source
      ) values (new.user_id,lift_name,old_weight,new_weight,actor,source_name);
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function app_private.audit_one_rep_max_change() from public, anon, authenticated;
create trigger one_rep_max_change_audit
after insert or update of squat,bench,deadlift,press
on public.one_rep_maxes
for each row execute function app_private.audit_one_rep_max_change();

-- The initial snapshot is labelled baseline, not misrepresented as a past edit.
insert into public.one_rep_max_history(
  user_id,lift,old_value,new_value,changed_by,change_source,recorded_at)
select m.user_id,v.lift,null,v.value,null,'baseline',now()
from public.one_rep_maxes m
cross join lateral (values
  ('Squat',m.squat),('Bench',m.bench),
  ('Deadlift',m.deadlift),('Press',m.press)
) as v(lift,value)
where v.value is not null;
