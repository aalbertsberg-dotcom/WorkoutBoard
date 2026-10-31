import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const kinds=['General','Workout Idea','Cue','Goal / PR']

export function WhiteboardPage({session}) {
  const [notes,setNotes]=useState([])
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')
  const [showNew,setShowNew]=useState(false)
  const [filter,setFilter]=useState('All')
  const [draft,setDraft]=useState({title:'',body:'',kind:'General'})
  const [editing,setEditing]=useState(null)

  const load=async()=>{
    if(!session?.user)return
    setLoading(true)
    const {data,error}=await supabase
      .from('whiteboard_notes')
      .select('*')
      .eq('user_id',session.user.id)
      .order('pinned',{ascending:false})
      .order('updated_at',{ascending:false})
    if(error){
      setMessage(error.message)
      setNotes([])
    }else{
      setMessage('')
      setNotes(data||[])
    }
    setLoading(false)
  }

  useEffect(()=>{load()},[session?.user?.id])

  const visible=useMemo(()=>filter==='All'?notes:notes.filter(n=>n.kind===filter),[notes,filter])

  const addNote=async e=>{
    e.preventDefault()
    const title=draft.title.trim()
    const body=draft.body.trim()
    if(!title&&!body)return
    const {error}=await supabase.from('whiteboard_notes').insert({
      user_id:session.user.id,
      title:title||null,
      body,
      kind:draft.kind,
    })
    if(error){setMessage(error.message);return}
    setDraft({title:'',body:'',kind:'General'})
    setShowNew(false)
    await load()
  }

  const togglePin=async note=>{
    const {error}=await supabase.from('whiteboard_notes')
      .update({pinned:!note.pinned,updated_at:new Date().toISOString()})
      .eq('id',note.id)
    if(error){setMessage(error.message);return}
    await load()
  }

  const saveEdit=async()=>{
    if(!editing)return
    const {error}=await supabase.from('whiteboard_notes')
      .update({
        title:editing.title?.trim()||null,
        body:editing.body?.trim()||'',
        kind:editing.kind,
        updated_at:new Date().toISOString(),
      })
      .eq('id',editing.id)
    if(error){setMessage(error.message);return}
    setEditing(null)
    await load()
  }

  const remove=async note=>{
    if(!window.confirm('Delete this whiteboard card?'))return
    const {error}=await supabase.from('whiteboard_notes').delete().eq('id',note.id)
    if(error){setMessage(error.message);return}
    setNotes(v=>v.filter(x=>x.id!==note.id))
  }

  const planWorkout=async note=>{
    const date=new Date().toISOString().slice(0,10)
    const lines=String(note.body||'').split('\n').map(x=>x.trim()).filter(Boolean)
    const exercises=(lines.length?lines:[note.title||'Whiteboard workout']).map((line,i)=>({
      id:`e${i+1}`,name:line,prescription:'Log as performed',note:'From Whiteboard',result:'',done:false
    }))
    const workout={version:2,type:'flexible',source:'Whiteboard',whiteboard_note_id:note.id,exercises,sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:''}
    const {error}=await supabase.from('planned_workouts').insert({
      user_id:session.user.id,scheduled_date:date,title:note.title||'Whiteboard workout',
      source_program_name:'Whiteboard',source_day:note.title||'Workout idea',workout,status:'planned'
    })
    setMessage(error?error.message:'Added to Today.')
  }

  const createProgramDraft=async note=>{
    const {error}=await supabase.from('program_library').insert({
      owner_user_id:session.user.id,
      name:note.title||'Whiteboard program',
      description:note.body||null,
      source_type:'manual',
      visibility:'private',
      status:'draft',
      plan:{source:'whiteboard',whiteboard_note_id:note.id,notes:note.body||''}
    })
    setMessage(error?error.message:'Program draft created in Plan.')
  }

  if(loading)return <section className="page-section"><div className="loading-card">Loading whiteboard…</div></section>

  return <section className="page-section whiteboard-page">
    <section className="whiteboard-hero">
      <div>
        <span className="card-label">WHITEBOARD</span>
        <h2>Keep the stuff you don't want to lose</h2>
        <p>Workout ideas, cues, goals, PR targets, substitutions, or anything you want waiting for you later.</p>
      </div>
      <button className="primary-action whiteboard-add" onClick={()=>setShowNew(v=>!v)}>{showNew?'Close':'+ New card'}</button>
    </section>

    {showNew&&<form className="whiteboard-composer" onSubmit={addNote}>
      <div className="builder-two">
        <label>Type
          <select value={draft.kind} onChange={e=>setDraft(v=>({...v,kind:e.target.value}))}>
            {kinds.map(k=><option key={k}>{k}</option>)}
          </select>
        </label>
        <label>Title
          <input value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))} placeholder="Optional title"/>
        </label>
      </div>
      <label>Note
        <textarea value={draft.body} onChange={e=>setDraft(v=>({...v,body:e.target.value}))} placeholder="Write it down…"/>
      </label>
      <button className="primary-action">Add to whiteboard</button>
    </form>}

    <div className="category-chips whiteboard-filters">
      {['All',...kinds].map(k=><button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{k}</button>)}
    </div>

    {message&&<div className="status-message">{message}</div>}

    <div className="whiteboard-grid">
      {visible.map(note=><article className={'whiteboard-note '+(note.pinned?'pinned':'')} key={note.id}>
        {editing?.id===note.id ? <>
          <div className="builder-two">
            <select value={editing.kind} onChange={e=>setEditing(v=>({...v,kind:e.target.value}))}>{kinds.map(k=><option key={k}>{k}</option>)}</select>
            <input value={editing.title||''} onChange={e=>setEditing(v=>({...v,title:e.target.value}))} placeholder="Title"/>
          </div>
          <textarea value={editing.body||''} onChange={e=>setEditing(v=>({...v,body:e.target.value}))}/>
          <div className="whiteboard-actions">
            <button className="secondary-action" onClick={()=>setEditing(null)}>Cancel</button>
            <button className="primary-action compact" onClick={saveEdit}>Save</button>
          </div>
        </> : <>
          <div className="whiteboard-note-head">
            <div>
              <span className="whiteboard-kind">{note.kind}</span>
              {note.title&&<h3>{note.title}</h3>}
            </div>
            <button className={'whiteboard-pin '+(note.pinned?'active':'')} onClick={()=>togglePin(note)} title={note.pinned?'Unpin':'Pin'}>{note.pinned?'★':'☆'}</button>
          </div>
          <p>{note.body||'—'}</p>
          <div className="whiteboard-note-foot">
            <small>{new Date(note.updated_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small>
            <div>
              {(note.kind==='Workout Idea'||note.kind==='General')&&<button onClick={()=>planWorkout(note)}>Plan workout</button>}
              {(note.kind==='Workout Idea'||note.kind==='General')&&<button onClick={()=>createProgramDraft(note)}>Program draft</button>}
              <button onClick={()=>setEditing({...note})}>Edit</button>
              <button className="danger-lite" onClick={()=>remove(note)}>Delete</button>
            </div>
          </div>
        </>}
      </article>)}
      {!visible.length&&<div className="empty-state whiteboard-empty">Nothing here yet. Add your first card.</div>}
    </div>
  </section>
}
