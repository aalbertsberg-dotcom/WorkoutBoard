-- WorkoutBoard advanced suite
-- Self-contained prerequisites for the advanced suite.
-- Safe to rerun because these use IF NOT EXISTS / idempotent policy recreation.

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

alter table public.training_goals enable row level security;
alter table public.body_measurements enable row level security;
alter table public.workout_templates enable row level security;

grant select,insert,update,delete on public.training_goals to authenticated;
grant select,insert,update,delete on public.body_measurements to authenticated;
grant select,insert,update,delete on public.workout_templates to authenticated;

drop policy if exists "training_goals_own_all" on public.training_goals;
create policy "training_goals_own_all" on public.training_goals for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "body_measurements_own_all" on public.body_measurements;
create policy "body_measurements_own_all" on public.body_measurements for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "workout_templates_own_all" on public.workout_templates;
create policy "workout_templates_own_all" on public.workout_templates for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create table if not exists public.whiteboard_drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Main Board',
  drawing jsonb not null default '{"version":1,"strokes":[],"grid":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whiteboard_drawings enable row level security;
grant select,insert,update,delete on public.whiteboard_drawings to authenticated;

drop policy if exists "whiteboard_drawings_own_all" on public.whiteboard_drawings;
create policy "whiteboard_drawings_own_all" on public.whiteboard_drawings for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

alter table public.whiteboard_drawings drop constraint if exists whiteboard_drawings_user_id_key;
create unique index if not exists whiteboard_drawings_user_title_unique on public.whiteboard_drawings(user_id,title);

-- Adds equipment profiles, substitutions, timer presets, progress photos,
-- share codes, program versions, workout edit audit, and admin analytics.

create table if not exists public.equipment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  equipment text[] not null default '{}',
  plates numeric[] not null default array[45,35,25,10,5,2.5]::numeric[],
  notes text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null,
  substitute text not null,
  reason text,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,exercise,substitute)
);

create table if not exists public.exercise_timer_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null,
  seconds integer not null check (seconds between 15 and 1800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,exercise)
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null default current_date,
  storage_path text not null,
  bodyweight numeric,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_library_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  share_code text not null unique,
  item_type text not null check (item_type in ('workout','program','template')),
  title text not null,
  payload jsonb not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.program_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_key text not null,
  version_number integer not null,
  title text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,program_key,version_number)
);

alter table public.user_program_tracking
  add column if not exists program_version_id uuid references public.program_versions(id) on delete set null;

create table if not exists public.workout_edit_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  before_workout jsonb,
  after_workout jsonb,
  before_total_volume numeric,
  after_total_volume numeric,
  before_estimated_1rm numeric,
  after_estimated_1rm numeric,
  edited_at timestamptz not null default now()
);

create index if not exists equipment_profiles_user on public.equipment_profiles(user_id,is_active desc);
create index if not exists substitutions_user_exercise on public.exercise_substitutions(user_id,exercise);
create index if not exists timer_presets_user_exercise on public.exercise_timer_presets(user_id,exercise);
create index if not exists progress_photos_user_date on public.progress_photos(user_id,taken_on desc);
create index if not exists shared_library_code on public.shared_library_items(share_code);
create index if not exists program_versions_user_key on public.program_versions(user_id,program_key,version_number desc);
create index if not exists workout_edit_audit_session on public.workout_edit_audit(user_id,session_id,edited_at desc);

alter table public.equipment_profiles enable row level security;
alter table public.exercise_substitutions enable row level security;
alter table public.exercise_timer_presets enable row level security;
alter table public.progress_photos enable row level security;
alter table public.shared_library_items enable row level security;
alter table public.program_versions enable row level security;
alter table public.workout_edit_audit enable row level security;

grant select,insert,update,delete on public.equipment_profiles to authenticated;
grant select,insert,update,delete on public.exercise_substitutions to authenticated;
grant select,insert,update,delete on public.exercise_timer_presets to authenticated;
grant select,insert,update,delete on public.progress_photos to authenticated;
grant select,insert,update,delete on public.shared_library_items to authenticated;
grant select,insert,update,delete on public.program_versions to authenticated;
grant select,insert on public.workout_edit_audit to authenticated;

drop policy if exists "equipment_profiles_own_all" on public.equipment_profiles;
create policy "equipment_profiles_own_all" on public.equipment_profiles
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "exercise_substitutions_own_all" on public.exercise_substitutions;
create policy "exercise_substitutions_own_all" on public.exercise_substitutions
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "exercise_timer_presets_own_all" on public.exercise_timer_presets;
create policy "exercise_timer_presets_own_all" on public.exercise_timer_presets
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "progress_photos_own_all" on public.progress_photos;
create policy "progress_photos_own_all" on public.progress_photos
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "shared_library_owner_write" on public.shared_library_items;
create policy "shared_library_owner_write" on public.shared_library_items
for all to authenticated
using (owner_user_id=auth.uid())
with check (owner_user_id=auth.uid());

drop policy if exists "shared_library_authenticated_read" on public.shared_library_items;
create policy "shared_library_authenticated_read" on public.shared_library_items
for select to authenticated
using (
  active
  and (expires_at is null or expires_at > now())
);

drop policy if exists "program_versions_own_all" on public.program_versions;
create policy "program_versions_own_all" on public.program_versions
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "workout_edit_audit_own_select" on public.workout_edit_audit;
create policy "workout_edit_audit_own_select" on public.workout_edit_audit
for select to authenticated using (user_id=auth.uid() or public.is_workout_admin());

drop policy if exists "workout_edit_audit_own_insert" on public.workout_edit_audit;
create policy "workout_edit_audit_own_insert" on public.workout_edit_audit
for insert to authenticated with check (user_id=auth.uid() or public.is_workout_admin());

-- Private progress photo bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'workoutboard-progress',
  'workoutboard-progress',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

drop policy if exists "workoutboard_progress_select" on storage.objects;
create policy "workoutboard_progress_select"
on storage.objects for select to authenticated
using (
  bucket_id='workoutboard-progress'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "workoutboard_progress_insert" on storage.objects;
create policy "workoutboard_progress_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id='workoutboard-progress'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "workoutboard_progress_update" on storage.objects;
create policy "workoutboard_progress_update"
on storage.objects for update to authenticated
using (
  bucket_id='workoutboard-progress'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check (
  bucket_id='workoutboard-progress'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "workoutboard_progress_delete" on storage.objects;
create policy "workoutboard_progress_delete"
on storage.objects for delete to authenticated
using (
  bucket_id='workoutboard-progress'
  and (storage.foldername(name))[1]=auth.uid()::text
);

create or replace function public.update_my_training_session(
  target_session uuid,
  new_title text,
  new_workout jsonb,
  new_total_volume numeric,
  new_estimated_1rm numeric,
  new_bodyweight numeric
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  owner_id uuid;
  old_workout jsonb;
  old_volume numeric;
  old_e1rm numeric;
  legacy_id uuid;
begin
  select user_id,workout,total_volume,estimated_1rm,legacy_log_id
  into owner_id,old_workout,old_volume,old_e1rm,legacy_id
  from public.training_sessions
  where id=target_session;

  if owner_id is null then
    raise exception 'Training session not found';
  end if;

  if owner_id<>auth.uid() and not public.is_workout_admin() then
    raise exception 'Not allowed';
  end if;

  insert into public.workout_edit_audit(
    user_id,session_id,before_workout,after_workout,before_total_volume,after_total_volume,before_estimated_1rm,after_estimated_1rm
  ) values (
    owner_id,target_session,old_workout,new_workout,old_volume,new_total_volume,old_e1rm,new_estimated_1rm
  );

  update public.training_sessions
  set title=coalesce(nullif(trim(new_title),''),title),
      workout=new_workout,
      total_volume=greatest(coalesce(new_total_volume,0),0),
      estimated_1rm=greatest(coalesce(new_estimated_1rm,0),0),
      bodyweight=new_bodyweight,
      updated_at=now()
  where id=target_session;

  if legacy_id is not null then
    update public.workout_logs
    set workout=new_workout,
        updated_at=now()
    where id=legacy_id
      and user_id=owner_id;
  end if;
end;
$$;

grant execute on function public.update_my_training_session(uuid,text,jsonb,numeric,numeric,numeric) to authenticated;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  result jsonb;
begin
  if not public.is_workout_admin() then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'users',(select count(*) from auth.users),
    'active_this_week',(select count(distinct user_id) from public.training_sessions where completed_at>=date_trunc('week',now())),
    'workouts_this_month',(select count(*) from public.training_sessions where completed_at>=date_trunc('month',now())),
    'volume_this_month',(select coalesce(sum(total_volume),0) from public.training_sessions where completed_at>=date_trunc('month',now())),
    'inactive_30_days',(
      select count(*) from auth.users u
      where greatest(
        coalesce(u.last_sign_in_at,'epoch'::timestamptz),
        coalesce((select max(ts.completed_at) from public.training_sessions ts where ts.user_id=u.id),'epoch'::timestamptz)
      ) < now()-interval '30 days'
    ),
    'never_signed_in',(select count(*) from auth.users where last_sign_in_at is null)
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_user_overview_v2()
returns table (
  user_id uuid,
  email text,
  display_name text,
  active_program text,
  current_week integer,
  workout_count bigint,
  workouts_this_month bigint,
  last_workout timestamptz,
  total_volume numeric,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public,auth
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
    count(ts.id)::bigint,
    count(ts.id) filter (where ts.completed_at>=date_trunc('month',now()))::bigint,
    max(ts.completed_at),
    coalesce(sum(ts.total_volume),0)::numeric,
    u.last_sign_in_at,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id=u.id
  left join public.training_sessions ts on ts.user_id=u.id and ts.completed_at is not null
  group by u.id,u.email,p.display_name,p.active_program,p.current_week,u.last_sign_in_at,u.created_at
  order by greatest(coalesce(max(ts.completed_at),'epoch'::timestamptz),coalesce(u.last_sign_in_at,'epoch'::timestamptz),u.created_at) desc;
end;
$$;

grant execute on function public.admin_user_overview_v2() to authenticated;

NOTIFY pgrst,'reload schema';
