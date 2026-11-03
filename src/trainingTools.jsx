import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'

const pad=n=>String(Math.max(0,Math.floor(n))).padStart(2,'0')
const fmt=seconds=>`${pad(seconds/60)}:${pad(seconds%60)}`
const today=()=>new Date().toISOString().slice(0,10)

function beep() {
  const sound=localStorage.getItem('wb-setting-sound')!=='false'
  const vibrate=localStorage.getItem('wb-setting-vibrate')!=='false'
  if(sound) try {
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
  if(vibrate) try { navigator.vibrate?.([120,60,120]) } catch {}
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
  const [keepAwake,setKeepAwake]=useState(()=>localStorage.getItem('wb-setting-wake-lock')!=='false')
  const [wakeActive,setWakeActive]=useState(false)
  const [expanded,setExpanded]=useState(false)
  const startAt=useRef(null)
  const baseElapsed=useRef(0)
  const wakeRef=useRef(null)
  const endBeeped=useRef(false)
  const transitionRef=useRef('')

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

  useEffect(()=>{
    if(!running)return
    let key=''
    if(mode==='EMOM') key='emom-'+Math.floor(elapsed/60)
    if(mode==='Intervals'){
      const cycle=workSeconds+breakSeconds
      const idx=Math.floor(elapsed/cycle)
      const inCycle=elapsed-idx*cycle
      key='interval-'+idx+'-'+(inCycle<workSeconds?'work':'rest')
    }
    if(key && transitionRef.current && key!==transitionRef.current) beep()
    if(key) transitionRef.current=key
  },[elapsed,running,mode,workSeconds,breakSeconds])

  const start=()=>{
    if(running)return
    endBeeped.current=false
    startAt.current=Date.now()
    baseElapsed.current=elapsed
    setRunning(true)
    setExpanded(false)
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
    setElapsed(0);baseElapsed.current=0;startAt.current=Date.now();endBeeped.current=false;setRunning(true);setExpanded(false)
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

  return <>
    {running&&!expanded&&<button type="button" className={'floating-workout-timer '+(phase?phase.toLowerCase():'')} onClick={()=>setExpanded(true)}>
      <span>{phase||mode}</span><strong>{fmt(display)}</strong>{round&&<small>{round}</small>}
    </button>}
    <details className={'training-timer-panel '+(running&&!expanded?'timer-floating-active':'')} open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}>
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
      <label className="wake-toggle"><input type="checkbox" checked={keepAwake} onChange={e=>{setKeepAwake(e.target.checked);localStorage.setItem('wb-setting-wake-lock',String(e.target.checked));if(!e.target.checked)releaseWake();else if(running)requestWake()}}/><span>Keep screen awake while timer runs</span><b>{'wakeLock' in navigator?(wakeActive?'ON':'Available'):'Not supported'}</b></label>
      <p className="helper-text">Rest mode can start automatically when you mark a set complete. Wake lock only works while WorkoutBoard is visible and the browser/device allows it.</p>
    </div>
  </details>
  </>
}

const circumferenceFields=[
  ['left_forearm','Left forearm'],['right_forearm','Right forearm'],['neck','Neck'],
  ['left_arm','Left arm'],['right_arm','Right arm'],['waist','Waist'],['hips','Hips'],
  ['left_thigh','Left thigh'],['right_thigh','Right thigh'],['left_calf','Left calf'],
  ['right_calf','Right calf'],['chest','Chest'],
]

function totalInches(row={}) {
  return circumferenceFields.reduce((sum,[key])=>{
    let value=Number(row[key]||0)
    if(!value && key==='left_arm') value=Number(row.arm||0)
    if(!value && key==='right_arm') value=Number(row.arm||0)
    if(!value && key==='left_thigh') value=Number(row.thigh||0)
    if(!value && key==='right_thigh') value=Number(row.thigh||0)
    return sum+(Number.isFinite(value)?value:0)
  },0)
}

function parseResult(text){
  const m=String(text||'').replace(/[×X]/g,'x').match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i)
  return m?{weight:Number(m[1]),reps:Number(m[2]),e1rm:Number(m[1])*(1+Number(m[2])/30)}:null
}

export function ProgressToolbox({session,legacyHistory=[],flexSessions=[],formatWeight,initialTab='PRs',onlyTab=null}) {
  const [tab,setTab]=useState(onlyTab||initialTab)
  const activeTab=onlyTab||tab
  const [goals,setGoals]=useState([])
  const [measurements,setMeasurements]=useState([])
  const [planned,setPlanned]=useState([])
  const [tracking,setTracking]=useState([])
  const [newGoal,setNewGoal]=useState({label:'',goal_type:'Strength',target_value:'',unit:'lb',target_date:''})
  const [measurement,setMeasurement]=useState({
    measured_on:today(),bodyweight:'',left_forearm:'',right_forearm:'',neck:'',
    left_arm:'',right_arm:'',waist:'',hips:'',left_thigh:'',right_thigh:'',
    left_calf:'',right_calf:'',chest:'',body_fat:'',note:''
  })
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
    const date=measurement.measured_on||today()
    const numericKeys=['bodyweight',...circumferenceFields.map(([key])=>key),'body_fat']
    const changes={user_id:session.user.id,measured_on:date}
    for(const key of numericKeys){
      if(measurement[key]!==''&&measurement[key]!=null)changes[key]=Number(measurement[key])
    }
    if(String(measurement.note||'').trim())changes.note=measurement.note.trim()
    const {data:existing}=await supabase.from('body_measurements').select('*').eq('user_id',session.user.id).eq('measured_on',date).maybeSingle()
    const payload=existing?{...existing,...changes}:{...changes}
    const {error}=await supabase.from('body_measurements').upsert(payload,{onConflict:'user_id,measured_on'})
    if(error){setMessage(error.message);return}
    setMessage('Measurements saved.')
    setMeasurement({
      measured_on:today(),bodyweight:'',left_forearm:'',right_forearm:'',neck:'',
      left_arm:'',right_arm:'',waist:'',hips:'',left_thigh:'',right_thigh:'',
      left_calf:'',right_calf:'',chest:'',body_fat:'',note:''
    })
    await load()
  }

  const latest=measurements[0]
  return <section className="progress-toolbox">
    {!onlyTab&&<div className="segmented toolbox-tabs">
      {['PRs','Exercises','Calendar','Goals','Measurements'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}
    </div>

    {activeTab==='PRs'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">PR BOARD</span><h3>Your best estimated sets</h3></div></div>
      <div className="pr-grid">{prs.slice(0,12).map(x=><div className="pr-card" key={x.name}><span>{x.name}</span><strong>{x.weight} × {x.reps}</strong><small>e1RM {formatWeight(x.e1rm)} lb</small></div>)}</div>
      {!prs.length&&<div className="empty-state">No PRs yet. Finish weighted sets and WorkoutBoard will add them automatically.</div>}
    </section>}

    {activeTab==='Exercises'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">EXERCISE LIBRARY</span><h3>Everything you've trained</h3></div></div>
      <div className="exercise-library">{exerciseRows.map(x=><article key={x.name}><div><strong>{x.name}</strong><span>{x.count} logged session{x.count===1?'':'s'}</span></div><div><strong>{x.last?.result||'—'}</strong><span>{x.best?`Best e1RM ${formatWeight(x.best.e1rm)} lb`:'Latest result'}</span></div></article>)}</div>
      {!exerciseRows.length&&<div className="empty-state">No exercise history yet. Complete a workout and your exercise library will build itself.</div>}
    </section>}

    {activeTab==='Calendar'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">CALENDAR HISTORY</span><h3>Planned vs completed</h3></div><div className="adherence-score"><strong>{adherence.pct==null?'—':adherence.pct+'%'}</strong><span>adherence</span></div></div>
      <div className="calendar-history">{calendar.map(([date,v])=><div key={date}><strong>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</strong><span>{v.completed} completed · {v.planned} planned</span></div>)}</div>
      {!calendar.length&&<div className="empty-state">No calendar history yet. Schedule or complete a workout to get started.</div>}
      {tracking.filter(x=>x.status==='tracking').map(x=><div className="adherence-program" key={x.id}><strong>{x.program_name}</strong><span>Run {x.run_number} · tracking</span></div>)}
    </section>}

    {activeTab==='Goals'&&<section className="simple-card">
      <div className="section-heading"><div><span className="card-label">GOALS</span><h3>Targets worth chasing</h3></div></div>
      <form className="goal-form" onSubmit={addGoal}>
        <input value={newGoal.label} onChange={e=>setNewGoal(v=>({...v,label:e.target.value}))} placeholder="Goal, e.g. 405 deadlift"/>
        <select value={newGoal.goal_type} onChange={e=>setNewGoal(v=>({...v,goal_type:e.target.value}))}><option>Strength</option><option>Bodyweight</option><option>Conditioning</option><option>Habit</option><option>Other</option></select>
        <input type="number" value={newGoal.target_value} onChange={e=>setNewGoal(v=>({...v,target_value:e.target.value}))} placeholder="Target"/>
        <input value={newGoal.unit} onChange={e=>setNewGoal(v=>({...v,unit:e.target.value}))} placeholder="Unit"/>
        <input type="date" value={newGoal.target_date} onChange={e=>setNewGoal(v=>({...v,target_date:e.target.value}))}/>
        <button className="primary-action">Add goal</button>
      </form>
      <div className="goal-list">{goals.map(g=>{
        const match=prs.find(p=>String(g.label||'').toLowerCase().includes(String(p.name||'').toLowerCase()))
        const current=match?.e1rm||null
        const pct=g.target_value&&current?Math.min(100,Math.round(current/Number(g.target_value)*100)):null
        return <div className="goal-row" key={g.id}>
          <div className="goal-main"><strong>{g.label}</strong><span>{g.target_value!=null?`${g.target_value} ${g.unit||''}`:g.goal_type}{g.target_date?` · target ${new Date(g.target_date+'T12:00:00').toLocaleDateString()}`:''}</span>{pct!=null&&<div className="goal-progress"><div style={{width:pct+'%'}}/><small>{pct}% · current e1RM {formatWeight(current)} lb</small></div>}</div>
          <button onClick={()=>completeGoal(g.id)}>Complete</button>
        </div>
      })}</div>
    </section>}

    {activeTab==='Measurements'&&<section className="measurement-workspace">
      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">BODY MEASUREMENTS</span><h3>{latest?('Latest · '+new Date(latest.measured_on+'T12:00:00').toLocaleDateString()):'Add a baseline'}</h3></div>{latest&&<b className="measurement-total-badge">{totalInches(latest)?totalInches(latest).toFixed(2)+' in total':''}</b>}</div>
        {latest&&<div className="measurement-summary">
          {[
            ['Weight',latest.bodyweight,'lb'],['Waist',latest.waist,'in'],['Hips',latest.hips,'in'],
            ['Chest',latest.chest,'in'],['Neck',latest.neck,'in'],['Body fat',latest.body_fat,'%']
          ].map(([label,value,unit])=><div key={label}><span>{label}</span><strong>{value??'—'}{value!=null?' '+unit:''}</strong></div>)}
        </div>}

        <form className="measurement-form expanded-measurement-form" onSubmit={saveMeasurement}>
          <label className="measurement-date-field"><span>Date</span><input type="date" value={measurement.measured_on} onChange={e=>setMeasurement(v=>({...v,measured_on:e.target.value}))}/></label>
          <label><span>Weight</span><div className="input-with-unit"><input type="number" step="0.1" inputMode="decimal" value={measurement.bodyweight} onChange={e=>setMeasurement(v=>({...v,bodyweight:e.target.value}))} placeholder="Weight"/><b>lb</b></div></label>

          <fieldset className="measurement-group">
            <legend>Upper body</legend>
            <div className="measurement-field-grid">
              {[
                ['left_forearm','Left forearm'],['right_forearm','Right forearm'],['neck','Neck'],
                ['left_arm','Left arm'],['right_arm','Right arm'],['chest','Chest']
              ].map(([key,label])=><label key={key}><span>{label}</span><div className="input-with-unit"><input type="number" step="0.01" inputMode="decimal" value={measurement[key]} onChange={e=>setMeasurement(v=>({...v,[key]:e.target.value}))}/><b>in</b></div></label>)}
            </div>
          </fieldset>

          <fieldset className="measurement-group">
            <legend>Midsection</legend>
            <div className="measurement-field-grid">
              {[['waist','Waist'],['hips','Hips']].map(([key,label])=><label key={key}><span>{label}</span><div className="input-with-unit"><input type="number" step="0.01" inputMode="decimal" value={measurement[key]} onChange={e=>setMeasurement(v=>({...v,[key]:e.target.value}))}/><b>in</b></div></label>)}
            </div>
          </fieldset>

          <fieldset className="measurement-group">
            <legend>Legs</legend>
            <div className="measurement-field-grid">
              {[
                ['left_thigh','Left thigh'],['right_thigh','Right thigh'],
                ['left_calf','Left calf'],['right_calf','Right calf']
              ].map(([key,label])=><label key={key}><span>{label}</span><div className="input-with-unit"><input type="number" step="0.01" inputMode="decimal" value={measurement[key]} onChange={e=>setMeasurement(v=>({...v,[key]:e.target.value}))}/><b>in</b></div></label>)}
            </div>
          </fieldset>

          <label><span>Body fat (optional)</span><div className="input-with-unit"><input type="number" step="0.1" inputMode="decimal" value={measurement.body_fat} onChange={e=>setMeasurement(v=>({...v,body_fat:e.target.value}))}/><b>%</b></div></label>
          <label><span>Note</span><input value={measurement.note} onChange={e=>setMeasurement(v=>({...v,note:e.target.value}))} placeholder="Optional note"/></label>

          <div className="measurement-total-preview">
            <span>Total inches</span>
            <strong>{totalInches(measurement)?totalInches(measurement).toFixed(2):'—'}</strong>
            <small>Automatically sums forearms, neck, arms, waist, hips, thighs, calves and chest.</small>
          </div>
          <button className="primary-action">Save measurements</button>
        </form>
      </section>

      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">MEASUREMENT HISTORY</span><h3>Your measurement log</h3></div></div>
        <div className="measurement-history-list">
          {measurements.map(row=><details className="measurement-history-row" key={row.id}>
            <summary>
              <div><strong>{new Date(row.measured_on+'T12:00:00').toLocaleDateString()}</strong><span>{row.bodyweight!=null?row.bodyweight+' lb':'No weight'}</span></div>
              <div><strong>{totalInches(row)?totalInches(row).toFixed(2)+' in':'—'}</strong><span>Total inches</span></div>
            </summary>
            <div className="measurement-history-detail">
              {circumferenceFields.map(([key,label])=>{
                let value=row[key]
                if(value==null&&key==='left_arm')value=row.arm
                if(value==null&&key==='right_arm')value=row.arm
                if(value==null&&key==='left_thigh')value=row.thigh
                if(value==null&&key==='right_thigh')value=row.thigh
                return <div key={key}><span>{label}</span><strong>{value!=null?value+' in':'—'}</strong></div>
              })}
              {row.body_fat!=null&&<div><span>Body fat</span><strong>{row.body_fat}%</strong></div>}
              {row.note&&<p>{row.note}</p>}
            </div>
          </details>)}
          {!measurements.length&&<div className="empty-state">No measurements saved yet.</div>}
        </div>
      </section>
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
