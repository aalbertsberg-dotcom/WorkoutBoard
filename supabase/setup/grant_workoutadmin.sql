-- One-time WorkoutAdmin promotion.
-- Safety: this only succeeds when exactly ONE auth account has display_name = WorkoutAdmin.

do $$
declare
  admin_ids uuid[];
  admin_id uuid;
begin
  select array_agg(id order by created_at desc)
    into admin_ids
  from auth.users
  where raw_user_meta_data ->> 'display_name' = 'WorkoutAdmin';

  if coalesce(array_length(admin_ids, 1), 0) <> 1 then
    raise exception 'Expected exactly one WorkoutAdmin account, found %',
      coalesce(array_length(admin_ids, 1), 0);
  end if;

  admin_id := admin_ids[1];

  insert into public.admin_users (user_id, username)
  values (admin_id, 'WorkoutAdmin')
  on conflict (user_id)
  do update set username = excluded.username;
end
$$;

select
  au.username,
  u.email,
  p.display_name
from public.admin_users au
join auth.users u on u.id = au.user_id
left join public.profiles p on p.id = au.user_id
where au.username = 'WorkoutAdmin';
