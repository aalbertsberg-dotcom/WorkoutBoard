// Completed workout records shared by the Progress PR board and Records view.
// A set with "done: true" is a real logged set; planned sets are NOT records.
const parseLegacyResult=value=>{
  const match=String(value||'').replace(/,/g,'').replace(/[×X]/g,'x')
    .match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i)
  return match?{weight:Number(match[1]),reps:Number(match[2])}:null
}
const validSet=(weight,reps)=>Number.isFinite(Number(weight))&&Number(weight)>0&&
  Number.isInteger(Number(reps))&&Number(reps)>0&&Number(reps)<=100

export const REP_PR_TARGETS=[1,3,5,8,10]

// Returns only actual completed sets, from both modern and legacy workouts.
export function completedStrengthSets(rows=[]){
  const sets=[]
  for(const row of rows||[]){
    if(!row?.completed_at)continue
    const date=row.completed_at||row.session_date
    const add=(name,weight,reps)=>{
      if(!String(name||'').trim()||!validSet(weight,reps))return
      const w=Number(weight),r=Number(reps)
      sets.push({name:String(name).trim(),weight:w,reps:r,e1rm:w*(1+r/30),date})
    }
    for(const set of row.workout?.main||[]){
      if(set.done===false)continue
      add(row.primary_lift||row.lift||row.title||'Lift',set.weight,set.actualReps??set.actual_reps)
    }
    for(const ex of row.workout?.exercises||[]){
      const progress=Array.isArray(ex.setProgress)?ex.setProgress:[]
      const actual=progress.filter(set=>set.done===true)
      if(actual.length){
        for(const set of actual){
          const weight=set.weight_edited?set.weight:(set.weight??ex.load)
          add(ex.name||row.primary_lift||row.title,weight,set.actual_reps??set.actualReps??set.reps)
        }
      }else if(progress.length===0){
        const legacy=parseLegacyResult(ex.result)
        if(legacy)add(ex.name||row.primary_lift||row.title,legacy.weight,legacy.reps)
      }
    }
  }
  return sets
}

export function buildPersonalRecords(rows=[]){
  const map=new Map()
  for(const set of completedStrengthSets(rows)){
    const key=set.name.toLocaleLowerCase()
    let record=map.get(key)
    if(!record){
      record={name:set.name,weight:0,reps:0,e1rm:0,date:set.date,bestByReps:{}}
      map.set(key,record)
    }
    if(set.e1rm>record.e1rm){
      record.weight=set.weight
      record.reps=set.reps
      record.e1rm=set.e1rm
      record.date=set.date
    }
    // A 135x10 set qualifies for "8+ reps", not an actual 8RM test.
    for(const minReps of REP_PR_TARGETS)
      if(set.reps>=minReps)
        record.bestByReps[minReps]=Math.max(record.bestByReps[minReps]||0,set.weight)
  }
  return [...map.values()].sort((a,b)=>b.e1rm-a.e1rm||a.name.localeCompare(b.name))
}
