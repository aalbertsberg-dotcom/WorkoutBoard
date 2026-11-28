import {recordedWeightValue} from './trackingRules.js'
const pos=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):0
const legacy=v=>{const m=String(v||'').replace(/,/g,'').replace(/[×X]/g,'x').match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i);return m?{weight:pos(m[1]),reps:pos(m[2]),sets:pos(m[3])||1}:null}
export function isDistanceExercise(name){
 const v=String(name||'').trim().toLowerCase()
 if(/\brows?\b/.test(v)&&/\b(cable|dumbbell|db|barbell|seated|chest.supported|machine|hammer|iso.lateral|pendlay|bent.over|t.bar|one.arm|single.arm|landmine|seal)\b/.test(v))return false
 return /\b(carr(?:y|ies)|walk|run|running|row|rowing|bike|cycling|sled|sprint)\b/.test(v)
}
export function exerciseSetWeight(item,set){
 const load=item?.load!==undefined&&item?.load!==''?pos(item.load):pos(legacy(item?.result)?.weight)||(/^\d+(?:\.\d+)?$/.test(String(item?.result||'').trim())?pos(item.result):0)
 return pos(recordedWeightValue(set,load))
}
export function exerciseSetReps(item,set){
 const actual=set?.actual_reps??set?.actualReps
 if(set?.drop_set)return pos(actual)
 if(actual!=null&&actual!=='')return pos(actual)
 if(set?.reps!=null&&set?.reps!=='')return pos(set.reps)
 return pos(String(item?.prescription||'').match(/\d+\s*[x×]\s*(\d+(?:\.\d+)?)/i)?.[1])
}
export function workoutStrengthMetrics(workout={}){
 let volume=0,e1rm=0
 const add=(w,r,drop=false,count=1)=>{if(w&&r){volume+=w*r*count;if(!drop)e1rm=Math.max(e1rm,w*(1+r/30))}}
 for(const s of workout.main||[])if(s.done!==false&&!s.skipped)add(pos(s.weight),pos(s.actualReps??s.actual_reps))
 for(const ex of workout.exercises||[]){
  if(isDistanceExercise(ex.name))continue
  if(ex.setProgress?.length){for(const s of ex.setProgress)if(s.done&&!s.skipped)add(exerciseSetWeight(ex,s),exerciseSetReps(ex,s),Boolean(s.drop_set))}
  else if(ex.done!==false){const p=legacy(ex.result);if(p)add(p.weight,p.reps,false,p.sets)}
 }
 return {volume,e1rm}
}
export function correctedWorkoutMetrics(row,workout){
 const before=workoutStrengthMetrics(row.workout||{}),after=workoutStrengthMetrics(workout)
 const old={volume:Number(row.total_volume)||0,e1rm:Number(row.estimated_1rm)||0}
 if(row.workout?.quick_cardio||row.workout?.mobility||(!row.workout?.exercises?.length&&!row.workout?.main?.length&&!workout.exercises?.length&&!workout.main?.length))return old
 if(row.workout?.main?.length||row.legacy_log_id){
  const extra=Math.max(0,old.volume-before.volume)
  const joker=(workout.jokerSets||[]).filter(s=>s.done!==false&&!s.skipped&&pos(s.reps)).reduce((b,s)=>Math.max(b,pos(s.weight)*(1+pos(s.reps)/30)),0)
  return {volume:Math.round(extra+after.volume),e1rm:Math.round(Math.max(after.e1rm,joker)*100)/100}
 }
 return {volume:Math.round(after.volume),e1rm:Math.round(after.e1rm*100)/100}
}
