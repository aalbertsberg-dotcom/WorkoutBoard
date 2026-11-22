import {useEffect,useState} from 'react'

/** Accessible, intentionally closed-by-default section. Unopened tools are not mounted. */
export function MeSection({id,title,description,children,icon='◇',openOnRequest=0}){
  const [open,setOpen]=useState(openOnRequest>0)
  useEffect(()=>{if(openOnRequest>0)setOpen(true)},[openOnRequest])
  const panelId='me-section-'+id
  return <section className={'me-collapsible'+(open?' is-open':'')} data-me-section={id}>
    <h3 className="me-section-title">
      <button type="button" className="me-section-toggle"
        aria-controls={panelId} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
        <span className="me-section-icon" aria-hidden="true">{icon}</span>
        <span className="me-section-label">
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="me-section-chevron" aria-hidden="true">{open?'⌃':'⌄'}</span>
      </button>
    </h3>
    <div className="me-section-content" id={panelId} hidden={!open}>{open?children:null}</div>
  </section>
}

/** Explicit save avoids silent onBlur writes and shows failures without changing the label. */
export function MeDisplayNameEditor({name,email,onSave}){
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState(name||'')
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState('')
  useEffect(()=>{if(!editing)setDraft(name||'')},[name,editing])
  const cancel=()=>{setDraft(name||'');setEditing(false);setStatus('')}
  const save=async event=>{
    event.preventDefault()
    const clean=draft.trim()
    if(!clean){setStatus('Enter a display name.');return}
    if(clean.length>80){setStatus('Use 80 characters or fewer.');return}
    if(clean===String(name||'').trim()){setEditing(false);setStatus('');return}
    if(busy)return
    setBusy(true);setStatus('')
    try{
      const result=await onSave(clean)
      if(result?.error){setStatus(result.error.message||'Could not save your name.');return}
      setEditing(false);setStatus('Display name saved.')
    }catch(error){setStatus(error?.message||'Could not save your name.')}
    finally{setBusy(false)}
  }
  return <section className="me-identity-card" aria-label="Your profile">
    <div className="me-identity-main">
      <div className="me-identity-avatar" aria-hidden="true">●</div>
      <div className="me-identity-text">
        <span className="card-label">YOUR PROFILE</span>
        <h2>{name||'You'}</h2>
        <p>{email||''}</p>
      </div>
      {!editing&&<button type="button" className="me-edit-name" onClick={()=>{setStatus('');setEditing(true)}}>Edit name</button>}
    </div>
    {editing&&<form className="me-name-form" onSubmit={save}>
      <label htmlFor="me-display-name">Display name</label>
      <input id="me-display-name" autoComplete="nickname" maxLength={81}
        value={draft} onChange={e=>setDraft(e.target.value)}/>
      <div className="me-name-actions">
        <button type="button" className="secondary-action" disabled={busy} onClick={cancel}>Cancel</button>
        <button type="submit" className="primary-action" disabled={busy||!draft.trim()}>{busy?'Saving…':'Save name'}</button>
      </div>
    </form>}
    {status&&<p role="status" className="me-inline-status">{status}</p>}
  </section>
}

function MeOneRmField({name,value,onSave}){
  const [draft,setDraft]=useState(value===null||value===undefined?'':String(value))
  const [dirty,setDirty]=useState(false)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{
    if(!dirty)setDraft(value===null||value===undefined?'':String(value))
  },[value,dirty])
  const commit=async()=>{
    if(!dirty||saving)return
    if(draft.trim()!==''&&(!Number.isFinite(Number(draft))||Number(draft)<0)){
      setMessage('Enter a valid nonnegative weight.');return
    }
    setSaving(true);setMessage('')
    try{
      const result=await onSave(name,draft.trim())
      if(result?.error){setMessage(result.error.message||'Save failed.');return}
      setDirty(false)
      setMessage(result?.offline?'Saved offline — will sync.':'Saved.')
    }catch(error){setMessage(error?.message||'Save failed.')}
    finally{setSaving(false)}
  }
  return <div className="me-max-field">
    <label htmlFor={'me-max-'+name}>{name}</label>
    <div className="me-max-input-row">
      <div className="input-with-unit">
        <input id={'me-max-'+name} type="number" min="0" step="0.01" inputMode="decimal"
          value={draft} placeholder="0" onFocus={e=>e.currentTarget.select()}
          onChange={e=>{setDraft(e.target.value);setDirty(true);setMessage('')}}/>
        <b>lb</b>
      </div>
      <button type="button" className="me-max-save" disabled={!dirty||saving}
        onClick={commit}>{saving?'Saving…':'Save'}</button>
    </div>
    {message&&<small role="status" className="me-inline-status">{message}</small>}
  </div>
}

export function MeOneRmEditor({lifts,values,onSave}){
  return <div className="me-max-grid">
    {lifts.map(name=><MeOneRmField key={name} name={name} value={values[name]} onSave={onSave}/>)}
  </div>
}
