-- WorkSet nutrition + hydration: new additive tables only; no existing workout tables changed.
-- Nutrition belongs to the signed-in user. Soft deletes keep offline upserts idempotent.
create table if not exists public.nutrition_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'calories' check (mode in ('calories','macros')),
  calorie_goal numeric not null default 2000 check (calorie_goal > 0 and calorie_goal <= 20000),
  protein_goal numeric not null default 150 check (protein_goal >= 0 and protein_goal <= 2000),
  carbs_goal numeric not null default 200 check (carbs_goal >= 0 and carbs_goal <= 3000),
  fat_goal numeric not null default 65 check (fat_goal >= 0 and fat_goal <= 2000),
  water_goal_oz numeric not null default 64 check (water_goal_oz > 0 and water_goal_oz <= 1000),
  updated_at timestamptz not null default now()
);
create table if not exists public.nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  brand text not null default '',
  source text not null default 'manual',
  source_id text not null default '',
  barcode text not null default '',
  serving_label text not null default '1 serving',
  serving_grams numeric,
  calories numeric not null default 0 check (calories between 0 and 50000),
  protein_g numeric not null default 0 check (protein_g between 0 and 10000),
  carbs_g numeric not null default 0 check (carbs_g between 0 and 10000),
  fat_g numeric not null default 0 check (fat_g between 0 and 10000),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  is_recipe boolean not null default false,
  is_favorite boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  meal text not null check (meal in ('Breakfast','Lunch','Dinner','Snacks')),
  food_id uuid references public.nutrition_foods(id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  brand text not null default '',
  serving_label text not null default '1 serving',
  quantity numeric not null default 1 check (quantity > 0 and quantity <= 1000),
  calories numeric not null default 0 check (calories between 0 and 500000),
  protein_g numeric not null default 0 check (protein_g between 0 and 100000),
  carbs_g numeric not null default 0 check (carbs_g between 0 and 100000),
  fat_g numeric not null default 0 check (fat_g between 0 and 100000),
  source text not null default 'manual',
  source_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.hydration_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  amount_oz numeric not null check (amount_oz > 0 and amount_oz <= 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists nutrition_entries_user_day_idx on public.nutrition_entries(user_id,entry_date desc);
create index if not exists hydration_entries_user_day_idx on public.hydration_entries(user_id,entry_date desc);
create index if not exists nutrition_foods_user_idx on public.nutrition_foods(user_id,updated_at desc);
alter table public.nutrition_preferences enable row level security;
alter table public.nutrition_foods enable row level security;
alter table public.nutrition_entries enable row level security;
alter table public.hydration_entries enable row level security;
grant select,insert,update,delete on public.nutrition_preferences,public.nutrition_foods,public.nutrition_entries,public.hydration_entries to authenticated;
revoke all on public.nutrition_preferences,public.nutrition_foods,public.nutrition_entries,public.hydration_entries from anon;
drop policy if exists nutrition_preferences_owner on public.nutrition_preferences;
create policy nutrition_preferences_owner on public.nutrition_preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists nutrition_foods_owner on public.nutrition_foods;
create policy nutrition_foods_owner on public.nutrition_foods for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists nutrition_entries_owner on public.nutrition_entries;
create policy nutrition_entries_owner on public.nutrition_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists hydration_entries_owner on public.hydration_entries;
create policy hydration_entries_owner on public.hydration_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';
