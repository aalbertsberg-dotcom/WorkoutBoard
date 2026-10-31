-- Unified program tracking for WorkoutBoard.
-- Run after 20261101_product_upgrades.sql.

create table if not exists public.user_program_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_key text not null,
  program_name text not null,
  program_kind text not null check (program_kind in ('classic','archive','custom')),
  run_number integer not null default 1,
  status text not null default 'tracking' check (status in ('tracking','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_program_tracking_one_active
on public.user_program_tracking(user_id, program_key)
where status = 'tracking';

create index if not exists user_program_tracking_user_status
on public.user_program_tracking(user_id, status, updated_at desc);

alter table public.user_program_tracking enable row level security;

grant select, insert, update, delete on public.user_program_tracking to authenticated;

drop policy if exists "program_tracking_own_select" on public.user_program_tracking;
create policy "program_tracking_own_select"
on public.user_program_tracking for select to authenticated
using (user_id = auth.uid() or public.is_workout_admin());

drop policy if exists "program_tracking_own_insert" on public.user_program_tracking;
create policy "program_tracking_own_insert"
on public.user_program_tracking for insert to authenticated
with check (user_id = auth.uid() or public.is_workout_admin());

drop policy if exists "program_tracking_own_update" on public.user_program_tracking;
create policy "program_tracking_own_update"
on public.user_program_tracking for update to authenticated
using (user_id = auth.uid() or public.is_workout_admin())
with check (user_id = auth.uid() or public.is_workout_admin());

drop policy if exists "program_tracking_own_delete" on public.user_program_tracking;
create policy "program_tracking_own_delete"
on public.user_program_tracking for delete to authenticated
using (user_id = auth.uid() or public.is_workout_admin());

create or replace function public.start_program_tracking(
  target_program_key text,
  target_program_name text,
  target_program_kind text
)
returns public.user_program_tracking
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_row public.user_program_tracking;
  next_run integer;
  created_row public.user_program_tracking;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into existing_row
  from public.user_program_tracking
  where user_id = auth.uid()
    and program_key = target_program_key
    and status = 'tracking'
  limit 1;

  if found then
    return existing_row;
  end if;

  select coalesce(max(run_number),0) + 1
    into next_run
  from public.user_program_tracking
  where user_id = auth.uid()
    and program_key = target_program_key;

  insert into public.user_program_tracking(
    user_id, program_key, program_name, program_kind, run_number, status
  )
  values(
    auth.uid(), target_program_key, target_program_name, target_program_kind, next_run, 'tracking'
  )
  returning * into created_row;

  return created_row;
end;
$$;

grant execute on function public.start_program_tracking(text,text,text) to authenticated;

create or replace function public.complete_program_tracking(target_tracking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_program_tracking
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = target_tracking_id
    and user_id = auth.uid()
    and status = 'tracking';

  if not found then
    raise exception 'Active tracked program not found';
  end if;
end;
$$;

grant execute on function public.complete_program_tracking(uuid) to authenticated;


-- Refresh Supabase/PostgREST schema cache after creating the table/functions.
NOTIFY pgrst, 'reload schema';
