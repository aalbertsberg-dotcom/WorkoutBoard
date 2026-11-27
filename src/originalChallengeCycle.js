// Week 6's completed 100%-of-training-max AMRAP establishes a NEW,
// program-specific estimated 1RM for Weeks 7-12. Never overwrite the
// athlete's saved/global 1RMs or substitute the prescribed "3+" for actual reps.
export const ORIGINAL_CHALLENGE_NAME='531 Original Challenge'
export const ORIGINAL_CHALLENGE_KEY='archive:531-original-challenge'
export const ORIGINAL_CHALLENGE_ID='531-original-challenge'
export const ORIGINAL_CHALLENGE_LIFTS=['Squat','Bench','Deadlift','Press']

export function isOriginalChallengeMaxTest(planned){
  return planned?.workout?.archive_program_id===ORIGINAL_CHALLENGE_ID &&
    [6,12].includes(Number(planned?.source_week))
}

export function isOriginalChallengeTestSet(set){
  return Number(set?.pct)===100 &&
    ORIGINAL_CHALLENGE_LIFTS.includes(set?.weight_lift) &&
    set?.weight_basis==='tm'
}

export function originalChallengeCompletedTest(workout){
  const result=[]
  for(const item of workout?.exercises||[]){
    const set=(item.setProgress||[]).find(isOriginalChallengeTestSet)
    if(!set?.done)continue
    // IMPORTANT: prescribed "3+" is not an actual performance result.
    if(set.actual_reps===undefined||set.actual_reps===null||set.actual_reps==='')continue
    const reps=Number(set.actual_reps)
    const weight=Number(set.weight)
    if(!Number.isInteger(reps)||reps<1||reps>30||!Number.isFinite(weight)||weight<=0)continue
    const estimate=reps===1?weight:weight*(1+reps/30)
    result.push({
      lift:set.weight_lift,
      reps,weight,
      estimated_1rm:Math.round((estimate+Number.EPSILON)*100)/100
    })
  }
  return result
}

export function originalChallengeWeek6Estimates(rows=[],runStartedAt=null){
  const minTime=runStartedAt?new Date(runStartedAt).getTime():null
  if(runStartedAt&&!Number.isFinite(minTime))return {maxes:{},results:{}}
  const ordered=[...(rows||[])].sort((a,b)=>
    new Date(b.completed_at||0).getTime()-new Date(a.completed_at||0).getTime())
  const maxes={},results={}
  for(const row of ordered){
    if(row?.program!==ORIGINAL_CHALLENGE_NAME ||
       Number(row?.week)!==6 || !row?.completed_at)continue
    const completedTime=new Date(row.completed_at).getTime()
    if(!Number.isFinite(completedTime)||(minTime!==null&&completedTime<minTime))continue
    const key=row.workout?.tracking_program_key
    if(key&&key!==ORIGINAL_CHALLENGE_KEY)continue
    for(const result of originalChallengeCompletedTest(row.workout)){
      if(results[result.lift])continue
      maxes[result.lift]=result.estimated_1rm
      results[result.lift]={...result,completed_at:row.completed_at,session_id:row.id||null}
    }
  }
  return {maxes,results}
}
