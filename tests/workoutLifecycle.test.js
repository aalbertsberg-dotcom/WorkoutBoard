import test from 'node:test'
import assert from 'node:assert/strict'
import {isOpenWorkout,selectWorkoutToRestore} from '../src/workoutLifecycle.js'

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
