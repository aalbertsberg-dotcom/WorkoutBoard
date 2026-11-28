-- WorkSet web-first social inbox: opt-in group invites, private chats, and notifications.
-- Only a recipient reads their notifications. Only chat members read messages.
create table if not exists public.workset_notifications(
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('friend_request','friend_accepted','live_invite','program_invite','chat_added','message')),
 title text not null,
 body text not null default '',
 related_id uuid not null,
 read_at timestamptz,
 email_sent_at timestamptz,
 email_claimed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(recipient_user_id,kind,related_id)
);
create index if not exists workset_notifications_inbox_idx
 on public.workset_notifications(recipient_user_id,created_at desc);

create table if not exists public.program_group_invites(
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.program_groups(id) on delete cascade,
 inviter_user_id uuid not null references auth.users(id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 unique(group_id,recipient_user_id),
 check(inviter_user_id<>recipient_user_id)
);
create index if not exists program_group_invites_recipient_idx
 on public.program_group_invites(recipient_user_id,status,created_at desc);

create table if not exists public.workset_chats(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('direct','group','program')),
 title text not null default '',
 created_by uuid not null references auth.users(id) on delete cascade,
 direct_pair text unique,
 program_group_id uuid unique references public.program_groups(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((kind='direct' and direct_pair is not null and program_group_id is null)
   or(kind='program' and program_group_id is not null and direct_pair is null)
   or(kind='group' and direct_pair is null and program_group_id is null))
);
create table if not exists public.workset_chat_members(
 chat_id uuid not null references public.workset_chats(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 last_read_at timestamptz not null default now(),
 primary key(chat_id,user_id)
);
create index if not exists workset_chat_members_user_idx
 on public.workset_chat_members(user_id,chat_id);

create table if not exists public.workset_chat_messages(
 id uuid primary key default gen_random_uuid(),
 chat_id uuid not null references public.workset_chats(id) on delete cascade,
 sender_user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists workset_chat_messages_recent_idx
 on public.workset_chat_messages(chat_id,created_at desc);

alter table public.workset_notifications enable row level security;
alter table public.program_group_invites enable row level security;
alter table public.workset_chats enable row level security;
alter table public.workset_chat_members enable row level security;
alter table public.workset_chat_messages enable row level security;

revoke all on public.workset_notifications,public.program_group_invites,
 public.workset_chats,public.workset_chat_members,public.workset_chat_messages
 from public,anon,authenticated;
grant select on public.workset_notifications,public.program_group_invites,
 public.workset_chats,public.workset_chat_members,public.workset_chat_messages
 to authenticated;

create or replace function public.is_workset_chat_member(target_chat uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists(
  select 1 from public.workset_chat_members cm where cm.chat_id=target_chat and cm.user_id=auth.uid()
 );
$$;
revoke all on function public.is_workset_chat_member(uuid) from public,anon,authenticated;
grant execute on function public.is_workset_chat_member(uuid) to authenticated;

create policy "workset_notifications_recipient_read" on public.workset_notifications
 for select to authenticated using(recipient_user_id=(select auth.uid()));
create policy "program_group_invites_parties_read" on public.program_group_invites
 for select to authenticated using(recipient_user_id=(select auth.uid()) or inviter_user_id=(select auth.uid()));
create policy "workset_chats_member_read" on public.workset_chats
 for select to authenticated using(public.is_workset_chat_member(id));
create policy "workset_chat_members_member_read" on public.workset_chat_members
 for select to authenticated using(public.is_workset_chat_member(chat_id));
create policy "workset_messages_member_read" on public.workset_chat_messages
 for select to authenticated using(public.is_workset_chat_member(chat_id));

-- Only internal SQL triggers create notifications.
create or replace function app_private.workset_notify(
 p_recipient uuid,p_actor uuid,p_kind text,p_title text,p_body text,p_related uuid
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_recipient is null or p_related is null or p_recipient=p_actor then return; end if;
 insert into public.workset_notifications(
  recipient_user_id,actor_user_id,kind,title,body,related_id)
 values(p_recipient,p_actor,p_kind,left(p_title,140),left(p_body,280),p_related)
 on conflict(recipient_user_id,kind,related_id) do update
 set actor_user_id=excluded.actor_user_id,title=excluded.title,body=excluded.body,
     created_at=now(),read_at=null,email_sent_at=null,email_claimed_at=null;
end;
$$;
revoke all on function app_private.workset_notify(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;

create or replace function app_private.workset_friend_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending'
   or old.created_at is distinct from new.created_at) then
   perform app_private.workset_notify(new.addressee_user_id,new.requester_user_id,
    'friend_request','New friend request',
    new.requester_display_name||' wants to connect on WorkSet.',new.id);
 elsif new.status='accepted' and tg_op='UPDATE' and old.status is distinct from 'accepted' then
   perform app_private.workset_notify(new.requester_user_id,new.addressee_user_id,
    'friend_accepted','Friend request accepted',
    new.addressee_display_name||' accepted your friend request.',new.id);
 end if;
 return new;
end;
$$;
drop trigger if exists workset_friend_alert on public.workset_friendships;
create trigger workset_friend_alert after insert or update on public.workset_friendships
 for each row execute function app_private.workset_friend_notification();

create or replace function app_private.workset_live_invite_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending'
   or old.created_at is distinct from new.created_at) then
  perform app_private.workset_notify(new.recipient_user_id,new.sender_user_id,
   'live_invite','Workout invitation',
   new.sender_display_name||' invited you to train together.',new.id);
 end if;
 return new;
end;
$$;
drop trigger if exists workset_live_invite_alert on public.together_invites;
create trigger workset_live_invite_alert after insert or update on public.together_invites
 for each row execute function app_private.workset_live_invite_notification();

create or replace function public.invite_workset_friend_to_group(target_group uuid,friend_user_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare caller uuid:=auth.uid(); invite_id uuid;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.program_groups g where g.id=target_group and g.owner_user_id=caller)
 then raise exception 'Only the group owner can invite friends'; end if;
 if friend_user_id=caller then raise exception 'You are already in this group'; end if;
 if not exists(select 1 from public.workset_friendships f
  where f.status='accepted' and
  ((f.requester_user_id=caller and f.addressee_user_id=friend_user_id) or
   (f.addressee_user_id=caller and f.requester_user_id=friend_user_id)))
 then raise exception 'Invite an accepted WorkSet friend'; end if;
 if exists(select 1 from public.program_group_members m where m.group_id=target_group and m.user_id=friend_user_id)
 then raise exception 'Already a group member'; end if;
 insert into public.program_group_invites(group_id,inviter_user_id,recipient_user_id)
 values(target_group,caller,friend_user_id)
 on conflict(group_id,recipient_user_id) do update set
 inviter_user_id=excluded.inviter_user_id,status='pending',responded_at=null,created_at=now()
 returning id into invite_id;
 return invite_id;
end;
$$;

create or replace function public.respond_workset_program_group_invite(target_invite uuid,response text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare caller uuid:=auth.uid();inv public.program_group_invites%rowtype; nm text;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 if response not in ('accepted','declined') then raise exception 'Invalid response'; end if;
 select * into inv from public.program_group_invites
 where id=target_invite and recipient_user_id=caller and status='pending' for update;
 if not found then raise exception 'Invitation no longer pending'; end if;
 if response='accepted' then
  select coalesce(nullif(p.display_name,''),split_part(u.email,'@',1),'Member')
   into nm from auth.users u left join public.profiles p on p.id=u.id where u.id=caller;
  insert into public.program_group_members(group_id,user_id,display_name,share_workouts)
  values(inv.group_id,caller,left(coalesce(nm,'Member'),80),true)
  on conflict(group_id,user_id) do nothing;
 end if;
 update public.program_group_invites set status=response,responded_at=now() where id=inv.id;
 return inv.group_id;
end;
$$;

create or replace function app_private.workset_group_invite_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare group_name text;
begin
 if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending'
   or old.created_at is distinct from new.created_at) then
  select g.name into group_name from public.program_groups g where g.id=new.group_id;
  perform app_private.workset_notify(new.recipient_user_id,new.inviter_user_id,
   'program_invite','Program group invitation',
   'You were invited to '||coalesce(group_name,'a WorkSet program group')||'.',new.id);
 end if;
 return new;
end;
$$;
drop trigger if exists workset_group_invite_alert on public.program_group_invites;
create trigger workset_group_invite_alert after insert or update on public.program_group_invites
 for each row execute function app_private.workset_group_invite_notification();

-- Private conversations: only accepted friends may start direct or ad-hoc groups.
create or replace function public.start_workset_direct_chat(friend_user_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare caller uuid:=auth.uid(); pair_key text; chat uuid;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 if caller=friend_user_id or friend_user_id is null then raise exception 'Choose a friend'; end if;
 if not exists(select 1 from public.workset_friendships f where f.status='accepted'
  and ((f.requester_user_id=caller and f.addressee_user_id=friend_user_id)
   or(f.addressee_user_id=caller and f.requester_user_id=friend_user_id)))
 then raise exception 'You can message accepted friends'; end if;
 pair_key:=least(caller::text,friend_user_id::text)||':'||greatest(caller::text,friend_user_id::text);
 insert into public.workset_chats(kind,title,created_by,direct_pair)
 values('direct','',caller,pair_key)
 on conflict(direct_pair) do update set direct_pair=excluded.direct_pair returning id into chat;
 insert into public.workset_chat_members(chat_id,user_id) values(chat,caller),(chat,friend_user_id)
 on conflict do nothing;
 return chat;
end;
$$;

create or replace function public.start_workset_group_chat(group_title text,friend_ids uuid[])
returns uuid language plpgsql security definer set search_path=''
as $$
declare caller uuid:=auth.uid();chat uuid; friend uuid; count_members integer;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 if length(btrim(coalesce(group_title,''))) not between 2 and 80 then raise exception 'Name the conversation'; end if;
 select count(distinct x) into count_members from unnest(friend_ids) x where x is not null and x<>caller;
 if count_members<2 or count_members>20 then raise exception 'Choose 2 to 20 friends'; end if;
 for friend in select distinct x from unnest(friend_ids) x where x is not null and x<>caller loop
   if not exists(select 1 from public.workset_friendships f where f.status='accepted'
     and ((f.requester_user_id=caller and f.addressee_user_id=friend)
      or(f.addressee_user_id=caller and f.requester_user_id=friend)))
   then raise exception 'All recipients must be accepted friends'; end if;
 end loop;
 insert into public.workset_chats(kind,title,created_by) values('group',btrim(group_title),caller)
 returning id into chat;
 insert into public.workset_chat_members(chat_id,user_id) values(chat,caller);
 insert into public.workset_chat_members(chat_id,user_id)
 select chat,x from (select distinct u as x from unnest(friend_ids) u where u<>caller) q;
 return chat;
end;
$$;

create or replace function public.start_workset_program_chat(target_group uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare caller uuid:=auth.uid();chat uuid;group_name text;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.program_group_members where group_id=target_group and user_id=caller)
 then raise exception 'Join this group before messaging'; end if;
 select name into group_name from public.program_groups where id=target_group;
 insert into public.workset_chats(kind,title,created_by,program_group_id)
 values('program',coalesce(group_name,'Program group'),caller,target_group)
 on conflict(program_group_id) do update set title=excluded.title returning id into chat;
 insert into public.workset_chat_members(chat_id,user_id)
 select chat,m.user_id from public.program_group_members m where m.group_id=target_group
 on conflict do nothing;
 return chat;
end;
$$;

create or replace function app_private.workset_chat_member_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare chat_row public.workset_chats%rowtype;
begin
 select * into chat_row from public.workset_chats where id=new.chat_id;
 if new.user_id<>chat_row.created_by then
   perform app_private.workset_notify(new.user_id,chat_row.created_by,'chat_added',
     'Added to a conversation',
     case when chat_row.kind='direct' then 'A friend started a private conversation.'
       else 'You were added to '||chat_row.title||'.' end,new.chat_id);
 end if;
 return new;
end;
$$;
drop trigger if exists workset_chat_member_alert on public.workset_chat_members;
create trigger workset_chat_member_alert after insert on public.workset_chat_members
 for each row execute function app_private.workset_chat_member_notification();

create or replace function app_private.workset_sync_program_chat_members()
returns trigger language plpgsql security definer set search_path=''
as $$
declare target_chat uuid;
begin
 select id into target_chat from public.workset_chats where program_group_id=coalesce(new.group_id,old.group_id);
 if target_chat is null then return null; end if;
 if tg_op='INSERT' then
   insert into public.workset_chat_members(chat_id,user_id) values(target_chat,new.user_id) on conflict do nothing;
 elsif tg_op='DELETE' then
   delete from public.workset_chat_members where chat_id=target_chat and user_id=old.user_id;
 end if;
 return null;
end;
$$;
-- a statement referencing NEW during DELETE at runtime would fail: choose TG_OP first.
create or replace function app_private.workset_sync_program_chat_members()
returns trigger language plpgsql security definer set search_path=''
as $$
declare target_chat uuid;group_key uuid; member_key uuid;
begin
 if tg_op='INSERT' then group_key:=new.group_id;member_key:=new.user_id;
 else group_key:=old.group_id;member_key:=old.user_id; end if;
 select id into target_chat from public.workset_chats where program_group_id=group_key;
 if target_chat is null then return null; end if;
 if tg_op='INSERT' then
   insert into public.workset_chat_members(chat_id,user_id) values(target_chat,member_key) on conflict do nothing;
 else
   delete from public.workset_chat_members where chat_id=target_chat and user_id=member_key;
 end if;
 return null;
end;
$$;
drop trigger if exists workset_program_chat_sync on public.program_group_members;
create trigger workset_program_chat_sync after insert or delete on public.program_group_members
 for each row execute function app_private.workset_sync_program_chat_members();

create or replace function public.send_workset_message(target_chat uuid,message_body text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare caller uuid:=auth.uid();message_id uuid;content text:=btrim(coalesce(message_body,''));
begin
 if caller is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.workset_chat_members where chat_id=target_chat and user_id=caller)
 then raise exception 'Not a conversation member'; end if;
 if length(content)<1 or length(content)>2000 then raise exception 'Messages must be 1-2000 characters'; end if;
 if exists(select 1 from public.workset_chat_messages
  where chat_id=target_chat and sender_user_id=caller and created_at>now()-interval '500 milliseconds')
 then raise exception 'Please slow down'; end if;
 insert into public.workset_chat_messages(chat_id,sender_user_id,body)
 values(target_chat,caller,content) returning id into message_id;
 update public.workset_chats set updated_at=now() where id=target_chat;
 return message_id;
end;
$$;

create or replace function app_private.workset_message_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare member_id uuid;chat_title text;sender_name text;
begin
 select nullif(c.title,'') into chat_title from public.workset_chats c where c.id=new.chat_id;
 select coalesce(nullif(p.display_name,''),split_part(u.email,'@',1),'Friend') into sender_name
  from auth.users u left join public.profiles p on p.id=u.id where u.id=new.sender_user_id;
 for member_id in select user_id from public.workset_chat_members where chat_id=new.chat_id and user_id<>new.sender_user_id loop
  perform app_private.workset_notify(member_id,new.sender_user_id,'message',
    coalesce(chat_title,'New message from '||sender_name),left(new.body,140),new.chat_id);
 end loop;
 return new;
end;
$$;
drop trigger if exists workset_message_alert on public.workset_chat_messages;
create trigger workset_message_alert after insert on public.workset_chat_messages
 for each row execute function app_private.workset_message_notification();

create or replace function public.mark_workset_notifications_read(target_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=''
as $$
declare result_count integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.workset_notifications n set read_at=now()
 where n.recipient_user_id=auth.uid() and n.read_at is null
 and (target_ids is null or n.id=any(target_ids));
 get diagnostics result_count=row_count;
 return result_count;
end;
$$;

create or replace function public.mark_workset_chat_read(target_chat uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.workset_chat_members set last_read_at=now()
 where chat_id=target_chat and user_id=auth.uid();
 if not found then raise exception 'Not a conversation member'; end if;
 update public.workset_notifications set read_at=now()
 where recipient_user_id=auth.uid() and kind='message' and related_id=target_chat and read_at is null;
end;
$$;

alter table public.profiles add column if not exists workset_email_invites boolean not null default true;
-- Profile email preference inherits the existing owner profile update policy.

-- Privileged RPCs require signed-in callers and have no anonymous grants.
revoke all on function public.invite_workset_friend_to_group(uuid,uuid) from public,anon,authenticated;
revoke all on function public.respond_workset_program_group_invite(uuid,text) from public,anon,authenticated;
revoke all on function public.start_workset_direct_chat(uuid) from public,anon,authenticated;
revoke all on function public.start_workset_group_chat(text,uuid[]) from public,anon,authenticated;
revoke all on function public.start_workset_program_chat(uuid) from public,anon,authenticated;
revoke all on function public.send_workset_message(uuid,text) from public,anon,authenticated;
revoke all on function public.mark_workset_notifications_read(uuid[]) from public,anon,authenticated;
revoke all on function public.mark_workset_chat_read(uuid) from public,anon,authenticated;
grant execute on function public.invite_workset_friend_to_group(uuid,uuid) to authenticated;
grant execute on function public.respond_workset_program_group_invite(uuid,text) to authenticated;
grant execute on function public.start_workset_direct_chat(uuid) to authenticated;
grant execute on function public.start_workset_group_chat(text,uuid[]) to authenticated;
grant execute on function public.start_workset_program_chat(uuid) to authenticated;
grant execute on function public.send_workset_message(uuid,text) to authenticated;
grant execute on function public.mark_workset_notifications_read(uuid[]) to authenticated;
grant execute on function public.mark_workset_chat_read(uuid) to authenticated;
notify pgrst,'reload schema';
