// Pure state transitions for editable workout sets.
// These are deliberately separate from the React runner so changes can be
// regression-tested without relying on browser events.
export const pendingWorkoutSet=set=>Boolean(set&&!set.done&&!set.skipped)

export const unfinishedWorkoutSets=item=>(item?.setProgress||[]).filter(pendingWorkoutSet)

export function completeExerciseEarly(item){
  const sets=(item?.setProgress||[]).map(set=>pendingWorkoutSet(set)?{...set,skipped:true}:set)
  return {...item,setProgress:sets,done:true,finished_early:sets.some(set=>set.skipped)}
}

export function completeExerciseSet(item,setIndex,weight){
  if(!item?.setProgress?.[setIndex]||!pendingWorkoutSet(item.setProgress[setIndex]))return item
  const next=item.setProgress.map((set,index)=>
    index===setIndex?{...set,done:true,skipped:false,...(weight!==undefined?{weight}:null)}:set)
  return {...item,setProgress:next,done:next.every(set=>!pendingWorkoutSet(set)),finished_early:false}
}

export function reopenExerciseSet(item,setIndex){
  if(!item?.setProgress?.[setIndex])return item
  return {...item,done:false,finished_early:false,
    setProgress:item.setProgress.map((set,index)=>index===setIndex?{...set,done:false,skipped:false}:set)
  }
}

// Any set can be removed, but keep at least one so a prescribed exercise
// never loses its editable controls. Completed sets require UI confirmation.
export function deleteWorkoutSet(item,index){
  const sets=item?.setProgress||[]
  if(sets.length<=1||index<0||index>=sets.length)return item
  const next=sets.filter((_,i)=>i!==index).map((set,i)=>({...set,set:i+1}))
  const groups=new Map()
  for(const set of next){
    if(set.drop_set&&set.drop_set_group){
      const count=(groups.get(set.drop_set_group)||0)+1
      groups.set(set.drop_set_group,count)
      set.drop_stage=count
      set.label='Drop '+count+' · AMRAP'
    }
  }
  return {...item,setProgress:next,done:next.every(set=>!pendingWorkoutSet(set))}
}

export const roundedDropWeight=value=>{
  const weight=Number(value)||0
  return weight>0?Math.max(5,Math.round(weight/5)*5):''
}

export function addDropSet(item,now=Date.now()){
  const prior=[...(item?.setProgress||[])].reverse()
    .find(set=>set.done&&Number(set.weight)>0&&!set.skipped)
  const starting=Number(prior?.weight)||0
  const group='drop-'+now
  const sets=(item?.setProgress||[])
  const newStages=[1,2,3].map(stage=>({
    set:sets.length+stage,extra:true,drop_set:true,drop_set_group:group,
    drop_stage:stage,done:false,skipped:false,
    label:'Drop '+stage+' · AMRAP',reps:null,actual_reps:'',
    weight:roundedDropWeight(starting?starting*(0.8**(stage-1)):0),
    weight_edited:true,
  }))
  return {...item,done:false,finished_early:false,setProgress:[...sets,...newStages]}
}

export function addDropStage(item){
  const sets=item?.setProgress||[]
  const last=[...sets].reverse().find(set=>set.drop_set)
  if(!last)return item
  const nextStage=(sets.filter(set=>set.drop_set_group===last.drop_set_group).length)+1
  const lastWeight=Number(last.weight)||0
  const added={
    set:sets.length+1,extra:true,drop_set:true,drop_set_group:last.drop_set_group,
    drop_stage:nextStage,done:false,skipped:false,
    label:'Drop '+nextStage+' · AMRAP',reps:null,actual_reps:'',
    weight:roundedDropWeight(lastWeight*0.8),weight_edited:true,
  }
  return {...item,done:false,finished_early:false,setProgress:[...sets,added]}
}

export function validateDropStage(set,weight,reps){
  if(!set?.drop_set)return ''
  if(!Number.isFinite(Number(weight))||Number(weight)<=0)
    return 'Enter the weight used for this drop stage.'
  if(!Number.isInteger(Number(reps))||Number(reps)<=0)
    return 'Enter the actual reps completed for this drop stage.'
  return ''
}
