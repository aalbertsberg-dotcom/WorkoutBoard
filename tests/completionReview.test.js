import test from 'node:test'
import assert from 'node:assert/strict'
import {completionCounts} from '../src/completionReview.js'
test('review counts only completed modern sets and shows skipped/unfinished separately',()=>{
 const c=completionCounts({exercises:[{name:'Bench Press',setProgress:[{done:true,weight:100,reps:5},{done:true,weight:80,actual_reps:10,drop_set:true},{skipped:true,done:true,weight:200,reps:5},{done:false,weight:300,reps:5}]},{name:'Cable Row',setProgress:[{done:false,weight:10,reps:3}]}]})
 assert.equal(c.exercises,1);assert.equal(c.sets,2);assert.equal(c.skipped,1);assert.equal(c.unfinished,2)
 assert.equal(c.rows[0].volume,1300);assert.equal(c.rows[0].best.weight,100)
})
test('distance exercise completed sets never contribute pound volume',()=>{
 const c=completionCounts({exercises:[{name:'Row',setProgress:[{done:true,weight:50,reps:5}]}]})
 assert.equal(c.sets,1);assert.equal(c.rows[0].volume,0);assert.equal(c.rows[0].best,null)
})

test('summary preserves original set positions and all completion statuses',()=>{const c=completionCounts({exercises:[{name:'Bench Press',setProgress:[{done:true,weight:100,reps:5},{done:false,skipped:true},{done:false},{done:true,drop_set:true,drop_stage:1,weight:60,actual_reps:8}]}]});assert.deepEqual(c.rows[0].allSets.map(s=>[s.label,s.status]),[['Set 1','Completed'],['Set 2','Skipped'],['Set 3','Not completed'],['Drop 1','Completed']]);assert.equal(c.sets,2)})
