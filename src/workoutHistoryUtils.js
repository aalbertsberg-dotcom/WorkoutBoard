import { outdoorDistancePresentation } from './trackingRules.js'
import { effectiveSteps } from './stepTracking.js'

export const HISTORY_PAGE_SIZE=100

export function completedWorkoutKind(row={}){
  if(row?.workout?.mobility)return 'Mobility'
  const activity=[row?.workout?.quick_cardio_kind,row?.workout?.metcon?.activity,row?.title]
    .filter(Boolean).join(' ').toLowerCase()
  if(row?.workout?.quick_cardio||/\b(walk|walking|run|running|bike|biking|ride|cycling|cardio|hike|hiking|elliptical|rowing|row|sled)\b/.test(activity))
    return 'Cardio'
  return 'Strength'
}

export function completedWorkoutSummary(row={}){
  const kind=completedWorkoutKind(row)
  if(kind==='Mobility'){
    const completed=(row.workout?.mobility?.items||[]).filter(x=>x.done).length
    return completed+' movement'+(completed===1?'':'s')
  }
  if(kind==='Cardio'){
    const distance=outdoorDistancePresentation(row.workout?.outdoor)
    if(distance.meters>0)return distance.label
    const storedMiles=Number(row?.outdoor_summary?.miles||0)
    if(storedMiles>0)return storedMiles.toFixed(2)+' mi'
    const steps=effectiveSteps(row.workout?.outdoor)
    if(steps>0)return steps.toLocaleString()+' steps'
    const seconds=Math.max(0,Number(row.workout?.quick_timer_elapsed_seconds||0))
    if(seconds>0)return (seconds>=3600?Math.floor(seconds/3600)+':':'')+
      String(Math.floor(seconds%3600/60)).padStart(seconds>=3600?2:1,'0')+':'+
      String(Math.floor(seconds%60)).padStart(2,'0')
    return 'Cardio logged'
  }
  const volume=Number(row.total_volume||0)
  return volume>0?volume.toLocaleString()+' lb':'Strength logged'
}

export function workoutHistoryDayKey(row={}){
  return String(row.session_date||row.completed_at||'').slice(0,10)
}

export function workoutHistoryMatches(row,filter='All',query=''){
  if(filter!=='All'&&completedWorkoutKind(row)!==filter)return false
  const q=String(query||'').trim().toLowerCase()
  if(!q)return true
  const exerciseNames=(row.workout?.exercises||[]).map(x=>x.name||'')
  const mobilityNames=(row.workout?.mobility?.items||[]).map(x=>x.title||'')
  return [row.title,row.program,workoutHistoryDayKey(row),...exerciseNames,...mobilityNames]
    .some(value=>String(value||'').toLowerCase().includes(q))
}
