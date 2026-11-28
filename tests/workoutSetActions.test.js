import test from 'node:test'
import assert from 'node:assert/strict'
import {completeExerciseEarly,completeExerciseSet,reopenExerciseSet,deleteWorkoutSet,
  addDropSet,addDropStage,validateDropStage,pendingWorkoutSet} from '../src/workoutSetActions.js'
import {exerciseHistoryKey,resolveExerciseHistoryKey,exerciseAliasLookup,
  exerciseHistoryNames,rankExerciseHistoryCandidates,findExerciseNameSuggestions,aggregateExerciseHistory} from '../src/exerciseIdentity.js'

const exercise=()=>({name:'Strict press',done:false,setProgress:[
  {set:1,reps:4,done:true,weight:'90'},
  {set:2,reps:4,done:true,weight:'105'},
  {set:3,reps:4,done:false,weight:''},
  {set:4,reps:4,done:false,weight:''}
]})

test('finish after 2 of 4: keep real reps, mark only incomplete sets skipped',()=>{
  const out=completeExerciseEarly(exercise())
  assert.equal(out.done,true)
  assert.deepEqual(out.setProgress.map(set=>[set.done,Boolean(set.skipped)]),
    [[true,false],[true,false],[false,true],[false,true]])
  assert.equal(out.setProgress.filter(set=>set.done).length,2)
  assert.equal(out.setProgress.filter(pendingWorkoutSet).length,0)
  assert.equal(exercise().setProgress[2].skipped,undefined)
})

test('any set may be removed, completed set requires separate UI confirmation',()=>{
  const deleted=deleteWorkoutSet(exercise(),2)
  assert.equal(deleted.setProgress.length,3)
  assert.deepEqual(deleted.setProgress.map(set=>set.set),[1,2,3])
  const doneRemoved=deleteWorkoutSet(deleted,0)
  assert.equal(doneRemoved.setProgress.filter(set=>set.done).length,1)
  assert.equal(deleteWorkoutSet({setProgress:[{done:false}]},0).setProgress.length,1)
})

test('reopening a skipped set restores editable status',()=>{
  const ended=completeExerciseEarly(exercise())
  const reopened=reopenExerciseSet(ended,2)
  assert.equal(reopened.done,false)
  assert.equal(reopened.setProgress[2].skipped,false)
  assert.equal(reopened.setProgress[2].done,false)
  assert.equal(completeExerciseSet(reopened,2,'95').setProgress[2].done,true)
})

test('drop sets are distinct AMRAP sets with progressively lighter weights',()=>{
  const out=addDropSet(exercise(),123)
  const stages=out.setProgress.filter(set=>set.drop_set)
  assert.equal(out.setProgress.length,7)
  assert.deepEqual(stages.map(set=>set.weight),[105,85,65])
  assert.deepEqual(stages.map(set=>set.drop_stage),[1,2,3])
  assert.equal(stages.every(set=>set.actual_reps===''&&set.done===false&&set.extra),true)
  assert.equal(validateDropStage(stages[0],105,''),'Enter the actual reps completed for this drop stage.')
  assert.equal(validateDropStage(stages[0],'',12),'Enter the weight used for this drop stage.')
  assert.equal(validateDropStage(stages[0],105,'12'),'')
  const expanded=addDropStage(out)
  assert.equal(expanded.setProgress.at(-1).drop_stage,4)
  assert.equal(expanded.setProgress.at(-1).weight,50)
  const shortened=deleteWorkoutSet(expanded,5)
  assert.deepEqual(shortened.setProgress.filter(set=>set.drop_set).map(set=>set.drop_stage),[1,2,3])
})

test('history normalizes spelling conservatively, not machine names or motion',()=>{
  assert.equal(exerciseHistoryKey('ISO lateral raises'),'iso lateral raise')
  assert.equal(exerciseHistoryKey('iso-lateral raise'),'iso lateral raise')
  assert.equal(exerciseHistoryKey('Hammer ISO lateral'),'hammer iso lateral')
  assert.notEqual(exerciseHistoryKey('ISO lateral raises'),exerciseHistoryKey('Hammer ISO lateral'))
  const links=exerciseAliasLookup([{alias_key:'hammer iso lateral',canonical_name:'ISO lateral raises'}])
  assert.equal(resolveExerciseHistoryKey('Hammer ISO lateral',links),'iso lateral raise')
})

test('linked history combines confirmed sets, excludes skipped and drop sets from 1RM',()=>{
  const sessions=[{
    workout:{exercises:[{name:'Hammer ISO lateral',setProgress:[
      {weight:'80',actual_reps:'9',done:true},
      {weight:'60',actual_reps:'20',done:true,drop_set:true},
      {weight:'90',actual_reps:'7',skipped:true}
    ]}]}
  },{
    workout:{exercises:[{name:'ISO lateral raises',setProgress:[
      {weight:'70',actual_reps:'10',done:true}
    ]}]}
  }]
  const aliases=exerciseAliasLookup([{alias_key:'hammer iso lateral',canonical_name:'ISO lateral raises'}])
  const index=aggregateExerciseHistory(sessions,aliases,
    (_,set)=>Number(set.weight),(_,set)=>Number(set.actual_reps),()=>false)
  assert.equal(Object.keys(index).length,1)
  assert.equal(index['iso lateral raise'].bestWeight,80)
  assert.ok(index['iso lateral raise'].bestE>100)
  assert.equal(index['iso lateral raise'].sourceName,'Hammer ISO lateral')
  assert.deepEqual(exerciseHistoryNames(sessions),['Hammer ISO lateral','ISO lateral raises'])
})

test('similar names are suggested first but only linked by explicit user action',()=>{
  const names=['Bench Press','Hammer ISO lateral','Seated Cable Row','Lateral raises']
  const result=rankExerciseHistoryCandidates('ISO lateral raises',names)
  assert.equal(result[0],'Lateral raises')
  assert.ok(result.indexOf('Hammer ISO lateral')<result.indexOf('Bench Press'))
  assert.notEqual(resolveExerciseHistoryKey('ISO lateral raises'),
    resolveExerciseHistoryKey('Hammer ISO lateral'))
})

test('exercise name suggestions stay short, relevant and never merge automatically',()=>{
  const candidates=[
    'Bench Press','ISO lateral raises','Hammer ISO lateral','Standing Lateral Raise',
    'Cable Lateral Raises','Seated Dumbbell Lateral Raise',
    'Single-Arm Lateral Raise','Strict Press','Row'
  ]
  const matches=findExerciseNameSuggestions('lat',candidates)
  assert.ok(matches.length<=5)
  assert.ok(matches.length>0)
  assert.ok(matches.every(name=>/lateral/i.test(name)))
  assert.equal(findExerciseNameSuggestions('l',candidates).length,0)
  assert.equal(findExerciseNameSuggestions('xyz',candidates).length,0)
  const ordered=findExerciseNameSuggestions('iso lat',candidates)
  assert.equal(ordered[0],'ISO lateral raises')
  assert.ok(ordered.includes('Hammer ISO lateral'))
  assert.equal(exerciseHistoryKey('ISO lateral raises'),'iso lateral raise')
  assert.notEqual(exerciseHistoryKey('ISO lateral raises'),exerciseHistoryKey('Hammer ISO lateral'))
})
