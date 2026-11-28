import {useCallback,useEffect,useMemo,useState} from 'react'
import {supabase} from './supabase'
import ExerciseNamePicker from './ExerciseNamePicker.jsx'
import {exerciseAliasLookup,exerciseHistoryKey,exerciseHistoryNames,resolveExerciseHistoryKey} from './exerciseIdentity.js'

// Outside-the-gym management of confirmed exercise aliases.
// This never overwrites a completed workout, rep, machine or program.
export default function ExerciseHistoryManager({session}){
  const userId=session?.user?.id
  const [names,setNames]=useState([])
  const [links,setLinks]=useState([])
  const [source,setSource]=useState('')
  const [target,setTarget]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [status,setStatus]=useState(null)
  const [expanded,setExpanded]=useState(false)
  const [query,setQuery]=useState('')

  const load=useCallback(async()=>{
    if(!userId)return
    setLoading(true)
    const [history,aliases]=await Promise.all([
      supabase.from('training_sessions').select('workout,completed_at')
        .eq('user_id',userId).not('completed_at','is',null)
        .order('completed_at',{ascending:false}).limit(500),
      supabase.from('exercise_name_aliases')
        .select('user_id,alias_key,alias_name,canonical_name,updated_at')
        .eq('user_id',userId).order('updated_at',{ascending:false})
    ])
    if(history.error||aliases.error){
      setStatus({type:'error',message:'Could not load exercise names. Check your connection and retry.'})
    }else{
      setNames(exerciseHistoryNames(history.data||[]))
      setLinks(aliases.data||[])
    }
    setLoading(false)
  },[userId])

  useEffect(()=>{load()},[load])
  const allNames=useMemo(()=>{
    const seen=new Set()
    return [...links.flatMap(link=>[link.alias_name,link.canonical_name]),...names]
      .filter(name=>{
        const key=exerciseHistoryKey(name)
        if(!key||seen.has(key))return false
        seen.add(key)
        return true
      })
  },[links,names])
  const lookup=useMemo(()=>exerciseAliasLookup(links),[links])
  const sourceKey=exerciseHistoryKey(source)
  const targetKey=exerciseHistoryKey(target)
  const knownSource=allNames.find(name=>exerciseHistoryKey(name)===sourceKey)
  const knownTarget=allNames.find(name=>exerciseHistoryKey(name)===targetKey)
  const preferredName=(knownTarget||String(target||'').trim())
  const canLink=Boolean(knownSource&&targetKey&&targetKey.length>=2&&
    preferredName.length<=160&&sourceKey!==targetKey&&!busy)
  const matchingLinks=links.filter(link=>
    !query.trim()||[link.alias_name,link.canonical_name].some(name=>
      exerciseHistoryKey(name).includes(exerciseHistoryKey(query))))
  const shownLinks=expanded?matchingLinks:matchingLinks.slice(0,6)

  const link=async()=>{
    if(!canLink)return
    if(navigator.onLine===false){
      setStatus({type:'error',message:'Connect to save exercise matches across devices.'})
      return
    }
    const preferred=preferredName
    if(resolveExerciseHistoryKey(preferred,lookup)===sourceKey){
      setStatus({type:'error',message:'These names would create a circular history link. Choose a different preferred exercise.'})
      return
    }
    const approved=window.confirm('Link "'+knownSource+'" to "'+preferred+
      '" for YOUR workout history? Only confirm if they represent the same exercise and machine movement. Existing workout names and sets stay unchanged.')
    if(!approved)return
    setBusy(true);setStatus(null)
    const row={user_id:userId,alias_key:sourceKey,alias_name:knownSource,
      canonical_name:preferred,updated_at:new Date().toISOString()}
    const {error}=await supabase.from('exercise_name_aliases')
      .upsert(row,{onConflict:'user_id,alias_key'})
    if(error)setStatus({type:'error',message:'Could not save link: '+error.message})
    else{
      setLinks(current=>[row,...current.filter(link=>link.alias_key!==sourceKey)])
      setSource('');setTarget('')
      setStatus({type:'success',message:'✓ Exercise history linked. Past workout entries remain unchanged.'})
    }
    setBusy(false)
  }
  const unlink=async row=>{
    if(busy)return
    if(navigator.onLine===false){
      setStatus({type:'error',message:'Connect to change saved exercise links.'})
      return
    }
    setBusy(true);setStatus(null)
    const {error}=await supabase.from('exercise_name_aliases')
      .delete().eq('user_id',userId).eq('alias_key',row.alias_key)
    if(error)setStatus({type:'error',message:'Could not unlink: '+error.message})
    else{
      setLinks(current=>current.filter(link=>link.alias_key!==row.alias_key))
      setStatus({type:'success',message:'✓ History link removed. Past workouts were not changed.'})
    }
    setBusy(false)
  }
  return <section className="exercise-history-manager" aria-label="Manage exercise names">
    <p className="exercise-history-help">
      Fix inconsistent exercise names here, outside a workout. Only link names for the same movement or machine.
      Your original workout entries never change.
    </p>
    <div className="exercise-manager-fields">
      <label><span>Previously used name</span>
        <ExerciseNamePicker label="Exercise to match" value={source}
          onChange={setSource} onSelect={setSource}
          choices={allNames} placeholder="Type an exercise you've logged…"/>
      </label>
      <label><span>Match to preferred name</span>
        <ExerciseNamePicker label="Preferred exercise name" value={target}
          onChange={setTarget} onSelect={setTarget}
          choices={allNames.filter(name=>exerciseHistoryKey(name)!==sourceKey)}
          placeholder="Find or type your preferred name…"/>
      </label>
    </div>
    <button type="button" className="exercise-manager-save" disabled={!canLink}
      onClick={link}>{busy?'Saving…':'Link exercise history'}</button>
    {source&&!knownSource&&
      <small className="exercise-manager-hint">Choose a previously logged exercise as the source name.</small>}
    {target&&!knownTarget&&<small className="exercise-manager-hint">New preferred name: you can standardize it manually, too.</small>}
    {status&&<p className={'exercise-manager-status '+status.type} role={status.type==='error'?'alert':'status'}>{status.message}</p>}
    <div className="exercise-manager-links">
      <div className="exercise-manager-links-header">
        <strong>Saved name matches</strong><small>{links.length} links</small>
      </div>
      {links.length>6&&<input type="search" value={query} onChange={e=>setQuery(e.target.value)}
        placeholder="Find a saved match…" aria-label="Search saved exercise matches"/>}
      {loading&&<p>Loading exercise history…</p>}
      {!loading&&!links.length&&<p>No custom matches yet. Previous exercise names are still available when you add a workout.</p>}
      {shownLinks.map(row=><div key={row.alias_key} className="exercise-manager-link-row">
        <div><strong>{row.alias_name}</strong><span>Uses history from {row.canonical_name}</span></div>
        <div className="exercise-manager-link-actions">
          <button type="button" disabled={busy} onClick={()=>{setSource(row.alias_name);setTarget(row.canonical_name);setStatus(null)}}>Edit</button>
          <button type="button" disabled={busy} onClick={()=>unlink(row)}>Unlink</button>
        </div>
      </div>)}
      {!loading&&matchingLinks.length>6&&
        <button type="button" className="exercise-manager-more" onClick={()=>setExpanded(v=>!v)}>
          {expanded?'Show fewer':'Show all '+matchingLinks.length+' matches'}
        </button>}
    </div>
  </section>
}
