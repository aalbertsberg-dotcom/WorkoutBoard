-- Follow-up for pause/resume UX.
-- Run after 20261104_three_active_program_limit.sql.

create or replace function public.resume_program_tracking_with_option(
  target_tracking_id uuid,
  restart_from_beginning boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
  target_row public.user_program_tracking;
  next_run integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_row
  from public.user_program_tracking
  where id=target_tracking_id
    and user_id=auth.uid()
    and status='paused'
  limit 1;

  if not found then
    raise exception 'Paused program not found';
  end if;

  select count(*) into active_count
  from public.user_program_tracking
  where user_id=auth.uid()
    and status='tracking';

  if active_count >= 3 then
    raise exception 'Maximum of 3 active programs. Pause or complete one before resuming another.';
  end if;

  if restart_from_beginning then
    select coalesce(max(run_number),0)+1 into next_run
    from public.user_program_tracking
    where user_id=auth.uid()
      and program_key=target_row.program_key;

    update public.user_program_tracking
    set status='tracking',
        run_number=next_run,
        started_at=now(),
        completed_at=null,
        updated_at=now()
    where id=target_tracking_id;
  else
    update public.user_program_tracking
    set status='tracking',
        completed_at=null,
        updated_at=now()
    where id=target_tracking_id;
  end if;
end;
$$;

grant execute on function public.resume_program_tracking_with_option(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
