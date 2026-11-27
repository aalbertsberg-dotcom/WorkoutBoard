import {useCallback,useEffect,useState} from 'react'
import {supabase} from './supabase'

// One live session = one persistent, updating recap visible to participants.
export default function LiveSessionRecaps({session}){
  const userId=session?.user?.id
  const [open,setOpen]=useState(false)
  const [sessions,setSessions]=useState([])
  const [people,setPeople]=useState([])
  const [results,setResults]=useState([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)

  const refresh=useCallback(async()=>{
    if(!userId||!open)return
    const {data:joined,error:joinError}=await supabase.from('session_participants')
      .select('session_id').eq('user_id',userId).order('joined_at',{ascending:false}).limit(30)
    if(joinError){setError(joinError.message);return}
    const ids=[...new Set((joined||[]).map(row=>row.session_id))]
    if(!ids.length){setSessions([]);setPeople([]);setResults([]);setError('');return}
    const [s,p,r]=await Promise.all([
      supabase.from('shared_sessions').select('id,program,week,lift,status,created_at,completed_at')
        .in('id',ids),
      supabase.from('session_participants').select('session_id,user_id,display_name').in('session_id',ids),
      supabase.from('session_results').select('session_id,user_id,total_volume,completed_at').in('session_id',ids)
    ])
    if(s.error||p.error||r.error){setError((s.error||p.error||r.error).message);return}
    setSessions((s.data||[]).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))))
    setPeople(p.data||[])
    setResults(r.data||[])
    setError('')
  },[userId,open])

  useEffect(()=>{
    if(!open||!userId)return
    setLoading(true)
    refresh().finally(()=>setLoading(false))
    const timer=setInterval(()=>{if(document.visibilityState!=='hidden')refresh()},12000)
    return()=>clearInterval(timer)
  },[userId,open,refresh])

  return <details className="today-collapsible program-live-recaps" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><span><b>Your Live workout recaps</b><small>One updating recap per shared session, only visible to participants</small></span></summary>
    <div className="program-live-recaps-inner">
      {loading&&!sessions.length&&<p className="helper-text">Loading sessions…</p>}
      {error&&<p className="status-message" role="alert">{error}</p>}
      {!loading&&!error&&!sessions.length&&<p className="helper-text">Join a workout under Together → Live to see its shared results here.</p>}
      {sessions.map(row=>{
        const participants=people.filter(person=>person.session_id===row.id)
        const finished=results.filter(result=>result.session_id===row.id&&result.completed_at)
        return <article key={row.id} className="program-group-post">
          <div className="program-group-post-head"><strong>{row.program} · Week {row.week} · {row.lift}</strong><small>{row.status==='completed'?'Session ended':'Session open'}</small></div>
          <div className="program-group-progress"><span>{finished.length} of {participants.length} finished</span><div><i style={{width:((participants.length?finished.length/participants.length:0)*100)+'%'}}/></div></div>
          <div className="program-group-finishers">
            {participants.map(person=>{
              const result=finished.find(item=>item.user_id===person.user_id)
              return <div key={person.user_id}><span>{result?'✓':'○'} {person.display_name}</span>
                <small>{result?Number(result.total_volume||0).toLocaleString()+' lb volume':'Not finished'}</small></div>
            })}
          </div>
        </article>
      })}
    </div>
  </details>
}
