
-- Opt-in private program cohorts and one evolving recap per program workout.
-- No raw training-session data or private 1RM settings are exposed.
create table if not exists public.program_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  program_name text not null check (char_length(trim(program_name)) between 2 and 160),
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  created_at timestamptz not null default now()
);
create table if not exists public.program_group_members (
  group_id uuid not null references public.program_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  share_workouts boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (group_id,user_id)
);
create index if not exists program_group_members_user_idx on public.program_group_members(user_id);
create table if not exists public.program_group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.program_groups(id) on delete cascade,
  week integer not null check (week between 1 and 52),
  workout_key text not null,
  title text not null,
  first_completed_at timestamptz not null,
  updated_at timestamptz not null,
  unique(group_id,week,workout_key)
);
create index if not exists program_group_posts_latest_idx on public.program_group_posts(group_id, updated_at desc);
create table if not exists public.program_group_results (
  post_id uuid not null references public.program_group_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  display_name text not null,
  total_volume numeric not null default 0,
  estimated_1rm numeric,
  completed_at timestamptz not null,
  primary key (post_id,user_id)
);

alter table public.program_groups enable row level security;
alter table public.program_group_members enable row level security;
alter table public.program_group_posts enable row level security;
alter table public.program_group_results enable row level security;
revoke all on public.program_groups,public.program_group_members,public.program_group_posts,public.program_group_results from public,anon,authenticated;
grant select on public.program_groups,public.program_group_members,public.program_group_posts,public.program_group_results to authenticated;

-- Small privileged helper only checks membership for the current authenticated user.
create or replace function public.is_program_group_member(target_group uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists(
    select 1 from public.program_group_members m
    where m.group_id=target_group and m.user_id=auth.uid()
  );
$$;
revoke all on function public.is_program_group_member(uuid) from public,anon,authenticated;
grant execute on function public.is_program_group_member(uuid) to authenticated;

create policy group_member_read on public.program_groups for select to authenticated
  using (public.is_program_group_member(id));
create policy group_members_read on public.program_group_members for select to authenticated
  using (public.is_program_group_member(group_id));
create policy group_posts_read on public.program_group_posts for select to authenticated
  using (public.is_program_group_member(group_id));
create policy group_results_read on public.program_group_results for select to authenticated
  using (exists (
    select 1 from public.program_group_posts p
    where p.id=post_id and public.is_program_group_member(p.group_id)
  ));

create or replace function public.create_program_group(group_name text, group_program text, member_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare group_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if length(trim(coalesce(group_name,''))) not between 2 and 80 or
     length(trim(coalesce(group_program,''))) not between 2 and 160 then
    raise exception 'Enter a group name and a program';
  end if;
  insert into public.program_groups(owner_user_id,name,program_name)
  values(auth.uid(),trim(group_name),trim(group_program)) returning id into group_id;
  insert into public.program_group_members(group_id,user_id,display_name)
  values(group_id,auth.uid(),left(coalesce(nullif(trim(member_name),''),'Member'),80));
  return group_id;
end;
$$;

create or replace function public.join_program_group(group_code text, member_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select id into target from public.program_groups
  where join_code=upper(trim(coalesce(group_code,'')));
  if target is null then raise exception 'No group found for that code'; end if;
  insert into public.program_group_members(group_id,user_id,display_name,share_workouts)
  values(target,auth.uid(),left(coalesce(nullif(trim(member_name),''),'Member'),80),true)
  on conflict(group_id,user_id) do nothing;
  return target;
end;
$$;

create or replace function public.set_program_group_sharing(target_group uuid, enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.program_group_members set share_workouts=coalesce(enabled,false)
  where group_id=target_group and user_id=auth.uid();
  if not found then raise exception 'Not a member of this group'; end if;
  if not coalesce(enabled,false) then
    delete from public.program_group_results r
    using public.program_group_posts p
    where r.post_id=p.id and p.group_id=target_group and r.user_id=auth.uid();
    delete from public.program_group_posts p
    where p.group_id=target_group
      and not exists(select 1 from public.program_group_results r where r.post_id=p.id);
  end if;
end;
$$;

create or replace function public.leave_program_group(target_group uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if exists(select 1 from public.program_groups where id=target_group and owner_user_id=auth.uid()) then
    raise exception 'Group owner must delete the group instead';
  end if;
  delete from public.program_group_members where group_id=target_group and user_id=auth.uid();
  delete from public.program_group_results r using public.program_group_posts p
    where r.post_id=p.id and p.group_id=target_group and r.user_id=auth.uid();
  delete from public.program_group_posts p where p.group_id=target_group
    and not exists(select 1 from public.program_group_results r where r.post_id=p.id);
end;
$$;

create or replace function public.delete_program_group(target_group uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  delete from public.program_groups where id=target_group and owner_user_id=auth.uid();
  if not found then raise exception 'Only the group owner can delete it'; end if;
end;
$$;

revoke all on function public.create_program_group(text,text,text) from public,anon,authenticated;
revoke all on function public.join_program_group(text,text) from public,anon,authenticated;
revoke all on function public.set_program_group_sharing(uuid,boolean) from public,anon,authenticated;
revoke all on function public.leave_program_group(uuid) from public,anon,authenticated;
revoke all on function public.delete_program_group(uuid) from public,anon,authenticated;
grant execute on function public.create_program_group(text,text,text) to authenticated;
grant execute on function public.join_program_group(text,text) to authenticated;
grant execute on function public.set_program_group_sharing(uuid,boolean) to authenticated;
grant execute on function public.leave_program_group(uuid) to authenticated;
grant execute on function public.delete_program_group(uuid) to authenticated;

-- An AFTER trigger includes every completed session, including offline-sync saves.
-- One post per group/week/workout key; members update their own entry in place.
create or replace function app_private.sync_program_group_completion()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  item record;
  recap uuid;
  matched_name text := coalesce(nullif(trim(new.program),''),nullif(trim(new.workout->>'program'),''),'');
  other_name text := coalesce(nullif(trim(new.workout->>'program'),''),nullif(trim(new.workout#>>'{shared_meta,program_name}'),''),'');
  this_week integer := coalesce(new.week,1);
  this_key text := lower(trim(case when coalesce(new.primary_lift,'') like 'Together:%'
    then coalesce(nullif(new.title,''),'Workout')
    else coalesce(nullif(new.primary_lift,''),nullif(new.title,''),'Workout') end));
begin
  if new.completed_at is null or this_week<1 or this_week>52 then return new; end if;
  for item in
    select m.group_id,m.display_name
    from public.program_group_members m
    join public.program_groups g on g.id=m.group_id
    where m.user_id=new.user_id and m.share_workouts
      and (lower(trim(g.program_name))=lower(matched_name)
        or lower(trim(g.program_name))=lower(other_name))
  loop
    insert into public.program_group_posts(group_id,week,workout_key,title,first_completed_at,updated_at)
    values(item.group_id,this_week,this_key,coalesce(nullif(new.title,''),'Completed workout'),new.completed_at,new.completed_at)
    on conflict(group_id,week,workout_key) do update
      set updated_at=greatest(public.program_group_posts.updated_at,excluded.updated_at)
    returning id into recap;
    insert into public.program_group_results(post_id,user_id,training_session_id,display_name,total_volume,estimated_1rm,completed_at)
    values(recap,new.user_id,new.id,item.display_name,coalesce(new.total_volume,0),new.estimated_1rm,new.completed_at)
    on conflict(post_id,user_id) do update
      set training_session_id=excluded.training_session_id,
          display_name=excluded.display_name,
          total_volume=excluded.total_volume,
          estimated_1rm=excluded.estimated_1rm,
          completed_at=excluded.completed_at
      where public.program_group_results.completed_at<=excluded.completed_at;
  end loop;
  return new;
end;
$$;
revoke all on function app_private.sync_program_group_completion() from public,anon,authenticated;
drop trigger if exists trg_program_group_completion on public.training_sessions;
create trigger trg_program_group_completion
after insert or update of completed_at,total_volume,estimated_1rm,program,week,primary_lift,workout
on public.training_sessions
for each row execute function app_private.sync_program_group_completion();
