-- WorkoutBoard shared workout sessions
-- Adds join-code sessions, participants, and per-person results.

create table if not exists public.shared_sessions (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  program text not null,
  week integer not null check (week between 1 and 12),
  lift text not null check (lift in ('Squat','Bench','Deadlift','Press')),
  status text not null default 'open' check (status in ('open','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists shared_sessions_join_code_idx
  on public.shared_sessions(join_code);

create table if not exists public.session_participants (
  session_id uuid not null references public.shared_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.session_results (
  session_id uuid not null references public.shared_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout jsonb not null default '{}'::jsonb,
  total_volume numeric not null default 0,
  estimated_1rm numeric,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.shared_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_results enable row level security;

grant select, insert, update, delete on public.shared_sessions to authenticated;
grant select, insert, update, delete on public.session_participants to authenticated;
grant select, insert, update, delete on public.session_results to authenticated;

create or replace function public.is_shared_session_member(target_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_participants
    where session_id = target_session
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_shared_session_host(target_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shared_sessions
    where id = target_session
      and host_user_id = auth.uid()
  );
$$;

grant execute on function public.is_shared_session_member(uuid) to authenticated;
grant execute on function public.is_shared_session_host(uuid) to authenticated;

drop policy if exists "shared_sessions_select" on public.shared_sessions;
create policy "shared_sessions_select"
on public.shared_sessions
for select
to authenticated
using (
  status = 'open'
  or host_user_id = auth.uid()
  or public.is_shared_session_member(id)
);

drop policy if exists "shared_sessions_insert" on public.shared_sessions;
create policy "shared_sessions_insert"
on public.shared_sessions
for insert
to authenticated
with check (host_user_id = auth.uid());

drop policy if exists "shared_sessions_update" on public.shared_sessions;
create policy "shared_sessions_update"
on public.shared_sessions
for update
to authenticated
using (host_user_id = auth.uid())
with check (host_user_id = auth.uid());

drop policy if exists "shared_sessions_delete" on public.shared_sessions;
create policy "shared_sessions_delete"
on public.shared_sessions
for delete
to authenticated
using (host_user_id = auth.uid());

drop policy if exists "session_participants_select" on public.session_participants;
create policy "session_participants_select"
on public.session_participants
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_shared_session_member(session_id)
);

drop policy if exists "session_participants_insert" on public.session_participants;
create policy "session_participants_insert"
on public.session_participants
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.shared_sessions
    where id = session_id
      and status = 'open'
  )
);

drop policy if exists "session_participants_delete" on public.session_participants;
create policy "session_participants_delete"
on public.session_participants
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "session_results_select" on public.session_results;
create policy "session_results_select"
on public.session_results
for select
to authenticated
using (public.is_shared_session_member(session_id));

drop policy if exists "session_results_insert" on public.session_results;
create policy "session_results_insert"
on public.session_results
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_shared_session_member(session_id)
);

drop policy if exists "session_results_update" on public.session_results;
create policy "session_results_update"
on public.session_results
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_shared_session_member(session_id)
)
with check (
  user_id = auth.uid()
  and public.is_shared_session_member(session_id)
);

drop policy if exists "session_results_delete" on public.session_results;
create policy "session_results_delete"
on public.session_results
for delete
to authenticated
using (user_id = auth.uid());
