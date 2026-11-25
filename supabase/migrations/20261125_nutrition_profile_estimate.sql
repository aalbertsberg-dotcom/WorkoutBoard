-- Additive, per-user nutrition estimation settings. No existing goals are overwritten.
-- Existing owner RLS policy on nutrition_preferences continues to protect all columns.
alter table public.nutrition_preferences
  add column if not exists height_cm numeric check (height_cm between 90 and 260),
  add column if not exists age_years integer check (age_years between 18 and 100),
  add column if not exists sex_for_estimate text check (sex_for_estimate in ('male','female')),
  add column if not exists activity_level text not null default 'light'
    check (activity_level in ('sedentary','light','moderate','very_active')),
  add column if not exists weight_goal text not null default 'maintain'
    check (weight_goal in ('lose','maintain','gain')),
  add column if not exists estimate_weight_lb numeric check (estimate_weight_lb between 45 and 800),
  add column if not exists goal_source text not null default 'manual'
    check (goal_source in ('manual','estimate'));

comment on column public.nutrition_preferences.height_cm is 'Optional height used for adult calorie estimates; user editable.';
comment on column public.nutrition_preferences.age_years is 'User-entered age (years) for optional estimate; not inferred.';
comment on column public.nutrition_preferences.sex_for_estimate is 'User-selected male/female Mifflin-St Jeor formula branch; optional.';
comment on column public.nutrition_preferences.estimate_weight_lb is 'Optional manual fallback when no body measurement is available.';
notify pgrst, 'reload schema';
