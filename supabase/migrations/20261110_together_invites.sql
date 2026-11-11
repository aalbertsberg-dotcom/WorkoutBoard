-- Workset Together in-app invitations.
-- Exact-email lookup is performed only inside a host-validated function.

create table if not exists public.together_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.shared_sessions(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  sender_display_name text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(session_id,recipient_user_id)
);

create index if not exists together_invites_recipient_idx
on public.together_invites(recipient_user_id,status,created_at desc);

create index if not exists together_invites_sender_idx
on public.together_invites(sender_user_id,created_at desc);

alter table public.together_invites enable row level security;
revoke all on public.together_invites from anon;
revoke insert,update,delete on public.together_invites from authenticated;
grant select on public.together_invites to authenticated;

drop policy if exists "together_invites_select_own" on public.together_invites;
create policy "together_invites_select_own"
on public.together_invites for select
to authenticated
using (
  (select auth.uid()) is not null
  and ((select auth.uid()) = recipient_user_id or (select auth.uid()) = sender_user_id)
);

create or replace function public.invite_workset_user_by_email(
  target_session uuid,
  target_email text
)
returns table(invite_id uuid, recipient_display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  recipient uuid;
  recipient_name text;
  sender_name text;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1 from public.shared_sessions s
    where s.id = target_session
      and s.host_user_id = caller
      and s.status = 'open'
  ) then
    raise exception 'Only the host can invite users to an open session';
  end if;

  select u.id, coalesce(nullif(p.display_name,''), split_part(u.email,'@',1))
    into recipient, recipient_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(target_email))
  limit 1;

  if recipient is null then raise exception 'No Workset account found for that email'; end if;
  if recipient = caller then raise exception 'You are already the host'; end if;

  select coalesce(nullif(p.display_name,''), split_part(u.email,'@',1))
    into sender_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = caller;

  insert into public.together_invites (
    session_id,sender_user_id,recipient_user_id,sender_display_name,status,created_at,responded_at
  )
  values (
    target_session,caller,recipient,coalesce(sender_name,'Workset user'),'pending',now(),null
  )
  on conflict (session_id,recipient_user_id)
  do update set
    sender_user_id=excluded.sender_user_id,
    sender_display_name=excluded.sender_display_name,
    status='pending',
    created_at=now(),
    responded_at=null
  returning id into invite_id;

  return query select invite_id, recipient_name;
end;
$$;

revoke execute on function public.invite_workset_user_by_email(uuid,text) from public;
revoke execute on function public.invite_workset_user_by_email(uuid,text) from anon;
grant execute on function public.invite_workset_user_by_email(uuid,text) to authenticated;

create or replace function public.respond_to_together_invite(
  target_invite uuid,
  response text
)
returns table(session_id uuid, join_code text, invite_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  inv public.together_invites%rowtype;
  code text;
  member_name text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if response not in ('accepted','declined') then raise exception 'Invalid invite response'; end if;

  select * into inv
  from public.together_invites
  where id=target_invite and recipient_user_id=caller;

  if inv.id is null then raise exception 'Invite not found'; end if;

  if response='accepted' then
    select s.join_code into code
    from public.shared_sessions s
    where s.id=inv.session_id and s.status='open';

    if code is null then raise exception 'This session is no longer open'; end if;

    select coalesce(nullif(p.display_name,''), split_part(u.email,'@',1))
      into member_name
    from auth.users u
    left join public.profiles p on p.id=u.id
    where u.id=caller;

    insert into public.session_participants(session_id,user_id,display_name)
    values(inv.session_id,caller,coalesce(member_name,'Workset user'))
    on conflict on constraint session_participants_pkey
    do update set display_name=excluded.display_name;
  end if;

  update public.together_invites
  set status=response, responded_at=now()
  where id=inv.id;

  if code is null then
    select s.join_code into code from public.shared_sessions s where s.id=inv.session_id;
  end if;

  return query select inv.session_id, code, response;
end;
$$;

revoke execute on function public.respond_to_together_invite(uuid,text) from public;
revoke execute on function public.respond_to_together_invite(uuid,text) from anon;
grant execute on function public.respond_to_together_invite(uuid,text) to authenticated;

notify pgrst, 'reload schema';
