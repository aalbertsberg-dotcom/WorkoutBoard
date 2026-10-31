-- WorkoutBoard platform foundation
-- Flexible planning, durable sessions, program submissions, and opt-in community.
-- Existing workout_logs are preserved and copied into training_sessions.

alter table public.profiles
  add column if not exists community_opt_in boolean not null default false;

alter table public.profiles
  add column if not exists community_display_name text;

alter table public.profiles
  add column if not exists community_share_bodyweight boolean not null default false;

create table if not exists public.program_library (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  slug text unique,
  name text not null,
  description text,
  source_type text not null default 'manual'
    check (source_type in ('system','manual','url')),
  source_url text,
  visibility text not null default 'private'
    check (visibility in ('private','community','system')),
  status text not null default 'draft'
    check (status in ('draft','active','archived','pending_import')),
  weeks_count integer,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  title text not null,
  source_program_id uuid references public.program_library(id) on delete set null,
  source_program_name text,
  source_week integer,
  source_day text,
  workout jsonb not null default '{}'::jsonb,
  status text not null default 'planned'
    check (status in ('planned','started','completed','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planned_workouts_user_date_idx
  on public.planned_workouts(user_id, scheduled_date);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  legacy_log_id uuid unique references public.workout_logs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  shared_session_id uuid references public.shared_sessions(id) on delete set null,
  title text not null,
  program text,
  source_program_id uuid references public.program_library(id) on delete set null,
  week integer,
  primary_lift text,
  session_date date not null default current_date,
  workout jsonb not null default '{}'::jsonb,
  total_volume numeric not null default 0,
  estimated_1rm numeric,
  bodyweight numeric,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_sessions_user_date_idx
  on public.training_sessions(user_id, session_date desc);

create table if not exists public.community_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_session_id uuid unique references public.training_sessions(id) on delete cascade,
  display_name text not null,
  activity_date date not null default current_date,
  title text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists community_activity_created_idx
  on public.community_activity(created_at desc);

alter table public.program_library enable row level security;
alter table public.planned_workouts enable row level security;
alter table public.training_sessions enable row level security;
alter table public.community_activity enable row level security;

grant select, insert, update, delete on public.program_library to authenticated;
grant select, insert, update, delete on public.planned_workouts to authenticated;
grant select, insert, update, delete on public.training_sessions to authenticated;
grant select, insert, update, delete on public.community_activity to authenticated;

drop policy if exists "program_library_select" on public.program_library;
create policy "program_library_select"
on public.program_library for select to authenticated
using (
  visibility in ('system','community')
  or owner_user_id = auth.uid()
);

drop policy if exists "program_library_insert" on public.program_library;
create policy "program_library_insert"
on public.program_library for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "program_library_update" on public.program_library;
create policy "program_library_update"
on public.program_library for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "program_library_delete" on public.program_library;
create policy "program_library_delete"
on public.program_library for delete to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "planned_workouts_own" on public.planned_workouts;
create policy "planned_workouts_own"
on public.planned_workouts for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "training_sessions_own" on public.training_sessions;
create policy "training_sessions_own"
on public.training_sessions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "community_activity_read" on public.community_activity;
create policy "community_activity_read"
on public.community_activity for select to authenticated
using (true);

drop policy if exists "community_activity_insert" on public.community_activity;
create policy "community_activity_insert"
on public.community_activity for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and community_opt_in = true
  )
);

drop policy if exists "community_activity_update" on public.community_activity;
create policy "community_activity_update"
on public.community_activity for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "community_activity_delete" on public.community_activity;
create policy "community_activity_delete"
on public.community_activity for delete to authenticated
using (user_id = auth.uid());

insert into public.program_library
  (slug, name, description, source_type, visibility, status, weeks_count, plan)
values
  ('andy-hybrid-12','12 Week Andy Hybrid','Strength-first hybrid program built from Andy workout history.','system','system','active',12,'{"builtin_id":"andy-hybrid-12"}'::jsonb),
  ('powerbuilding-8','8 Week Powerbuilding','Higher-volume powerbuilding block.','system','system','active',8,'{"builtin_id":"powerbuilding-8"}'::jsonb),
  ('strength-power-6','6 Week Strength + Power','Strength, speed, power, and short conditioning.','system','system','active',6,'{"builtin_id":"strength-power-6"}'::jsonb),
  ('reset-4','4 Week Reset','Simple re-entry and rebuild block.','system','system','active',4,'{"builtin_id":"reset-4"}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  weeks_count = excluded.weeks_count,
  updated_at = now();

insert into public.training_sessions
  (
    legacy_log_id,
    user_id,
    title,
    program,
    week,
    primary_lift,
    session_date,
    workout,
    bodyweight,
    completed_at,
    created_at,
    updated_at
  )
select
  wl.id,
  wl.user_id,
  wl.lift || ' Day',
  wl.program,
  wl.week,
  wl.lift,
  wl.workout_date,
  wl.workout,
  nullif(wl.workout ->> 'bodyweight','')::numeric,
  wl.completed_at,
  wl.created_at,
  wl.updated_at
from public.workout_logs wl
where wl.completed_at is not null
on conflict (legacy_log_id) do nothing;
