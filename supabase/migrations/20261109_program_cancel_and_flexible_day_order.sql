-- Add a distinct cancelled/stopped state for tracked programs.
-- Completed workout history remains untouched. Tracking the same program again
-- creates a new run_number and starts from the beginning.

alter table public.user_program_tracking
  drop constraint if exists user_program_tracking_status_check;

alter table public.user_program_tracking
  add constraint user_program_tracking_status_check
  check (status in ('tracking','paused','cancelled','completed'));

create or replace function public.cancel_program_tracking(target_tracking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.user_program_tracking
  set status='cancelled',
      completed_at=null,
      updated_at=now()
  where id=target_tracking_id
    and user_id=auth.uid()
    and status='paused';

  if not found then
    raise exception 'Paused program not found';
  end if;
end;
$$;

grant execute on function public.cancel_program_tracking(uuid) to authenticated;

notify pgrst, 'reload schema';
