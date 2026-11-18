// Stable links from Progress rows to the full History screen.
// Older training-log IDs are intentionally distinguishable from session IDs.
export const progressWorkoutLink=row=>{
  if(!row?.id)return null
  if(row.legacyId)return 'legacy-'+String(row.legacyId)
  return String(row.sessionId||row.id).replace(/^flex-/,'')
}
export const isLegacyWorkoutLink=id=>String(id||'').startsWith('legacy-')
export function legacyWorkoutDetail(row){
  if(!row?.id)return null
  const workout=row.workout||{}
  const main=workout.main||[]
  const total=main.reduce((sum,set)=>{
    const weight=Number(set.weight||0),reps=Number(set.actualReps??set.reps??0)
    return sum+(Number.isFinite(weight*reps)?weight*reps:0)
  },0)
  const estimated=main.reduce((best,set)=>{
    const weight=Number(set.weight||0),reps=Number(set.actualReps??set.reps??0)
    return Math.max(best,weight>0&&reps>0?weight*(1+reps/30):0)
  },0)
  return {...row,id:'legacy-'+row.id,title:(row.lift||'Strength')+' Day',
    session_date:String(row.completed_at||'').slice(0,10),
    total_volume:row._metrics?.volume??total,
    estimated_1rm:row._metrics?.estimated1rm??estimated,
    workout,__legacy:true}
}
