-- One-time promotion for Andy's normal WorkoutBoard account.
-- Safe to run more than once. The separate WorkoutAdmin account remains unchanged.

do $$
declare
  target_id uuid;
  target_count integer;
begin
  select count(*), max(id)
    into target_count, target_id
  from auth.users
  where lower(email)=lower('a.aalbertsberg@gmail.com');

  if target_count <> 1 then
    raise exception 'Expected exactly one Andy account for a.aalbertsberg@gmail.com, found %', target_count;
  end if;

  insert into public.admin_users (user_id, username)
  values (target_id, 'Andy')
  on conflict (user_id)
  do update set username=excluded.username;
end
$$;

select
  au.username,
  u.email,
  p.display_name
from public.admin_users au
join auth.users u on u.id=au.user_id
left join public.profiles p on p.id=au.user_id
where lower(u.email)=lower('a.aalbertsberg@gmail.com');
