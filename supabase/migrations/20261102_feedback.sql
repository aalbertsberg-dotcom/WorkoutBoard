-- WorkoutBoard feedback inbox
create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  display_name text,
  category text not null default 'idea' check (category in ('bug','confusing','idea','other')),
  message text not null check (char_length(message) between 1 and 5000),
  page text,
  user_agent text,
  status text not null default 'new' check (status in ('new','read','resolved')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);

create index if not exists feedback_submissions_created_idx
  on public.feedback_submissions(created_at desc);
create index if not exists feedback_submissions_status_idx
  on public.feedback_submissions(status,created_at desc);

alter table public.feedback_submissions enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback_submissions;
create policy "feedback_insert_own"
on public.feedback_submissions for insert to authenticated
with check (user_id=auth.uid());

drop policy if exists "feedback_select_own" on public.feedback_submissions;
create policy "feedback_select_own"
on public.feedback_submissions for select to authenticated
using (user_id=auth.uid());

drop policy if exists "feedback_admin_all" on public.feedback_submissions;
create policy "feedback_admin_all"
on public.feedback_submissions for all to authenticated
using (public.is_workout_admin())
with check (public.is_workout_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='feedback_submissions'
  ) then
    alter publication supabase_realtime add table public.feedback_submissions;
  end if;
end $$;


-- Promote Andy's normal WorkoutBoard account to admin.
-- Keeps the separate WorkoutAdmin account as a fallback.
do $$
declare
  target_id uuid;
  target_count integer;
begin
  select count(*)
    into target_count
  from auth.users
  where lower(email)=lower('a.aalbertsberg@gmail.com');

  if target_count <> 1 then
    raise exception 'Expected exactly one Andy account for a.aalbertsberg@gmail.com, found %', target_count;
  end if;

  select id
    into target_id
  from auth.users
  where lower(email)=lower('a.aalbertsberg@gmail.com')
  limit 1;

  insert into public.admin_users (user_id, username)
  values (target_id, 'Andy')
  on conflict (user_id)
  do update set username=excluded.username;
end
$$;
