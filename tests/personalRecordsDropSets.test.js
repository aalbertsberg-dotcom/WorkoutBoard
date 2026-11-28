import test from 'node:test'
import assert from 'node:assert/strict'
import {completedStrengthSets,buildPersonalRecords} from '../src/personalRecords.js'

test('skipped sets and drop stages remain logged in workouts but do not inflate PRs',()=>{
  const rows=[{
    completed_at:'2026-11-28T16:00:00Z',
    workout:{exercises:[{name:'Strict press',setProgress:[
      {done:true,weight:'90',actual_reps:4},
      {done:true,weight:'50',actual_reps:30,drop_set:true,drop_stage:1},
      {done:false,skipped:true,weight:'200',actual_reps:5}
    ]}]}
  }]
  const strength=completedStrengthSets(rows)
  assert.deepEqual(strength.map(set=>[set.weight,set.reps,set.isDropSet]),[[90,4,false],[50,30,true]])
  const prs=buildPersonalRecords(rows)
  assert.equal(prs.length,1)
  assert.equal(prs[0].weight,90)
  assert.equal(strength.filter(set=>set.isDropSet).length,1)
})

test('only a user-confirmed alias merges two differently named exercise records',()=>{
  const rows=[
    {completed_at:'2026-11-28T16:00:00Z',workout:{exercises:[
      {name:'Hammer ISO lateral',setProgress:[{done:true,weight:90,actual_reps:8}]}]}},
    {completed_at:'2026-11-27T16:00:00Z',workout:{exercises:[
      {name:'ISO lateral raises',setProgress:[{done:true,weight:85,actual_reps:10}]}]}}
  ]
  assert.equal(buildPersonalRecords(rows).length,2)
  const withLink=buildPersonalRecords(rows,{'hammer iso lateral':'ISO lateral raises'})
  assert.equal(withLink.length,1)
  assert.ok(withLink[0].bestByReps[8]>=90)
})
