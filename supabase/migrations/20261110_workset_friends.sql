-- Workset Friends: saved account-to-account relationships for Together.

create table if not exists public.workset_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  addressee_user_id uuid not null references auth.users(id) on delete cascade,
  requester_display_name text not null,
  addressee_display_name text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint workset_friendships_not_self check (requester_user_id <> addressee_user_id)
);

create unique index if not exists workset_friendships_pair_unique
on public.workset_friendships (
  least(requester_user_id,addressee_user_id),
  greatest(requester_user_id,addressee_user_id)
);

create index if not exists workset_friendships_requester_idx
on public.workset_friendships(requester_user_id,status,created_at desc);

create index if not exists workset_friendships_addressee_idx
on public.workset_friendships(addressee_user_id,status,created_at desc);

alter table public.workset_friendships enable row level security;
revoke all on public.workset_friendships from anon;
revoke insert,update,delete on public.workset_friendships from authenticated;
grant select on public.workset_friendships to authenticated;

drop policy if exists "workset_friendships_select_own" on public.workset_friendships;
create policy "workset_friendships_select_own"
on public.workset_friendships
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    requester_user_id = (select auth.uid())
    or addressee_user_id = (select auth.uid())
  )
);

create or replace function public.request_workset_friend_by_email(target_email text)
returns table(friendship_id uuid, friendship_status text, friend_user_id uuid, friend_display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_user uuid;
  target_name text;
  caller_name text;
  existing public.workset_friendships%rowtype;
  created_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  select u.id, coalesce(nullif(p.display_name,''), split_part(u.email,'@',1))
    into target_user,target_name
  from auth.users u
  left join public.profiles p on p.id=u.id
  where lower(u.email)=lower(trim(target_email))
  limit 1;

  if target_user is null then raise exception 'No Workset account found for that email'; end if;
  if target_user=caller then raise exception 'You cannot add yourself as a friend'; end if;

  select coalesce(nullif(p.display_name,''),split_part(u.email,'@',1))
    into caller_name
  from auth.users u
  left join public.profiles p on p.id=u.id
  where u.id=caller;

  select * into existing
  from public.workset_friendships f
  where (f.requester_user_id=caller and f.addressee_user_id=target_user)
     or (f.requester_user_id=target_user and f.addressee_user_id=caller)
  limit 1;

  if existing.id is not null then
    if existing.status='accepted' then
      return query select existing.id,'accepted'::text,target_user,target_name;
      return;
    end if;

    if existing.status='pending' and existing.requester_user_id=target_user and existing.addressee_user_id=caller then
      update public.workset_friendships
      set status='accepted',responded_at=now()
      where id=existing.id;
      return query select existing.id,'accepted'::text,target_user,target_name;
      return;
    end if;

    update public.workset_friendships
    set requester_user_id=caller,
        addressee_user_id=target_user,
        requester_display_name=coalesce(caller_name,'Workset user'),
        addressee_display_name=coalesce(target_name,'Workset user'),
        status='pending',
        created_at=now(),
        responded_at=null
    where id=existing.id;
    return query select existing.id,'pending'::text,target_user,target_name;
    return;
  end if;

  insert into public.workset_friendships(
    requester_user_id,addressee_user_id,requester_display_name,addressee_display_name
  )
  values(caller,target_user,coalesce(caller_name,'Workset user'),coalesce(target_name,'Workset user'))
  returning id into created_id;

  return query select created_id,'pending'::text,target_user,target_name;
end;
$$;

revoke execute on function public.request_workset_friend_by_email(text) from public;
revoke execute on function public.request_workset_friend_by_email(text) from anon;
grant execute on function public.request_workset_friend_by_email(text) to authenticated;

create or replace function public.respond_workset_friend_request(target_friendship uuid,response text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  row public.workset_friendships%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if response not in ('accepted','declined') then raise exception 'Invalid response'; end if;

  select * into row
  from public.workset_friendships
  where id=target_friendship
    and addressee_user_id=caller
    and status='pending';

  if row.id is null then raise exception 'Friend request not found'; end if;

  update public.workset_friendships
  set status=response,responded_at=now()
  where id=row.id;

  return response;
end;
$$;

revoke execute on function public.respond_workset_friend_request(uuid,text) from public;
revoke execute on function public.respond_workset_friend_request(uuid,text) from anon;
grant execute on function public.respond_workset_friend_request(uuid,text) to authenticated;

create or replace function public.remove_workset_friend(target_friend uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  deleted_count integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  delete from public.workset_friendships
  where status='accepted'
    and (
      (requester_user_id=caller and addressee_user_id=target_friend)
      or
      (requester_user_id=target_friend and addressee_user_id=caller)
    );

  get diagnostics deleted_count = row_count;
  return deleted_count>0;
end;
$$;

revoke execute on function public.remove_workset_friend(uuid) from public;
revoke execute on function public.remove_workset_friend(uuid) from anon;
grant execute on function public.remove_workset_friend(uuid) to authenticated;

create or replace function public.invite_workset_friend_to_session(
  target_session uuid,
  friend_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sender_name text;
  invite_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1 from public.shared_sessions s
    where s.id=target_session
      and s.host_user_id=caller
      and s.status='open'
  ) then
    raise exception 'Only the host can invite friends to an open session';
  end if;

  if not exists (
    select 1 from public.workset_friendships f
    where f.status='accepted'
      and (
        (f.requester_user_id=caller and f.addressee_user_id=friend_user_id)
        or
        (f.requester_user_id=friend_user_id and f.addressee_user_id=caller)
      )
  ) then
    raise exception 'That user is not in your Workset friends';
  end if;

  select coalesce(nullif(p.display_name,''),split_part(u.email,'@',1))
    into sender_name
  from auth.users u
  left join public.profiles p on p.id=u.id
  where u.id=caller;

  insert into public.together_invites(
    session_id,sender_user_id,recipient_user_id,sender_display_name,status,created_at,responded_at
  )
  values(
    target_session,caller,friend_user_id,coalesce(sender_name,'Workset user'),'pending',now(),null
  )
  on conflict(session_id,recipient_user_id)
  do update set
    sender_user_id=excluded.sender_user_id,
    sender_display_name=excluded.sender_display_name,
    status='pending',
    created_at=now(),
    responded_at=null
  returning id into invite_id;

  return invite_id;
end;
$$;

revoke execute on function public.invite_workset_friend_to_session(uuid,uuid) from public;
revoke execute on function public.invite_workset_friend_to_session(uuid,uuid) from anon;
grant execute on function public.invite_workset_friend_to_session(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
