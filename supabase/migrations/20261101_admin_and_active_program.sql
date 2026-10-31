-- WorkoutBoard admin + persistent active program
-- Broad admin access is intentional for explicitly granted WorkoutAdmin accounts.

alter table public.profiles
  add column if not exists active_program text not null default 'andy-hybrid-12';

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_workout_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_workout_admin() to authenticated;

drop policy if exists "admin_users_admin_select" on public.admin_users;
create policy "admin_users_admin_select"
on public.admin_users
for select
to authenticated
using (public.is_workout_admin());

-- Admin override policies. Existing own-row policies remain in place for normal users.
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "training_maxes_admin_all" on public.training_maxes;
create policy "training_maxes_admin_all"
on public.training_maxes for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "workout_logs_admin_all" on public.workout_logs;
create policy "workout_logs_admin_all"
on public.workout_logs for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "training_sessions_admin_all" on public.training_sessions;
create policy "training_sessions_admin_all"
on public.training_sessions for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "planned_workouts_admin_all" on public.planned_workouts;
create policy "planned_workouts_admin_all"
on public.planned_workouts for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "program_library_admin_all" on public.program_library;
create policy "program_library_admin_all"
on public.program_library for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "shared_sessions_admin_all" on public.shared_sessions;
create policy "shared_sessions_admin_all"
on public.shared_sessions for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "session_participants_admin_all" on public.session_participants;
create policy "session_participants_admin_all"
on public.session_participants for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "session_results_admin_all" on public.session_results;
create policy "session_results_admin_all"
on public.session_results for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

drop policy if exists "community_activity_admin_all" on public.community_activity;
create policy "community_activity_admin_all"
on public.community_activity for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

create or replace function public.admin_user_overview()
returns table (
  user_id uuid,
  email text,
  display_name text,
  active_program text,
  current_week integer,
  community_opt_in boolean,
  workout_count bigint,
  last_workout timestamptz,
  total_volume numeric
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_workout_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.display_name,
    p.active_program,
    p.current_week,
    p.community_opt_in,
    count(ts.id)::bigint,
    max(ts.completed_at),
    coalesce(sum(ts.total_volume),0)::numeric
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.training_sessions ts
    on ts.user_id = u.id
   and ts.completed_at is not null
  group by
    u.id, u.email, p.display_name, p.active_program, p.current_week, p.community_opt_in
  order by coalesce(max(ts.completed_at), u.created_at) desc;
end;
$$;

grant execute on function public.admin_user_overview() to authenticated;

create or replace function public.admin_set_user_program(
  target_user uuid,
  new_program text,
  new_week integer default 1
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
  set
    active_program = new_program,
    current_week = greatest(1, least(new_week, 12)),
    updated_at = now()
  where id = target_user;
end;
$$;

grant execute on function public.admin_set_user_program(uuid,text,integer) to authenticated;


-- Preserve any program choice that was previously stored in auth metadata.
update public.profiles p
set active_program = u.raw_user_meta_data ->> 'active_program',
    updated_at = now()
from auth.users u
where p.id = u.id
  and (u.raw_user_meta_data ->> 'active_program') in (
    'andy-hybrid-12',
    'powerbuilding-8',
    'strength-power-6',
    'reset-4'
  );
