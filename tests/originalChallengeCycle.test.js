import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {originalChallengeProgram} from '../src/programSources/originalChallenge.js'
import {partnerSetTarget} from '../src/programSetTargets.js'
import {ORIGINAL_CHALLENGE_NAME,ORIGINAL_CHALLENGE_KEY,
  isOriginalChallengeMaxTest,isOriginalChallengeTestSet,
  originalChallengeCompletedTest,originalChallengeWeek6Estimates
} from '../src/originalChallengeCycle.js'

const top=(lift,weight,reps,extra={})=>({
  name:lift,
  setProgress:[
    {weight_lift:lift,weight_basis:'tm',pct:50,reps:5,done:true,weight:135},
    {weight_lift:lift,weight_basis:'tm',pct:100,reps:3,label:'3+ @ 100% TM',done:true,
      weight,actual_reps:reps,...extra}
  ]
})
const row=(lift,weight,reps,completed_at='2026-12-22T15:00:00Z',other={})=>({
  id:'week6-'+lift,
  program:ORIGINAL_CHALLENGE_NAME,week:6,completed_at,
  workout:{tracking_program_key:ORIGINAL_CHALLENGE_KEY,
    exercises:[top(lift,weight,reps)]},
  ...other
})

test('Week 6 records actual reps at 100% TM, never the template 3+',()=>{
  const result=originalChallengeCompletedTest({exercises:[top('Squat',265,7)]})
  assert.deepEqual(result,[{lift:'Squat',weight:265,reps:7,estimated_1rm:326.83}])
  assert.deepEqual(originalChallengeCompletedTest({exercises:[top('Squat',265,'')]}),[])
  assert.deepEqual(originalChallengeCompletedTest({exercises:[top('Squat',265,null)]}),[])
  assert.deepEqual(originalChallengeCompletedTest({exercises:[top('Squat',265,3,{done:false})]}),[])
  assert.deepEqual(originalChallengeCompletedTest({exercises:[top('Squat','',7)]}),[])
  assert.deepEqual(originalChallengeCompletedTest({exercises:[top('Squat',265,31)]}),[])
  assert.deepEqual(originalChallengeCompletedTest({exercises:[top('Squat',265,6.5)]}),[])
})

test('Week 7-9 loads reset estimated 1RM; Week 10-12 adds 10/5 lb to NEW 85% TM',()=>{
  const rows=[row('Squat',265,7),row('Bench',185,5),row('Deadlift',285,4),row('Press',125,8)]
  const {maxes,results}=originalChallengeWeek6Estimates(rows,'2026-11-28T00:00:00Z')
  assert.equal(maxes.Squat,326.83)
  assert.equal(maxes.Bench,215.83)
  assert.equal(maxes.Deadlift,323)
  assert.equal(maxes.Press,158.33)
  assert.equal(results.Squat.reps,7)
  const set=(lift,week,pct)=>({weight_lift:lift,weight_basis:'tm',pct,
    tm_offset:originalChallengeProgram.getTrainingMaxOffset(week,lift)})
  assert.equal(partnerSetTarget(maxes,set('Squat',7,85)),'235 lb')
  assert.equal(partnerSetTarget(maxes,set('Squat',10,85)),'245 lb')
  assert.equal(partnerSetTarget(maxes,set('Bench',7,85)),'155 lb')
  assert.equal(partnerSetTarget(maxes,set('Bench',10,85)),'160 lb')
  assert.equal(partnerSetTarget(maxes,set('Press',7,95)),'130 lb')
  assert.equal(partnerSetTarget(maxes,set('Press',10,95)),'135 lb')
})

test('only this completed program run can reset its training max',()=>{
  const old=row('Squat',265,9,'2026-10-01T15:00:00Z')
  const newer=row('Squat',275,4,'2026-12-22T15:00:00Z')
  const wrongProgram=row('Bench',185,5,'2026-12-22T15:00:00Z',{program:'Other program'})
  const wrongWeek=row('Press',125,9,'2026-12-22T15:00:00Z',{week:12})
  const wrongKey=row('Deadlift',285,9,'2026-12-22T15:00:00Z',{
    workout:{tracking_program_key:'archive:some-other-program',exercises:[top('Deadlift',285,9)]}
  })
  const laterRetest=row('Squat',275,6,'2026-12-23T15:00:00Z')
  const selected=originalChallengeWeek6Estimates([old,newer,wrongProgram,wrongWeek,wrongKey,laterRetest],
    '2026-11-28T00:00:00Z')
  assert.deepEqual(Object.keys(selected.maxes),['Squat'])
  assert.equal(selected.maxes.Squat,330)
  assert.equal(selected.results.Squat.reps,6)
})

test('Week 6 and Week 12 top set is recognized, Week 3 and other programs are not',()=>{
  const workout={archive_program_id:'531-original-challenge'}
  assert.equal(isOriginalChallengeMaxTest({source_week:6,workout}),true)
  assert.equal(isOriginalChallengeMaxTest({source_week:12,workout}),true)
  assert.equal(isOriginalChallengeMaxTest({source_week:3,workout}),false)
  assert.equal(isOriginalChallengeMaxTest({source_week:6,workout:{}}),false)
  assert.equal(isOriginalChallengeTestSet(top('Squat',265,7).setProgress[1]),true)
  assert.equal(isOriginalChallengeTestSet(top('Squat',265,7).setProgress[0]),false)
})

test('program-specific estimates do not overwrite the athlete saved 1RMs',()=>{
  const saved={Squat:300,Bench:200}
  const {maxes}=originalChallengeWeek6Estimates([row('Squat',265,7)])
  assert.deepEqual(saved,{Squat:300,Bench:200})
  assert.equal(partnerSetTarget(saved,{weight_lift:'Squat',weight_basis:'tm',pct:85,tm_offset:0}),'215 lb')
  assert.equal(partnerSetTarget({...saved,...maxes},
    {weight_lift:'Squat',weight_basis:'tm',pct:85,tm_offset:0}),'235 lb')
})

test('current workout loads the Week 6 result by run and requires real max-test reps',()=>{
  const src=readFileSync(new URL('../src/productFeatures.jsx',import.meta.url),'utf8')
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  const plan=readFileSync(new URL('../src/platform.jsx',import.meta.url),'utf8')
  assert.match(src,/originalChallengeWeek6Estimates\(rows\|\|\[\],runStartedAt\)/)
  assert.match(src,/\.gte\('completed_at',runStartedAt\)/)
  assert.match(src,/const workoutOneRms=\{\.\.\.oneRepMaxes,\.\.\.cycleMaxes\}/)
  assert.match(src,/partnerSetTarget\(workoutOneRms,activeSet\)/)
  assert.match(src,/partnerSetTarget\(workoutOneRms,set\)/)
  assert.match(src,/isOriginalChallengeMaxTest\(planned\)&&isOriginalChallengeTestSet\(activeSet\)/)
  assert.match(src,/set\.actual_reps==null/)
  assert.match(app,/tracking_started_at:trackInfo\.startedAt\|\|null/)
  assert.match(plan,/tracking_started_at:activeTrack\?\.started_at\|\|null/)
})
