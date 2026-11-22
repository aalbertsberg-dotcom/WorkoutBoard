import test from 'node:test'
import assert from 'node:assert/strict'
import {completedStrengthSets,buildPersonalRecords,recentPersonalRecords,REP_PR_TARGETS} from '../src/personalRecords.js'

const modern=(sets,completed='2026-11-20T12:00:00Z')=>({
  completed_at:completed,session_date:'2026-11-20',
  workout:{exercises:[{name:'Bench Press',setProgress:sets}]}
})
test('modern completed sets populate PRs without legacy result strings',()=>{
  const sessions=[modern([
    {weight:'135',reps:8,done:true},
    {weight:145,reps:5,done:true},
    {weight:300,reps:1,done:false}
  ])]
  const best=buildPersonalRecords(sessions)
  assert.equal(best.length,1)
  assert.equal(best[0].name,'Bench Press')
  assert.equal(best[0].bestByReps[1],145)
  assert.equal(best[0].bestByReps[3],145)
  assert.equal(best[0].bestByReps[5],145)
  assert.equal(best[0].bestByReps[8],135)
  assert.equal(best[0].bestByReps[10],undefined)
  // Highest Epley estimate is 135 × 8 even though 145 × 5 is heavier.
  assert.equal(best[0].weight,135)
  assert.equal(best[0].reps,8)
})
test('unfinished and planned sets cannot become strength records',()=>{
  const sessions=[modern([{weight:500,reps:5,done:false}]),modern([{weight:450,reps:5,done:true}],null)]
  assert.deepEqual(completedStrengthSets(sessions),[])
})
test('legacy logged result strings remain supported',()=>{
  const rows=[{completed_at:'2026-01-01',workout:{exercises:[{name:'Squat',result:'225 × 5'}]}}]
  const best=buildPersonalRecords(rows)
  assert.equal(best.length,1)
  assert.equal(best[0].bestByReps[5],225)
})
test('legacy main lift and modern sets combine without duplicate phantom PRs',()=>{
  const rows=[
    {completed_at:'2026-01-01',lift:'Squat',workout:{main:[{weight:185,actualReps:5}]}},
    {completed_at:'2026-02-01',workout:{exercises:[{name:'squat',setProgress:[{weight:205,reps:3,done:true}]}]}}
  ]
  const best=buildPersonalRecords(rows)
  assert.equal(best.length,1)
  assert.equal(best[0].bestByReps[3],205)
  assert.equal(best[0].bestByReps[5],185)
})
test('explicitly cleared weight never inherits the exercise suggested load',()=>{
  const rows=[{completed_at:'2026-01-01',workout:{exercises:[{name:'Press',load:95,setProgress:[
    {weight:'',weight_edited:true,reps:5,done:true},
    {weight:undefined,reps:5,done:true}
  ]}]}}]
  const sets=completedStrengthSets(rows)
  assert.equal(sets.length,1)
  assert.equal(sets[0].weight,95)
})
test('non-weighted cardio and unrealistic rep counts are ignored',()=>{
  const rows=[{completed_at:'2026-01-01',workout:{exercises:[{name:'Walk',setProgress:[{weight:0,reps:120,done:true}]},{name:'Bench',setProgress:[{weight:100,reps:500,done:true}]}]}}]
  assert.deepEqual(buildPersonalRecords(rows),[])
  assert.deepEqual(REP_PR_TARGETS,[1,3,5,8,10])
})

test('Progress overview and Records use the same completed strength bests',()=>{
  const rows=[
    {completed_at:'2026-11-18T09:00:00Z',workout:{exercises:[{name:'Deadlift',result:'',setProgress:[{weight:225,reps:5,done:true}]}]}},
    {completed_at:'2026-11-20T10:00:00Z',workout:{exercises:[{name:'Bench Press',result:'',setProgress:[{weight:135,reps:8,done:true}]}]}},
    {completed_at:'2026-11-21T10:00:00Z',workout:{exercises:[{name:'Deadlift',result:'',setProgress:[{weight:245,reps:3,done:true}]}]}}
  ]
  const records=buildPersonalRecords(rows)
  const recent=recentPersonalRecords(rows)
  assert.equal(recent.length,2)
  assert.deepEqual(recent.map(item=>item.label),['Deadlift','Bench Press'])
  for(const item of recent){
    const matching=records.find(record=>record.name===item.label)
    assert.equal(item.e1rm,matching.e1rm)
    assert.equal(item.date,matching.date)
    assert.deepEqual(item.set,{weight:matching.weight,reps:matching.reps})
  }
})
test('Progress hides PRs when there are no completed weighted sets',()=>{
  assert.deepEqual(recentPersonalRecords([modern([{weight:315,reps:3,done:false}])]),[])
})
