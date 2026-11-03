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

-- Preserve older single-side Arm/Thigh values by treating them as both sides
-- until a newer left/right measurement is recorded.
update public.body_measurements
set
  left_arm=coalesce(left_arm,arm),
  right_arm=coalesce(right_arm,arm),
  left_thigh=coalesce(left_thigh,thigh),
  right_thigh=coalesce(right_thigh,thigh)
where arm is not null or thigh is not null;

notify pgrst, 'reload schema';
