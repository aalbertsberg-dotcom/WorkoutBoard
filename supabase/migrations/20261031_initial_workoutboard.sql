-- WorkoutBoard initial database schema
-- Separates each user's profile, training maxes, and workout logs.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  current_week integer not null default 1 check (current_week between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_maxes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  squat numeric,
  bench numeric,
  deadlift numeric,
  press numeric,
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program text not null default '12 Week Andy Hybrid',
  week integer not null check (week between 1 and 12),
  lift text not null check (lift in ('Squat','Bench','Deadlift','Press')),
  workout_date date not null default current_date,
  workout jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program, week, lift)
);

alter table public.profiles enable row level security;
alter table public.training_maxes enable row level security;
alter table public.workout_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.training_maxes to authenticated;
grant select, insert, update, delete on public.workout_logs to authenticated;

drop policy if exists "profiles_own_rows" on public.profiles;
create policy "profiles_own_rows"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "training_maxes_own_rows" on public.training_maxes;
create policy "training_maxes_own_rows"
on public.training_maxes
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "workout_logs_own_rows" on public.workout_logs;
create policy "workout_logs_own_rows"
on public.workout_logs
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.training_maxes (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
