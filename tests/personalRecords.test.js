import test from 'node:test'
import assert from 'node:assert/strict'
import {completedStrengthSets,buildPersonalRecords,REP_PR_TARGETS,mainLiftName,completedMainLiftSets,strengthTrendFromCompletedSets} from '../src/personalRecords.js'

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

test('Progress strength trend shows actual completed Deadlift and Back Squat sets',()=>{
  const rows=[
    {completed_at:'2026-11-20T10:00:00Z',workout:{exercises:[
      {name:'Back Squat',setProgress:[{weight:205,reps:6,done:true}]},
      {name:'Front Squat',setProgress:[{weight:135,reps:8,done:true}]}
    ]}},
    {completed_at:'2026-11-21T10:00:00Z',workout:{exercises:[
      {name:'Deadlift',setProgress:[{weight:275,reps:2,done:true},{weight:315,reps:2,done:false}]}
    ]}}
  ]
  const trend=strengthTrendFromCompletedSets(rows)
  assert.equal(trend.length,2)
  assert.deepEqual(trend.map(x=>x.lift),['Squat','Deadlift'])
  assert.equal(trend[0].e1rm,205*(1+6/30))
  assert.equal(trend[1].e1rm,275*(1+2/30))
  assert.equal(completedMainLiftSets(rows).length,2)
  assert.equal(mainLiftName('Front Squat'),null)
})
test('multiple sets in one workout create one best trend point per lift',()=>{
  const rows=[{completed_at:'2026-11-22T10:00:00Z',workout:{exercises:[
    {name:'Bench Press',setProgress:[{weight:135,reps:8,done:true},{weight:165,reps:5,done:true}]}
  ]}}]
  const trend=strengthTrendFromCompletedSets(rows)
  assert.equal(trend.length,1)
  assert.equal(trend[0].lift,'Bench')
  assert.equal(trend[0].weight,165)
})
