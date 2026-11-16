// Workout lifecycle rules. 'skipped' is terminal for a cancelled workout.
// Keep this module free of React/Supabase so refresh behavior can be regression-tested.
const ACTIVE_PREFIX='workset-current-workout-v1:'
const CANCEL_PREFIX='workset-cancelled-workouts-v1:'
const activeStatus=new Set(['started','planned'])

function storage(){
  try{return localStorage}catch{return null}
}
function safeRead(key,fallback){
  try{const raw=storage()?.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}
}

export function getActiveWorkoutId(userId) {
  if(!userId)return null
  return safeRead(ACTIVE_PREFIX+userId,null)?.id||null
}

export function setActiveWorkoutId(userId,id) {
  if(!userId||!id)return
  try{storage()?.setItem(ACTIVE_PREFIX+userId,JSON.stringify({id,updatedAt:Date.now()}))}catch{}
}

export function clearActiveWorkoutId(userId,id=null) {
  if(!userId)return
  if(id&&getActiveWorkoutId(userId)!==id)return
  try{storage()?.removeItem(ACTIVE_PREFIX+userId)}catch{}
}

export function cancelledWorkoutIds(userId) {
  if(!userId)return []
  return safeRead(CANCEL_PREFIX+userId,[])
}

export function rememberWorkoutCancellation(userId,id) {
  if(!userId||!id)return
  const ids=[id,...cancelledWorkoutIds(userId).filter(item=>item!==id)].slice(0,150)
  try{storage()?.setItem(CANCEL_PREFIX+userId,JSON.stringify(ids))}catch{}
  clearActiveWorkoutId(userId,id)
}

export function isOpenWorkout(row,cancelledIds=[]) {
  return Boolean(row?.id && activeStatus.has(row.status) &&
    !row.workout?.cancelled_explicitly && !cancelledIds.includes(row.id))
}

export function selectWorkoutToRestore(rows,{preferredId=null,cancelledIds=[],eligible=null}={}) {
  const available=(rows||[]).filter(row=>
    isOpenWorkout(row,cancelledIds) && (typeof eligible!=='function'||eligible(row))
  )
  const preferred=available.find(row=>row.id===preferredId)
  if(preferred)return preferred
  return available.sort((a,b)=>{
    const startedA=a.status==='started'?1:0,startedB=b.status==='started'?1:0
    if(startedA!==startedB)return startedB-startedA
    return String(b.created_at||'').localeCompare(String(a.created_at||''))
  })[0]||null
}
