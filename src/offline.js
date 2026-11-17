import {durableRead,durableWrite} from './durableStore'

// Every pending upsert is persisted before the UI reports "Saved offline".
// The v1 localStorage queue is imported automatically on first 2.6.6 run.
const LEGACY_QUEUE_KEY='workset-offline-queue-v1'
const QUEUE_KEY='workset-offline-queue-v2'
const DURABLE_QUEUE_KEY='offline-queue-v2'
const SESSION_KEY='workset-offline-session-v1'
const STATE_PREFIX='workset-offline-state-v1:'

const safeParse=(value,fallback)=>{
  try{return value?JSON.parse(value):fallback}catch{return fallback}
}
const storageGet=key=>{try{return localStorage.getItem(key)}catch{return null}}
const storageSet=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}}
const legacyQueue=()=>{const value=safeParse(storageGet(LEGACY_QUEUE_KEY),[]);return Array.isArray(value)?value:[]}
const localSnapshot=()=>{
  const record=safeParse(storageGet(QUEUE_KEY),null)
  if(record&&Array.isArray(record.ops)&&Number.isFinite(record.rev))return record
  return {rev:0,ops:legacyQueue()}
}
let current=null
let ready=null
let mutationChain=Promise.resolve()
const syncInFlight=new Map()
const emitOfflineChange=detail=>{
  try{window.dispatchEvent(new CustomEvent('workset:offline-change',{detail}))}catch{}
}

const queueRead=()=>current?.ops||localSnapshot().ops

export async function hydrateOfflineQueue(){
  if(ready)return ready
  ready=(async()=>{
    const local=localSnapshot()
    const durable=await durableRead(DURABLE_QUEUE_KEY)
    // Select the newer complete snapshot; never resurrect v1 entries after a
    // v2 queue has deliberately been emptied by a successful synchronization.
    const chosen=durable&&Array.isArray(durable.ops)&&Number(durable.rev)>Number(local.rev)?durable:local
    current={rev:Number(chosen.rev||0),ops:[...chosen.ops]}
    // Migrate pre-upgrade localStorage queues into IndexedDB.
    if(!durable||Number(durable.rev)<current.rev)await durableWrite(DURABLE_QUEUE_KEY,current)
    storageSet(QUEUE_KEY,JSON.stringify(current))
    emitOfflineChange({pending:current.ops.length})
    return current
  })()
  return ready
}
const exclusive=operation=>{
  const pending=mutationChain.then(operation,operation)
  mutationChain=pending.catch(()=>{})
  return pending
}
const writeQueue=async ops=>{
  const next={rev:Math.max(Date.now(),Number(current?.rev||0)+1),ops}
  const [durableOK,localOK]=await Promise.all([
    durableWrite(DURABLE_QUEUE_KEY,next),
    Promise.resolve(storageSet(QUEUE_KEY,JSON.stringify(next)))
  ])
  if(!durableOK&&!localOK)throw new Error('Workout could not be saved locally. Check browser storage.')
  current=next
  emitOfflineChange({pending:next.ops.length})
  return next
}

export const offlineUuid=()=>{
  try{return crypto.randomUUID()}catch{
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8)
      return v.toString(16)
    })
  }
}
export const isOnline=()=>typeof navigator==='undefined'?true:navigator.onLine!==false
export const isOfflineError=error=>{
  if(!error)return false
  if(!isOnline())return true
  const str=String(error?.message||error?.details||error||'').toLowerCase()
  return /failed to fetch|network|load failed|fetch failed|networkerror|connection|offline/.test(str)
}

export function saveOfflineSession(session){
  if(!session?.user)return
  const user=session.user
  storageSet(SESSION_KEY,JSON.stringify({
    user:{
      id:user.id,email:user.email||null,
      user_metadata:user.user_metadata||{},
      app_metadata:user.app_metadata||{},created_at:user.created_at||null
    },offline:true,cached_at:new Date().toISOString()
  }))
}
export const readOfflineSession=()=>safeParse(storageGet(SESSION_KEY),null)
export const clearOfflineSession=()=>{try{localStorage.removeItem(SESSION_KEY)}catch{}}
const stateKey=(userId,name)=>STATE_PREFIX+String(userId||'anonymous')+':'+name
export function writeOfflineState(userId,name,value){
  if(!userId||!name)return
  storageSet(stateKey(userId,name),JSON.stringify({savedAt:Date.now(),value}))
}
export function readOfflineState(userId,name,fallback=null){
  if(!userId||!name)return fallback
  const item=safeParse(storageGet(stateKey(userId,name)),null)
  return item?.value??fallback
}
export function getPendingOfflineCount(userId=null){
  const queue=queueRead()
  return userId?queue.filter(op=>op.userId===userId).length:queue.length
}
export async function queueUpsert({userId,table,payload,onConflict='id',dedupeKey=null}){
  if(!userId||!table||!payload)throw new Error('Cannot queue an incomplete workout update')
  return exclusive(async()=>{
    await hydrateOfflineQueue()
    const key=dedupeKey||('upsert:'+table+':'+(payload.id||payload.measured_on||offlineUuid()))
    const next={
      id:offlineUuid(),kind:'upsert',userId,table,payload,onConflict,
      dedupeKey:key,createdAt:new Date().toISOString()
    }
    const queue=queueRead().filter(op=>!(op.userId===userId&&op.dedupeKey===key))
    queue.push(next)
    await writeQueue(queue)
    return next
  })
}
const queueNetworkFailure=async opts=>{
  try{
    await queueUpsert(opts)
    return {data:opts.payload,error:null,offline:true}
  }catch(error){return {data:null,error,offline:false}}
}
export async function upsertOfflineFirst(supabase,{userId,table,payload,onConflict='id',dedupeKey=null,select=false,single=false}){
  const opts={userId,table,payload,onConflict,dedupeKey}
  if(!isOnline())return queueNetworkFailure(opts)
  try{
    let query=supabase.from(table).upsert(payload,{onConflict})
    if(select)query=query.select('*')
    if(single)query=query.single()
    const result=await query
    if(result.error&&isOfflineError(result.error))return queueNetworkFailure(opts)
    return {...result,offline:false}
  }catch(error){
    if(isOfflineError(error))return queueNetworkFailure(opts)
    return {data:null,error,offline:false}
  }
}
export function syncOfflineQueue(supabase,userId){
  if(!userId)return Promise.resolve({synced:0,pending:0})
  if(syncInFlight.has(userId))return syncInFlight.get(userId)
  const run=(async()=>{
    await hydrateOfflineQueue()
    if(!isOnline())return {synced:0,pending:getPendingOfflineCount(userId),offline:true}
    let synced=0,lastError=null
    for(const op of queueRead().filter(item=>item.userId===userId)){
      if(!isOnline())break
      try{
        const result=await supabase.from(op.table).upsert(op.payload,{onConflict:op.onConflict})
        if(result.error){lastError=result.error;break}
        // Don't remove a newer edit that replaced the same dedupe key while
        // this network request was in flight.
        await exclusive(async()=>{
          await hydrateOfflineQueue()
          if(queueRead().some(item=>item.id===op.id))
            await writeQueue(queueRead().filter(item=>item.id!==op.id))
        })
        synced++
      }catch(error){lastError=error;break}
    }
    const pending=getPendingOfflineCount(userId)
    const error=lastError?.message||null
    emitOfflineChange({synced,pending,error})
    if(synced>0&&pending===0){
      try{window.dispatchEvent(new CustomEvent('workset:offline-synced',{detail:{synced}}))}catch{}
    }
    return {synced,pending,error:lastError}
  })()
  syncInFlight.set(userId,run)
  run.finally(()=>{if(syncInFlight.get(userId)===run)syncInFlight.delete(userId)}).catch(()=>{})
  return run
}
