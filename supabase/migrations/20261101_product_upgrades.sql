-- WorkoutBoard product upgrades
-- Run once after the existing 20261101 migrations.

alter table public.profiles
  add column if not exists favorite_programs text[] not null default '{}'::text[];

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

  update public.training_maxes
  set squat = null,
      bench = null,
      deadlift = null,
      press = null,
      updated_at = now()
  where user_id = target_user;

  update public.profiles
  set current_week = 1,
      updated_at = now()
  where id = target_user;
end;
$$;

grant execute on function public.admin_reset_training(uuid) to authenticated;

create or replace function public.admin_set_training_maxes(
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

  insert into public.training_maxes(user_id,squat,bench,deadlift,press,updated_at)
  values(target_user,new_squat,new_bench,new_deadlift,new_press,now())
  on conflict (user_id) do update set
    squat = excluded.squat,
    bench = excluded.bench,
    deadlift = excluded.deadlift,
    press = excluded.press,
    updated_at = now();
end;
$$;

grant execute on function public.admin_set_training_maxes(uuid,numeric,numeric,numeric,numeric) to authenticated;

create or replace function public.admin_delete_training_session(
  target_user uuid,
  target_session uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_id uuid;
begin
  if not public.is_workout_admin() then
    raise exception 'Admin access required';
  end if;

  select legacy_log_id into legacy_id
  from public.training_sessions
  where id = target_session
    and user_id = target_user;

  delete from public.training_sessions
  where id = target_session
    and user_id = target_user;

  if legacy_id is not null then
    delete from public.workout_logs
    where id = legacy_id
      and user_id = target_user;
  end if;
end;
$$;

grant execute on function public.admin_delete_training_session(uuid,uuid) to authenticated;
