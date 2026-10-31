-- WorkoutBoard Whiteboard
-- Run once in Supabase SQL Editor.

create table if not exists public.whiteboard_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text not null default '',
  kind text not null default 'General'
    check (kind in ('General','Workout Idea','Cue','Goal / PR')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whiteboard_notes_user_updated
on public.whiteboard_notes(user_id, pinned desc, updated_at desc);

alter table public.whiteboard_notes enable row level security;

grant select, insert, update, delete
on public.whiteboard_notes
to authenticated;

drop policy if exists "whiteboard_own_select" on public.whiteboard_notes;
create policy "whiteboard_own_select"
on public.whiteboard_notes for select to authenticated
using (user_id = auth.uid());

drop policy if exists "whiteboard_own_insert" on public.whiteboard_notes;
create policy "whiteboard_own_insert"
on public.whiteboard_notes for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "whiteboard_own_update" on public.whiteboard_notes;
create policy "whiteboard_own_update"
on public.whiteboard_notes for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "whiteboard_own_delete" on public.whiteboard_notes;
create policy "whiteboard_own_delete"
on public.whiteboard_notes for delete to authenticated
using (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
