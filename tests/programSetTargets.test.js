import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {partnerSetTarget,missingWorkoutOneRms} from '../src/programSetTargets.js'

const squat=pct=>({weight_lift:'Squat',weight_basis:'tm',tm_offset:0,pct})
const bench=pct=>({weight_lift:'Bench',weight_basis:'tm',tm_offset:0,pct})
const workout={exercises:[
  {name:'Squat',setProgress:[squat(35),squat(85)]},
  {name:'Bench',setProgress:[bench(35),bench(85)]},
]}
test('missing saved 1RMs explains blank targets without guessing loads',()=>{
  assert.deepEqual(missingWorkoutOneRms(workout,{}),['Squat','Bench'])
  assert.equal(partnerSetTarget({},squat(35)),'')
  assert.equal(partnerSetTarget({Squat:null},squat(85)),'')
})
test('1RM values entered later calculate the current and all upcoming sets',()=>{
  const maxes={Squat:200,Bench:160}
  assert.deepEqual(missingWorkoutOneRms(workout,maxes),[])
  assert.equal(partnerSetTarget(maxes,squat(35)),'60 lb')
  assert.equal(partnerSetTarget(maxes,squat(85)),'145 lb')
  assert.equal(partnerSetTarget(maxes,bench(35)),'50 lb')
  assert.equal(partnerSetTarget(maxes,bench(85)),'115 lb')
})
test('missing lifts can be entered individually',()=>{
  assert.deepEqual(missingWorkoutOneRms(workout,{Squat:200}),['Bench'])
})
test('the original second-cycle training max increases remain in force',()=>{
  const first=squat(85)
  const second={...first,tm_offset:10}
  assert.equal(partnerSetTarget({Squat:200},first),'145 lb')
  assert.equal(partnerSetTarget({Squat:200},second),'155 lb')
  assert.equal(partnerSetTarget({Bench:200},{...bench(85),tm_offset:5}),'150 lb')
})
test('recalculating from a new one-rep max does not require recreating the workout',()=>{
  const set=squat(85)
  assert.equal(partnerSetTarget({Squat:200},set),'145 lb')
  assert.equal(partnerSetTarget({Squat:220},set),'160 lb')
})
test('in-workout form persists values through per-account 1RM saver and updates all tiles',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  const runner=readFileSync(new URL('../src/productFeatures.jsx',import.meta.url),'utf8')
  assert.match(app,/onSaveOneRm=\{\(name,value\)=>setOneRm\(name,value\)\}/)
  assert.match(runner,/missingWorkoutOneRms\(workout,workoutOneRms\)/)
  assert.match(runner,/onSaveOneRm\(lift,Number\(oneRmDraft\[lift\]\)\)/)
  assert.match(runner,/programmedTarget>0&&activeSet\?\.weight_lift&&!activeSet\?\.weight_edited/)
  assert.match(runner,/const tileWeight=set.done\|\|set.weight_edited\?recordedWeight:\(suggestedWeight\|\|recordedWeight\)/)
})
