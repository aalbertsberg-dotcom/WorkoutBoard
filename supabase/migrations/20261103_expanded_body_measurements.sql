-- Expand WorkoutBoard body measurements to support full left/right circumference tracking.

alter table public.body_measurements
  add column if not exists left_forearm numeric,
  add column if not exists right_forearm numeric,
  add column if not exists neck numeric,
  add column if not exists left_arm numeric,
  add column if not exists right_arm numeric,
  add column if not exists hips numeric,
  add column if not exists left_thigh numeric,
  add column if not exists right_thigh numeric,
  add column if not exists left_calf numeric,
  add column if not exists right_calf numeric;

-- Existing rows are left unchanged. New measurements can start from a fresh baseline.

notify pgrst, 'reload schema';
