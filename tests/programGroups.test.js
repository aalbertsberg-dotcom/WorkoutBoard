import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const migration=read('supabase/migrations/20261127_program_groups_and_recaps.sql')
const groups=read('src/ProgramGroups.jsx')
const live=read('src/LiveSessionRecaps.jsx')
const app=read('src/App.jsx')

test('private program groups have RLS, member-only reads, and no direct client writes',()=>{
  for(const table of ['program_groups','program_group_members','program_group_posts','program_group_results']){
    assert.match(migration,new RegExp('alter table public\\.'+table+' enable row level security'))
    assert.match(migration,new RegExp('on public\\.'+table+' for select to authenticated'))
  }
  assert.match(migration,/revoke all on public\.program_groups,public\.program_group_members,public\.program_group_posts,public\.program_group_results from public,anon,authenticated/)
  assert.match(migration,/public\.is_program_group_member/)
  assert.doesNotMatch(migration,/grant (?:insert|update|delete) on public\.program_groups/)
})
test('member opts in, can turn off sharing, and old results are deleted',()=>{
  assert.match(migration,/share_workouts boolean not null default true/)
  assert.match(migration,/create or replace function public\.set_program_group_sharing/)
  assert.match(migration,/delete from public\.program_group_results r/)
  assert.match(groups,/Joining opts you in/)
  assert.match(groups,/Share my completed workouts/)
  assert.match(groups,/set_program_group_sharing/)
})
test('each completed workout produces a single updating group post',()=>{
  assert.match(migration,/unique\(group_id,week,workout_key\)/)
  assert.match(migration,/on conflict\(group_id,week,workout_key\) do update/)
  assert.match(migration,/on conflict\(post_id,user_id\) do update/)
  assert.match(migration,/after insert or update of completed_at/)
  assert.match(migration,/on public\.training_sessions/)
  assert.match(groups,/sharing members finished/)
})
test('community includes both joinable groups and live participant recaps',()=>{
  assert.match(app,/import ProgramGroups from '.\/ProgramGroups\.jsx'/)
  assert.match(app,/import LiveSessionRecaps from '.\/LiveSessionRecaps\.jsx'/)
  assert.match(app,/<ProgramGroups session=\{session\}/)
  assert.match(app,/<LiveSessionRecaps session=\{session\}/)
  assert.match(groups,/join_program_group/)
  assert.match(groups,/create_program_group/)
  assert.match(live,/from\('session_participants'\)/)
  assert.match(live,/from\('session_results'\)/)
})
