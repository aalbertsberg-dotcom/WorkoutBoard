// IndexedDB is used for durable workout drafts and queued writes.
// localStorage remains a synchronous compatibility mirror for existing installs.
const DB_NAME='workset-recovery-v1'
const STORE='records'
let openPromise=null

const openDatabase=()=>{
  if(typeof indexedDB==='undefined')return Promise.resolve(null)
  if(!openPromise){
    openPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1)
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE)
      }
      request.onsuccess=()=>resolve(request.result)
      request.onerror=()=>reject(request.error||new Error('IndexedDB unavailable'))
      request.onblocked=()=>reject(new Error('IndexedDB upgrade blocked'))
    }).catch(()=>{openPromise=null;return null})
  }
  return openPromise
}

const operate=async (mode,key,value)=>{
  const db=await openDatabase()
  if(!db)return {ok:false,value:null}
  try{
    return await new Promise(resolve=>{
      const tx=db.transaction(STORE,mode==='read'?'readonly':'readwrite')
      const store=tx.objectStore(STORE)
      const request=mode==='read'?store.get(key):mode==='delete'?store.delete(key):store.put(value,key)
      let result=null,readOK=false
      request.onsuccess=()=>{if(mode==='read'){result=request.result??null;readOK=true}}
      request.onerror=()=>{try{tx.abort()}catch{}}
      tx.oncomplete=()=>resolve({ok:mode!=='read'||readOK,value:result})
      tx.onerror=()=>resolve({ok:false,value:null})
      tx.onabort=()=>resolve({ok:false,value:null})
    })
  }catch{return {ok:false,value:null}}
}

export const durableRead=async key=>(await operate('read',key)).value
export const durableWrite=async(key,value)=>(await operate('write',key,value)).ok
export const durableDelete=async key=>(await operate('delete',key)).ok

const draftKey=(userId,plannedId)=>'draft:'+userId+':'+plannedId
const draftWrites=new Map()
const enqueueDraftWrite=(key,action)=>{
  const prior=draftWrites.get(key)||Promise.resolve()
  const current=prior.catch(()=>{}).then(action)
  draftWrites.set(key,current)
  current.finally(()=>{if(draftWrites.get(key)===current)draftWrites.delete(key)}).catch(()=>{})
  return current
}
const legacyDraftKey=plannedId=>'wb-planned-draft-'+plannedId
const legacyDraftTime=plannedId=>'wb-planned-draft-ts-'+plannedId

export async function recoverWorkoutDraft(userId,plannedId,serverTimestamp=0){
  if(!userId||!plannedId)return null
  let local=null
  try{
    const value=localStorage.getItem(legacyDraftKey(plannedId))
    if(value)local={value:JSON.parse(value),savedAt:Number(localStorage.getItem(legacyDraftTime(plannedId))||0)}
  }catch{}
  const persisted=await durableRead(draftKey(userId,plannedId))
  const choices=[local,persisted].filter(x=>x&&Number(x.savedAt)>Number(serverTimestamp||0))
  choices.sort((a,b)=>b.savedAt-a.savedAt)
  return choices[0]||null
}
export async function persistWorkoutDraft(userId,plannedId,workout){
  if(!userId||!plannedId)return false
  const savedAt=Date.now()
  let localOK=false
  try{
    localStorage.setItem(legacyDraftKey(plannedId),JSON.stringify(workout))
    localStorage.setItem(legacyDraftTime(plannedId),String(savedAt))
    localOK=true
  }catch{}
  const key=draftKey(userId,plannedId)
  const indexedOK=await enqueueDraftWrite(key,()=>durableWrite(key,{savedAt,value:workout}))
  return Boolean(localOK||indexedOK)
}
export async function clearWorkoutDraft(userId,plannedId){
  if(!userId||!plannedId)return
  try{
    localStorage.removeItem(legacyDraftKey(plannedId))
    localStorage.removeItem(legacyDraftTime(plannedId))
  }catch{}
  const key=draftKey(userId,plannedId)
  await enqueueDraftWrite(key,()=>durableDelete(key))
}
