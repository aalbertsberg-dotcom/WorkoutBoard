import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const local=new Map()
globalThis.localStorage={
  getItem:key=>local.get(key)??null,
  setItem:(key,value)=>{local.set(key,String(value))},
  removeItem:key=>local.delete(key),
  key:index=>[...local.keys()][index]??null,
  get length(){return local.size}
}
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}})
globalThis.window={dispatchEvent:()=>true}
globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail}}
const {hydrateOfflineQueue,upsertOfflineFirst,getPendingOfflineCount,syncOfflineQueue,queueUpsert}=await import('../src/offline.js')
const {persistWorkoutDraft,recoverWorkoutDraft,clearWorkoutDraft}=await import('../src/durableStore.js')

test('An offline workout is persistently queued and only the newest edit remains',async()=>{
  await hydrateOfflineQueue()
  const first=await upsertOfflineFirst(null,{
    userId:'athlete-test',table:'planned_workouts',
    payload:{id:'workout-1',note:'first'},dedupeKey:'planned:workout-1'
  })
  assert.equal(first.offline,true)
  const newer=await upsertOfflineFirst(null,{
    userId:'athlete-test',table:'planned_workouts',
    payload:{id:'workout-1',note:'newer'},dedupeKey:'planned:workout-1'
  })
  assert.equal(newer.offline,true)
  assert.equal(getPendingOfflineCount('athlete-test'),1)
  const snapshot=JSON.parse(local.get('workset-offline-queue-v2'))
  assert.equal(snapshot.ops[0].payload.note,'newer')
})

test('Only one concurrent reconnect sync sends a queued workout',async()=>{
  let attempts=0
  globalThis.navigator.onLine=true
  const supabase={from:()=>({upsert:async()=>{attempts++;await new Promise(r=>setTimeout(r,10));return {error:null}}})}
  const [a,b]=await Promise.all([
    syncOfflineQueue(supabase,'athlete-test'),
    syncOfflineQueue(supabase,'athlete-test')
  ])
  assert.equal(a.synced,1)
  assert.equal(b.synced,1)
  assert.equal(attempts,1)
  assert.equal(getPendingOfflineCount('athlete-test'),0)
})

test('Rejected server writes stay queued for review and a later retry',async()=>{
  await queueUpsert({userId:'athlete-test',table:'planned_workouts',payload:{id:'workout-2'}})
  const rejected={from:()=>({upsert:async()=>({error:{message:'row rejected'}})})}
  const bad=await syncOfflineQueue(rejected,'athlete-test')
  assert.match(bad.error.message,/rejected/)
  assert.equal(getPendingOfflineCount('athlete-test'),1)
  const accepted={from:()=>({upsert:async()=>({error:null})})}
  const good=await syncOfflineQueue(accepted,'athlete-test')
  assert.equal(good.synced,1)
  assert.equal(getPendingOfflineCount('athlete-test'),0)
})

test('A local draft is recovered and cleared without touching unrelated keys',async()=>{
  const saved={quick_cardio:true,exercises:[{name:'Bench',setProgress:[{done:true,weight:185}]}]}
  assert.equal(await persistWorkoutDraft('athlete-test','draft-test',saved),true)
  const recovered=await recoverWorkoutDraft('athlete-test','draft-test',Date.now()-10000)
  assert.deepEqual(recovered.value,saved)
  await clearWorkoutDraft('athlete-test','draft-test')
  assert.equal(await recoverWorkoutDraft('athlete-test','draft-test',0),null)
})

test('Release requires pending workout protection, cache-versioning, and crash recovery',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
  const app=read('src/App.jsx')
  const sw=read('public/sw.js')
  const main=read('src/main.jsx')
  const runner=read('src/productFeatures.jsx')
  assert.match(app,/const updateBlocked=Boolean/)
  assert.match(app,/offlineStatus\.pending>0/)
  assert.match(app,/if\(!releaseUpdate\?\.buildId\|\|updateBlocked\)return/)
  assert.doesNotMatch(app,/reg\.unregister\(\)/)
  assert.match(sw,/workset-offline-v2-/)
  assert.match(sw,/matchAll/)
  assert.match(main,/<WorksetErrorBoundary>/)
  assert.match(runner,/await queueUpsert/)
  assert.match(runner,/await clearWorkoutDraft/)
})

test('On reconnect, pending edits flush before a new online edit is sent',async()=>{
  globalThis.navigator.onLine=false
  await queueUpsert({userId:'athlete-test',table:'planned_workouts',payload:{id:'workout-3',note:'older'}})
  globalThis.navigator.onLine=true
  const sent=[]
  const supabase={from:()=>({upsert:async payload=>{sent.push(payload.note);return {error:null}}})}
  const current=await upsertOfflineFirst(supabase,{
    userId:'athlete-test',table:'planned_workouts',payload:{id:'workout-3',note:'newest'}
  })
  assert.equal(current.error,null)
  assert.deepEqual(sent,['older','newest'])
  assert.equal(getPendingOfflineCount('athlete-test'),0)
})

test('Release guard is initialized only after the workout progress helper',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.ok(app.indexOf('const updateBlocked=Boolean(')>app.indexOf('const plannedWorkoutHasProgress = row => {'))
})

test('Update toast stays out of the way of an unfinished workout',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/releaseUpdate&&!updateBlocked&&<div className="release-update-toast"/)
})

test('Release updates are blocked until durable pending-workout queue has loaded',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/ready:false/)
  assert.match(app,/!offlineStatus.ready\|\|!offlineStatus.online/)
})
