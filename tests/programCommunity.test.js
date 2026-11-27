import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('program community is reachable from a specific program preview',()=>{
  const platform=read('src/platform.jsx')
  const app=read('src/App.jsx')
  assert.match(platform,/import ProgramCommunity from '.\/ProgramCommunity.jsx'/)
  assert.match(platform,/<ProgramCommunity key=\{preview.key\} programName=\{preview.name\}/)
  assert.match(platform,/onOpenCommunity=\{onOpenCommunity\}/)
  assert.match(app,/onOpenCommunity=\{\(\)=>\{setTogetherView\('community'\);navigateTo\('together'\)\}\}/)
})
test('cohort activity looks up only shared posts for this exact program',()=>{
  const source=read('src/ProgramCommunity.jsx')
  assert.match(source,/from\('community_activity'\)/)
  assert.match(source,/\.contains\('summary',\{program:programName\}\)/)
  assert.doesNotMatch(source,/from\('training_sessions'\)/)
  assert.doesNotMatch(source,/from\('user_program_tracking'\)/)
  assert.match(source,/if\(!open\|\|!programName\|\|!session\?\.user\?\.id\)return/)
})
test('new community posts carry actual finish timestamps and workout weeks',()=>{
  const runner=read('src/productFeatures.jsx')
  const app=read('src/App.jsx')
  assert.match(runner,/if\(communityProfile\?\.community_opt_in\)/)
  assert.match(runner,/program_key:planned.workout\?\.tracking_program_key\|\|null/)
  assert.match(runner,/week:planned.source_week\|\|null/)
  assert.match(runner,/completed_at:now/)
  assert.match(app,/if \(complete && durableSession && profile\?\.community_opt_in\)/)
  assert.match(app,/program_key:'classic:'\+workoutProgramId/)
  assert.match(app,/week,\s+completed_at:now/)
})
test('community respects global opt-in controls and displays only summary metrics',()=>{
  const src=read('src/ProgramCommunity.jsx')
  assert.match(src,/sharingEnabled/)
  assert.match(src,/Together → Community/)
  assert.match(src,/estimate/i)
  assert.match(src,/row\.summary\?\.sets/)
  assert.match(src,/row\.summary\?\.completed_at/)
  assert.doesNotMatch(src,/select\('\*'\)/)
})
