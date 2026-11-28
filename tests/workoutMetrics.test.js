import test from 'node:test'
import assert from 'node:assert/strict'
import {workoutStrengthMetrics,correctedWorkoutMetrics} from '../src/workoutMetrics.js'
import {completedStrengthSets} from '../src/personalRecords.js'
test('completed-set metrics exclude skipped and distance sets and count drop volume, not PRs',()=>{
 const workout={exercises:[{name:'Cable Row',load:100,prescription:'3 x 5',setProgress:[{done:true,actual_reps:'',weight:''},{done:true,weight:80,actual_reps:10,drop_set:true},{done:true,skipped:true,weight:500,reps:10},{done:false,weight:500,reps:10}]},{name:'Row',setProgress:[{done:true,weight:500,reps:10}]}]}
 const m=workoutStrengthMetrics(workout)
 assert.equal(m.volume,1300);assert.ok(Math.abs(m.e1rm-100*(1+5/30))<1e-8)
 assert.equal(correctedWorkoutMetrics({workout,total_volume:1300},workout).volume,1300)
 assert.equal(completedStrengthSets([{completed_at:'2026-11-28',workout}]).length,2)
})
test('legacy correction retains unrelated assistance and notes-only records',()=>{
 const row={legacy_log_id:'legacy',total_volume:1500,workout:{main:[{weight:100,actualReps:5}]}}
 assert.equal(correctedWorkoutMetrics(row,{main:[{weight:120,actualReps:5}]}).volume,1600)
 assert.equal(correctedWorkoutMetrics({total_volume:900,workout:{}},{note:'Edited'}).volume,900)
})
