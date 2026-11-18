import test from 'node:test'
import assert from 'node:assert/strict'
import {createQueuedPatchSaver} from '../src/reliableSaves.js'
test('1RM failure never commits a value and later saves do not carry the failed value',async()=>{
  let commits=[]
  const saves=[]
  const saver=createQueuedPatchSaver({
    initial:{Bench:185,Deadlift:275},
    persist:async data=>{
      saves.push({...data})
      if(data.Bench===999)return {error:new Error('backend rejected')}
      return {error:null}
    },onCommit:val=>commits.push(val)
  })
  const rejected=await saver.save({Bench:999})
  assert.match(rejected.error.message,/rejected/)
  assert.deepEqual(saver.values(),{Bench:185,Deadlift:275})
  assert.deepEqual(commits,[])
  const accepted=await saver.save({Deadlift:300})
  assert.equal(accepted.error,null)
  assert.deepEqual(saver.values(),{Bench:185,Deadlift:300})
  assert.deepEqual(saves[1],{Bench:185,Deadlift:300})
  assert.equal(commits.length,1)
})
test('Concurrent lift changes commit sequentially in order, without losing either change',async()=>{
  const sent=[]
  const saver=createQueuedPatchSaver({
    initial:{Bench:185,Deadlift:275},
    persist:async next=>{await new Promise(done=>setTimeout(done,6));sent.push({...next});return {error:null}}
  })
  const [first,second]=await Promise.all([saver.save({Bench:205}),saver.save({Deadlift:315})])
  assert.equal(first.error,null);assert.equal(second.error,null)
  assert.deepEqual(sent[0],{Bench:205,Deadlift:275})
  assert.deepEqual(sent[1],{Bench:205,Deadlift:315})
  assert.deepEqual(saver.values(),{Bench:205,Deadlift:315})
})
test('Saving all baseline maxes updates all four values after persistence',async()=>{
  const snapshot=[]
  const saver=createQueuedPatchSaver({
    initial:{Squat:250,Bench:185,Deadlift:275,Press:115},
    persist:async()=>({error:null}),
    onCommit:val=>snapshot.push(val)
  })
  const result=await saver.save({Squat:275,Bench:205,Deadlift:305,Press:125})
  assert.equal(result.error,null)
  assert.deepEqual(snapshot[0],{Squat:275,Bench:205,Deadlift:305,Press:125})
})
test('An exception during persistence rejects a save without poisoning subsequent updates',async()=>{
  let first=true
  const saver=createQueuedPatchSaver({
    initial:{Bench:185},persist:async()=>{
      if(first){first=false;throw new Error('Network failure')}
      return {error:null}
    }
  })
  assert.match((await saver.save({Bench:195})).error.message,/Network failure/)
  assert.deepEqual(saver.values(),{Bench:185})
  assert.equal((await saver.save({Bench:205})).error,null)
  assert.deepEqual(saver.values(),{Bench:205})
})
