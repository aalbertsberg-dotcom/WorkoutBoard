import {confirmWorkset} from './worksetDialogs'
import {useEffect,useState} from 'react'
import {supabase} from './supabase'
import {AGILE_8,COOL_DOWN} from './mobilityRoutines'

const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const duration=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`

export default function MobilitySession({session,initialMode='warmup',onBack,onSaved}){
  const [mode,setMode]=useState(initialMode)
  const [checked,setChecked]=useState({})
  const [startedAt,setStartedAt]=useState(()=>Date.now())
  const [elapsed,setElapsed]=useState(0)
  const [note,setNote]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{const id=setInterval(()=>setElapsed(Math.floor((Date.now()-startedAt)/1000)),1000);return()=>clearInterval(id)},[startedAt])
  useEffect(()=>{setMode(initialMode);setChecked({});setStartedAt(Date.now());setElapsed(0);setNote('');setMessage('')},[initialMode])
  useEffect(()=>{
    const onNativeBack=async event=>{
      event.preventDefault()
      if(Object.values(checked).some(Boolean)&&!await confirmWorkset('Leave this routine without saving?'))return
      onBack?.()
    }
    window.addEventListener('workset-native-back',onNativeBack)
    return()=>window.removeEventListener('workset-native-back',onNativeBack)
  },[checked,onBack])
  const items=mode==='warmup'?AGILE_8:COOL_DOWN
  const count=items.filter((_,i)=>checked[i]).length
  const changeMode=value=>{if(value===mode)return;setMode(value);setChecked({});setStartedAt(Date.now());setElapsed(0);setMessage('')}
  const save=async()=>{
    if(busy||count===0)return
    if(!session?.user?.id){setMessage('Sign in to save a routine.');return}
    setBusy(true);setMessage('')
    const now=new Date().toISOString()
    const title=mode==='warmup'?'DeFranco Agile 8':'Cool-down Routine'
    const {data,error}=await supabase.from('training_sessions').insert({
      user_id:session.user.id,
      title,program:'Mobility',
      session_date:localDay(),
      started_at:new Date(startedAt).toISOString(),completed_at:now,
      total_volume:0,
      workout:{
        mobility:{
          kind:mode,id:mode==='warmup'?'defranco-agile-8':'easy-cooldown',
          duration_seconds:Math.max(1,elapsed),
          items:items.map((x,i)=>({...x,done:Boolean(checked[i])})),
        },
        note,
        exercises:items.filter((_,i)=>checked[i]).map((x,i)=>({id:'mobility-'+i,name:x.title,done:true,note:x.target}))
      }
    }).select('id').single()
    setBusy(false)
    if(error){setMessage(error.message);return}
    onSaved?.(data?.id||null)
  }
  return <section className="page-section workset-mobility">
    <div className="mobility-heading">
      <div><span className="card-label">WARM-UP & COOL-DOWN</span><h2>{mode==='warmup'?'DeFranco Agile 8':'Easy Cool-down'}</h2>
        <p>{mode==='warmup'?'Eight mobility drills · about 10 minutes':'A gentle optional post-workout recovery routine'}</p></div>
      <button className="secondary-action" type="button" onClick={onBack}>← Today</button>
    </div>
    <div className="workset-history-switch" role="group" aria-label="Mobility routine">
      <button type="button" className={mode==='warmup'?'active':''} onClick={()=>changeMode('warmup')}>Warm-up</button>
      <button type="button" className={mode==='cooldown'?'active':''} onClick={()=>changeMode('cooldown')}>Cool-down</button>
    </div>
    <div className="mobility-session-status"><span><strong>{count}/{items.length}</strong> completed</span><span>Time <strong>{duration(elapsed)}</strong></span></div>
    {mode==='warmup'&&<p className="mobility-attribution">DeFranco Agile 8 is a mobility routine. Skip or modify any movement that causes pain; foam rolling is optional.</p>}
    <div className="mobility-movements">{items.map((item,i)=><label key={item.title} className={checked[i]?'done':''}>
      <input type="checkbox" checked={Boolean(checked[i])} onChange={e=>setChecked(prev=>({...prev,[i]:e.target.checked}))}/>
      <span><strong>{i+1}. {item.title}</strong><small>{item.target}</small><em>{item.detail}</em></span>
    </label>)}</div>
    <label className="mobility-note">Optional note<textarea rows={2} value={note} placeholder="How did you feel?" onChange={e=>setNote(e.target.value)}/></label>
    {message&&<div className="status-message" role="status">{message}</div>}
    <div className="mobility-actions">
      <button type="button" className="secondary-action" onClick={onBack} disabled={busy}>Back</button>
      <button type="button" className="primary-action" onClick={save} disabled={busy||!count}>{busy?'Saving…':`Save ${count} movement${count===1?'':'s'}`}</button>
    </div>
  </section>
}
