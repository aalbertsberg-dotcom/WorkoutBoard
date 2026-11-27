import {useEffect,useMemo,useState} from 'react'
import {supabase} from './supabase'

export const summarizeProgramCommunity=posts=>({
  athletes:new Set((posts||[]).map(row=>row.user_id).filter(Boolean)).size,
  workouts:(posts||[]).length,
})

const sharedDate=row=>{
  const time=row?.summary?.completed_at||row?.created_at
  if(!time)return ''
  const date=new Date(time)
  return Number.isNaN(date.getTime())?'':date.toLocaleString([],{
    month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
  })
}

// "Program group" means other WorkSet members who voluntarily shared a
// completed workout for this exact program. It does not expose private
// program tracking rows or any unshared training-session details.
export default function ProgramCommunity({programName='',session,sharingEnabled=false,onOpenCommunity}){
  const [open,setOpen]=useState(false)
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [refreshId,setRefreshId]=useState(0)
  const stats=useMemo(()=>summarizeProgramCommunity(rows),[rows])

  useEffect(()=>{
    if(!open||!programName||!session?.user?.id)return
    let cancelled=false
    setRows([])
    setError('')
    if(navigator.onLine===false){
      setLoading(false)
      setError('Reconnect to view the latest shared workouts.')
      return
    }
    setLoading(true)
    // Existing Community uses explicit opt-in and RLS. Never query anyone's
    // private workout history, or infer missing days as missed sessions.
    supabase.from('community_activity')
      .select('id,user_id,display_name,activity_date,title,summary,created_at')
      .contains('summary',{program:programName})
      .order('created_at',{ascending:false})
      .limit(80)
      .then(({data,error:requestError})=>{
        if(cancelled)return
        setRows(data||[])
        setError(requestError ? 'Could not load shared workouts: '+requestError.message : '')
      })
      .catch(err=>{if(!cancelled)setError(err?.message||'Could not load shared workouts.')})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[open,programName,session?.user?.id,refreshId])

  return <details className="today-collapsible program-community-group" open={open}
    onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary><span><b>Program Community</b><small>See others' shared workouts for this program</small></span></summary>
    <div className="program-community-inner">
      <p className="helper-text">This feed shows completed workouts voluntarily shared with WorkSet Community for <strong>{programName}</strong>. Private workouts and 1RMs stay private.</p>
      {!sharingEnabled&&<div className="program-community-sharing-notice">
        <p className="helper-text">Your sharing is off. You can still view shared workouts. To let others see yours, opt in under Together → Community. Sharing there is visible to WorkSet Community, not just this program.</p>
        {onOpenCommunity&&<button type="button" className="secondary-action" onClick={onOpenCommunity}>Community sharing settings</button>}
      </div>}
      <div className="program-community-toolbar">
        <span className="helper-text">{loading?'Loading…':stats.athletes+' sharing athlete'+(stats.athletes===1?'':'s')+' · '+stats.workouts+' completed workout'+(stats.workouts===1?'':'s')}</span>
        <button type="button" className="mini-action" onClick={()=>setRefreshId(x=>x+1)} disabled={loading}>Refresh</button>
      </div>
      {error&&<p className="helper-text" role="status">{error}</p>}
      {!loading&&!error&&!rows.length&&<p className="helper-text">No one has shared a completed workout for this program yet. Start tracking it and opt in to Community to share your results.</p>}
      <div className="community-feed">
        {rows.map(row=><article className="community-card" key={row.id}>
          <div className="community-card-head">
            <strong>{row.display_name||'Member'}{row.user_id===session?.user?.id?' (You)':''}</strong>
            <span>{sharedDate(row)}</span>
          </div>
          <h3>{row.title||'Completed workout'}{row.summary?.week?' · Week '+row.summary.week:''}</h3>
          <div className="community-stats">
            {Number(row.summary?.volume)>0&&<span>{Number(row.summary.volume).toLocaleString()} lb volume</span>}
            {Number(row.summary?.sets)>0&&<span>{row.summary.sets} sets</span>}
            {Number(row.summary?.exercises)>0&&<span>{row.summary.exercises} exercises</span>}
            {Number(row.summary?.estimated_1rm)>0&&<span>e1RM {Math.round(Number(row.summary.estimated_1rm))} lb</span>}
            {!Number(row.summary?.volume)&&!Number(row.summary?.sets)&&!Number(row.summary?.exercises)&&<span>Workout completed</span>}
          </div>
        </article>)}
      </div>
    </div>
  </details>
}
