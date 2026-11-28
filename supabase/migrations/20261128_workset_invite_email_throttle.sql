-- Prevent repeat invitation RPCs from sending multiple emails to the
-- same recipient and invitation within 24 hours.
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
     created_at=now(),read_at=null,resolved_at=null,
     email_sent_at=case when public.workset_notifications.email_sent_at>now()-interval '24 hours'
       then public.workset_notifications.email_sent_at else null end,
     email_claimed_at=null;
end;
$$;
revoke all on function app_private.workset_notify(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
