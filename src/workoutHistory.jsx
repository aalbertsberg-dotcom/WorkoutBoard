import { useEffect,useMemo,useState } from 'react'
import { supabase } from './supabase'
import { RouteMap,outdoorMetrics,formatPace,formatOutdoorDuration,outdoorActivityKind } from './outdoorTracking'
import { workoutDistancePresentation,hasReliableOutdoorRoute,hasVerifiedOutdoorRoute,effectiveCardioDurationSeconds } from './trackingRules'
import { effectiveSteps } from './stepTracking'
import { EditableWorkout } from './advancedFeatures'
import { DialogPortal } from './worksetDialogs'
import {isLegacyWorkoutLink,legacyWorkoutDetail} from './historyNavigation.js'
import { HISTORY_PAGE_SIZE,completedWorkoutKind,completedWorkoutSummary,workoutHistoryMatches,workoutHistoryDayKey } from './workoutHistoryUtils'

const dateKey=workoutHistoryDayKey
const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const prettyDate=key=>{
  const date=new Date(String(key||'')+'T12:00:00')
  return Number.isNaN(date.getTime())?'Unknown date':date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})
}
const formatNumber=v=>Number(v||0).toLocaleString()
const category=completedWorkoutKind
const summary=completedWorkoutSummary
const monthGrid=date=>{
  const first=new Date(date.getFullYear(),date.getMonth(),1)
  const start=new Date(first);start.setDate(first.getDate()-first.getDay())
  const weeks=Math.ceil((first.getDay()+new Date(date.getFullYear(),date.getMonth()+1,0).getDate())/7)
  return Array.from({length:weeks*7},(_,i)=>{
    const d=new Date(start);d.setDate(start.getDate()+i)
    return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      date:d.getDate(),inMonth:d.getMonth()===date.getMonth()}
  })
}

export default function WorkoutHistory({session,initialWorkoutId=null,onBack,onChanged,legacyHistory=[],fromProgress=false}){
  const [rows,setRows]=useState([])
  const [monthRows,setMonthRows]=useState([])
  const [visibleCount,setVisibleCount]=useState(HISTORY_PAGE_SIZE)
  const [hasMore,setHasMore]=useState(false)
  const [loading,setLoading]=useState(true)
  const [loadingMonth,setLoadingMonth]=useState(true)
  const [message,setMessage]=useState('')
  const stored=()=>window.history.state?.tab==='history'?window.history.state.historyView:null
  const [mode,setMode]=useState(()=>stored()?.mode||'calendar')
  const [month,setMonth]=useState(()=>stored()?.month?new Date(stored().month+'T12:00:00'):new Date())
  const [day,setDay]=useState(()=>stored()?.day||localDay())
  const [query,setQuery]=useState(()=>stored()?.query||'')
  const [categoryFilter,setCategoryFilter]=useState(()=>stored()?.categoryFilter||'All')
  const [selectedId,setSelectedId]=useState(()=>stored()?stored().selectedId:initialWorkoutId)
  const [detailRow,setDetailRow]=useState(null)
  const [detailLoading,setDetailLoading]=useState(false)
  const [editing,setEditing]=useState(false)
  const [deleting,setDeleting]=useState(false)
  const [busy,setBusy]=useState(false)

  const load=async()=>{
    if(!session?.user?.id){setRows([]);setHasMore(false);setLoading(false);return}
    setLoading(true)
    const {data,error}=await supabase.from('training_sessions').select('*')
      .eq('user_id',session.user.id).not('completed_at','is',null)
      .order('completed_at',{ascending:false}).range(0,visibleCount)
    if(error)setMessage(error.message)
    else{
      setRows((data||[]).slice(0,visibleCount))
      setHasMore((data||[]).length>visibleCount)
    }
    setLoading(false)
  }
  useEffect(()=>{load()},[session?.user?.id,visibleCount])
  // Fetch calendar dates independently, including months older than list results.
  useEffect(()=>{
    if(!session?.user?.id){setMonthRows([]);setLoadingMonth(false);return}
    let cancelled=false
    const grid=monthGrid(month)
    setLoadingMonth(true)
    setMonthRows([])
    supabase.from('training_sessions').select('*')
      .eq('user_id',session.user.id).not('completed_at','is',null)
      .gte('session_date',grid[0].key).lte('session_date',grid.at(-1).key)
      .order('completed_at',{ascending:false}).limit(1000)
      .then(({data,error})=>{
        if(cancelled)return
        if(error)setMessage(error.message)
        else setMonthRows(data||[])
        setLoadingMonth(false)
      })
    return()=>{cancelled=true}
  },[session?.user?.id,month])
  const saveView=(id=selectedId,extra={})=>{
    const state=window.history.state
    if(state?.tab!=='history')return
    return {...state,historyView:{mode,month:[month.getFullYear(),String(month.getMonth()+1).padStart(2,'0'),'01'].join('-'),day,query,categoryFilter,selectedId:id,...extra}}
  }
  useEffect(()=>{
    const state=saveView()
    if(state)window.history.replaceState(state,'',window.location.href)
  },[mode,month,day,query,categoryFilter,selectedId])
  useEffect(()=>{
    const restore=event=>{
      if(event.state?.tab!=='history')return
      const view=event.state.historyView
      setSelectedId(view?view.selectedId:event.state.workoutId||null)
      if(view){
        setMode(view.mode||'calendar');setMonth(prev=>prev.getFullYear()===Number(view.month.slice(0,4))&&prev.getMonth()+1===Number(view.month.slice(5,7))?prev:new Date(view.month+'T12:00:00'))
        setDay(view.day||localDay());setQuery(view.query||'');setCategoryFilter(view.categoryFilter||'All')
      }
      setEditing(false);setDeleting(false)
      if(view?.selectedId)window.scrollTo({top:0,behavior:'instant'})
      else requestAnimationFrame(()=>window.scrollTo({top:event.state.historyScrollY||0,behavior:'instant'}))
    }
    window.addEventListener('popstate',restore)
    return()=>window.removeEventListener('popstate',restore)
  },[])
  useEffect(()=>{
    if(!selectedId||isLegacyWorkoutLink(selectedId)||!session?.user?.id)return
    if(rows.some(row=>row.id===selectedId)||monthRows.some(row=>row.id===selectedId))return
    let cancelled=false
    setDetailLoading(true)
    supabase.from('training_sessions').select('*').eq('user_id',session.user.id).eq('id',selectedId)
      .not('completed_at','is',null).limit(1).then(({data,error})=>{
        if(cancelled)return
        if(error)setMessage(error.message)
        setDetailRow((data||[]).find(row=>row.id===selectedId)||null)
        setDetailLoading(false)
      })
    return()=>{cancelled=true;setDetailLoading(false)}
  },[selectedId,session?.user?.id,rows,monthRows])
  useEffect(()=>{
    const onNativeBack=event=>{
      if(deleting||editing||selectedId){
        event.preventDefault()
        if(deleting)setDeleting(false)
        else if(editing)setEditing(false)
        else if(fromProgress)onBack?.()
        else openList()
      }
    }
    window.addEventListener('workset-native-back',onNativeBack)
    return()=>window.removeEventListener('workset-native-back',onNativeBack)
  },[deleting,editing,selectedId,mode,month,day,query,categoryFilter,fromProgress,onBack])
  const legacySelected=isLegacyWorkoutLink(selectedId)
    ?legacyWorkoutDetail(legacyHistory.find(row=>String(row.id)===String(selectedId).slice(7)))
    :null
  const selected=rows.find(row=>row.id===selectedId)||monthRows.find(row=>row.id===selectedId)||legacySelected||(detailRow?.id===selectedId?detailRow:null)
  const dates=useMemo(()=>{
    const map={}
    for(const row of monthRows){const key=dateKey(row);if(key&&workoutHistoryMatches(row,categoryFilter))map[key]=(map[key]||0)+1}
    return map
  },[monthRows,categoryFilter])
  const filtered=useMemo(()=>rows.filter(row=>workoutHistoryMatches(row,categoryFilter,query)),[rows,query,categoryFilter])
  const dayRows=monthRows.filter(row=>workoutHistoryMatches(row,categoryFilter)&&dateKey(row)===day)
  const select=row=>{
    const state=saveView(row.id)
    if(state){
      window.history.replaceState({...saveView(null),historyScrollY:window.scrollY},'',window.location.href)
      window.history.pushState({...state,historyDetailParent:true,worksetDepth:Number(state.worksetDepth||0)+1},'',window.location.href)
    }
    setSelectedId(row.id);setEditing(false);setDeleting(false);setMessage('')
    window.scrollTo({top:0,behavior:'instant'})
  }

  const deleteSelected=async()=>{
    if(!selected||busy||!session?.user?.id)return
    setBusy(true);setMessage('')
    const sessionRow=selected
    const {error}=await supabase.from('training_sessions').delete()
      .eq('id',sessionRow.id).eq('user_id',session.user.id)
    if(error){setMessage(error.message);setBusy(false);return}
    if(sessionRow.planned_workout_id)await supabase.from('planned_workouts').delete()
      .eq('id',sessionRow.planned_workout_id).eq('user_id',session.user.id)
    setRows(prev=>prev.filter(row=>row.id!==sessionRow.id))
    setMonthRows(prev=>prev.filter(row=>row.id!==sessionRow.id))
    setDetailRow(null);openList();setDeleting(false);setBusy(false)
    setMessage('Workout deleted.')
    onChanged?.()
  }
  const openList=()=>{
    if(window.history.state?.tab==='history'&&window.history.state?.historyDetailParent){
      window.history.back();return
    }
    setSelectedId(null);setEditing(false);setDeleting(false)
    requestAnimationFrame(()=>document.querySelector('.history-day-title')?.scrollIntoView({block:'nearest'}))
  }
  const changeMonth=offset=>{
    const next=new Date(month.getFullYear(),month.getMonth()+offset,1)
    setMonth(next)
    const today=localDay()
    const prefix=[next.getFullYear(),String(next.getMonth()+1).padStart(2,'0')].join('-')
    setDay(today.startsWith(prefix)?today:prefix+'-01')
  }
  const itemButton=row=><button type="button" className="history-entry" key={row.id} onClick={()=>select(row)}>
    <span className="history-entry-main"><strong>{row.title||'Workout'}</strong>
      <small>{prettyDate(dateKey(row))} · {row.program||category(row)}</small></span>
    <span className="history-entry-meta"><b>{summary(row)}</b><span>View details ›</span></span>
  </button>

  const workout=selected?.workout||{}
  const outdoor=workout.outdoor
  const kind=outdoorActivityKind(workout.quick_cardio_kind||workout.metcon?.activity||selected?.title)
  const distance=workoutDistancePresentation(workout)
  const loggedDurationSeconds=effectiveCardioDurationSeconds(workout)
  const metrics=selected&&kind?outdoorMetrics(outdoor||{},loggedDurationSeconds,kind):null
  const strengthExercises=(workout.exercises||[]).filter(item=>item.name)
  const mainSets=(workout.main||[])

  return <section className="page-section workset-history">
    <div className="workset-history-head">
      <div><span className="card-label">WORKOUT HISTORY</span>
        <h2>{selected?'Workout details':selectedId?'Workout details':mode==='calendar'?'Your training calendar':'Your workout history'}</h2>
        <p>{selected?'Everything recorded for this session':'What you did, when you did it — no charts to dig through'}</p>
      </div>
      <button type="button" className="secondary-action workset-back-control" onClick={selectedId&&fromProgress?onBack:selectedId?openList:onBack}>
        {selectedId&&fromProgress?'← Progress':selectedId?'← All workouts':'← Back'}
      </button>
    </div>
    {message&&<div className="status-message" role="status">{message}</div>}
    {selectedId&&!selected?<p className="history-note" role="status">{loading||loadingMonth||detailLoading?'Loading workout details…':'Workout details not available.'}</p>:selected?<>
      <article className="simple-card history-detail">
        <div className="history-detail-top">
          <div><span className="card-label">{category(selected).toUpperCase()}</span>
            <h3>{selected.title}</h3>
            <p>{prettyDate(dateKey(selected))}{selected.completed_at?' · '+new Date(selected.completed_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''}</p>
            {selected.program&&<small>{selected.program}</small>}
          </div>
          {selected.__legacy
            ?<p className="history-legacy-badge">Older program workout · read-only history</p>
            :<div className="history-detail-actions" role="group" aria-label="Workout actions">
              <button type="button" className="secondary-action" onClick={()=>{setEditing(x=>!x);setDeleting(false)}}>{editing?'Close editor':'Edit'}</button>
              <button type="button" className="secondary-action danger-lite" onClick={()=>{setDeleting(true);setEditing(false)}}>Delete</button>
            </div>}
        </div>
        {category(selected)==='Cardio'&&<>
          {hasReliableOutdoorRoute(outdoor)
            ? <RouteMap points={outdoor.points} compact/>
            : <p className="history-note">No verified GPS route was saved for this activity. Any short GPS distance is an estimate.</p>}
          <div className="history-detail-kpis">
            <div><span>Distance</span><strong>{distance.label}</strong></div>
            <div><span>Duration</span><strong>{formatOutdoorDuration(loggedDurationSeconds)}</strong></div>
            {(kind==='walk'||kind==='run')&&<div><span>Steps</span><strong>{formatNumber(effectiveSteps(outdoor))}</strong></div>}
            <div><span>{kind==='bike'?'Avg speed':'Avg pace'}</span><strong>{!hasVerifiedOutdoorRoute(outdoor)?'—':kind==='bike'?(metrics?.avgMph?metrics.avgMph.toFixed(1)+' mph':'—'):formatPace(metrics?.avgPaceSecPerMile)}</strong></div>
          </div>
          {distance.manual&&<small className="history-note">Distance was entered manually; no GPS route was inferred.</small>}
          {distance.estimated&&<small className="history-note">{distance.note}. Pace is not reported for an unverified track.</small>}
        </>}
        {category(selected)==='Mobility'&&<>
          <p className="history-note">{workout.mobility?.kind==='cooldown'?'Cool-down':'Warm-up'} · {formatOutdoorDuration(Number(workout.mobility?.duration_seconds||0))}</p>
          <div className="history-exercises">{(workout.mobility?.items||[]).map((item,i)=><div key={i}>
            <strong>{item.done?'✓':'○'} {item.title}</strong><small>{item.detail}</small>
          </div>)}</div>
        </>}
        {category(selected)==='Strength'&&<>
          <div className="history-detail-kpis"><div><span>Total volume</span><strong>{formatNumber(selected.total_volume)} lb</strong></div>
            <div><span>Estimated 1RM</span><strong>{selected.estimated_1rm?formatNumber(selected.estimated_1rm)+' lb':'—'}</strong></div></div>
          {mainSets.length>0&&<section className="history-exercises"><h4>Main sets</h4>
            {mainSets.map((set,i)=><div key={i}><strong>Set {i+1}</strong>
              <small>{set.weight||0} lb × {set.actualReps??set.reps??0} reps</small></div>)}</section>}
          {strengthExercises.length>0&&<section className="history-exercises"><h4>Exercises</h4>
            {strengthExercises.map((ex,i)=><div key={ex.id||i}>
              <strong>{ex.name}</strong>
              {ex.setProgress?.length>0
                ? <small>{ex.setProgress.map((set,j)=>{
                    const label=set.drop_set?'Drop '+(set.drop_stage||j+1):'Set '+(j+1)
                    if(set.skipped)return label+': skipped'
                    if(!set.done)return label+': not completed'
                    return label+': '+(set.weight??'—')+' lb × '+(set.actual_reps??set.reps??'—')+' reps ✓'
                  }).join(' · ')}</small>
                : <small>{ex.result||ex.prescription||'Completed'}</small>}
            </div>)}</section>}
          {!mainSets.length&&!strengthExercises.length&&<p className="history-note">No individual sets were recorded for this workout.</p>}
        </>}
        {(workout.note||workout.notes)&&<div className="history-notes"><strong>Notes</strong><p>{workout.note||workout.notes}</p></div>}
      </article>
      {editing&&<EditableWorkout key={selected.id} sessionRow={selected}
        onCancel={()=>setEditing(false)} onSaved={async()=>{
          setEditing(false);setMessage('Workout saved.')
          setDetailRow(null)
          await load()
          setMonth(date=>new Date(date))
          onChanged?.()
        }}/>} 
      {deleting&&<DialogPortal label="Delete this workout?" onDismiss={()=>{if(!busy)setDeleting(false)}}><section className="simple-card history-delete-confirm">
        <h3>Delete this workout?</h3>
        <p>This removes only <strong>{selected.title}</strong> and its linked history. It cannot be undone.</p>
        <div className="history-detail-actions">
          <button type="button" className="secondary-action" onClick={()=>setDeleting(false)} disabled={busy}>Keep workout</button>
          <button type="button" className="danger-action" onClick={deleteSelected} disabled={busy}>{busy?'Deleting…':'Delete workout'}</button>
        </div>
      </section></DialogPortal>}
    </>:<>
      <div className="workset-history-switch" role="group" aria-label="History view">
        <button type="button" className={mode==='calendar'?'active':''} onClick={()=>setMode('calendar')}>Calendar</button>
        <button type="button" className={mode==='list'?'active':''} onClick={()=>setMode('list')}>List & search</button>
      </div>
      <div className="history-filters">
        <label>Activity
          <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
            {['All','Strength','Cardio','Mobility'].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        {mode==='list'&&<label>Search
          <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Workout, exercise or date…"/>
        </label>}
      </div>
      {mode==='calendar'&&<section className="simple-card history-calendar">
        <div className="history-month">
          <button type="button" aria-label="Previous month" onClick={()=>changeMonth(-1)}>‹</button>
          <h3>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3>
          <button type="button" aria-label="Next month" onClick={()=>changeMonth(1)}>›</button>
        </div>
        <div className="history-calendar-grid">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=><b key={x}>{x}</b>)}
          {monthGrid(month).map(d=><button type="button" key={d.key}
            aria-label={d.key+' '+(dates[d.key]||0)+' workouts'}
            className={(d.inMonth?'':'outside ')+(dates[d.key]?'trained ':'')+(day===d.key?'selected ':'')+(d.key===localDay()?'today':'')}
            aria-pressed={day===d.key}
            onClick={()=>{setDay(d.key);if(!d.inMonth)setMonth(new Date(d.key+'T12:00:00'))}}>
            <span>{d.date}</span>{dates[d.key]>0&&<small>{dates[d.key]}</small>}
          </button>)}
        </div>
        <div className="history-calendar-legend"><span><b>Green</b> · workout days</span><span>Number · completed workouts</span></div>
        <h3 className="history-day-title">{prettyDate(day)}</h3>
        <div className="history-entries">{dayRows.map(itemButton)}</div>
        {loadingMonth&&<p className="history-note" role="status">Loading this month's workouts…</p>}
        {!loadingMonth&&!dayRows.length&&<p className="history-empty">No {categoryFilter==='All'?'':categoryFilter.toLowerCase()+' '}workouts recorded on this date.</p>}
      </section>}
      {mode==='list'&&<section className="simple-card">
        <h3>Completed workouts <small>({filtered.length})</small></h3>
        <div className="history-entries">{filtered.map(itemButton)}</div>
        {!loading&&!filtered.length&&<p className="history-empty">No matching workouts in the loaded history.</p>}
        {hasMore&&<button type="button" className="history-load-more" disabled={loading}
          onClick={()=>setVisibleCount(n=>n+HISTORY_PAGE_SIZE)}>{loading?'Loading…':'Load older workouts'}</button>}
        <small className="history-note">Showing {rows.length} most recent workouts{hasMore?' · load older sessions to search further':''}.</small>
      </section>}
      {loading&&<p className="history-note" role="status">Loading your workout history…</p>}
    </>}
  </section>
}
