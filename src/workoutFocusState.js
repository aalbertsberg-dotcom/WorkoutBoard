// Pure focus persistence for the planned-workout runner. Focus state is
// scoped by account AND workout ID; workout/set data stays in durableStore.
const MAX_AGE_MS=14*24*60*60*1000

export function workoutFocusKey(userId,plannedId){
  if(!userId||!plannedId)return ''
  return 'wb-workout-focus:'+userId+':'+plannedId
}

export function readWorkoutFocus(userId,plannedId,storage=typeof localStorage==='undefined'?null:localStorage){
  const key=workoutFocusKey(userId,plannedId)
  if(!key||!storage)return null
  try{
    const value=JSON.parse(storage.getItem(key)||'null')
    if(!value||value.version!==1||!value.exerciseId||!Number.isFinite(value.savedAt)||
      value.savedAt>Date.now()+60000||Date.now()-value.savedAt>MAX_AGE_MS)return null
    return value
  }catch{return null}
}

export function saveWorkoutFocus(userId,plannedId,exercise,setIndex=null,storage=typeof localStorage==='undefined'?null:localStorage){
  const key=workoutFocusKey(userId,plannedId)
  if(!key||!storage||!exercise)return false
  const id=exercise.id
  if(id===undefined||id===null||String(id).length===0)return false
  const value={
    version:1,exerciseId:String(id),exerciseName:String(exercise.name||''),
    setIndex:Number.isInteger(setIndex)&&setIndex>=0?setIndex:null,savedAt:Date.now()
  }
  try{storage.setItem(key,JSON.stringify(value));return true}catch{return false}
}

export function clearWorkoutFocus(userId,plannedId,storage=typeof localStorage==='undefined'?null:localStorage){
  const key=workoutFocusKey(userId,plannedId)
  if(!key||!storage)return false
  try{storage.removeItem(key);return true}catch{return false}
}

export function resolveWorkoutFocus(workout,saved){
  if(!saved?.exerciseId)return null
  const exercises=workout?.exercises||[]
  const index=exercises.findIndex(item=>String(item.id||'')===saved.exerciseId&&
    (!saved.exerciseName||String(item.name||'')===saved.exerciseName))
  if(index<0)return null
  const item=exercises[index]
  // An already completed set is never reopened by restoring its old index.
  const sets=item.setProgress||[]
  const setIndex=Number.isInteger(saved.setIndex)&&
    saved.setIndex>=0&&saved.setIndex<sets.length&&!sets[saved.setIndex].done
    ? saved.setIndex:null
  return {index,key:String(item.id||index),setIndex}
}
