import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { MetconTracker } from './advancedFeatures'

function parseVolume(value) {
  if (!value) return 0
  const text=String(value).replace(/,/g,'').replace(/[×X]/g,'x')
  const m=text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i)
  if (!m) return 0
  return Number(m[1])*Number(m[2])*(m[3]?Number(m[3]):1)
}

function prescribedSetProgress(text) {
  const value=String(text||'').trim()
  const rx=value.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*([^,;]+?))?(?:\s+(?:light|moderate|easy|hard|@|$))/i)
    || value.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)([^,;]*)/i)
  if(rx){
    const sets=Number(rx[1]),reps=Number(rx[2])
    let suffix=String(rx[3]||'').trim()
    suffix=suffix.replace(/^(?:reps?\s*)/i,'').replace(/\s+(?:light|moderate|easy|hard).*$/i,'').trim()
    let label=suffix ? String(reps)+' '+suffix : String(reps)+' reps'
    label=label.replace(/\s*\/\s*/g,'/')
    return Array.from({length:sets},(_,i)=>({set:i+1,reps,label,done:false}))
  }
  const setsOnly=value.match(/(\d+)\s*sets?/i)
  if(setsOnly){
    const sets=Number(setsOnly[1])
    return Array.from({length:sets},(_,i)=>({set:i+1,reps:null,label:'Done',done:false}))
  }
  return []
}

function withSetProgress(workout) {
  return {
    ...workout,
    exercises:(workout?.exercises||[]).map(item=>({
      ...item,
      setProgress:Array.isArray(item.setProgress)&&item.setProgress.length
        ? item.setProgress
        : prescribedSetProgress(item.prescription||item.name)
    }))
  }
}

function humanPrescription(text) {
  const value=String(text||'').trim()
  const m=value.match(/^(\d+)\s*[x×]\s*([^\s]+)(?:\s+(.*))?$/i)
  if(!m)return value
  const sets=m[1],work=m[2],rest=String(m[3]||'').trim()
  const workLabel=/\//.test(work)||/[a-z]/i.test(work) ? work : work+' reps'
  return sets+' sets × '+workLabel+(rest?' · '+rest:'')
}

function loadFieldForExercise(name) {
  const value=String(name||'').toLowerCase()
  if(/dead bug|bird dog|side plank|plank|pallof press/.test(value)) return null
  if(/suitcase carry/.test(value)) return {label:'Load carried',placeholder:'lb',optional:false}
  if(/farmer carry/.test(value)) return {label:'Load carried',placeholder:'lb',optional:false}
  if(/bulgarian split squat|reverse lunge|step-up|glute bridge/.test(value)) return {label:'Weight used',placeholder:'Optional lb',optional:true}
  return {label:'Weight used',placeholder:'lb',optional:false}
}

function parseLoad(item) {
  if(item?.load!==undefined && item?.load!=='') return Number(item.load)||0
  const direct=String(item?.result||'').trim().match(/^\d+(?:\.\d+)?$/)
  if(direct)return Number(direct[0])
  const legacy=String(item?.result||'').replace(/,/g,'').replace(/[×X]/g,'x').match(/(\d+(?:\.\d+)?)\s*x/i)
  return legacy?Number(legacy[1]):0
}

function completedSetCount(item) {
  if(Array.isArray(item?.setProgress)&&item.setProgress.length) return item.setProgress.filter(x=>x.done).length
  return item?.done?1:0
}

function repsPerSet(item) {
  const first=item?.setProgress?.[0]
  if(first?.reps)return Number(first.reps)||0
  const m=String(item?.prescription||'').match(/\d+\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  return m?Number(m[1]):0
}

function plannedAlternatives(name) {
  const value=String(name||'').toLowerCase()
  if(/front squat|\bsquat\b/.test(value)) return ['Goblet Squat','Safety-Bar Squat','Leg Press','Box Squat']
  if(/bulgarian split squat|split squat|lunge/.test(value)) return ['Reverse Lunge','Step-Up','Goblet Split Squat','Single-Leg Press']
  if(/chest-supported.*row|\brow\b/.test(value)) return ['Cable Row','Ring Row','One-Arm DB Row','Lat Pulldown']
  if(/dead bug/.test(value)) return ['Bird Dog','Pallof Press','Heel Tap','Plank']
  if(/suitcase carry/.test(value)) return ['Farmer Carry','Front-Rack Carry','Offset Carry','Pallof Walkout']
  if(/romanian deadlift|rdl/.test(value)) return ['DB Romanian Deadlift','Cable Pull-Through','Hip Hinge','Trap-Bar RDL']
  if(/strict press|shoulder press/.test(value)) return ['DB Shoulder Press','Landmine Press','Machine Shoulder Press','Incline DB Press']
  if(/side plank/.test(value)) return ['Pallof Press','Suitcase Hold','Dead Bug','Bird Dog']
  if(/glute bridge/.test(value)) return ['Hip Thrust','Cable Pull-Through','Bodyweight Bridge','Single-Leg Bridge']
  if(/bird dog/.test(value)) return ['Dead Bug','Pallof Press','Plank','Bear Hold']
  if(/farmer carry/.test(value)) return ['Suitcase Carry','Front-Rack Carry','Trap-Bar Carry','Sled Drag']
  return []
}

function PlannedAlternatives({name}) {
  const [open,setOpen]=useState(false)
  const items=plannedAlternatives(name)
  if(!items.length)return null
  return <span className="planned-alternatives">
    <button type="button" className="movement-alt-button" onClick={()=>setOpen(v=>!v)}>Alternatives</button>
    {open&&<span className="movement-alt-popover"><b>Alternative movements</b>{items.map(item=><span key={item}>{item}</span>)}</span>}
  </span>
}

export function PlannedWorkoutRunner({planned,onFinished,onDismiss,sharedSessionId=null}) {
  const [workout,setWorkout]=useState(()=>{
    let cached=null
    try { cached=planned?.id ? JSON.parse(localStorage.getItem('wb-planned-draft-'+planned.id) || 'null') : null } catch {}
    return withSetProgress({exercises:[],sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',circuit_rounds:'',conditioningEnabled:false,metcon:{name:'',format:'For time',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx'},...(planned?.workout||{}),...(cached||{})})
  })
  const [saveState,setSaveState]=useState('Saved')
  const [finishing,setFinishing]=useState(false)
  const [historyByExercise,setHistoryByExercise]=useState({})
  const [substitutions,setSubstitutions]=useState({})
  const [timerPresets,setTimerPresets]=useState({})

  useEffect(()=>{
    let cached=null
    try { cached=planned?.id ? JSON.parse(localStorage.getItem('wb-planned-draft-'+planned.id) || 'null') : null } catch {}
    setWorkout(withSetProgress({exercises:[],sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',circuit_rounds:'',conditioningEnabled:false,metcon:{name:'',format:'For time',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx'},...(planned?.workout||{}),...(cached||{})}))
  },[planned?.id])

  useEffect(()=>{
    if(!planned?.id)return
    try { localStorage.setItem('wb-planned-draft-'+planned.id,JSON.stringify(workout)) } catch {}
  },[workout,planned?.id])

  useEffect(()=>{
    if(!planned?.user_id)return
    let cancelled=false
    Promise.all([
      supabase.from('training_sessions').select('workout,completed_at').eq('user_id',planned.user_id).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(150),
      supabase.from('exercise_substitutions').select('*').eq('user_id',planned.user_id),
      supabase.from('exercise_timer_presets').select('*').eq('user_id',planned.user_id),
    ]).then(([sessions,subs,timers])=>{
      if(cancelled)return
      const map={}
      for(const row of (sessions.data||[])){
        for(const item of (row.workout?.exercises||[])){
          const key=String(item.name||'').trim().toLowerCase()
          const load=parseLoad(item)
          const reps=repsPerSet(item)
          if(!key||(!load&&!item.result))continue
          const parsed=load&&reps?{weight:load,reps,e1rm:load*(1+reps/30)}:null
          const lastText=load ? load+' lb' : String(item.result||'')
          if(!map[key])map[key]={last:lastText,bestE:parsed?.e1rm||0,bestWeight:parsed?.weight||0}
          else if(parsed){map[key].bestE=Math.max(map[key].bestE||0,parsed.e1rm);map[key].bestWeight=Math.max(map[key].bestWeight||0,parsed.weight)}
        }
      }
      setHistoryByExercise(map)
      const subMap={}
      for(const x of subs.data||[])(subMap[String(x.exercise||'').trim().toLowerCase()]??=[]).push(x)
      setSubstitutions(subMap)
      setTimerPresets(Object.fromEntries((timers.data||[]).map(x=>[String(x.exercise||'').trim().toLowerCase(),x.seconds])))
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
  const totalVolume=useMemo(()=> (workout.exercises||[]).reduce((sum,item)=>{
    const load=parseLoad(item),reps=repsPerSet(item),sets=completedSetCount(item)
    if(load&&reps&&sets)return sum+(load*reps*sets)
    return sum+parseVolume(item.result)
  },0),[workout.exercises])
  const bestEstimated1rm=useMemo(()=>{
    let best=0
    for(const item of workout.exercises||[]){
      const weight=parseLoad(item),reps=repsPerSet(item)
      if(!weight||!reps)continue
      best=Math.max(best,weight*(1+reps/30))
    }
    return best
  },[workout.exercises])

  const finish=async()=>{
    if (!planned?.id || finishing) return
    setFinishing(true)
    const now=new Date().toISOString()
    const finalWorkout={...workout,complete:true,savedAt:now}
    const existing=await supabase.from('training_sessions').select('id').eq('planned_workout_id',planned.id).maybeSingle()
    let error=null
    if (existing.data?.id) {
      ;({error}=await supabase.from('training_sessions').update({
        title:planned.title,program:planned.source_program_name||'Custom workout',week:planned.source_week||null,
        primary_lift:planned.source_day||null,session_date:planned.scheduled_date,workout:finalWorkout,
        total_volume:Math.round(totalVolume),bodyweight:Number(workout.bodyweight||0)||null,
        shared_session_id:sharedSessionId||null,
        completed_at:now,updated_at:now
      }).eq('id',existing.data.id))
    } else {
      ;({error}=await supabase.from('training_sessions').insert({
        user_id:planned.user_id,planned_workout_id:planned.id,title:planned.title,
        program:planned.source_program_name||'Custom workout',week:planned.source_week||null,
        primary_lift:planned.source_day||null,session_date:planned.scheduled_date,workout:finalWorkout,
        total_volume:Math.round(totalVolume),bodyweight:Number(workout.bodyweight||0)||null,
        shared_session_id:sharedSessionId||null,
        started_at:planned.created_at||now,completed_at:now,updated_at:now
      }))
    }
    if (!error) {
      await supabase.from('planned_workouts').update({status:'completed',workout:finalWorkout,updated_at:now}).eq('id',planned.id)
      if(sharedSessionId){
        await supabase.from('session_results').upsert({
          session_id:sharedSessionId,
          user_id:planned.user_id,
          workout:{
            ...finalWorkout,
            shared_template:planned.workout?.shared_template||planned.workout,
            shared_meta:planned.workout?.shared_meta||null,
          },
          total_volume:Math.round(totalVolume),
          estimated_1rm:bestEstimated1rm||null,
          completed_at:now,
          updated_at:now,
        },{onConflict:'session_id,user_id'})
      }
      try { localStorage.removeItem('wb-planned-draft-'+planned.id) } catch {}
      onFinished?.()
    } else {
      setSaveState('Finish failed: '+error.message)
    }
    setFinishing(false)
  }

  return <section className="flex-runner">
    <div className="flex-runner-head">
      <div><span className="card-label">PLANNED WORKOUT</span><h2>{planned.title}</h2><p>{planned.source_program_name||'Custom workout'}{planned.source_week?` · Week ${planned.source_week}`:''}</p></div>
      <span className="save-pill">{saveState}</span>
    </div>

    {(workout.exercises||[]).map((item,i)=>{
      const key=String(item.name||'').trim().toLowerCase()
      const hist=historyByExercise[key]
      const currentLoad=parseLoad(item)
      const currentReps=repsPerSet(item)
      const current=currentLoad&&currentReps?{weight:currentLoad,reps:currentReps,e1rm:currentLoad*(1+currentReps/30)}:null
      const isPR=Boolean(current&&hist&&(current.weight>(hist.bestWeight||0)||current.e1rm>(hist.bestE||0)+.5))
      const loadField=loadFieldForExercise(item.name)
      const fallbackRest=/squat|deadlift|bench|press|clean|snatch/i.test(item.name||'')?Number(localStorage.getItem('wb-setting-compound-rest')||180):Number(localStorage.getItem('wb-setting-accessory-rest')||90)
      const programRest=Number(item.rest_seconds||fallbackRest)
      const rest=timerPresets[key]||programRest
      const sub=substitutions[key]?.[0]
      const nextExerciseIndex=(workout.exercises||[]).findIndex(x=>!(x.done||(x.setProgress?.length&&x.setProgress.every(s=>s.done))))
      return <article className={'flex-exercise '+(item.done?'done ':'')+(item.group?'grouped ':'')+(!item.done&&i===nextExerciseIndex?'current-exercise':'')} key={item.id||i}>
        <div className="flex-exercise-title">
          <div>
            <div className="exercise-name-line"><strong>{item.name}</strong>{isPR&&<b className="pr-mini">PR</b>}<PlannedAlternatives name={item.name}/></div>
            <span className="exercise-plan-line">{humanPrescription(item.prescription)}{rest?' · '+(rest<120?rest+' sec':rest/60+' min')+' rest':''}</span>
            {item.note&&<details className="exercise-cue"><summary>Form tip</summary><small>{item.note}</small></details>}
            {hist?.last&&<small className="flex-history">Last: {hist.last}{current&&hist?.last?` · Suggested ${Math.round((current.weight||0)+5)} lb`:''}</small>}
            {sub&&<small className="sub-suggestion">Saved substitute: {sub.substitute}{sub.reason?' · '+sub.reason:''}</small>}
          </div>
          {!item.setProgress?.length&&<button type="button" className={'check '+(item.done?'checked':'')} onClick={()=>{ const next=!item.done; changeExercise(i,{done:next}); if(next) window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds:rest}})) }}>✓</button>}
        </div>
        {loadField&&<label className="exercise-load-field"><span>{loadField.label}{loadField.optional?' (optional)':''}</span><div><input type="number" inputMode="decimal" className="text-input" value={item.load??''} onFocus={e=>e.currentTarget.select()} onChange={e=>changeExercise(i,{load:e.target.value===''?'':Number(e.target.value),result:''})} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}} placeholder={loadField.placeholder}/><b>lb</b></div></label>}
        {item.setProgress?.length>0&&<div className="set-progress-grid compact flexible-set-progress">
          {item.setProgress.map((set,j)=><button
            type="button"
            key={j}
            className={'set-progress-button '+(set.done?'done ':'')+(!set.done&&i===(workout.exercises||[]).findIndex(x=>!x.done)&&j===item.setProgress.findIndex(x=>!x.done)?'current-set':'')}
            onClick={()=>{
              const next=!set.done
              changeExercise(i,{setProgress:item.setProgress.map((sp,k)=>k===j?{...sp,done:next}:sp)})
              if(next)window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds:rest}}))
            }}>
            <strong>Set {j+1}</strong><span>{set.label || (set.reps?set.reps+' reps':'Done')}</span><b>{set.done?'✓':'○'}</b>
          </button>)}
        </div>}
      </article>
    })}

    {(workout.conditioningEnabled || workout.metcon?.name || workout.metcon?.time || workout.metcon?.rounds || workout.metcon?.reps || workout.metcon?.distance || workout.metcon?.calories) ? <details className="today-collapsible conditioning-tools" open>
      <summary><span><b>Conditioning</b><small>Metcon / intervals / result</small></span></summary>
      <MetconTracker value={workout.metcon} onChange={value=>{change('conditioningEnabled',true);change('metcon',value)}} />
    </details> : <button className="context-add-button" type="button" onClick={()=>change('conditioningEnabled',true)}>+ Conditioning</button>}

    <details className="today-collapsible workout-details">
      <summary><span><b>Workout details</b><small>Readiness, bodyweight, pain & notes</small></span></summary>
      <section className="simple-card readiness-card embedded-tool-card">
        <div className="metrics compact-metrics">
          <label><span>Sleep</span><input type="number" min="1" max="10" inputMode="numeric" value={workout.sleep||''} onChange={e=>change('sleep',e.target.value)} placeholder="1-10" /></label>
          <label><span>Energy</span><input type="number" min="1" max="10" inputMode="numeric" value={workout.energy||''} onChange={e=>change('energy',e.target.value)} placeholder="1-10" /></label>
          <label><span>RPE</span><input type="number" min="1" max="10" step="0.5" inputMode="decimal" value={workout.rpe||''} onChange={e=>change('rpe',e.target.value)} placeholder="1-10" /></label>
          <label><span>Bodyweight</span><input type="number" inputMode="decimal" value={workout.bodyweight||''} onChange={e=>change('bodyweight',e.target.value)} placeholder="lb" /></label>
        </div>
        <label className="field-label"><span>Pain / injury</span><input className="text-input" value={workout.pain||''} onChange={e=>change('pain',e.target.value)} placeholder="Optional" /></label>
        <label className="field-label"><span>Notes</span><textarea value={workout.note||''} onChange={e=>change('note',e.target.value)} placeholder="Anything worth remembering next time…" /></label>
      </section>
    </details>

    {onDismiss&&<button className="secondary-action regular-workout-fallback" onClick={onDismiss}>Use regular Today workout</button>}
    <div className="finish-wrap planned-finish-wrap">
      <button className="finish" onClick={finish} disabled={finishing}>{finishing?'FINISHING…':'FINISH WORKOUT'}</button>
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
    const stamp=new Date().toISOString().slice(0,10)
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
