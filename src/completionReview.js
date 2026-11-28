import {exerciseSetWeight,exerciseSetReps,isDistanceExercise} from './workoutMetrics.js'
export function completionExerciseRows(workout={}){
 const rows=[]
 const summarize=(name,sets,weight,reps,distance=false)=>{
  const complete=sets.filter(s=>s.done!==false&&!s.skipped)
  const completed=complete.length,skipped=sets.filter(s=>s.skipped).length
  const unfinished=sets.length-completed-skipped
  const allSets=sets.map((s,i)=>({weight:weight(s),reps:reps(s),drop:Boolean(s.drop_set),label:s.drop_set?'Drop '+(s.drop_stage||i+1):'Set '+(i+1),status:s.skipped?'Skipped':s.done===false?'Not completed':'Completed'}))
  const logged=allSets.filter(s=>s.status==='Completed')
  const volume=distance?0:logged.reduce((n,s)=>n+s.weight*s.reps,0)
  const best=distance?null:logged.filter(s=>!s.drop&&s.weight>0&&s.reps>0).reduce((b,s)=>!b||s.weight>b.weight||(s.weight===b.weight&&s.reps>b.reps)?s:b,null)
  return {name,completed,skipped,unfinished,volume,best,distance,sets:logged,allSets}
 }
 if(workout.main?.length)rows.push(summarize(workout.lift||'Main lift',workout.main,s=>Number(s.weight)||0,s=>Number(s.actualReps??s.actual_reps)||0))
 if(workout.backoffSets?.length)rows.push(summarize('Back-off sets',workout.backoffSets,s=>Number(s.weight??workout.backoffWeight)||0,s=>Number(s.actualReps??s.reps)||0))
 if(workout.jokerSets?.length)rows.push(summarize('Joker sets',workout.jokerSets,s=>Number(s.weight)||0,s=>Number(s.reps)||0))
 for(const ex of [...(workout.exercises||[]),...(workout.assistance||[])]){
  if(workout.mobility)continue
  const name=ex.name||ex.title||'Exercise'
  if(ex.setProgress?.length)rows.push(summarize(name,ex.setProgress.map(s=>({...s,done:s.done===true})),s=>exerciseSetWeight(ex,s),s=>exerciseSetReps(ex,s),isDistanceExercise(name)))
  else rows.push({name,completed:0,skipped:0,unfinished:0,volume:0,best:null,sets:[],result:ex.result||ex.prescription||'',logged:Boolean(ex.done||String(ex.result||'').trim())})
 }
 return rows
}
export function completionCounts(workout={}){
 const rows=completionExerciseRows(workout)
 return {rows,exercises:rows.filter(r=>r.completed||r.logged).length,sets:rows.reduce((n,r)=>n+r.completed,0),skipped:rows.reduce((n,r)=>n+r.skipped,0),unfinished:rows.reduce((n,r)=>n+r.unfinished,0)}
}
