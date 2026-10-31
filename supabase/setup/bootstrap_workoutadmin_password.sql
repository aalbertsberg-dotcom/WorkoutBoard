-- ONE-TIME BOOTSTRAP FOR WORKOUTADMIN
-- Before running: replace CHANGE-ME-TO-A-TEMP-PASSWORD with a password you choose.
-- This keeps the same auth user ID, profile, admin role, and all workout data.

do $$
declare
  target_id uuid;
  target_count integer;
  new_password text := 'CHANGE-ME-TO-A-TEMP-PASSWORD';
begin
  select count(*)
    into target_count
  from auth.users
  where raw_user_meta_data ->> 'display_name' = 'WorkoutAdmin';

  if target_count <> 1 then
    raise exception 'Expected exactly one WorkoutAdmin account, found %', target_count;
  end if;

  select id
    into target_id
  from auth.users
  where raw_user_meta_data ->> 'display_name' = 'WorkoutAdmin'
  limit 1;

  if new_password = 'CHANGE-ME-TO-A-TEMP-PASSWORD' or length(new_password) < 10 then
    raise exception 'Edit new_password first and use at least 10 characters';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = target_id;
end
$$;

select
  u.email,
  u.raw_user_meta_data ->> 'display_name' as display_name
from auth.users u
where u.raw_user_meta_data ->> 'display_name' = 'WorkoutAdmin';
