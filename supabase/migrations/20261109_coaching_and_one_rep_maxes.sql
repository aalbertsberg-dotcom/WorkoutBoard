-- WorkoutBoard coaching foundation + true 1RM storage.
-- Keeps legacy training_maxes as derived 85% values for backward compatibility.

create table if not exists public.one_rep_maxes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  squat numeric,
  bench numeric,
  deadlift numeric,
  press numeric,
  updated_at timestamptz not null default now()
);

alter table public.one_rep_maxes enable row level security;
grant select, insert, update, delete on public.one_rep_maxes to authenticated;

drop policy if exists "one_rep_maxes_own_rows" on public.one_rep_maxes;
create policy "one_rep_maxes_own_rows"
on public.one_rep_maxes for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "one_rep_maxes_admin_all" on public.one_rep_maxes;
create policy "one_rep_maxes_admin_all"
on public.one_rep_maxes for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

-- Prefer exact 1RMs already stored in user metadata. Otherwise convert the
-- historical 85% training-max table back to an estimated true 1RM.
insert into public.one_rep_maxes(user_id,squat,bench,deadlift,press,updated_at)
select
  tm.user_id,
  case when (u.raw_user_meta_data->'one_rep_maxes'->>'Squat') ~ '^[0-9]+([.][0-9]+)?$'
    then (u.raw_user_meta_data->'one_rep_maxes'->>'Squat')::numeric
    else round(tm.squat / 0.85,2) end,
  case when (u.raw_user_meta_data->'one_rep_maxes'->>'Bench') ~ '^[0-9]+([.][0-9]+)?$'
    then (u.raw_user_meta_data->'one_rep_maxes'->>'Bench')::numeric
    else round(tm.bench / 0.85,2) end,
  case when (u.raw_user_meta_data->'one_rep_maxes'->>'Deadlift') ~ '^[0-9]+([.][0-9]+)?$'
    then (u.raw_user_meta_data->'one_rep_maxes'->>'Deadlift')::numeric
    else round(tm.deadlift / 0.85,2) end,
  case when (u.raw_user_meta_data->'one_rep_maxes'->>'Press') ~ '^[0-9]+([.][0-9]+)?$'
    then (u.raw_user_meta_data->'one_rep_maxes'->>'Press')::numeric
    else round(tm.press / 0.85,2) end,
  now()
from public.training_maxes tm
join auth.users u on u.id=tm.user_id
on conflict (user_id) do nothing;

create or replace function public.admin_set_one_rep_maxes(
  target_user uuid,
  new_squat numeric default null,
  new_bench numeric default null,
  new_deadlift numeric default null,
  new_press numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workout_admin() then
    raise exception 'Admin access required';
  end if;

  insert into public.one_rep_maxes(user_id,squat,bench,deadlift,press,updated_at)
  values(target_user,new_squat,new_bench,new_deadlift,new_press,now())
  on conflict (user_id) do update set
    squat=excluded.squat,
    bench=excluded.bench,
    deadlift=excluded.deadlift,
    press=excluded.press,
    updated_at=now();

  insert into public.training_maxes(user_id,squat,bench,deadlift,press,updated_at)
  values(
    target_user,
    case when new_squat is null then null else round(new_squat*0.85,2) end,
    case when new_bench is null then null else round(new_bench*0.85,2) end,
    case when new_deadlift is null then null else round(new_deadlift*0.85,2) end,
    case when new_press is null then null else round(new_press*0.85,2) end,
    now()
  )
  on conflict (user_id) do update set
    squat=excluded.squat,
    bench=excluded.bench,
    deadlift=excluded.deadlift,
    press=excluded.press,
    updated_at=now();
end;
$$;

grant execute on function public.admin_set_one_rep_maxes(uuid,numeric,numeric,numeric,numeric) to authenticated;

create or replace function public.admin_reset_training(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workout_admin() then
    raise exception 'Admin access required';
  end if;

  delete from public.community_activity where user_id = target_user;
  delete from public.session_results where user_id = target_user;
  delete from public.training_sessions where user_id = target_user;
  delete from public.workout_logs where user_id = target_user;
  delete from public.planned_workouts where user_id = target_user;

  update public.one_rep_maxes
  set squat=null,bench=null,deadlift=null,press=null,updated_at=now()
  where user_id=target_user;

  update public.training_maxes
  set squat=null,bench=null,deadlift=null,press=null,updated_at=now()
  where user_id=target_user;

  update public.profiles
  set current_week=1,updated_at=now()
  where id=target_user;
end;
$$;

grant execute on function public.admin_reset_training(uuid) to authenticated;

create or replace function public.admin_update_user_profile(
  target_user uuid,
  new_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workout_admin() then
    raise exception 'Admin access required';
  end if;

  update public.profiles
  set display_name=coalesce(nullif(trim(new_display_name),''),display_name),
      updated_at=now()
  where id=target_user;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

grant execute on function public.admin_update_user_profile(uuid,text) to authenticated;

-- Session members may see only the four training numbers of people who
-- voluntarily joined the same workout. This supports side-by-side target weights.
create or replace function public.shared_session_one_rep_maxes(target_session uuid)
returns table (
  user_id uuid,
  display_name text,
  squat numeric,
  bench numeric,
  deadlift numeric,
  press numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_shared_session_member(target_session) or public.is_workout_admin()) then
    raise exception 'Shared session membership required';
  end if;

  return query
  select
    sp.user_id,
    sp.display_name,
    orm.squat,
    orm.bench,
    orm.deadlift,
    orm.press
  from public.session_participants sp
  left join public.one_rep_maxes orm on orm.user_id=sp.user_id
  where sp.session_id=target_session
  order by sp.joined_at;
end;
$$;

grant execute on function public.shared_session_one_rep_maxes(uuid) to authenticated;

notify pgrst, 'reload schema';
