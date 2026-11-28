import {resolveExerciseHistoryKey} from './exerciseIdentity.js'
import {exerciseSetWeight,exerciseSetReps,isDistanceExercise} from './workoutMetrics.js'

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
export function completedStrengthSets(rows=[],aliases={}){
  const sets=[]
  for(const row of rows||[]){
    if(!row?.completed_at)continue
    const date=row.completed_at||row.session_date
    const add=(name,weight,reps,isDropSet=false)=>{
      if(!String(name||'').trim()||!validSet(weight,reps))return
      const w=Number(weight),r=Number(reps)
      sets.push({name:String(name).trim(),identity:resolveExerciseHistoryKey(name,aliases),
        weight:w,reps:r,e1rm:w*(1+r/30),date,isDropSet})
    }
    for(const set of row.workout?.main||[]){
      if(set.done===false||set.skipped)continue
      add(row.primary_lift||row.lift||row.title||'Lift',set.weight,set.actualReps??set.actual_reps)
    }
    for(const ex of row.workout?.exercises||[]){
      if(isDistanceExercise(ex.name))continue
      const progress=Array.isArray(ex.setProgress)?ex.setProgress:[]
      const actual=progress.filter(set=>set.done===true&&!set.skipped)
      if(actual.length){
        for(const set of actual){
          add(ex.name||row.primary_lift||row.title,exerciseSetWeight(ex,set),exerciseSetReps(ex,set),Boolean(set.drop_set))
        }
      }else if(progress.length===0&&ex.done!==false){
        const legacy=parseLegacyResult(ex.result)
        if(legacy)add(ex.name||row.primary_lift||row.title,legacy.weight,legacy.reps)
      }
    }
  }
  return sets
}

export function buildPersonalRecords(rows=[],aliases={}){
  const map=new Map()
  for(const set of completedStrengthSets(rows,aliases)){
    // Burnout stages contribute volume, not a new 1RM or rep PR.
    if(set.isDropSet)continue
    const key=set.identity
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

// Do not conflate different movements (e.g. Front Squat with Back Squat).
// Used by analytics only; never overwrites the user's saved 1RM baseline.
export function mainLiftName(name){
  const normalized=String(name||'').toLowerCase().trim().replace(/\s+/g,' ')
  if(['squat','back squat','barbell squat'].includes(normalized))return 'Squat'
  if(['bench','bench press','barbell bench press','flat bench press'].includes(normalized))return 'Bench'
  if(['deadlift','conventional deadlift'].includes(normalized))return 'Deadlift'
  if(['press','strict press','overhead press','barbell overhead press'].includes(normalized))return 'Press'
  return null
}

export function completedMainLiftSets(rows=[]){
  return completedStrengthSets(rows).flatMap(set=>{
    const lift=mainLiftName(set.name)
    return lift?[{...set,lift}]:[]
  })
}

// One best set per lift per completed workout, for a useful training trend.
export function strengthTrendFromCompletedSets(rows=[]){
  const best=new Map()
  for(const set of completedMainLiftSets(rows)){
    if(set.isDropSet)continue
    const key=set.lift+':'+String(set.date)
    if(!best.has(key)||set.e1rm>best.get(key).e1rm)best.set(key,set)
  }
  return [...best.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
}
