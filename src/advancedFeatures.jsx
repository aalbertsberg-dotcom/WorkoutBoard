import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'

const today=()=>new Date().toISOString().slice(0,10)
const round5=n=>Math.round(Number(n||0)/5)*5
const codeChars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode=()=>Array.from({length:8},()=>codeChars[Math.floor(Math.random()*codeChars.length)]).join('')

function parseSet(value){
  const m=String(value||'').replace(/,/g,'').replace(/[×X]/g,'x').match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i)
  if(!m)return null
  const weight=Number(m[1]),reps=Number(m[2]),sets=m[3]?Number(m[3]):1
  return {weight,reps,sets,volume:weight*reps*sets,e1rm:weight*(1+reps/30)}
}
function metricsFromWorkout(workout){
  let volume=0,best=0
  if(Array.isArray(workout?.main)){
    for(const s of workout.main){
      const w=Number(s.weight||0),r=Number(s.actualReps||0)
      if(w&&r){volume+=w*r;best=Math.max(best,w*(1+r/30))}
    }
  }
  for(const ex of workout?.exercises||[]){
    const p=parseSet(ex.result)
    if(p){volume+=p.volume;best=Math.max(best,p.e1rm)}
  }
  return {volume:Math.round(volume),e1rm:Math.round(best)}
}
function download(name,content,type='application/json'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
}
function sourceKey(name){return String(name||'').trim().toLowerCase()}

export function WorkoutCoach({session,lift,log,history=[],tm,plan}) {
  const [rest,setRest]=useState(()=>Number(localStorage.getItem('wb-rest-'+sourceKey(lift))||((lift==='Squat'||lift==='Deadlift')?180:120)))
  const rows=useMemo(()=>history.filter(r=>r.completed_at&&r.lift===lift).sort((a,b)=>String(b.completed_at).localeCompare(String(a.completed_at))),[history,lift])
  const past=useMemo(()=>{
    let bestWeight=0,bestE=0,maxRepsByWeight={}
    for(const row of rows)for(const s of row.workout?.main||[]){
      const w=Number(s.weight||0),r=Number(s.actualReps||0)
      if(!w||!r)continue
      bestWeight=Math.max(bestWeight,w);bestE=Math.max(bestE,w*(1+r/30))
      maxRepsByWeight[w]=Math.max(maxRepsByWeight[w]||0,r)
    }
    const last=rows[0]?.workout?.main?.filter(s=>Number(s.weight)&&Number(s.actualReps)).at(-1)||null
    return {bestWeight,bestE,maxRepsByWeight,last}
  },[rows])
  const current=useMemo(()=>{
    let weightPR=false,e1rmPR=false,repPR=false,best=null
    for(const s of log?.main||[]){
      const w=Number(s.weight||0),r=Number(s.actualReps||0)
      if(!w||!r)continue
      const e=w*(1+r/30)
      if(!best||e>best.e)best={w,r,e}
      if(w>past.bestWeight)weightPR=true
      if(e>past.bestE+.5)e1rmPR=true
      if(r>(past.maxRepsByWeight[w]||0)&&past.maxRepsByWeight[w])repPR=true
    }
    return {weightPR,e1rmPR,repPR,best}
  },[log,past])
  const suggested=past.last?round5(Number(past.last.weight)+(lift==='Squat'||lift==='Deadlift'?10:5)):null
  const workWeight=Number((log?.main||[]).find(s=>Number(s.weight))?.weight||tm||0)
  const warmups=workWeight?[{p:40,r:5},{p:50,r:5},{p:60,r:3},{p:70,r:1}].map(x=>({...x,w:round5(workWeight*x.p/100)})):[]
  const saveRest=async value=>{
    const seconds=Number(value);setRest(seconds);localStorage.setItem('wb-rest-'+sourceKey(lift),String(seconds))
    if(session?.user)await supabase.from('exercise_timer_presets').upsert({user_id:session.user.id,exercise:lift,seconds,updated_at:new Date().toISOString()},{onConflict:'user_id,exercise'})
  }
  return <section className="coach-card">
    <div className="section-heading"><div><span className="card-label">WORKOUT COACH</span><h3>{lift} guidance</h3></div>{(current.weightPR||current.e1rmPR||current.repPR)&&<span className="pr-live">PR!</span>}</div>
    <div className="coach-grid">
      <div><span>Last top set</span><strong>{past.last?`${past.last.weight} × ${past.last.actualReps}`:'—'}</strong></div>
      <div><span>Suggested next load</span><strong>{suggested?suggested+' lb':'—'}</strong></div>
      <div><span>Today best</span><strong>{current.best?`${current.best.w} × ${current.best.r}`:'—'}</strong></div>
      <div><span>Rest after set</span><select value={rest} onChange={e=>saveRest(e.target.value)}>{[60,90,120,180,240,300].map(s=><option value={s} key={s}>{s<120?s+' sec':s/60+' min'}</option>)}</select></div>
    </div>
    {warmups.length>0&&<div className="warmup-line"><b>Warm-up:</b>{warmups.map(x=><span key={x.p}>{x.w}×{x.r}</span>)}</div>}
    <div className="pr-flags">
      {current.weightPR&&<b>Weight PR</b>}{current.repPR&&<b>Rep PR</b>}{current.e1rmPR&&<b>e1RM PR</b>}
      {!current.weightPR&&!current.repPR&&!current.e1rmPR&&<span>PR flags appear live as you enter work sets.</span>}
    </div>
    {past.last&&current.best&&<p className="comparison-line">Last: {past.last.weight}×{past.last.actualReps} → Today: {current.best.w}×{current.best.r} ({Math.round(current.best.e-past.last.weight*(1+Number(past.last.actualReps)/30))>=0?'+':''}{Math.round(current.best.e-past.last.weight*(1+Number(past.last.actualReps)/30))} e1RM)</p>}
  </section>
}

export function MetconTracker({value,onChange}) {
  const v={name:'',format:'For time',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',...(value||{})}
  const set=(k,x)=>onChange?.({...v,[k]:x})
  return <section className="simple-card metcon-tracker">
    <div className="section-heading"><div><span className="card-label">METCON</span><h3>Conditioning result</h3></div></div>
    <div className="metcon-grid">
      <input value={v.name} onChange={e=>set('name',e.target.value)} placeholder="Benchmark / workout name"/>
      <select value={v.format} onChange={e=>set('format',e.target.value)}><option>For time</option><option>AMRAP</option><option>EMOM</option><option>Intervals</option><option>Distance</option></select>
      <select value={v.scale} onChange={e=>set('scale',e.target.value)}><option>Rx</option><option>Scaled</option><option>Modified</option></select>
      <input value={v.time} onChange={e=>set('time',e.target.value)} placeholder="Time e.g. 12:34"/>
      <input type="number" value={v.rounds} onChange={e=>set('rounds',e.target.value)} placeholder="Rounds"/>
      <input type="number" value={v.reps} onChange={e=>set('reps',e.target.value)} placeholder="Extra reps"/>
      <input value={v.distance} onChange={e=>set('distance',e.target.value)} placeholder="Distance"/>
      <input type="number" value={v.calories} onChange={e=>set('calories',e.target.value)} placeholder="Calories"/>
    </div>
  </section>
}

function EditableWorkout({sessionRow,onSaved,onCancel}){
  const [title,setTitle]=useState(sessionRow.title||'Workout')
  const [workout,setWorkout]=useState(()=>structuredClone(sessionRow.workout||{}))
  const [bodyweight,setBodyweight]=useState(sessionRow.bodyweight??'')
  const [busy,setBusy]=useState(false)
  const updateMain=(i,key,val)=>setWorkout(v=>({...v,main:(v.main||[]).map((s,j)=>j===i?{...s,[key]:val}:s)}))
  const updateEx=(i,key,val)=>setWorkout(v=>({...v,exercises:(v.exercises||[]).map((s,j)=>j===i?{...s,[key]:val}:s)}))
  const save=async()=>{
    setBusy(true);const m=metricsFromWorkout(workout)
    const {error}=await supabase.rpc('update_my_training_session',{target_session:sessionRow.id,new_title:title,new_workout:workout,new_total_volume:m.volume,new_estimated_1rm:m.e1rm,new_bodyweight:bodyweight===''?null:Number(bodyweight)})
    setBusy(false);if(error){alert(error.message);return}onSaved?.()
  }
  return <section className="edit-workout-card">
    <div className="section-heading"><div><span className="card-label">EDIT COMPLETED WORKOUT</span><h3>{sessionRow.title}</h3></div></div>
    <label>Title<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
    {(workout.main||[]).map((s,i)=><div className="edit-set-row" key={i}><strong>Set {i+1}</strong><input type="number" value={s.weight??''} onChange={e=>updateMain(i,'weight',e.target.value)}/><span>lb ×</span><input type="number" value={s.actualReps??''} onChange={e=>updateMain(i,'actualReps',e.target.value)}/><span>reps</span></div>)}
    {(workout.exercises||[]).map((x,i)=><div className="edit-ex-row" key={x.id||i}><input value={x.name||''} onChange={e=>updateEx(i,'name',e.target.value)}/><input value={x.result||''} onChange={e=>updateEx(i,'result',e.target.value)} placeholder="Result"/></div>)}
    <label>Bodyweight<input type="number" value={bodyweight} onChange={e=>setBodyweight(e.target.value)}/></label>
    <div className="edit-actions"><button className="secondary-action" onClick={onCancel}>Cancel</button><button className="primary-action" disabled={busy} onClick={save}>{busy?'Saving…':'Recalculate + save'}</button></div>
  </section>
}

export function CompletedWorkoutCenter({session}) {
  const [rows,setRows]=useState([])
  const [query,setQuery]=useState('')
  const [editing,setEditing]=useState(null)
  const [message,setMessage]=useState('')
  const load=async()=>{if(!session?.user)return;const {data,error}=await supabase.from('training_sessions').select('*').eq('user_id',session.user.id).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(500);if(error)setMessage(error.message);else setRows(data||[])}
  useEffect(()=>{load()},[session?.user?.id])
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return !q?rows:rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q))},[rows,query])
  const saveTemplate=async r=>{
    const {error}=await supabase.from('workout_templates').insert({user_id:session.user.id,name:r.title||'Saved workout',description:`Saved from ${new Date(r.completed_at).toLocaleDateString()}`,workout:r.workout})
    setMessage(error?error.message:'Saved as workout template.')
  }
  const share=async r=>{
    const code=makeCode();const {error}=await supabase.from('shared_library_items').insert({owner_user_id:session.user.id,share_code:code,item_type:'workout',title:r.title||'Workout',payload:{title:r.title,program:r.program,workout:r.workout}})
    if(error){setMessage(error.message);return}
    try{await navigator.clipboard.writeText(code)}catch{}
    setMessage('Share code '+code+' copied.')
  }
  return <section className="advanced-history">
    <section className="simple-card">
      <div className="section-heading"><div><span className="card-label">WORKOUT HISTORY</span><h3>Search, reopen, fix, reuse</h3></div></div>
      <input className="text-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search bench, 225, Squatober, pain…"/>
      <div className="advanced-history-list">{filtered.slice(0,60).map(r=><article key={r.id}>
        <div><strong>{r.title}</strong><span>{new Date(r.completed_at).toLocaleDateString()} · {r.program||'Workout'} · {Number(r.total_volume||0).toLocaleString()} lb</span></div>
        <div><button onClick={()=>setEditing(r)}>Edit</button><button onClick={()=>saveTemplate(r)}>Template</button><button onClick={()=>share(r)}>Share</button></div>
      </article>)}</div>
      {!filtered.length&&<div className="empty-state">No workouts match.</div>}
      {message&&<div className="status-message">{message}</div>}
    </section>
    {editing&&<EditableWorkout sessionRow={editing} onCancel={()=>setEditing(null)} onSaved={async()=>{setEditing(null);setMessage('Workout updated and metrics recalculated.');await load()}}/>}
  </section>
}

function repPrs(rows){
  const map={}
  for(const r of rows){
    const list=[]
    for(const s of r.workout?.main||[])list.push({name:r.primary_lift||r.title,weight:Number(s.weight||0),reps:Number(s.actualReps||0)})
    for(const x of r.workout?.exercises||[]){const p=parseSet(x.result);if(p)list.push({name:x.name,weight:p.weight,reps:p.reps})}
    for(const x of list){
      if(!x.weight||!x.reps)continue
      const key=x.name||'Exercise';if(!map[key])map[key]={}
      for(const rr of [1,3,5,8,10])if(x.reps>=rr)map[key][rr]=Math.max(map[key][rr]||0,x.weight)
    }
  }
  return map
}
function monthCells(month){
  const first=new Date(month.getFullYear(),month.getMonth(),1),last=new Date(month.getFullYear(),month.getMonth()+1,0)
  const start=new Date(first);start.setDate(first.getDate()-first.getDay())
  return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
}

export function AdvancedProgressCenter({session}) {
  const [tab,setTab]=useState('History')
  const [sessions,setSessions]=useState([])
  const [planned,setPlanned]=useState([])
  const [profiles,setProfiles]=useState([])
  const [subs,setSubs]=useState([])
  const [photos,setPhotos]=useState([])
  const [photoUrls,setPhotoUrls]=useState({})
  const [month,setMonth]=useState(()=>new Date())
  const [message,setMessage]=useState('')
  const [equipmentDraft,setEquipmentDraft]=useState({name:'Home Gym',equipment:'Barbell,Rack,Bench,Dumbbells',plates:'45,35,25,10,5,2.5'})
  const [subDraft,setSubDraft]=useState({exercise:'Bench Press',substitute:'DB Bench Press',reason:''})
  const load=async()=>{
    if(!session?.user)return
    const [s,p,e,sub,ph]=await Promise.all([
      supabase.from('training_sessions').select('*').eq('user_id',session.user.id).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(1000),
      supabase.from('planned_workouts').select('*').eq('user_id',session.user.id).order('scheduled_date',{ascending:false}).limit(1000),
      supabase.from('equipment_profiles').select('*').eq('user_id',session.user.id).order('is_active',{ascending:false}),
      supabase.from('exercise_substitutions').select('*').eq('user_id',session.user.id).order('usage_count',{ascending:false}),
      supabase.from('progress_photos').select('*').eq('user_id',session.user.id).order('taken_on',{ascending:false}),
    ])
    setSessions(s.data||[]);setPlanned(p.data||[]);setProfiles(e.data||[]);setSubs(sub.data||[]);setPhotos(ph.data||[])
    const urls={}
    for(const x of ph.data||[]){const {data}=await supabase.storage.from('workoutboard-progress').createSignedUrl(x.storage_path,3600);if(data?.signedUrl)urls[x.id]=data.signedUrl}
    setPhotoUrls(urls)
  }
  useEffect(()=>{load()},[session?.user?.id])
  const prs=useMemo(()=>repPrs(sessions),[sessions])
  const totalVolume=sessions.reduce((a,r)=>a+Number(r.total_volume||0),0)
  const achievements=useMemo(()=>{
    const arr=[]
    for(const n of [10,25,50,100,250,500])if(sessions.length>=n)arr.push(`${n} workouts`)
    for(const n of [100000,250000,500000,1000000,2500000])if(totalVolume>=n)arr.push(`${n.toLocaleString()} lb volume`)
    for(const [lift,marks] of Object.entries({Squat:[225,315,405,495],Bench:[135,225,315,405],Deadlift:[315,405,495,585]})){
      const best=Math.max(0,...sessions.filter(s=>String(s.primary_lift||s.title).toLowerCase().includes(lift.toLowerCase())).map(s=>Number(s.estimated_1rm||0)))
      for(const n of marks)if(best>=n)arr.push(`${lift} ${n}+`)
    }
    return arr
  },[sessions,totalVolume])
  const cells=monthCells(month)
  const scheduledByDate={},doneByDate={}
  for(const p of planned)(scheduledByDate[p.scheduled_date]??=[]).push(p)
  for(const s of sessions){const d=String(s.session_date||s.completed_at).slice(0,10);(doneByDate[d]??=[]).push(s)}
  const saveEquipment=async()=>{
    const equipment=equipmentDraft.equipment.split(',').map(x=>x.trim()).filter(Boolean),plates=equipmentDraft.plates.split(',').map(Number).filter(Number.isFinite)
    if(!profiles.length)equipmentDraft.is_active=true
    const {error}=await supabase.from('equipment_profiles').upsert({user_id:session.user.id,name:equipmentDraft.name,equipment,plates,is_active:profiles.length===0,updated_at:new Date().toISOString()},{onConflict:'user_id,name'})
    setMessage(error?error.message:'Equipment profile saved.');await load()
  }
  const activate=async id=>{await supabase.from('equipment_profiles').update({is_active:false}).eq('user_id',session.user.id);await supabase.from('equipment_profiles').update({is_active:true}).eq('id',id);await load()}
  const addSub=async()=>{
    const {error}=await supabase.from('exercise_substitutions').upsert({user_id:session.user.id,...subDraft},{onConflict:'user_id,exercise,substitute'});setMessage(error?error.message:'Substitution saved.');await load()
  }
  const uploadPhoto=async e=>{
    const file=e.target.files?.[0];if(!file)return
    const path=`${session.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`
    const {error}=await supabase.storage.from('workoutboard-progress').upload(path,file,{upsert:false})
    if(error){setMessage(error.message);return}
    await supabase.from('progress_photos').insert({user_id:session.user.id,taken_on:today(),storage_path:path})
    setMessage('Progress photo saved privately.');await load()
  }
  return <section className="advanced-progress">
    <div className="segmented advanced-tabs">{['History','Records','Month','Milestones','Equipment','Photos'].map(x=><button className={tab===x?'active':''} key={x} onClick={()=>setTab(x)}>{x}</button>)}</div>
    {tab==='History'&&<CompletedWorkoutCenter session={session}/>}
    {tab==='Records'&&<section className="simple-card"><div className="section-heading"><div><span className="card-label">PERSONAL RECORDS</span><h3>Rep PR table</h3></div></div><div className="rep-pr-table"><div className="rep-pr-head"><b>Exercise</b>{[1,3,5,8,10].map(r=><b key={r}>{r}RM</b>)}</div>{Object.entries(prs).sort().map(([name,v])=><div key={name}><strong>{name}</strong>{[1,3,5,8,10].map(r=><span key={r}>{v[r]?v[r]+' lb':'—'}</span>)}</div>)}</div></section>}
    {tab==='Month'&&<section className="simple-card"><div className="month-head"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button><h3>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button></div><div className="month-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=><b key={x}>{x}</b>)}{cells.map(d=>{const key=d.toISOString().slice(0,10),done=doneByDate[key]?.length||0,pl=scheduleByDateSafe(scheduledByDate,key),same=d.getMonth()===month.getMonth();return <div className={(same?'':'muted')+(done?' has-done':'')+(pl?' has-plan':'')} key={key}><span>{d.getDate()}</span>{done>0&&<i>{done}✓</i>}{pl>0&&!done&&<i>{pl} plan</i>}</div>})}</div></section>}
    {tab==='Milestones'&&<section className="simple-card"><div className="section-heading"><div><span className="card-label">MILESTONES</span><h3>Earned from your actual training</h3></div></div><div className="milestone-grid">{achievements.map(x=><div key={x}>✓ {x}</div>)}</div>{!achievements.length&&<div className="empty-state">Keep logging. Milestones appear automatically.</div>}</section>}
    {tab==='Equipment'&&<section className="equipment-stack"><section className="simple-card"><div className="section-heading"><div><span className="card-label">EQUIPMENT PROFILES</span><h3>Home / commercial / travel</h3></div></div><div className="equipment-form"><input value={equipmentDraft.name} onChange={e=>setEquipmentDraft(v=>({...v,name:e.target.value}))}/><input value={equipmentDraft.equipment} onChange={e=>setEquipmentDraft(v=>({...v,equipment:e.target.value}))} placeholder="Equipment, comma separated"/><input value={equipmentDraft.plates} onChange={e=>setEquipmentDraft(v=>({...v,plates:e.target.value}))} placeholder="Plates"/><button onClick={saveEquipment}>Save profile</button></div><div className="equipment-list">{profiles.map(p=><div key={p.id}><div><strong>{p.name}</strong><span>{(p.equipment||[]).join(', ')}</span></div><button className={p.is_active?'active':''} onClick={()=>activate(p.id)}>{p.is_active?'Active':'Use'}</button></div>)}</div></section><section className="simple-card"><div className="section-heading"><div><span className="card-label">SUBSTITUTIONS</span><h3>Exercise swaps</h3></div></div><div className="sub-form"><input value={subDraft.exercise} onChange={e=>setSubDraft(v=>({...v,exercise:e.target.value}))}/><span>→</span><input value={subDraft.substitute} onChange={e=>setSubDraft(v=>({...v,substitute:e.target.value}))}/><input value={subDraft.reason} onChange={e=>setSubDraft(v=>({...v,reason:e.target.value}))} placeholder="Reason / equipment"/><button onClick={addSub}>Add</button></div>{subs.map(s=><div className="sub-row" key={s.id}><strong>{s.exercise}</strong><span>→ {s.substitute}</span><small>{s.reason}</small></div>)}</section></section>}
    {tab==='Photos'&&<section className="simple-card"><div className="section-heading"><div><span className="card-label">PRIVATE PROGRESS PHOTOS</span><h3>Only your account can access these</h3></div><label className="photo-upload">+ Add photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto}/></label></div><div className="photo-grid">{photos.map(p=><figure key={p.id}>{photoUrls[p.id]?<img src={photoUrls[p.id]} alt="Progress"/>:<div/>}<figcaption>{new Date(p.taken_on+'T12:00:00').toLocaleDateString()}</figcaption></figure>)}</div></section>}
    {message&&<div className="status-message">{message}</div>}
  </section>
}
function scheduleByDateSafe(map,key){return map[key]?.length||0}

export function PlannedWorkoutTools({session}) {
  const [rows,setRows]=useState([]),[message,setMessage]=useState('')
  const load=async()=>{const {data}=await supabase.from('planned_workouts').select('*').eq('user_id',session.user.id).in('status',['planned','started']).order('scheduled_date');setRows(data||[])}
  useEffect(()=>{if(session?.user)load()},[session?.user?.id])
  const move=async(row,delta)=>{const d=new Date(row.scheduled_date+'T12:00:00');d.setDate(d.getDate()+delta);await supabase.from('planned_workouts').update({scheduled_date:d.toISOString().slice(0,10),updated_at:new Date().toISOString()}).eq('id',row.id);setMessage('Workout moved.');await load()}
  const duplicate=async row=>{const d=new Date(row.scheduled_date+'T12:00:00');d.setDate(d.getDate()+1);const copy={...row};delete copy.id;delete copy.created_at;delete copy.updated_at;copy.scheduled_date=d.toISOString().slice(0,10);copy.status='planned';await supabase.from('planned_workouts').insert(copy);setMessage('Workout duplicated to next day.');await load()}
  return <section className="simple-card"><div className="section-heading"><div><span className="card-label">SCHEDULE TOOLS</span><h3>Move or duplicate planned workouts</h3></div></div><div className="schedule-tool-list">{rows.slice(0,20).map(r=><div key={r.id}><div><strong>{r.title}</strong><span>{r.scheduled_date}</span></div><div><button onClick={()=>move(r,-1)}>← Day</button><button onClick={()=>move(r,1)}>Day →</button><button onClick={()=>duplicate(r)}>Duplicate</button></div></div>)}</div>{message&&<div className="status-message">{message}</div>}</section>
}

export function ShareImportPanel({session}) {
  const [code,setCode]=useState(''),[message,setMessage]=useState('')
  const importCode=async()=>{
    const {data,error}=await supabase.from('shared_library_items').select('*').eq('share_code',code.trim().toUpperCase()).maybeSingle()
    if(error||!data){setMessage(error?.message||'Share code not found.');return}
    if(data.item_type==='workout'){
      const w=data.payload?.workout||{}
      await supabase.from('planned_workouts').insert({user_id:session.user.id,scheduled_date:today(),title:data.title,source_program_name:'Shared workout',source_day:data.title,workout:w,status:'planned'})
      setMessage('Shared workout added to Today.')
    }else if(data.item_type==='template'){
      await supabase.from('workout_templates').insert({user_id:session.user.id,name:data.title,workout:data.payload?.workout||{}})
      setMessage('Shared template imported.')
    }else{
      await supabase.from('program_library').insert({owner_user_id:session.user.id,name:data.title,description:'Imported by share code',source_type:'shared',visibility:'private',status:'draft',plan:data.payload})
      setMessage('Shared program imported as a draft.')
    }
  }
  return <section className="simple-card"><div className="section-heading"><div><span className="card-label">SHARE / IMPORT</span><h3>Import a WorkoutBoard code</h3></div></div><div className="share-import"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="8-character code"/><button onClick={importCode}>Import</button></div>{message&&<div className="status-message">{message}</div>}</section>
}

export function AccountSecurityPanel({session,appUrl}) {
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const reset=async()=>{setBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(session.user.email,{redirectTo:appUrl});setMessage(error?error.message:'Password reset email requested.');setBusy(false)}
  const resend=async()=>{setBusy(true);const {error}=await supabase.auth.resend({type:'signup',email:session.user.email,options:{emailRedirectTo:appUrl}});setMessage(error?error.message:'Confirmation email requested.');setBusy(false)}
  return <section className="simple-card"><div className="section-heading"><div><span className="card-label">EMAIL & SECURITY</span><h3>{session.user.email}</h3></div></div><div className="security-status"><span>Email confirmed</span><strong>{session.user.email_confirmed_at?'Yes':'No'}</strong></div><div className="security-actions"><button onClick={reset} disabled={busy}>Send password reset</button>{!session.user.email_confirmed_at&&<button onClick={resend} disabled={busy}>Resend confirmation</button>}</div><p className="helper-text">These use Supabase transactional email. Reliable production delivery requires custom SMTP configured in Supabase.</p>{message&&<div className="status-message">{message}</div>}</section>
}

const backupTables=['workout_logs','training_sessions','planned_workouts','training_maxes','profiles','whiteboard_notes','training_goals','body_measurements','workout_templates','user_program_tracking','equipment_profiles','exercise_substitutions','exercise_timer_presets','program_versions']
export function BackupRestorePanel({session}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),fileRef=useRef(null)
  const backup=async()=>{
    setBusy(true);const data={format:'WorkoutBoard Backup',version:2,exported_at:new Date().toISOString(),user_email:session.user.email,tables:{}}
    for(const table of backupTables){
      let q=supabase.from(table).select('*')
      if(table==='profiles')q=q.eq('id',session.user.id);else q=q.eq('user_id',session.user.id)
      const {data:rows,error}=await q
      if(!error)data.tables[table]=rows||[]
    }
    download(`WorkoutBoard-backup-${today()}.json`,JSON.stringify(data,null,2));setBusy(false);setMessage('Backup downloaded.')
  }
  const restore=async e=>{
    const file=e.target.files?.[0];if(!file)return
    if(!window.confirm('Merge this WorkoutBoard backup into the current account?')){e.target.value='';return}
    setBusy(true)
    try{
      const data=JSON.parse(await file.text())
      if(data.format!=='WorkoutBoard Backup')throw new Error('Not a WorkoutBoard backup file')
      for(const table of backupTables){
        const rows=data.tables?.[table]||[];if(!rows.length)continue
        const fixed=rows.map(row=>table==='profiles'?{...row,id:session.user.id}:{...row,user_id:session.user.id})
        const {error}=await supabase.from(table).upsert(fixed)
        if(error)throw new Error(table+': '+error.message)
      }
      setMessage('Backup restored/merged successfully.')
    }catch(err){setMessage(err.message)}
    setBusy(false);e.target.value=''
  }
  return <section className="simple-card"><div className="section-heading"><div><span className="card-label">BACKUP / RESTORE</span><h3>Full WorkoutBoard backup package</h3></div></div><p className="helper-text">JSON is used here because CSV cannot restore nested workouts, programs, board cards, and settings reliably.</p><div className="backup-actions"><button onClick={backup} disabled={busy}>Download full backup</button><button onClick={()=>fileRef.current?.click()} disabled={busy}>Restore backup</button><input ref={fileRef} type="file" accept="application/json,.json" onChange={restore} hidden/></div>{message&&<div className="status-message">{message}</div>}</section>
}

export function AdminDashboardSummary() {
  const [stats,setStats]=useState(null),[error,setError]=useState('')
  useEffect(()=>{supabase.rpc('admin_dashboard_stats').then(({data,error})=>{if(error)setError(error.message);else setStats(data)})},[])
  if(error)return <div className="status-message">{error}</div>
  if(!stats)return <div className="loading-card">Loading admin dashboard…</div>
  return <section className="admin-dashboard-grid">
    <div><span>Users</span><strong>{stats.users}</strong></div>
    <div><span>Active this week</span><strong>{stats.active_this_week}</strong></div>
    <div><span>Workouts this month</span><strong>{stats.workouts_this_month}</strong></div>
    <div><span>Volume this month</span><strong>{Number(stats.volume_this_month||0).toLocaleString()} lb</strong></div>
    <div><span>Inactive 30+ days</span><strong>{stats.inactive_30_days}</strong></div>
    <div><span>Never signed in</span><strong>{stats.never_signed_in}</strong></div>
  </section>
}
