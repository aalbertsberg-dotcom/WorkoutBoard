import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  workoutFocusKey,readWorkoutFocus,saveWorkoutFocus,clearWorkoutFocus,resolveWorkoutFocus
} from '../src/workoutFocusState.js'

const storage=()=>{
  const m=new Map()
  return {
    getItem:key=>m.get(key)??null,
    setItem:(key,value)=>m.set(key,value),
    removeItem:key=>m.delete(key),
    all:()=>m,
  }
}

const workout={exercises:[
  {id:'e1',name:'Squat',setProgress:[{done:false}]},
  {id:'e2',name:'Bench',setProgress:[{done:false}]},
  {id:'added-8892',name:'Incline Dumbbell Press',custom_added:true,
    setProgress:[{done:true,weight:50},{done:false,weight:50},{done:false,weight:50}]},
]}

test('restores an added exercise and its next unfinished set after screen lock',()=>{
  const s=storage()
  assert.equal(saveWorkoutFocus('athlete-A','planned-week2',workout.exercises[2],1,s),true)
  const stored=readWorkoutFocus('athlete-A','planned-week2',s)
  assert.deepEqual(resolveWorkoutFocus(workout,stored),{
    index:2,key:'added-8892',setIndex:1
  })
})
test('focus is isolated by user AND planned workout even on same device',()=>{
  const s=storage()
  saveWorkoutFocus('athlete-A','day2',workout.exercises[2],1,s)
  assert.equal(readWorkoutFocus('athlete-B','day2',s),null)
  assert.equal(readWorkoutFocus('athlete-A','day3',s),null)
  assert.ok(workoutFocusKey('athlete-A','day2').includes('athlete-A'))
})
test('inserted or removed program exercises cannot move focus to the wrong card',()=>{
  const s=storage()
  saveWorkoutFocus('athlete-A','day2',workout.exercises[2],1,s)
  const focus=readWorkoutFocus('athlete-A','day2',s)
  const reOrdered={exercises:[workout.exercises[2],workout.exercises[0]]}
  assert.equal(resolveWorkoutFocus(reOrdered,focus).index,0)
  assert.equal(resolveWorkoutFocus({exercises:[workout.exercises[0]]},focus),null)
})
test('previously completed set reopens at next unfinished one without reverting progress',()=>{
  const s=storage()
  saveWorkoutFocus('athlete-A','day2',workout.exercises[2],1,s)
  const next={exercises:[{...workout.exercises[2],setProgress:[
    {done:true},{done:true},{done:false}
  ]}]}
  const focus=resolveWorkoutFocus(next,readWorkoutFocus('athlete-A','day2',s))
  assert.equal(focus.index,0)
  assert.equal(focus.setIndex,null)
  assert.equal(next.exercises[0].setProgress[1].done,true)
})
test('focus is cleared when a workout finishes or is cancelled',()=>{
  const s=storage()
  saveWorkoutFocus('athlete-A','day2',workout.exercises[2],1,s)
  assert.equal(clearWorkoutFocus('athlete-A','day2',s),true)
  assert.equal(readWorkoutFocus('athlete-A','day2',s),null)
})
test('stale, invalid, and corrupt focus cannot reopen a different workout',()=>{
  const s=storage(),key=workoutFocusKey('athlete-A','day2')
  s.setItem(key,'{')
  assert.equal(readWorkoutFocus('athlete-A','day2',s),null)
  s.setItem(key,JSON.stringify({version:1,exerciseId:'added-8892',savedAt:Date.now()-15*24*60*60*1000}))
  assert.equal(readWorkoutFocus('athlete-A','day2',s),null)
  s.setItem(key,JSON.stringify({version:1,exerciseId:'added-8892',exerciseName:'Another exercise',savedAt:Date.now()}))
  assert.equal(resolveWorkoutFocus(workout,readWorkoutFocus('athlete-A','day2',s)),null)
})
test('runner preserves selection on wake refresh and restores after durable draft recovery',()=>{
  const src=readFileSync(new URL('../src/productFeatures.jsx',import.meta.url),'utf8')
  assert.match(src,/On iOS\/Android wake, refreshPlannedToday updates the server timestamp/)
  assert.match(src,/switchedWorkout=lastRunnerWorkoutIdRef\.current!==planned\?\.id/)
  assert.match(src,/}\,\[planned\?\.id\]\)/)
  assert.match(src,/readWorkoutFocus\(planned.user_id,planned.id\)/)
  assert.match(src,/saveWorkoutFocus\(planned\?\.user_id,planned\?\.id,item,0\)/)
  assert.match(src,/focusDraftReady=draftReady&&draftReadyForId===planned\?\.id/)
  assert.match(src,/clearWorkoutFocus\(planned.user_id,planned.id\)/)
  assert.match(src,/scrollIntoView\(\{behavior:'auto',block:'nearest'\}\)/)
  assert.match(src,/document.addEventListener\('visibilitychange',hidden\)/)
  assert.match(src,/window.addEventListener\('pagehide',saveFocus\)/)
})
