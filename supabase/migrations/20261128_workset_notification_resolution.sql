-- Resolve actionable notifications once the corresponding invitation is answered.
alter table public.workset_notifications
 add column if not exists resolved_at timestamptz;

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
     created_at=now(),read_at=null,resolved_at=null,email_sent_at=null,email_claimed_at=null;
end;
$$;
revoke all on function app_private.workset_notify(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;

create or replace function app_private.workset_resolve_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare k text;receiver uuid;
begin
 if new.status='pending' or old.status=new.status then return new; end if;
 if tg_table_name='workset_friendships' then
   k:='friend_request';receiver:=new.addressee_user_id;
 elsif tg_table_name='together_invites' then
   k:='live_invite';receiver:=new.recipient_user_id;
 elsif tg_table_name='program_group_invites' then
   k:='program_invite';receiver:=new.recipient_user_id;
 else return new;
 end if;
 update public.workset_notifications
 set resolved_at=now(),read_at=coalesce(read_at,now())
 where recipient_user_id=receiver and kind=k and related_id=new.id;
 return new;
end;
$$;
revoke all on function app_private.workset_resolve_notification() from public,anon,authenticated;
drop trigger if exists workset_resolve_friend_request on public.workset_friendships;
create trigger workset_resolve_friend_request after update of status on public.workset_friendships
for each row execute function app_private.workset_resolve_notification();
drop trigger if exists workset_resolve_live_invite on public.together_invites;
create trigger workset_resolve_live_invite after update of status on public.together_invites
for each row execute function app_private.workset_resolve_notification();
drop trigger if exists workset_resolve_program_invite on public.program_group_invites;
create trigger workset_resolve_program_invite after update of status on public.program_group_invites
for each row execute function app_private.workset_resolve_notification();
notify pgrst,'reload schema';
