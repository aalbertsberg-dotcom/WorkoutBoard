-- WorkoutBoard drawable whiteboard
-- Run once in Supabase SQL Editor.

create table if not exists public.whiteboard_drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null default 'Main Board',
  drawing jsonb not null default '{"version":1,"strokes":[],"grid":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whiteboard_drawings enable row level security;

grant select, insert, update, delete
on public.whiteboard_drawings
to authenticated;

drop policy if exists "whiteboard_drawings_own_all" on public.whiteboard_drawings;
create policy "whiteboard_drawings_own_all"
on public.whiteboard_drawings
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
