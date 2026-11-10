-- Managed/no-login training partners.
-- Each signed-in user can keep their own partner list and 1RMs.

create table if not exists public.managed_athletes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  squat numeric,
  bench numeric,
  deadlift numeric,
  press numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists managed_athletes_owner
on public.managed_athletes(owner_user_id, updated_at desc);

alter table public.managed_athletes enable row level security;
grant select, insert, update, delete on public.managed_athletes to authenticated;

drop policy if exists "managed_athletes_own_select" on public.managed_athletes;
create policy "managed_athletes_own_select"
on public.managed_athletes for select to authenticated
using (owner_user_id=auth.uid());

drop policy if exists "managed_athletes_own_insert" on public.managed_athletes;
create policy "managed_athletes_own_insert"
on public.managed_athletes for insert to authenticated
with check (owner_user_id=auth.uid());

drop policy if exists "managed_athletes_own_update" on public.managed_athletes;
create policy "managed_athletes_own_update"
on public.managed_athletes for update to authenticated
using (owner_user_id=auth.uid())
with check (owner_user_id=auth.uid());

drop policy if exists "managed_athletes_own_delete" on public.managed_athletes;
create policy "managed_athletes_own_delete"
on public.managed_athletes for delete to authenticated
using (owner_user_id=auth.uid());

notify pgrst, 'reload schema';
