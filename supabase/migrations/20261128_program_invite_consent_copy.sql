-- Consent is explicit for invited program-group members:
-- accepting opts their future completed workouts into private group summaries.
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
   'Join '||coalesce(group_name,'a WorkSet group')||
   '. Accepting will share your future completed workouts for this program with group members. You can turn sharing off.',
   new.id);
 end if;
 return new;
end;
$$;
revoke all on function app_private.workset_group_invite_notification() from public,anon,authenticated;
