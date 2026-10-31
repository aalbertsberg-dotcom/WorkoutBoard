import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'

const pad=n=>String(Math.max(0,Math.floor(n))).padStart(2,'0')
const fmt=seconds=>`${pad(seconds/60)}:${pad(seconds%60)}`
const today=()=>new Date().toISOString().slice(0,10)

function beep() {
  try {
    const Ctx=window.AudioContext||window.webkitAudioContext
    if(!Ctx)return
    const ctx=new Ctx()
    const osc=ctx.createOscillator()
    const gain=ctx.createGain()
    osc.frequency.value=880
    gain.gain.value=.08
    osc.connect(gain);gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime+.18)
    osc.onended=()=>ctx.close()
  } catch {}
  try { navigator.vibrate?.([120,60,120]) } catch {}
}

export function TrainingTimer() {
  const [mode,setMode]=useState('Rest')
  const [running,setRunning]=useState(false)
  const [elapsed,setElapsed]=useState(0)
  const [restSeconds,setRestSeconds]=useState(()=>Number(localStorage.getItem('wb-rest-seconds')||90))
  const [duration,setDuration]=useState(12*60)
  const [emomMinutes,setEmomMinutes]=useState(10)
  const [workSeconds,setWorkSeconds]=useState(40)
  const [breakSeconds,setBreakSeconds]=useState(20)
  const [rounds,setRounds]=useState(8)
  const [keepAwake,setKeepAwake]=useState(true)
  const [wakeActive,setWakeActive]=useState(false)
  const [expanded,setExpanded]=useState(false)
  const startAt=useRef(null)
  const baseElapsed=useRef(0)
  const wakeRef=useRef(null)
  const endBeeped=useRef(false)

  const requestWake=async()=>{
    if(!keepAwake||!('wakeLock' in navigator)||document.visibilityState!=='visible')return
    try {
      if(wakeRef.current&&!wakeRef.current.released)return
      wakeRef.current=await navigator.wakeLock.request('screen')
      setWakeActive(true)
      wakeRef.current.addEventListener('release',()=>setWakeActive(false))
    } catch { setWakeActive(false) }
  }
  const releaseWake=async()=>{
    try { await wakeRef.current?.release() } catch {}
    wakeRef.current=null
    setWakeActive(false)
  }

  useEffect(()=>{
    if(!running)return
    requestWake()
    const tick=()=>{
      const next=baseElapsed.current+(Date.now()-startAt.current)/1000
      setElapsed(next)
    }
    tick()
    const id=setInterval(tick,250)
    return()=>clearInterval(id)
  },[running])

  useEffect(()=>{
    const vis=()=>{ if(running&&document.visibilityState==='visible')requestWake() }
    document.addEventListener('visibilitychange',vis)
    return()=>document.removeEventListener('visibilitychange',vis)
  },[running,keepAwake])

  useEffect(()=>()=>{releaseWake()},[])

  const totalInterval=rounds*(workSeconds+breakSeconds)
  const target = mode==='Rest' ? restSeconds
    : mode==='AMRAP'||mode==='Metcon' ? duration
    : mode==='EMOM' ? emomMinutes*60
    : mode==='Intervals' ? totalInterval
    : null

  useEffect(()=>{
    if(!running||target==null)return
    if(elapsed>=target&&!endBeeped.current){
      endBeeped.current=true
      setRunning(false)
      baseElapsed.current=target
      setElapsed(target)
      releaseWake()
      beep()
    }
  },[elapsed,running,target])

  const start=()=>{
    if(running)return
    endBeeped.current=false
    startAt.current=Date.now()
    baseElapsed.current=elapsed
    setRunning(true)
    setExpanded(true)
  }
  const pause=()=>{
    if(!running)return
    baseElapsed.current=elapsed
    setRunning(false)
    releaseWake()
  }
  const reset=()=>{
    setRunning(false)
    setElapsed(0)
    baseElapsed.current=0
    startAt.current=null
    endBeeped.current=false
    releaseWake()
  }
  const startRest=(seconds=restSeconds)=>{
    setMode('Rest');setRestSeconds(seconds);localStorage.setItem('wb-rest-seconds',String(seconds))
    setElapsed(0);baseElapsed.current=0;startAt.current=Date.now();endBeeped.current=false;setRunning(true);setExpanded(true)
  }

  useEffect(()=>{
    const listener=e=>startRest(Number(e.detail?.seconds||restSeconds))
    window.addEventListener('workoutboard:rest-timer',listener)
    return()=>window.removeEventListener('workoutboard:rest-timer',listener)
  },[restSeconds])

  let display=elapsed
  let phase=''
  let round=''
  if(target!=null){
    display=Math.max(0,target-elapsed)
  }
  if(mode==='EMOM'){
    const minute=Math.min(emomMinutes,Math.floor(elapsed/60)+1)
    round=`Minute ${minute} / ${emomMinutes}`
    display=Math.max(0,60-(elapsed%60))
  }
  if(mode==='Intervals'){
    const cycle=workSeconds+breakSeconds
    const idx=Math.min(rounds-1,Math.floor(elapsed/cycle))
    const inCycle=elapsed-idx*cycle
    const working=inCycle<workSeconds
    phase=working?'WORK':'REST'
    round=`Round ${idx+1} / ${rounds}`
    display=working?Math.max(0,workSeconds-inCycle):Math.max(0,cycle-inCycle)
  }
  if(mode==='Stopwatch') display=elapsed

  return <details className="training-timer-panel" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}>
    <summary>
      <span><b>⏱ Timer</b><small>{running?`${mode} · ${fmt(display)}`:'Rest / Metcon / EMOM / Intervals'}</small></span>
      {running&&<i className="timer-live-dot">LIVE</i>}
    </summary>
    <div className="training-timer">
      <div className="timer-modes">{['Rest','Stopwatch','AMRAP','EMOM','Intervals','Metcon'].map(x=><button key={x} className={mode===x?'active':''} onClick={()=>{pause();reset();setMode(x)}}>{x}</button>)}</div>

      <div className="timer-display">
        {phase&&<span className={'timer-phase '+phase.toLowerCase()}>{phase}</span>}
        {round&&<span className="timer-round">{round}</span>}
        <strong>{fmt(display)}</strong>
        <small>{running?(wakeActive?'Screen awake':'Timer running'):'Ready'}</small>
      </div>

      {!running&&mode==='Rest'&&<div className="timer-presets">
        {[60,90,120,180].map(s=><button key={s} onClick={()=>startRest(s)}>{s<120?s+' sec':s/60+' min'}</button>)}
      </div>}
      {!running&&(mode==='AMRAP'||mode==='Metcon')&&<label className="timer-setting">Time cap (minutes)<input type="number" min="1" value={Math.round(duration/60)} onChange={e=>setDuration(Math.max(1,Number(e.target.value))*60)}/></label>}
      {!running&&mode==='EMOM'&&<label className="timer-setting">Minutes<input type="number" min="1" value={emomMinutes} onChange={e=>setEmomMinutes(Math.max(1,Number(e.target.value)))}/></label>}
      {!running&&mode==='Intervals'&&<div className="timer-settings-grid">
        <label>Work sec<input type="number" min="1" value={workSeconds} onChange={e=>setWorkSeconds(Math.max(1,Number(e.target.value)))}/></label>
        <label>Rest sec<input type="number" min="0" value={breakSeconds} onChange={e=>setBreakSeconds(Math.max(0,Number(e.target.value)))}/></label>
        <label>Rounds<input type="number" min="1" value={rounds} onChange={e=>setRounds(Math.max(1,Number(e.target.value)))}/></label>
      </div>}

      <div className="timer-controls">
        <button className="primary-action" onClick={running?pause:start}>{running?'Pause':'Start'}</button>
        <button className="secondary-action" onClick={reset}>Reset</button>
      </div>
      <label className="wake-toggle"><input type="checkbox" checked={keepAwake} onChange={e=>{setKeepAwake(e.target.checked);if(!e.target.checked)releaseWake();else if(running)requestWake()}}/><span>Keep screen awake while timer runs</span><b>{'wakeLock' in navigator?(wakeActive?'ON':'Available'):'Not supported'}</b></label>
      <p className="helper-text">Rest mode can start automatically when you mark a set complete. Wake lock only works while WorkoutBoard is visible and the browser/device allows it.</p>
    </div>
  </details>
}

function parseResult(text){
  const m=String(text||'').replace(/[×X]/g,'x').match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i)
  return m?{weight:Number(m[1]),reps:Number(m[2]),e1rm:Number(m[1])*(1+Number(m[2])/30)}:null
}

export function ProgressToolbox({session,legacyHistory=[],flexSessions=[],formatWeight}) {
  const [tab,setTab]=useState('PRs')
  const [goals,setGoals]=useState([])
  const [measurements,setMeasurements]=useState([])
  const [planned,setPlanned]=useState([])
  const [tracking,setTracking]=useState([])
  const [newGoal,setNewGoal]=useState({label:'',goal_type:'Strength',target_value:'',unit:'lb',target_date:''})
  const [measurement,setMeasurement]=useState({measured_on:today(),bodyweight:'',waist:'',chest:'',arm:'',thigh:'',body_fat:'',note:''})
  const [message,setMessage]=useState('')

  const load=async()=>{
    if(!session?.user)return
    const [g,m,p,t]=await Promise.all([
      supabase.from('training_goals').select('*').eq('user_id',session.user.id).eq('status','active').order('updated_at',{ascending:false}),
      supabase.from('body_measurements').select('*').eq('user_id',session.user.id).order('measured_on',{ascending:false}).limit(100),
      supabase.from('planned_workouts').select('*').eq('user_id',session.user.id).order('scheduled_date',{ascending:false}).limit(500),
      supabase.from('user_program_tracking').select('*').eq('user_id',session.user.id).order('updated_at',{ascending:false}),
    ])
    if(g.error||m.error){setMessage((g.error||m.error).message);return}
    setGoals(g.data||[]);setMeasurements(m.data||[]);setPlanned(p.data||[]);setTracking(t.data||[])
  }
  useEffect(()=>{load()},[session?.user?.id])

  const prs=useMemo(()=>{
    const best={}
    for(const row of legacyHistory){
      if(!row.completed_at)continue
      for(const set of row.workout?.main||[]){
        const w=Number(set.weight||0),r=Number(set.actualReps||0)
        if(!w||!r)continue
        const e=w*(1+r/30), key=row.lift||'Lift'
        if(!best[key]||e>best[key].e1rm)best[key]={name:key,weight:w,reps:r,e1rm:e,date:row.completed_at}
      }
    }
    for(const row of flexSessions){
      for(const ex of row.workout?.exercises||[]){
        const parsed=parseResult(ex.result)
        if(!parsed)continue
        const key=ex.name||row.primary_lift||'Exercise'
        if(!best[key]||parsed.e1rm>best[key].e1rm)best[key]={name:key,...parsed,date:row.completed_at||row.session_date}
      }
    }
    return Object.values(best).sort((a,b)=>b.e1rm-a.e1rm)
  },[legacyHistory,flexSessions])

  const exerciseRows=useMemo(()=>{
    const map={}
    for(const row of flexSessions){
      for(const ex of row.workout?.exercises||[]){
        const key=String(ex.name||'').trim()
        if(!key)continue
        if(!map[key])map[key]={name:key,count:0,last:null,best:null}
        map[key].count++
        if(!map[key].last)map[key].last={result:ex.result,date:row.completed_at||row.session_date}
        const parsed=parseResult(ex.result)
        if(parsed&&(!map[key].best||parsed.e1rm>map[key].best.e1rm))map[key].best={...parsed,date:row.completed_at||row.session_date}
      }
    }
    for(const row of legacyHistory.filter(x=>x.completed_at)){
      const key=row.lift
      if(!map[key])map[key]={name:key,count:0,last:null,best:null}
      map[key].count++
      const lastSet=(row.workout?.main||[]).filter(x=>x.weight&&x.actualReps).at(-1)
      if(lastSet&&!map[key].last)map[key].last={result:`${lastSet.weight} × ${lastSet.actualReps}`,date:row.completed_at}
    }
    return Object.values(map).sort((a,b)=>b.count-a.count)
  },[legacyHistory,flexSessions])

  const calendar=useMemo(()=>{
    const map={}
    for(const row of planned){ const d=row.scheduled_date; if(!map[d])map[d]={planned:0,completed:0}; map[d].planned++; if(row.status==='completed')map[d].completed++ }
    for(const row of flexSessions){ const d=String(row.session_date||row.completed_at).slice(0,10); if(!map[d])map[d]={planned:0,completed:0}; map[d].completed++ }
    for(const row of legacyHistory.filter(x=>x.completed_at)){ const d=String(row.completed_at).slice(0,10); if(!map[d])map[d]={planned:0,completed:0}; map[d].completed++ }
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,42)
  },[planned,flexSessions,legacyHistory])

  const adherence=useMemo(()=>{
    const scheduled=planned.filter(x=>new Date(x.scheduled_date)<=new Date()).length
    const completed=planned.filter(x=>x.status==='completed'&&new Date(x.scheduled_date)<=new Date()).length
    return {scheduled,completed,pct:scheduled?Math.round(completed/scheduled*100):null}
  },[planned])

  const addGoal=async e=>{
    e.preventDefault()
    if(!newGoal.label.trim())return
    const {error}=await supabase.from('training_goals').insert({...newGoal,user_id:session.user.id,target_value:newGoal.target_value===''?null:Number(newGoal.target_value),target_date:newGoal.target_date||null})
    if(error){setMessage(error.message);return}
    setNewGoal({label:'',goal_type:'Strength',target_value:'',unit:'lb',target_date:''});await load()
  }
  const completeGoal=async id=>{await supabase.from('training_goals').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',id);await load()}
  const saveMeasurement=async e=>{
    e.preventDefault()
    const payload={...measurement,user_id:session.user.id}
    for(const k of ['bodyweight','waist','chest','arm','thigh','body_fat'])payload[k]=payload[k]===''?null:Number(payload[k])
    const {error}=await supabase.from('body_measurements').upsert(payload,{onConflict:'user_id,measured_on'})
    if(error){setMessage(error.message);return}
    setMeasurement(v=>({...v,bodyweight:'',waist:'',chest:'',arm:'',thigh:'',body_fat:'',note:''}));await load()
  }

  const latest=measurements[0]
  return <section className="progress-toolbox">
    <div className="segmented toolbox-tabs">
      {['PRs','Exercises','Calendar','Goals','Measurements'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}
    </div>

    {tab==='PRs'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">PR BOARD</span><h3>Your best estimated sets</h3></div></div>
      <div className="pr-grid">{prs.slice(0,12).map(x=><div className="pr-card" key={x.name}><span>{x.name}</span><strong>{x.weight} × {x.reps}</strong><small>e1RM {formatWeight(x.e1rm)} lb</small></div>)}</div>
      {!prs.length&&<div className="empty-state">PRs appear as you log weighted sets.</div>}
    </section>}

    {tab==='Exercises'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">EXERCISE LIBRARY</span><h3>Everything you've trained</h3></div></div>
      <div className="exercise-library">{exerciseRows.map(x=><article key={x.name}><div><strong>{x.name}</strong><span>{x.count} logged session{x.count===1?'':'s'}</span></div><div><strong>{x.last?.result||'—'}</strong><span>{x.best?`Best e1RM ${formatWeight(x.best.e1rm)} lb`:'Latest result'}</span></div></article>)}</div>
      {!exerciseRows.length&&<div className="empty-state">Your exercise library builds itself from completed workouts.</div>}
    </section>}

    {tab==='Calendar'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">CALENDAR HISTORY</span><h3>Planned vs completed</h3></div><div className="adherence-score"><strong>{adherence.pct==null?'—':adherence.pct+'%'}</strong><span>adherence</span></div></div>
      <div className="calendar-history">{calendar.map(([date,v])=><div key={date}><strong>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</strong><span>{v.completed} completed · {v.planned} planned</span></div>)}</div>
      {!calendar.length&&<div className="empty-state">Your training calendar fills in as you plan and complete workouts.</div>}
      {tracking.filter(x=>x.status==='tracking').map(x=><div className="adherence-program" key={x.id}><strong>{x.program_name}</strong><span>Run {x.run_number} · tracking</span></div>)}
    </section>}

    {tab==='Goals'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">GOALS</span><h3>Targets worth chasing</h3></div></div>
      <form className="goal-form" onSubmit={addGoal}>
        <input value={newGoal.label} onChange={e=>setNewGoal(v=>({...v,label:e.target.value}))} placeholder="Goal, e.g. 405 deadlift"/>
        <select value={newGoal.goal_type} onChange={e=>setNewGoal(v=>({...v,goal_type:e.target.value}))}><option>Strength</option><option>Bodyweight</option><option>Conditioning</option><option>Habit</option><option>Other</option></select>
        <input type="number" value={newGoal.target_value} onChange={e=>setNewGoal(v=>({...v,target_value:e.target.value}))} placeholder="Target"/>
        <input value={newGoal.unit} onChange={e=>setNewGoal(v=>({...v,unit:e.target.value}))} placeholder="Unit"/>
        <input type="date" value={newGoal.target_date} onChange={e=>setNewGoal(v=>({...v,target_date:e.target.value}))}/>
        <button className="primary-action">Add goal</button>
      </form>
      <div className="goal-list">{goals.map(g=><div key={g.id}><div><strong>{g.label}</strong><span>{g.target_value!=null?`${g.target_value} ${g.unit||''}`:g.goal_type}{g.target_date?` · target ${new Date(g.target_date+'T12:00:00').toLocaleDateString()}`:''}</span></div><button onClick={()=>completeGoal(g.id)}>Complete</button></div>)}</div>
    </section>}

    {tab==='Measurements'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">BODY MEASUREMENTS</span><h3>{latest?('Latest · '+new Date(latest.measured_on+'T12:00:00').toLocaleDateString()):'Add a baseline'}</h3></div></div>
      {latest&&<div className="measurement-summary">{[['Weight',latest.bodyweight,'lb'],['Waist',latest.waist,'in'],['Chest',latest.chest,'in'],['Arm',latest.arm,'in'],['Thigh',latest.thigh,'in'],['Body fat',latest.body_fat,'%']].map(([label,value,unit])=><div key={label}><span>{label}</span><strong>{value??'—'}{value!=null?' '+unit:''}</strong></div>)}</div>}
      <form className="measurement-form" onSubmit={saveMeasurement}>
        <input type="date" value={measurement.measured_on} onChange={e=>setMeasurement(v=>({...v,measured_on:e.target.value}))}/>
        {['bodyweight','waist','chest','arm','thigh','body_fat'].map(k=><input key={k} type="number" step="0.1" value={measurement[k]} onChange={e=>setMeasurement(v=>({...v,[k]:e.target.value}))} placeholder={k.replace('_',' ')}/>)}
        <input value={measurement.note} onChange={e=>setMeasurement(v=>({...v,note:e.target.value}))} placeholder="Note"/>
        <button className="primary-action">Save measurement</button>
      </form>
    </section>}

    {message&&<div className="status-message">{message}</div>}
  </section>
}

export function WorkoutTemplates({session}) {
  const [templates,setTemplates]=useState([])
  const [name,setName]=useState('')
  const [body,setBody]=useState('')
  const [scheduleDate,setScheduleDate]=useState(today())
  const [message,setMessage]=useState('')

  const load=async()=>{
    if(!session?.user)return
    const {data,error}=await supabase.from('workout_templates').select('*').eq('user_id',session.user.id).order('updated_at',{ascending:false})
    if(error){setMessage(error.message);return}
    setTemplates(data||[])
  }
  useEffect(()=>{load()},[session?.user?.id])

  const create=async e=>{
    e.preventDefault()
    const lines=body.split('\n').map(x=>x.trim()).filter(Boolean)
    if(!name.trim()||!lines.length)return
    const workout={version:2,type:'flexible',template:true,exercises:lines.map((line,i)=>({id:`e${i+1}`,name:line,prescription:'Log as performed',note:'',result:'',done:false})),sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:''}
    const {error}=await supabase.from('workout_templates').insert({user_id:session.user.id,name:name.trim(),workout})
    if(error){setMessage(error.message);return}
    setName('');setBody('');await load()
  }
  const schedule=async t=>{
    const {error}=await supabase.from('planned_workouts').insert({user_id:session.user.id,scheduled_date:scheduleDate,title:t.name,source_program_name:'Template',source_day:t.name,workout:t.workout,status:'planned'})
    setMessage(error?error.message:`${t.name} scheduled for ${scheduleDate}.`)
  }
  const remove=async id=>{await supabase.from('workout_templates').delete().eq('id',id);await load()}

  return <section className="simple-card">
    <div className="section-heading"><div><span className="card-label">WORKOUT TEMPLATES</span><h3>Reusable workouts</h3></div></div>
    <form className="template-form" onSubmit={create}>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Template name"/>
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder={"One exercise per line\nBench Press\nDB Row\nTriceps"}/>
      <button className="primary-action">Save template</button>
    </form>
    <label className="template-date">Schedule date<input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)}/></label>
    <div className="template-list">{templates.map(t=><div key={t.id}><div><strong>{t.name}</strong><span>{t.workout?.exercises?.length||0} exercises</span></div><div><button onClick={()=>schedule(t)}>Schedule</button><button className="danger-lite" onClick={()=>remove(t.id)}>Delete</button></div></div>)}</div>
    {message&&<div className="status-message">{message}</div>}
  </section>
}
