-- Normalize "Squat" and "Squat Day" to the same group workout recap,
-- so solo and Live members of a 5/3/1 group share one evolving post.
create or replace function app_private.sync_program_group_completion()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  item record;
  recap uuid;
  matched_name text := coalesce(nullif(trim(new.program),''),nullif(trim(new.workout->>'program'),''),'');
  other_name text := coalesce(nullif(trim(new.workout->>'program'),''),nullif(trim(new.workout#>>'{shared_meta,program_name}'),''),'');
  this_week integer := coalesce(new.week,1);
  this_key text := lower(trim(regexp_replace(
    case when coalesce(new.primary_lift,'') like 'Together:%'
      then coalesce(nullif(new.title,''),'Workout')
      else coalesce(nullif(new.primary_lift,''),nullif(new.title,''),'Workout') end,
    '[[:space:]]+day
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
$$;, '', 'i')));
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
