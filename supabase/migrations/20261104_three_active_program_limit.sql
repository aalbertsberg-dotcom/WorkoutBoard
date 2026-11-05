-- Allow paused programs and enforce a maximum of 3 active tracked programs.
-- Safe to run after 20261101_unified_program_tracking.sql.

alter table public.user_program_tracking
  drop constraint if exists user_program_tracking_status_check;

alter table public.user_program_tracking
  add constraint user_program_tracking_status_check
  check (status in ('tracking','paused','completed'));

create or replace function public.start_program_tracking(
  target_program_key text,
  target_program_name text,
  target_program_kind text
)
returns public.user_program_tracking
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_row public.user_program_tracking;
  next_run integer;
  active_count integer;
  created_row public.user_program_tracking;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into existing_row
  from public.user_program_tracking
  where user_id = auth.uid()
    and program_key = target_program_key
    and status = 'tracking'
  limit 1;

  if found then
    return existing_row;
  end if;

  select count(*) into active_count
  from public.user_program_tracking
  where user_id = auth.uid()
    and status = 'tracking';

  if active_count >= 3 then
    raise exception 'Maximum of 3 active programs. Pause or complete one before adding another.';
  end if;

  select coalesce(max(run_number),0) + 1
    into next_run
  from public.user_program_tracking
  where user_id = auth.uid()
    and program_key = target_program_key;

  insert into public.user_program_tracking(
    user_id, program_key, program_name, program_kind, run_number, status
  )
  values(
    auth.uid(), target_program_key, target_program_name, target_program_kind, next_run, 'tracking'
  )
  returning * into created_row;

  return created_row;
end;
$$;

grant execute on function public.start_program_tracking(text,text,text) to authenticated;

create or replace function public.pause_program_tracking(target_tracking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_program_tracking
  set status='paused',
      completed_at=null,
      updated_at=now()
  where id=target_tracking_id
    and user_id=auth.uid()
    and status='tracking';

  if not found then
    raise exception 'Active tracked program not found';
  end if;
end;
$$;

grant execute on function public.pause_program_tracking(uuid) to authenticated;

create or replace function public.resume_program_tracking(target_tracking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
begin
  select count(*) into active_count
  from public.user_program_tracking
  where user_id=auth.uid()
    and status='tracking';

  if active_count >= 3 then
    raise exception 'Maximum of 3 active programs. Pause or complete one before resuming another.';
  end if;

  update public.user_program_tracking
  set status='tracking',
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

grant execute on function public.resume_program_tracking(uuid) to authenticated;

notify pgrst, 'reload schema';
