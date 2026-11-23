import test from 'node:test'
import assert from 'node:assert/strict'
import {completedWorkoutKind,completedWorkoutSummary,workoutHistoryDayKey,workoutHistoryMatches,HISTORY_PAGE_SIZE} from '../src/workoutHistoryUtils.js'

test('cardio history shows distance consistently even without a tracked program',()=>{
 const walk={title:'Walk',total_volume:0,workout:{quick_cardio_kind:'walk',outdoor:{distance_m:2349,points:[{lat:30,lng:-88},{lat:30.012,lng:-88}]}}}
 assert.equal(completedWorkoutKind(walk),'Cardio')
 assert.match(completedWorkoutSummary(walk),/mi/)
 assert.equal(completedWorkoutSummary({...walk,workout:{quick_cardio_kind:'walk',outdoor:{distance_m:22.56}}}),'≈74 ft')
})
test('warm-up and other logged activities are never mislabeled as zero pounds',()=>{
 const warmup={title:'DeFranco Agile 8',workout:{mobility:{items:[{done:true},{done:false}]}}}
 assert.equal(completedWorkoutKind(warmup),'Mobility')
 assert.equal(completedWorkoutSummary(warmup),'1 movement')
 assert.equal(completedWorkoutSummary({title:'Indoor Bike',workout:{quick_cardio:true,quick_timer_elapsed_seconds:76}}),'1:16')
 assert.equal(completedWorkoutSummary({title:'Free Workout',total_volume:16115}),'16,115 lb')
 assert.equal(completedWorkoutSummary({title:'Bench',total_volume:0}),'Strength logged')
})
test('workout history matches dates, exercise names and mobility movements',()=>{
 const row={title:'Upper-body baseline',session_date:'2026-11-17',workout:{exercises:[{name:'Bench Press'}]}}
 assert.equal(workoutHistoryDayKey(row),'2026-11-17')
 assert.equal(workoutHistoryMatches(row,'Strength','bench'),true)
 assert.equal(workoutHistoryMatches(row,'Cardio','bench'),false)
 assert.equal(workoutHistoryMatches(row,'All','2026-11-17'),true)
 assert.equal(workoutHistoryMatches({title:'Warmup',workout:{mobility:{items:[{title:'Groiners',done:true}]}}},'Mobility','groiners'),true)
 assert.equal(HISTORY_PAGE_SIZE,100)
})

test('manually entered cardio duration appears correctly in saved History',()=>{
 const walk={title:'Walk',workout:{quick_cardio:true,quick_cardio_kind:'walk',
   quick_timer_elapsed_seconds:0,metcon:{duration:'45 min'}}}
 assert.equal(completedWorkoutSummary(walk),'45:00')
 assert.equal(completedWorkoutSummary({...walk,workout:{...walk.workout,
   quick_timer_elapsed_seconds:120}}),'2:00')
})
