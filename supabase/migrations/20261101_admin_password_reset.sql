-- Admin-managed password recovery for WorkoutBoard.
-- Avoids dependency on Supabase default SMTP for this small private app.

create extension if not exists pgcrypto;

create or replace function public.admin_reset_user_password(
  target_user uuid,
  new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_workout_admin() then
    raise exception 'Admin access required';
  end if;

  if length(new_password) < 10 then
    raise exception 'Password must be at least 10 characters';
  end if;

  update auth.users
  set
    encrypted_password = crypt(new_password, gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = target_user;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.admin_reset_user_password(uuid,text) from public;
grant execute on function public.admin_reset_user_password(uuid,text) to authenticated;
