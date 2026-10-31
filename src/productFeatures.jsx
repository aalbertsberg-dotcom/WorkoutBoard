import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

function parseVolume(value) {
  if (!value) return 0
  const text=String(value).replace(/,/g,'').replace(/[×X]/g,'x')
  const m=text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i)
  if (!m) return 0
  return Number(m[1])*Number(m[2])*(m[3]?Number(m[3]):1)
}

export function PlannedWorkoutRunner({planned,onFinished,onDismiss}) {
  const [workout,setWorkout]=useState(()=>{
    let cached=null
    try { cached=planned?.id ? JSON.parse(localStorage.getItem('wb-planned-draft-'+planned.id) || 'null') : null } catch {}
    return {exercises:[],sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',...(planned?.workout||{}),...(cached||{})}
  })
  const [saveState,setSaveState]=useState('Saved')
  const [finishing,setFinishing]=useState(false)
  const [historyByExercise,setHistoryByExercise]=useState({})

  useEffect(()=>{
    let cached=null
    try { cached=planned?.id ? JSON.parse(localStorage.getItem('wb-planned-draft-'+planned.id) || 'null') : null } catch {}
    setWorkout({exercises:[],sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',...(planned?.workout||{}),...(cached||{})})
  },[planned?.id])

  useEffect(()=>{
    if(!planned?.id)return
    try { localStorage.setItem('wb-planned-draft-'+planned.id,JSON.stringify(workout)) } catch {}
  },[workout,planned?.id])

  useEffect(()=>{
    if(!planned?.user_id)return
    let cancelled=false
    supabase.from('training_sessions').select('workout,completed_at').eq('user_id',planned.user_id)
      .not('completed_at','is',null).order('completed_at',{ascending:false}).limit(100)
      .then(({data})=>{
        if(cancelled)return
        const map={}
        for(const row of (data||[])){
          for(const item of (row.workout?.exercises||[])){
            const key=String(item.name||'').trim().toLowerCase()
            if(key&&item.result&&!map[key])map[key]=item.result
          }
        }
        setHistoryByExercise(map)
      })
    return()=>{cancelled=true}
  },[planned?.user_id,planned?.id])

  useEffect(()=>{
    if (!planned?.id || saveState !== 'Unsaved') return
    const timer=setTimeout(async()=>{
      setSaveState('Saving…')
      const {error}=await supabase.from('planned_workouts').update({workout,updated_at:new Date().toISOString()}).eq('id',planned.id)
      setSaveState(error ? 'Save failed' : 'Saved')
    },700)
    return ()=>clearTimeout(timer)
  },[workout,planned?.id,saveState])

  const changeExercise=(index,patch)=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((item,i)=>i===index?{...item,...patch}:item)}))
  }
  const change=(key,value)=>{ setSaveState('Unsaved'); setWorkout(v=>({...v,[key]:value})) }
  const totalVolume=useMemo(()=> (workout.exercises||[]).reduce((sum,x)=>sum+parseVolume(x.result),0),[workout.exercises])

  const finish=async()=>{
    if (!planned?.id || finishing) return
    setFinishing(true)
    const now=new Date().toISOString()
    const finalWorkout={...workout,complete:true,savedAt:now}
    const existing=await supabase.from('training_sessions').select('id').eq('planned_workout_id',planned.id).maybeSingle()
    let error=null
    if (existing.data?.id) {
      ;({error}=await supabase.from('training_sessions').update({
        title:planned.title,program:planned.source_program_name||'Flexible',week:planned.source_week||null,
        primary_lift:planned.source_day||null,session_date:planned.scheduled_date,workout:finalWorkout,
        total_volume:Math.round(totalVolume),bodyweight:Number(workout.bodyweight||0)||null,
        completed_at:now,updated_at:now
      }).eq('id',existing.data.id))
    } else {
      ;({error}=await supabase.from('training_sessions').insert({
        user_id:planned.user_id,planned_workout_id:planned.id,title:planned.title,
        program:planned.source_program_name||'Flexible',week:planned.source_week||null,
        primary_lift:planned.source_day||null,session_date:planned.scheduled_date,workout:finalWorkout,
        total_volume:Math.round(totalVolume),bodyweight:Number(workout.bodyweight||0)||null,
        started_at:planned.created_at||now,completed_at:now,updated_at:now
      }))
    }
    if (!error) {
      await supabase.from('planned_workouts').update({status:'completed',workout:finalWorkout,updated_at:now}).eq('id',planned.id)
      try { localStorage.removeItem('wb-planned-draft-'+planned.id) } catch {}
      onFinished?.()
    } else {
      setSaveState('Finish failed: '+error.message)
    }
    setFinishing(false)
  }

  return <section className="flex-runner">
    <div className="flex-runner-head">
      <div><span className="card-label">PLANNED WORKOUT</span><h2>{planned.title}</h2><p>{planned.source_program_name||'Flexible workout'}{planned.source_week?` · Week ${planned.source_week}`:''}</p></div>
      <span className="save-pill">{saveState}</span>
    </div>
    {planned.workout?.source && <div className="source-pill">Source: {planned.workout.source}</div>}
    {(workout.exercises||[]).map((item,i)=><article className={'flex-exercise '+(item.done?'done':'')} key={item.id||i}>
      <div className="flex-exercise-title"><div><strong>{item.name}</strong><span>{item.prescription}</span>{item.note&&<small>{item.note}</small>}{historyByExercise[String(item.name||'').trim().toLowerCase()]&&<small className="flex-history">Last: {historyByExercise[String(item.name||'').trim().toLowerCase()]}</small>}</div><button type="button" className={'check '+(item.done?'checked':'')} onClick={()=>changeExercise(i,{done:!item.done})}>✓</button></div>
      <input className="text-input" value={item.result||''} onChange={e=>changeExercise(i,{result:e.target.value})} placeholder="Result, e.g. 185 × 5 × 3 or completed" />
    </article>)}

    <section className="simple-card readiness-card">
      <div className="section-heading"><div><span className="card-label">HOW YOU FELT</span><h3>Session notes</h3></div></div>
      <div className="metrics compact-metrics">
        <label><span>Sleep</span><input type="number" min="1" max="10" inputMode="numeric" value={workout.sleep||''} onChange={e=>change('sleep',e.target.value)} placeholder="1-10" /></label>
        <label><span>Energy</span><input type="number" min="1" max="10" inputMode="numeric" value={workout.energy||''} onChange={e=>change('energy',e.target.value)} placeholder="1-10" /></label>
        <label><span>RPE</span><input type="number" min="1" max="10" step="0.5" inputMode="decimal" value={workout.rpe||''} onChange={e=>change('rpe',e.target.value)} placeholder="1-10" /></label>
        <label><span>Bodyweight</span><input type="number" inputMode="decimal" value={workout.bodyweight||''} onChange={e=>change('bodyweight',e.target.value)} placeholder="lb" /></label>
      </div>
      <label className="field-label"><span>Pain / injury</span><input className="text-input" value={workout.pain||''} onChange={e=>change('pain',e.target.value)} placeholder="Optional" /></label>
      <label className="field-label"><span>Notes</span><textarea value={workout.note||''} onChange={e=>change('note',e.target.value)} placeholder="Anything worth remembering next time…" /></label>
    </section>

    <div className="finish-row">
      {onDismiss&&<button className="secondary-action" onClick={onDismiss}>Use regular workout</button>}
      <button className="finish-button" onClick={finish} disabled={finishing}>{finishing?'Finishing…':'FINISH WORKOUT'}</button>
    </div>
  </section>
}

export function ExerciseHistoryStrip({history,lift,formatWeight}) {
  const stat=useMemo(()=>{
    const rows=(history||[]).filter(r=>r.completed_at&&r.lift===lift).sort((a,b)=>String(b.completed_at).localeCompare(String(a.completed_at)))
    let best=null
    for (const row of rows) for (const set of (row.workout?.main||[])) {
      const w=Number(set.weight||0), reps=Number(set.actualReps||0)
      if (!w||!reps) continue
      const e=w*(1+reps/30)
      if (!best||e>best.e) best={w,reps,e}
    }
    const last=rows[0]?.workout?.main?.filter(x=>Number(x.weight)&&Number(x.actualReps)).at(-1)||null
    return {count:rows.length,last,best}
  },[history,lift])
  if (!stat.count) return null
  return <div className="history-strip">
    <div><span>LAST</span><strong>{stat.last?`${stat.last.weight} × ${stat.last.actualReps}`:'—'}</strong></div>
    <div><span>BEST SET</span><strong>{stat.best?`${stat.best.w} × ${stat.best.reps}`:'—'}</strong></div>
    <div><span>BEST e1RM</span><strong>{stat.best?`${formatWeight(stat.best.e)} lb`:'—'}</strong></div>
  </div>
}

export function InstallAppButton() {
  const [prompt,setPrompt]=useState(null)
  const [installed,setInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches||false)
  useEffect(()=>{
    const before=e=>{e.preventDefault();setPrompt(e)}
    const installedHandler=()=>{setInstalled(true);setPrompt(null)}
    window.addEventListener('beforeinstallprompt',before)
    window.addEventListener('appinstalled',installedHandler)
    return ()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',installedHandler)}
  },[])
  if (installed) return <div className="status-message">WorkoutBoard is installed on this device.</div>
  return <button className="wide-button" disabled={!prompt} onClick={async()=>{if(!prompt)return;await prompt.prompt();setPrompt(null)}}>{prompt?'Install WorkoutBoard':'Install from your browser menu'}</button>
}

function download(name,content,type='application/json') {
  const blob=new Blob([content],{type})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
}

export function ExportDataButton({userId}) {
  const [busy,setBusy]=useState(false)
  const exportData=async()=>{
    if(!userId)return
    setBusy(true)
    const [profile,tms,logs,sessions,planned]=await Promise.all([
      supabase.from('profiles').select('*').eq('id',userId).maybeSingle(),
      supabase.from('training_maxes').select('*').eq('user_id',userId).maybeSingle(),
      supabase.from('workout_logs').select('*').eq('user_id',userId).order('workout_date'),
      supabase.from('training_sessions').select('*').eq('user_id',userId).order('session_date'),
      supabase.from('planned_workouts').select('*').eq('user_id',userId).order('scheduled_date'),
    ])
    const payload={exported_at:new Date().toISOString(),profile:profile.data,training_maxes:tms.data,workout_logs:logs.data||[],training_sessions:sessions.data||[],planned_workouts:planned.data||[]}
    const stamp=new Date().toISOString().slice(0,10)
    download(`WorkoutBoard-${stamp}.json`,JSON.stringify(payload,null,2))

    const esc=value=>`"${String(value??'').replace(/"/g,'""')}"`
    const headers=['date','title','program','week','primary_lift','total_volume','estimated_1rm','bodyweight','completed_at']
    const rows=(sessions.data||[]).map(row=>[
      row.session_date,row.title,row.program,row.week,row.primary_lift,row.total_volume,row.estimated_1rm,row.bodyweight,row.completed_at
    ])
    const csv=[headers.map(esc).join(','),...rows.map(row=>row.map(esc).join(','))].join('\n')
    download(`WorkoutBoard-sessions-${stamp}.csv`,csv,'text/csv')
    setBusy(false)
  }
  return <button className="wide-button" onClick={exportData} disabled={busy}>{busy?'Preparing export…':'Export CSV'}</button>
}

export function SharedTimer({session,isHost,onChanged}) {
  const syncReady=session && session.timer_elapsed_seconds !== undefined
  const [localSeconds,setLocalSeconds]=useState(0)
  const [localRunning,setLocalRunning]=useState(false)
  const [tick,setTick]=useState(0)

  useEffect(()=>{
    if(syncReady && session?.timer_started_at){
      const t=setInterval(()=>setTick(v=>v+1),1000)
      return()=>clearInterval(t)
    }
    if(!syncReady && localRunning){
      const t=setInterval(()=>setLocalSeconds(v=>v+1),1000)
      return()=>clearInterval(t)
    }
  },[syncReady,session?.timer_started_at,localRunning])

  const syncedSeconds=syncReady
    ? Number(session.timer_elapsed_seconds||0)+(session.timer_started_at?Math.max(0,Math.floor((Date.now()-new Date(session.timer_started_at).getTime())/1000)):0)
    : localSeconds
  const running=syncReady?Boolean(session.timer_started_at):localRunning
  const mm=String(Math.floor(syncedSeconds/60)).padStart(2,'0')
  const ss=String(syncedSeconds%60).padStart(2,'0')

  const update=async patch=>{
    if(!session?.id)return
    await supabase.from('shared_sessions').update(patch).eq('id',session.id)
    onChanged?.()
  }

  const start=()=>{
    if(!syncReady){setLocalRunning(true);return}
    if(isHost) update({timer_started_at:new Date().toISOString()})
  }
  const pause=()=>{
    if(!syncReady){setLocalRunning(false);return}
    if(isHost) update({timer_elapsed_seconds:syncedSeconds,timer_started_at:null})
  }
  const reset=()=>{
    if(!syncReady){setLocalSeconds(0);setLocalRunning(false);return}
    if(isHost) update({timer_elapsed_seconds:0,timer_started_at:null})
  }

  return <div>
    <div className="shared-timer">
      <strong>{mm}:{ss}</strong>
      <button onClick={running?pause:start} disabled={syncReady&&!isHost}>{running?'Pause':'Start'}</button>
      <button onClick={reset} disabled={syncReady&&!isHost}>Reset</button>
    </div>
    {syncReady&&!isHost&&<p className="helper-text">The host controls the shared timer.</p>}
    {!syncReady&&<p className="helper-text">Local timer until the product-upgrades migration is run.</p>}
  </div>
}
