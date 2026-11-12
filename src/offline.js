const QUEUE_KEY='workset-offline-queue-v1'
const SESSION_KEY='workset-offline-session-v1'
const STATE_PREFIX='workset-offline-state-v1:'

const safeParse=(value,fallback)=>{
  try{return value?JSON.parse(value):fallback}catch{return fallback}
}

const queueRead=()=>safeParse(localStorage.getItem(QUEUE_KEY),[])
const queueWrite=queue=>{
  try{localStorage.setItem(QUEUE_KEY,JSON.stringify(queue))}catch{}
  emitOfflineChange()
}

const emitOfflineChange=detail=>{
  try{window.dispatchEvent(new CustomEvent('workset:offline-change',{detail}))}catch{}
}

export const offlineUuid=()=>{
  try{return crypto.randomUUID()}catch{
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8)
      return v.toString(16)
    })
  }
}

export const isOnline=()=>typeof navigator==='undefined' ? true : navigator.onLine!==false

export const isOfflineError=error=>{
  if(!error)return false
  if(!isOnline())return true
  const text=String(error?.message||error?.details||error||'').toLowerCase()
  return /failed to fetch|network|load failed|fetch failed|networkerror|connection|offline/.test(text)
}

export function saveOfflineSession(session){
  if(!session?.user)return
  const user=session.user
  const cached={
    user:{
      id:user.id,
      email:user.email||null,
      user_metadata:user.user_metadata||{},
      app_metadata:user.app_metadata||{},
      created_at:user.created_at||null,
    },
    offline:true,
    cached_at:new Date().toISOString(),
  }
  try{localStorage.setItem(SESSION_KEY,JSON.stringify(cached))}catch{}
}

export function readOfflineSession(){
  return safeParse(localStorage.getItem(SESSION_KEY),null)
}

export function clearOfflineSession(){
  try{localStorage.removeItem(SESSION_KEY)}catch{}
}

const stateKey=(userId,name)=>STATE_PREFIX+String(userId||'anonymous')+':'+name

export function writeOfflineState(userId,name,value){
  if(!userId||!name)return
  try{localStorage.setItem(stateKey(userId,name),JSON.stringify({savedAt:Date.now(),value}))}catch{}
}

export function readOfflineState(userId,name,fallback=null){
  if(!userId||!name)return fallback
  const item=safeParse(localStorage.getItem(stateKey(userId,name)),null)
  return item?.value??fallback
}

export function getPendingOfflineCount(userId=null){
  const queue=queueRead()
  return userId ? queue.filter(op=>op.userId===userId).length : queue.length
}

export function queueUpsert({userId,table,payload,onConflict='id',dedupeKey=null}){
  if(!userId||!table||!payload)return
  const queue=queueRead()
  const key=dedupeKey||('upsert:'+table+':'+(payload.id||payload.measured_on||offlineUuid()))
  const next={
    id:offlineUuid(),
    kind:'upsert',
    userId,
    table,
    payload,
    onConflict,
    dedupeKey:key,
    createdAt:new Date().toISOString(),
  }
  const existingIndex=queue.findIndex(op=>op.userId===userId&&op.dedupeKey===key)
  if(existingIndex>=0)queue.splice(existingIndex,1)
  queue.push(next)
  queueWrite(queue)
  return next
}

export async function upsertOfflineFirst(supabase,{userId,table,payload,onConflict='id',dedupeKey=null,select=false,single=false}){
  if(!isOnline()){
    queueUpsert({userId,table,payload,onConflict,dedupeKey})
    return {data:payload,error:null,offline:true}
  }
  try{
    let query=supabase.from(table).upsert(payload,{onConflict})
    if(select)query=query.select('*')
    if(single)query=query.single()
    const result=await query
    if(result.error&&isOfflineError(result.error)){
      queueUpsert({userId,table,payload,onConflict,dedupeKey})
      return {data:payload,error:null,offline:true}
    }
    return {...result,offline:false}
  }catch(error){
    if(isOfflineError(error)){
      queueUpsert({userId,table,payload,onConflict,dedupeKey})
      return {data:payload,error:null,offline:true}
    }
    return {data:null,error,offline:false}
  }
}

export async function syncOfflineQueue(supabase,userId){
  if(!userId||!isOnline())return {synced:0,pending:getPendingOfflineCount(userId),offline:!isOnline()}
  let queue=queueRead()
  let synced=0
  let lastError=null
  for(const op of [...queue]){
    if(op.userId!==userId)continue
    try{
      let result
      if(op.kind==='upsert'){
        result=await supabase.from(op.table).upsert(op.payload,{onConflict:op.onConflict})
      }
      if(result?.error){
        lastError=result.error
        if(isOfflineError(result.error))break
        // Keep server-rejected operations for review/retry rather than losing data.
        break
      }
      queue=queue.filter(item=>item.id!==op.id)
      queueWrite(queue)
      synced++
    }catch(error){
      lastError=error
      break
    }
  }
  const pending=queue.filter(op=>op.userId===userId).length
  emitOfflineChange({synced,pending,error:lastError?.message||null})
  if(synced>0&&pending===0){
    try{window.dispatchEvent(new CustomEvent('workset:offline-synced',{detail:{synced}}))}catch{}
  }
  return {synced,pending,error:lastError}
}
