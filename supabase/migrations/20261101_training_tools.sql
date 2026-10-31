-- WorkoutBoard training tools
-- Goals, body measurements, and reusable workout templates.

create table if not exists public.training_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  goal_type text not null default 'Strength',
  target_value numeric,
  unit text,
  target_date date,
  status text not null default 'active' check (status in ('active','completed','archived')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  bodyweight numeric,
  waist numeric,
  chest numeric,
  arm numeric,
  thigh numeric,
  body_fat numeric,
  note text,
  created_at timestamptz not null default now(),
  unique(user_id, measured_on)
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  workout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_goals_user_status on public.training_goals(user_id,status,updated_at desc);
create index if not exists body_measurements_user_date on public.body_measurements(user_id,measured_on desc);
create index if not exists workout_templates_user_updated on public.workout_templates(user_id,updated_at desc);

alter table public.training_goals enable row level security;
alter table public.body_measurements enable row level security;
alter table public.workout_templates enable row level security;

grant select,insert,update,delete on public.training_goals to authenticated;
grant select,insert,update,delete on public.body_measurements to authenticated;
grant select,insert,update,delete on public.workout_templates to authenticated;

drop policy if exists "training_goals_own_all" on public.training_goals;
create policy "training_goals_own_all" on public.training_goals
for all to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

drop policy if exists "body_measurements_own_all" on public.body_measurements;
create policy "body_measurements_own_all" on public.body_measurements
for all to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

drop policy if exists "workout_templates_own_all" on public.workout_templates;
create policy "workout_templates_own_all" on public.workout_templates
for all to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

NOTIFY pgrst, 'reload schema';
