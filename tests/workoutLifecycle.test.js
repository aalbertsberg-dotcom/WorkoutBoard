import test from 'node:test'
import assert from 'node:assert/strict'
import {isOpenWorkout,selectWorkoutToRestore,isOvernightCardioToResume} from '../src/workoutLifecycle.js'

const row=(id,status,created_at,standalone=false)=>({
  id,status,created_at,workout:{started_explicitly:true,standalone}
})

test('refresh never reopens skipped or explicitly cancelled workout',()=>{
  const skipped=row('old','skipped','2026-11-16T11:00:00Z')
  const stale={...row('stale','started','2026-11-16T11:15:00Z'),workout:{cancelled_explicitly:true}}
  const walk=row('walk','started','2026-11-16T12:00:00Z',true)
  assert.equal(isOpenWorkout(skipped),false)
  assert.equal(isOpenWorkout(stale),false)
  assert.equal(selectWorkoutToRestore([skipped,stale,walk])?.id,'walk')
})

test('active Walk on refresh wins over older strength workout',()=>{
  const strength=row('strength','started','2026-11-16T11:00:00Z')
  const walk=row('walk','started','2026-11-16T12:00:00Z',true)
  assert.equal(selectWorkoutToRestore([strength,walk])?.id,'walk')
  assert.equal(selectWorkoutToRestore([strength,walk],{preferredId:'walk'})?.id,'walk')
  assert.equal(selectWorkoutToRestore([strength,walk],{preferredId:'strength'})?.id,'strength')
})

test('local cancellation tombstone excludes stale in-flight server save',()=>{
  const stale=row('canceled','started','2026-11-16T12:15:00Z')
  const walk=row('walk','started','2026-11-16T12:05:00Z',true)
  assert.equal(selectWorkoutToRestore([stale,walk],{cancelledIds:['canceled']})?.id,'walk')
})

test('legacy scheduled workout still restores if no active workout exists',()=>{
  const scheduled=row('scheduled','planned','2026-11-16T09:00:00Z')
  assert.equal(selectWorkoutToRestore([scheduled])?.id,'scheduled')
  assert.equal(selectWorkoutToRestore([{...scheduled,status:'completed'}]),null)
})

test('cancel barrier suppresses older orphaned sessions without blocking new ones',()=>{
  const oldWalk=row('old-walk','started','2026-11-16T12:00:00Z',true)
  const newerWalk=row('new-walk','started','2026-11-16T13:30:00Z',true)
  const barrier=Date.parse('2026-11-16T13:00:00Z')
  assert.equal(selectWorkoutToRestore([oldWalk],{cancelledBefore:barrier}),null)
  assert.equal(selectWorkoutToRestore([oldWalk,newerWalk],{cancelledBefore:barrier})?.id,'new-walk')
  assert.equal(selectWorkoutToRestore([oldWalk],{preferredId:'old-walk',cancelledBefore:barrier})?.id,'old-walk')
})

test('overnight active cardio resumes only when explicitly timed and not completed',()=>{
  const yesterday='2026-11-21',today='2026-11-22'
  const walk={id:'overnight',status:'started',scheduled_date:yesterday,
    created_at:'2026-11-21T23:40:00Z',
    workout:{standalone:true,quick_cardio:true,started_explicitly:true,
      quick_timer_started_at:'2026-11-21T23:42:00Z'}}
  const paused={...walk,id:'paused',workout:{...walk.workout,quick_timer_started_at:null,quick_timer_elapsed_seconds:600}}
  assert.equal(isOvernightCardioToResume(walk,yesterday,today),true)
  assert.equal(isOvernightCardioToResume(paused,yesterday,today),true)
  assert.equal(isOvernightCardioToResume({...walk,status:'completed'},yesterday,today),false)
  assert.equal(isOvernightCardioToResume({...walk,scheduled_date:'2026-11-18'},yesterday,today),false)
  assert.equal(isOvernightCardioToResume({...walk,workout:{...walk.workout,quick_timer_started_at:null}},yesterday,today),false)
  assert.equal(selectWorkoutToRestore([walk],{cancelledIds:['overnight']}),null)
  assert.equal(selectWorkoutToRestore([walk],{cancelledBefore:Date.parse('2026-11-22T00:00:00Z')}),null)
  assert.equal(selectWorkoutToRestore([walk],{preferredId:'overnight'})?.id,'overnight')
})
