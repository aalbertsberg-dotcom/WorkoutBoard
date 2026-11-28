-- Per-account exercise history links. Original names stay on each workout.
-- No fuzzy or machine-brand matching: only user-confirmed aliases are stored.
create table if not exists public.exercise_name_aliases (
  user_id uuid not null references auth.users(id) on delete cascade,
  alias_key text not null check (char_length(alias_key) between 2 and 160),
  alias_name text not null check (char_length(alias_name) between 2 and 160),
  canonical_name text not null check (char_length(canonical_name) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, alias_key),
  check (alias_name <> canonical_name)
);
create index if not exists exercise_name_aliases_user_idx on public.exercise_name_aliases(user_id);
alter table public.exercise_name_aliases enable row level security;
revoke all on public.exercise_name_aliases from public,anon,authenticated;
grant select,insert,update,delete on public.exercise_name_aliases to authenticated;

create policy "exercise_aliases_owner_select" on public.exercise_name_aliases
  for select to authenticated using(user_id=(select auth.uid()));
create policy "exercise_aliases_owner_insert" on public.exercise_name_aliases
  for insert to authenticated with check(user_id=(select auth.uid()));
create policy "exercise_aliases_owner_update" on public.exercise_name_aliases
  for update to authenticated using(user_id=(select auth.uid()))
    with check(user_id=(select auth.uid()));
create policy "exercise_aliases_owner_delete" on public.exercise_name_aliases
  for delete to authenticated using(user_id=(select auth.uid()));
notify pgrst,'reload schema';
