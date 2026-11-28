import {OverlayPortal} from './worksetDialogs'
import {isNativeAndroid, WorksetUpdater, checkAndroidUpdate} from './androidUpdates.js'
import {recoverWorkoutDraft,persistWorkoutDraft,clearWorkoutDraft} from './durableStore.js'
import {readWorkoutFocus,saveWorkoutFocus,clearWorkoutFocus,resolveWorkoutFocus} from './workoutFocusState.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { MetconTracker } from './advancedFeatures'
import { offlineUuid, queueUpsert, upsertOfflineFirst, isOfflineError, readOfflineState, writeOfflineState } from './offline'
import { OutdoorTracker, emptyOutdoorTrack, outdoorActivityKind, outdoorMetrics } from './outdoorTracking'
import {describeOutdoorGps} from './gpsStatus.js'
import GpsStatusBadge from './GpsStatusBadge.jsx'
import BeatTimer from './BeatTimer.jsx'
import { effectiveSteps } from './stepTracking'
import {partnerSetTarget,missingWorkoutOneRms} from './programSetTargets.js'
import {explainProgramSetWeight,adjustedManualSetWeight} from './programWeightNotes.js'
import {ORIGINAL_CHALLENGE_KEY,ORIGINAL_CHALLENGE_NAME,ORIGINAL_CHALLENGE_ID,ORIGINAL_CHALLENGE_LIFTS,isOriginalChallengeMaxTest,isOriginalChallengeTestSet,originalChallengeCompletedTest,originalChallengeWeek6Estimates,originalChallengeProgramMaxes} from './originalChallengeCycle.js'
import { validWeightDraft,validRepsDraft,displayedSetWeight,recordedWeightValue,canFinishQuickCardio,withoutUnreliableRoute,outdoorDistancePresentation,workoutDistancePresentation,effectiveCardioDurationSeconds,autosaveDelayMs } from './trackingRules'
import {pendingWorkoutSet,unfinishedWorkoutSets,completeExerciseEarly,completeExerciseSet,reopenExerciseSet,deleteWorkoutSet,addDropSet,addDropStage,validateDropStage} from './workoutSetActions.js'
import {exerciseHistoryKey,resolveExerciseHistoryKey,exerciseAliasLookup,exerciseHistoryNames,aggregateExerciseHistory} from './exerciseIdentity.js'
import ExerciseNamePicker from './ExerciseNamePicker.jsx'

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
    exercises:(workout?.exercises||[]).map(item=>{
      const generated=prescribedSetProgress(item.prescription||item.name)
      const existing=Array.isArray(item.setProgress)&&item.setProgress.length ? item.setProgress : generated
      return {
        ...item,
        setProgress:existing.map((set,i)=>({
          ...set,
          label:set.label || generated[i]?.label || (set.reps?set.reps+' reps':'Done'),
          weight:set.weight!==undefined ? set.weight : '',
        }))
      }
    })
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
  if(/z[-\s]?twist/.test(value)) return {label:'Cable weight',placeholder:'lb',optional:false}
  if(/bulgarian split squat|reverse lunge|step-up|glute bridge/.test(value)) return {label:'Weight used',placeholder:'Optional lb',optional:true}
  return {label:'Weight used',placeholder:'lb',optional:false}
}

function legacyLoad(item) {
  if(item?.load!==undefined && item?.load!=='') return Number(item.load)||0
  const direct=String(item?.result||'').trim().match(/^\d+(?:\.\d+)?$/)
  if(direct)return Number(direct[0])
  const legacy=String(item?.result||'').replace(/,/g,'').replace(/[×X]/g,'x').match(/(\d+(?:\.\d+)?)\s*x/i)
  return legacy?Number(legacy[1]):0
}

function setWeight(item,set) {
  return recordedWeightValue(set,legacyLoad(item))
}

function repsForSet(item,set) {
  // Drop stages are AMRAP: never substitute the exercise prescription.
  if(set?.drop_set)return Number(set.actual_reps)||0
  if(set?.actual_reps!==undefined && set?.actual_reps!==null && set?.actual_reps!=='') return Number(set.actual_reps)||0
  if(set?.reps!==undefined && set?.reps!==null && set?.reps!=='') return Number(set.reps)||0
  const m=String(item?.prescription||'').match(/\d+\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  return m?Number(m[1]):0
}

function isDistanceExercise(name) {
  const value=String(name||'').trim().toLowerCase()
  // "Row" can mean cardio, but Cable Row / Hammer ISO-Lateral Row is
  // resistance training and must count toward volume and drop-set eligibility.
  if(/\brows?\b/.test(value)&&
    /\b(cable|dumbbell|db|barbell|seated|chest.supported|machine|hammer|iso.lateral|pendlay|bent.over|t.bar|one.arm|single.arm|landmine|seal)\b/.test(value))
    return false
  return /\b(carr(?:y|ies)|walk|run|running|row|rowing|bike|cycling|sled|sprint)\b/.test(value)
}

function bestLoadedSet(item) {
  const loaded=(item?.setProgress||[])
    .filter(set=>set.done&&!set.skipped&&!set.drop_set)
    .map(set=>({weight:setWeight(item,set),reps:repsForSet(item,set),done:Boolean(set.done)}))
    .filter(set=>set.weight&&set.reps)
  if(!loaded.length){
    if(item?.setProgress?.length)return null
    const weight=legacyLoad(item)
    const reps=repsForSet(item,null)
    return weight&&reps?{weight,reps,done:Boolean(item?.done)}:null
  }
  return loaded.reduce((best,set)=>!best || set.weight>best.weight ? set : best,null)
}

function plannedAlternatives(name) {
  const value=String(name||'').toLowerCase()
  if(/z[-\s]?twist/.test(value)) return ['Face Pull','Cable External Rotation','Band External Rotation','Band Pull-Apart']
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

export function PlannedWorkoutRunner({planned,onFinished,onCancelled,onDismiss,sharedSessionId=null,partnerOneRms={},oneRepMaxes={},onSaveOneRm=null,cancelRequestToken=0}) {
  const [workout,setWorkout]=useState(()=>{
    let cached=null
    try {
      if(planned?.id){
        const raw=JSON.parse(localStorage.getItem('wb-planned-draft-'+planned.id) || 'null')
        const draftTs=Number(localStorage.getItem('wb-planned-draft-ts-'+planned.id)||0)
        const serverTs=planned?.updated_at ? new Date(planned.updated_at).getTime() : 0
        if(raw && draftTs>serverTs)cached=raw
      }
    } catch {}
    return withSetProgress({exercises:[],sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',circuit_rounds:'',conditioningEnabled:false,metcon:{name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'},...(planned?.workout||{}),...(cached||{})})
  })
  const [saveState,setSaveState]=useState('Saved')
  const [finishing,setFinishing]=useState(false)
  const [cancelConfirm,setCancelConfirm]=useState(false)
  const [cancelling,setCancelling]=useState(false)
  const [historySessionRows,setHistorySessionRows]=useState([])
  const [exerciseAliases,setExerciseAliases]=useState([])
  const [historyLinkDrafts,setHistoryLinkDrafts]=useState({})
  const [renameExerciseDrafts,setRenameExerciseDrafts]=useState({})
  const [historyLinkStatus,setHistoryLinkStatus]=useState('')
  const [linkingHistory,setLinkingHistory]=useState(false)
  const aliasLookup=useMemo(()=>exerciseAliasLookup(exerciseAliases),[exerciseAliases])
  const historyByExercise=useMemo(()=>aggregateExerciseHistory(
    historySessionRows,aliasLookup,setWeight,repsForSet,isDistanceExercise
  ),[historySessionRows,aliasLookup])
  const knownExerciseNames=useMemo(()=>exerciseHistoryNames(historySessionRows),[historySessionRows])
  const [substitutions,setSubstitutions]=useState({})
  const [timerPresets,setTimerPresets]=useState({})
  const [conditioningOpen,setConditioningOpen]=useState(()=>Boolean(planned?.workout?.conditioning_prescribed))
  const [exerciseAdderOpen,setExerciseAdderOpen]=useState(false)
  const [newExercise,setNewExercise]=useState({name:'',sets:3,target:'10',rest:90})
  const [activeExerciseIndex,setActiveExerciseIndex]=useState(()=>
    resolveWorkoutFocus(workout,readWorkoutFocus(planned?.user_id,planned?.id))?.index??0)
  const [activeSetByExercise,setActiveSetByExercise]=useState(()=>{
    const focus=resolveWorkoutFocus(workout,readWorkoutFocus(planned?.user_id,planned?.id))
    return focus?.setIndex!=null?{[focus.key]:focus.setIndex}:{}
  })
  const lastRunnerWorkoutIdRef=useRef(planned?.id)
  const restoredRunnerFocusIdRef=useRef(null)
  const [removeExercisePrompt,setRemoveExercisePrompt]=useState(null)
  const [quickClock,setQuickClock]=useState(()=>Date.now())
  const [cardioDetailsOpen,setCardioDetailsOpen]=useState(()=>Boolean(
    workout?.note||workout?.metcon?.distance||workout?.metcon?.duration||workout?.metcon?.calories
  ))
  const cancelRequestedRef=useRef(false)
  const inFlightSaveRef=useRef(Promise.resolve())
  const revisionRef=useRef(0)
  const unsavedSinceRef=useRef(0)
  const [draftReady,setDraftReady]=useState(false)
  const [draftReadyForId,setDraftReadyForId]=useState(null)
  const focusDraftReady=draftReady&&draftReadyForId===planned?.id
  const [oneRmDraft,setOneRmDraft]=useState({})
  const [oneRmSaving,setOneRmSaving]=useState(false)
  const [oneRmSaveMessage,setOneRmSaveMessage]=useState('')
  const needsChallengeCycle=workout?.archive_program_id===ORIGINAL_CHALLENGE_ID && Number(planned?.source_week)>=7
  const [challengeCycle,setChallengeCycle]=useState({workoutId:null,loading:false,maxes:{},results:{},message:''})
  const cyclePending=needsChallengeCycle&&(challengeCycle.workoutId!==planned?.id||challengeCycle.loading)
  const cycleMaxes=needsChallengeCycle&&challengeCycle.workoutId===planned?.id?challengeCycle.maxes||{}:{}
  const isChallenge=workout?.archive_program_id===ORIGINAL_CHALLENGE_ID
  const initialMaxes=workout?.challenge_starting_one_rms&&Object.keys(workout.challenge_starting_one_rms).length
    ? workout.challenge_starting_one_rms:oneRepMaxes
  // Post-test weeks MUST NOT silently use the old global 1RM if a Week 6
  // result is missing. Each lift is independently driven by its test.
  const workoutOneRms=isChallenge
    ? originalChallengeProgramMaxes(planned?.source_week,initialMaxes,cycleMaxes)
    : oneRepMaxes
  const missingOneRms=needsChallengeCycle?[]:missingWorkoutOneRms(workout,workoutOneRms)
  const readyOneRmDrafts=missingOneRms.filter(lift=>Number(oneRmDraft[lift])>0)
  const saveWorkoutOneRms=async event=>{
    event.preventDefault()
    if(!onSaveOneRm||!readyOneRmDrafts.length||oneRmSaving)return
    setOneRmSaving(true)
    setOneRmSaveMessage('')
    const saved=[]
    try{
      for(const lift of readyOneRmDrafts){
        const result=await onSaveOneRm(lift,Number(oneRmDraft[lift]))
        if(result?.error)throw new Error(result.error.message||'1RM save failed.')
        saved.push(lift)
      }
      setOneRmSaveMessage('1RMs saved. Working weights are now calculated from your training max.')
    }catch(error){
      setOneRmSaveMessage('Could not save 1RM: '+(error?.message||'Please retry.'))
    }finally{
      if(saved.length)setOneRmDraft(previous=>Object.fromEntries(
        Object.entries(previous).filter(([lift])=>!saved.includes(lift))))
      setOneRmSaving(false)
    }
  }

  // For Weeks 7-12 the source-of-truth is this run's completed Week 6
  // 100%-TM tests, NOT the user's global/saved 1RMs.
  useEffect(()=>{
    if(!needsChallengeCycle||!planned?.id||!planned?.user_id)return
    let cancelled=false
    const update=value=>{if(!cancelled)setChallengeCycle({workoutId:planned.id,...value})}
    update({loading:true,maxes:{},results:{},message:''})
    const load=async()=>{
      let runStartedAt=planned.workout?.tracking_started_at||null
      if(!runStartedAt&&navigator.onLine!==false){
        const {data:track}=await supabase.from('user_program_tracking')
          .select('started_at')
          .eq('user_id',planned.user_id)
          .eq('program_key',ORIGINAL_CHALLENGE_KEY)
          .eq('status','tracking')
          .order('started_at',{ascending:false}).limit(1).maybeSingle()
        runStartedAt=track?.started_at||null
      }
      if(cancelled)return
      if(!runStartedAt){
        update({loading:false,maxes:{},results:{},
          message:'Week 6 test results cannot be matched to a program run. Track this program to link the test automatically.'})
        return
      }
      const cacheKey='original-challenge-week6:'+runStartedAt
      const cached=readOfflineState(planned.user_id,cacheKey,null)
      if(navigator.onLine===false){
        update({loading:false,maxes:cached?.maxes||{},results:cached?.results||{},
          message:cached?'Using the last synced Week 6 test results (offline).':
            'Offline: Week 6 results have not been synced on this device. Connect before relying on post-test weights.'})
        return
      }
      try{
        const {data:rows,error}=await supabase.from('training_sessions')
          .select('id,program,week,completed_at,workout')
          .eq('user_id',planned.user_id)
          .eq('program',ORIGINAL_CHALLENGE_NAME)
          .eq('week',6)
          .gte('completed_at',runStartedAt)
          .not('completed_at','is',null)
          .order('completed_at',{ascending:false}).limit(50)
        if(error)throw error
        const calculated=originalChallengeWeek6Estimates(rows||[],runStartedAt)
        writeOfflineState(planned.user_id,cacheKey,calculated)
        update({loading:false,maxes:calculated.maxes,results:calculated.results,message:''})
      }catch(error){
        update({loading:false,maxes:cached?.maxes||{},results:cached?.results||{},
          message:'Week 6 results could not be refreshed: '+(error?.message||'Connection unavailable')})
      }
    }
    load()
    return()=>{cancelled=true}
  },[needsChallengeCycle,planned?.id,planned?.user_id,planned?.source_week,planned?.workout?.tracking_started_at])

  const lastCancelRequestRef=useRef(cancelRequestToken)
  useEffect(()=>{
    if(cancelRequestToken===lastCancelRequestRef.current)return
    lastCancelRequestRef.current=cancelRequestToken
    if(cancelRequestToken>0)setCancelConfirm(true)
  },[cancelRequestToken])

  useEffect(()=>{
    if(!workout?.quick_cardio || !workout?.quick_timer_started_at)return
    setQuickClock(Date.now())
    const id=setInterval(()=>setQuickClock(Date.now()),1000)
    return()=>clearInterval(id)
  },[workout?.quick_cardio,workout?.quick_timer_started_at])

  useEffect(()=>{
    let cached=null
    try {
      if(planned?.id){
        const raw=JSON.parse(localStorage.getItem('wb-planned-draft-'+planned.id) || 'null')
        const draftTs=Number(localStorage.getItem('wb-planned-draft-ts-'+planned.id)||0)
        const serverTs=planned?.updated_at ? new Date(planned.updated_at).getTime() : 0
        if(raw && draftTs>serverTs)cached=raw
        else {
          localStorage.removeItem('wb-planned-draft-'+planned.id)
          localStorage.removeItem('wb-planned-draft-ts-'+planned.id)
        }
      }
    } catch {}
    // On iOS/Android wake, refreshPlannedToday updates the server timestamp.
    // This is still the SAME workout: never reset the focused added exercise.
    const switchedWorkout=lastRunnerWorkoutIdRef.current!==planned?.id
    lastRunnerWorkoutIdRef.current=planned?.id
    cancelRequestedRef.current=false
    const incoming=withSetProgress({exercises:[],sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',circuit_rounds:'',conditioningEnabled:false,metcon:{name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'},...(planned?.workout||{}),...(cached||{})})
    setWorkout(incoming)
    if(switchedWorkout){
      const focus=resolveWorkoutFocus(incoming,readWorkoutFocus(planned?.user_id,planned?.id))
      setActiveExerciseIndex(focus?.index??0)
      setActiveSetByExercise(focus?.setIndex!=null?{[focus.key]:focus.setIndex}:{})
      restoredRunnerFocusIdRef.current=null
    }
    setConditioningOpen(Boolean(planned?.workout?.conditioning_prescribed))
    setExerciseAdderOpen(false)
    setNewExercise({name:'',sets:3,target:'10',rest:90})
    setRemoveExercisePrompt(null)
  },[planned?.id])

  // Recover the newest saved draft before writing any replacement.
  useEffect(()=>{
    if(!planned?.id)return
    let cancelled=false
    setDraftReady(false)
    setDraftReadyForId(null)
    const serverTs=planned.updated_at?new Date(planned.updated_at).getTime():0
    let localTs=0
    try{localTs=Number(localStorage.getItem('wb-planned-draft-ts-'+planned.id)||0)}catch{}
    recoverWorkoutDraft(planned.user_id,planned.id,serverTs).then(saved=>{
      if(!cancelled&&saved?.value&&Number(saved.savedAt)>localTs)
        setWorkout(current=>withSetProgress({...current,...saved.value}))
    }).finally(()=>{if(!cancelled){setDraftReadyForId(planned.id);setDraftReady(true)}})
    return()=>{cancelled=true}
  },[planned?.id])

  // Cold-resume after iOS Safari/Android evicts the web view. Wait for
  // workout draft recovery before resolving by stable exercise ID: added
  // exercises may exist only in that recovered draft.
  useEffect(()=>{
    if(!focusDraftReady||!planned?.id||restoredRunnerFocusIdRef.current===planned.id)return
    const saved=readWorkoutFocus(planned.user_id,planned.id)
    const focus=resolveWorkoutFocus(workout,saved)
    restoredRunnerFocusIdRef.current=planned.id
    if(!focus)return
    setActiveExerciseIndex(focus.index)
    setActiveSetByExercise(previous=>({
      ...previous,
      ...(focus.setIndex!=null?{[focus.key]:focus.setIndex}:{})
    }))
    // Only restore scroll on a fresh mount, not on every phone wake.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.getElementById('workout-exercise-'+focus.index)
        ?.scrollIntoView({behavior:'auto',block:'nearest'})
    }))
  },[focusDraftReady,planned?.id,planned?.user_id,workout])

  // Save focus independently of autosaved workout progress. Sync writes
  // on background events as an extra safeguard against OS process eviction.
  useEffect(()=>{
    if(!focusDraftReady||restoredRunnerFocusIdRef.current!==planned?.id)return
    const saveFocus=()=>{
      const item=(workout.exercises||[])[activeExerciseIndex]
      if(!item)return
      const key=item.id||String(activeExerciseIndex)
      saveWorkoutFocus(planned.user_id,planned.id,item,activeSetByExercise[key])
    }
    saveFocus()
    const hidden=()=>{if(document.visibilityState==='hidden')saveFocus()}
    document.addEventListener('visibilitychange',hidden)
    window.addEventListener('pagehide',saveFocus)
    return()=>{
      document.removeEventListener('visibilitychange',hidden)
      window.removeEventListener('pagehide',saveFocus)
    }
  },[focusDraftReady,planned?.id,planned?.user_id,workout.exercises,activeExerciseIndex,activeSetByExercise])

  useEffect(()=>{
    if(!planned?.id||!focusDraftReady)return
    revisionRef.current++
    persistWorkoutDraft(planned.user_id,planned.id,workout).then(ok=>{
      if(!ok)setSaveState('Storage unavailable — keep this page open')
    })
  },[workout,planned?.id,focusDraftReady])

  useEffect(()=>{
    if(!planned?.user_id)return
    let cancelled=false
    const applyMeta=(sessionRows=[],subRows=[],timerRows=[],aliasRows=[])=>{
      if(cancelled)return
      setHistorySessionRows(sessionRows)
      setExerciseAliases(aliasRows)
      const subMap={}
      for(const x of subRows)(subMap[String(x.exercise||'').trim().toLowerCase()]??=[]).push(x)
      setSubstitutions(subMap)
      setTimerPresets(Object.fromEntries(timerRows.map(x=>[String(x.exercise||'').trim().toLowerCase(),x.seconds])))
    }
    if(navigator.onLine===false){
      const cached=readOfflineState(planned.user_id,'runner-meta',null)
      if(cached)applyMeta(cached.sessions||[],cached.subs||[],cached.timers||[],cached.aliases||[])
      return()=>{cancelled=true}
    }
    Promise.all([
      supabase.from('training_sessions').select('workout,completed_at').eq('user_id',planned.user_id).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(150),
      supabase.from('exercise_substitutions').select('*').eq('user_id',planned.user_id),
      supabase.from('exercise_timer_presets').select('*').eq('user_id',planned.user_id),
      supabase.from('exercise_name_aliases').select('user_id,alias_key,alias_name,canonical_name')
        .eq('user_id',planned.user_id),
    ]).then(([sessions,subs,timers,aliases])=>{
      if(cancelled)return
      const sessionRows=sessions.data||[],subRows=subs.data||[],timerRows=timers.data||[]
      const cached=readOfflineState(planned.user_id,'runner-meta',null)
      const aliasRows=aliases.error?(cached?.aliases||[]):(aliases.data||[])
      applyMeta(sessionRows,subRows,timerRows,aliasRows)
      writeOfflineState(planned.user_id,'runner-meta',{
        sessions:sessionRows,subs:subRows,timers:timerRows,aliases:aliasRows
      })
    })
    return()=>{cancelled=true}
  },[planned?.user_id,planned?.id])

  useEffect(()=>{
    if (!planned?.id || !focusDraftReady || saveState !== 'Unsaved' || cancelRequestedRef.current) return
    if(!unsavedSinceRef.current)unsavedSinceRef.current=Date.now()
    const unsavedFor=Date.now()-unsavedSinceRef.current
    const timer=setTimeout(async()=>{
      if(cancelRequestedRef.current)return
      unsavedSinceRef.current=0
      setSaveState('Saving…')
      const updatedAt=new Date().toISOString()
      const revision=revisionRef.current
      const save=inFlightSaveRef.current.catch(()=>{}).then(()=>upsertOfflineFirst(supabase,{
        userId:planned.user_id,
        table:'planned_workouts',
        payload:{...planned,workout,updated_at:updatedAt},
        onConflict:'id',
        dedupeKey:'planned:'+planned.id,
      }))
      inFlightSaveRef.current=save
      const result=await save
      if(!cancelRequestedRef.current&&revision===revisionRef.current)
        setSaveState(result.error?'Save failed: '+result.error.message:result.offline?'Saved offline':'Saved')
    },autosaveDelayMs(unsavedFor,Boolean(workout.quick_cardio)))
    return ()=>clearTimeout(timer)
  },[workout,planned?.id,saveState,focusDraftReady])

  // Link ONLY when the user confirms two labels mean the same movement.
  // Preserve the original names in all recorded workouts.
  const linkExerciseHistory=async(sourceName,targetName)=>{
    const sourceKey=exerciseHistoryKey(sourceName)
    const targetKey=exerciseHistoryKey(targetName)
    if(!sourceKey||!targetKey||sourceKey===targetKey||linkingHistory)return
    if(navigator.onLine===false){
      setHistoryLinkStatus('Connect to save exercise history links across devices.')
      return
    }
    if(!window.confirm('Combine history for "'+sourceName+'" and "'+targetName+
      '"? Only link them if they are the same exercise and machine movement. Original workout names will remain unchanged.'))return
    setLinkingHistory(true)
    const row={
      user_id:planned.user_id,alias_key:sourceKey,alias_name:sourceName,
      canonical_name:targetName,updated_at:new Date().toISOString()
    }
    const {error}=await supabase.from('exercise_name_aliases')
      .upsert(row,{onConflict:'user_id,alias_key'})
    if(error)setHistoryLinkStatus('Could not link exercise history: '+error.message)
    else{
      const next=[...exerciseAliases.filter(item=>item.alias_key!==sourceKey),row]
      setExerciseAliases(next)
      setHistoryLinkDrafts(value=>({...value,[sourceKey]:''}))
      setHistoryLinkStatus('Linked history. Old workout names and sets were preserved.')
      const cached=readOfflineState(planned.user_id,'runner-meta',{})||{}
      writeOfflineState(planned.user_id,'runner-meta',{...cached,aliases:next})
    }
    setLinkingHistory(false)
  }

  const unlinkExerciseHistory=async(sourceName)=>{
    if(linkingHistory||navigator.onLine===false)return
    const sourceKey=exerciseHistoryKey(sourceName)
    setLinkingHistory(true)
    const {error}=await supabase.from('exercise_name_aliases')
      .delete().eq('user_id',planned.user_id).eq('alias_key',sourceKey)
    if(error)setHistoryLinkStatus('Could not unlink history: '+error.message)
    else{
      const next=exerciseAliases.filter(row=>row.alias_key!==sourceKey)
      setExerciseAliases(next)
      setHistoryLinkStatus('Exercise history link removed. Original workouts were never changed.')
      const cached=readOfflineState(planned.user_id,'runner-meta',{})||{}
      writeOfflineState(planned.user_id,'runner-meta',{...cached,aliases:next})
    }
    setLinkingHistory(false)
  }

  const changeExercise=(index,patch)=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((item,i)=>i===index?{...item,...patch}:item)}))
  }
  const change=(key,value)=>{ setSaveState('Unsaved'); setWorkout(v=>({...v,[key]:value})) }

  const quickCardio=Boolean(workout.quick_cardio)
  const quickStartedAt=workout.quick_timer_started_at ? new Date(workout.quick_timer_started_at).getTime() : 0
  const quickElapsedSeconds=Math.max(0,Math.round(
    Number(workout.quick_timer_elapsed_seconds||0) +
    (quickStartedAt ? Math.max(0,(quickClock-quickStartedAt)/1000) : 0)
  ))
  const formatQuickTime=seconds=>{
    const total=Math.max(0,Math.round(Number(seconds)||0))
    const h=Math.floor(total/3600)
    const m=Math.floor((total%3600)/60)
    const sec=total%60
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
  }
  const setQuickFields=patch=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,...patch}))
  }
  const setQuickMetcon=(key,value)=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,conditioningEnabled:true,metcon:{...(v.metcon||{}),[key]:value}}))
  }
  const quickOutdoorKind=quickCardio ? outdoorActivityKind(workout.quick_cardio_kind||workout.metcon?.activity||planned?.title) : ''
  const quickOutdoorGps=quickOutdoorKind
    ?describeOutdoorGps({
      outdoor:workout.outdoor||emptyOutdoorTrack(quickOutdoorKind),
      running:Boolean(workout.quick_timer_started_at),
      elapsedSeconds:quickElapsedSeconds,now:quickClock
    }):null
  const canFinishCardio=canFinishQuickCardio(quickElapsedSeconds,workout.metcon?.duration)
  const setQuickOutdoor=value=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,outdoor:value}))
  }
  const startQuickTimer=()=>{
    if(workout.quick_timer_started_at)return
    const patch={quick_timer_started_at:new Date().toISOString()}
    if(quickOutdoorKind&&!workout.outdoor)patch.outdoor=emptyOutdoorTrack(quickOutdoorKind)
    setQuickFields(patch)
    setQuickClock(Date.now())
  }
  const pauseQuickTimer=()=>{
    if(!workout.quick_timer_started_at)return
    setQuickFields({quick_timer_started_at:null,quick_timer_elapsed_seconds:quickElapsedSeconds})
  }
  const resetQuickTimer=()=>setQuickFields({
    quick_timer_started_at:null,
    quick_timer_elapsed_seconds:0,
    ...(quickOutdoorKind?{outdoor:emptyOutdoorTrack(quickOutdoorKind)}:{})
  })

  const exerciseIncomplete=item=>Boolean(
    item && !item.done && (
      item.setProgress?.length
        ? item.setProgress.some(pendingWorkoutSet)
        : !String(item.result||'').trim()
    )
  )

  const activateExercise=(index,setIndex=null,{scroll=true}={})=>{
    const item=(workout.exercises||[])[index]
    if(!item)return
    setActiveExerciseIndex(index)
    const focusKey=item.id||String(index)
    saveWorkoutFocus(planned?.user_id,planned?.id,item,setIndex!==null?setIndex:activeSetByExercise[focusKey]??null)
    if(setIndex!==null){
      const key=item.id||String(index)
      setActiveSetByExercise(v=>({...v,[key]:setIndex}))
    }
    if(scroll)requestAnimationFrame(()=>document.getElementById('workout-exercise-'+index)?.scrollIntoView({behavior:'smooth',block:'start'}))
  }

  const goToNextExercise=currentIndex=>{
    const items=workout.exercises||[]
    if(!items.length)return
    const order=[...items.keys()].slice(currentIndex+1).concat([...items.keys()].slice(0,currentIndex))
    const next=order.find(index=>exerciseIncomplete(items[index]))
    if(next!==undefined)activateExercise(next,null,{scroll:true})
  }

  const addExercise=()=>{
    const name=String(newExercise.name||'').trim()
    const sets=Math.max(1,Math.min(20,Number(newExercise.sets)||1))
    const target=String(newExercise.target||'').trim() || '10'
    const rest=Math.max(0,Number(newExercise.rest)||0)
    if(!name)return
    const prescription=sets+'x'+target
    const item={
      id:'added-'+Date.now(),
      name,
      prescription,
      rest_seconds:rest,
      result:'',
      load:'',
      done:false,
      custom_added:true,
      setProgress:prescribedSetProgress(prescription),
    }
    const newIndex=(workout.exercises||[]).length
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:[...(v.exercises||[]),item]}))
    setNewExercise({name:'',sets:3,target:'10',rest:90})
    setExerciseAdderOpen(false)
    setActiveExerciseIndex(newIndex)
    saveWorkoutFocus(planned?.user_id,planned?.id,item,0)
    setActiveSetByExercise(v=>({...v,[item.id]:0}))
    requestAnimationFrame(()=>document.getElementById('workout-exercise-'+newIndex)?.scrollIntoView({behavior:'smooth',block:'start'}))
  }

  const removeExercise=index=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).filter((_,i)=>i!==index)}))
    setActiveExerciseIndex(current=>{
      const nextLength=Math.max(0,(workout.exercises||[]).length-1)
      if(!nextLength)return 0
      if(current>index)return current-1
      if(current===index)return Math.min(index,nextLength-1)
      return current
    })
    setRemoveExercisePrompt(null)
  }

  const addExtraSet=index=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((item,i)=>{
      if(i!==index)return item
      const sets=Array.isArray(item.setProgress)?item.setProgress:[]
      const previous=[...sets].reverse().find(set=>!set.drop_set)||{}
      const reps=previous.reps ?? repsForSet(item,previous) ?? null
      const label=previous.label || (reps?reps+' reps':'Done')
      const previousWeight=previous.weight!==undefined&&previous.weight!=='' ? previous.weight : (item.load??'')
      return {
        ...item,
        done:false,
        finished_early:false,
        setProgress:[
          ...sets,
          {
            set:sets.length+1,
            reps,
            label,
            done:false,
            weight:previousWeight,
            extra:true,
          }
        ]
      }
    })}))
  }

  const removeSet=(exerciseIndex,setIndex)=>{
    const item=workout.exercises?.[exerciseIndex]
    const set=item?.setProgress?.[setIndex]
    if(!set||item.setProgress.length<=1)return
    if(set.done&&!window.confirm('Delete this completed set and its recorded weight/reps?'))return
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((exercise,i)=>
      i===exerciseIndex?deleteWorkoutSet(exercise,setIndex):exercise)}))
    const exerciseKey=item.id||String(exerciseIndex)
    setActiveSetByExercise(value=>({...value,[exerciseKey]:null}))
  }

  const finishExerciseNow=index=>{
    const item=workout.exercises?.[index]
    if(!item||!unfinishedWorkoutSets(item).length)return
    if(!(item.setProgress||[]).some(set=>set.done)&&
      !window.confirm('Skip this exercise? No completed sets will be recorded.'))return
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((exercise,i)=>
      i===index?completeExerciseEarly(exercise):exercise)}))
    const key=item.id||String(index)
    setActiveSetByExercise(value=>({...value,[key]:null}))
    goToNextExercise(index)
  }

  const addDropSetToExercise=index=>{
    const item=workout.exercises?.[index]
    if(!item||!loadFieldForExercise(item.name)||isDistanceExercise(item.name))return
    const firstDropIndex=item.setProgress?.length||0
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((exercise,i)=>
      i===index?addDropSet(exercise):exercise)}))
    activateExercise(index,firstDropIndex,{scroll:false})
  }

  const addDropStageToExercise=index=>{
    const item=workout.exercises?.[index]
    if(!item?.setProgress?.some(set=>set.drop_set))return
    const newIndex=item.setProgress.length
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((exercise,i)=>
      i===index?addDropStage(exercise):exercise)}))
    activateExercise(index,newIndex,{scroll:false})
  }

  const totalVolume=useMemo(()=> (workout.exercises||[]).reduce((sum,item)=>{
    if(Array.isArray(item.setProgress)&&item.setProgress.length){
      if(isDistanceExercise(item.name))return sum
      return sum+item.setProgress.reduce((setSum,set)=>{
        if(!set.done)return setSum
        const weight=setWeight(item,set),reps=repsForSet(item,set)
        return setSum+(weight&&reps ? weight*reps : 0)
      },0)
    }
    return sum+parseVolume(item.result)
  },0),[workout.exercises])
  const bestEstimated1rm=useMemo(()=>{
    let best=0
    for(const item of workout.exercises||[]){
      if(isDistanceExercise(item.name))continue
      for(const set of item.setProgress||[]){
        if(!set.done||set.skipped||set.drop_set)continue
        const weight=setWeight(item,set),reps=repsForSet(item,set)
        if(!weight||!reps)continue
        best=Math.max(best,weight*(1+reps/30))
      }
    }
    return best
  },[workout.exercises])

  const cancelWorkout=async()=>{
    if(!planned?.id || cancelling)return
    cancelRequestedRef.current=true
    setCancelling(true)
    // Wait for any earlier save to settle so it cannot overwrite cancellation.
    try{await inFlightSaveRef.current}catch{}
    const cancelledAt=new Date().toISOString()
    const result=await upsertOfflineFirst(supabase,{
      userId:planned.user_id,
      table:'planned_workouts',
      payload:{...planned,workout:{...workout,cancelled_explicitly:true,cancelled_at:cancelledAt},status:'skipped',updated_at:cancelledAt},
      onConflict:'id',
      dedupeKey:'planned:'+planned.id,
    })
    if(result.error){
      cancelRequestedRef.current=false
      setSaveState('Cancel failed: '+result.error.message)
      setCancelling(false)
      return
    }
    await clearWorkoutDraft(planned.user_id,planned.id)
    clearWorkoutFocus(planned.user_id,planned.id)
    setSaveState(result.offline?'Saved offline':'Saved')
    setCancelConfirm(false)
    setCancelling(false)
    onCancelled?.({planned,sharedSessionId,offline:Boolean(result.offline)})
  }

  const baselineLiftForExercise=item=>{
    if(item?.strength_baseline_lift)return item.strength_baseline_lift
    const name=String(item?.name||'').trim().toLowerCase()
    if(/^(back\s+)?squat$/.test(name))return 'Squat'
    if(/^(barbell\s+)?bench(\s+press)?$/.test(name))return 'Bench'
    if(/^(conventional\s+|sumo\s+)?deadlift$/.test(name))return 'Deadlift'
    if(/^(overhead\s+|strict\s+|military\s+)?press$/.test(name))return 'Press'
    return null
  }

  const baselineResults=useMemo(()=>{
    if(!workout?.strength_baseline)return []
    const rows=[]
    for(const item of workout.exercises||[]){
      const lift=baselineLiftForExercise(item)
      if(!lift)continue
      let best=null
      for(const set of item.setProgress||[]){
        if(!set.done)continue
        const weight=setWeight(item,set)
        const reps=repsForSet(item,set)
        if(!weight||!reps||reps>15)continue
        const estimate=Math.round((weight*(1+reps/30)+Number.EPSILON)*100)/100
        if(!best||estimate>best.estimated_1rm){
          best={lift,weight,reps,estimated_1rm:estimate,set:set.set||null,label:set.label||''}
        }
      }
      if(best)rows.push(best)
    }
    return rows
  },[workout])

  const finish=async()=>{
    if (!planned?.id || finishing || (quickCardio&&!canFinishCardio)) return
    if(cyclePending){setSaveState('Waiting for Week 6 test results before finishing.');return}
    if(isOriginalChallengeMaxTest(planned)){
      const testSets=(workout.exercises||[]).flatMap(item=>
        (item.setProgress||[]).filter(isOriginalChallengeTestSet))
      if(testSets.length===0||testSets.some(set=>
        !set.done||!(Number(set.weight)>0)||
        !Number.isInteger(Number(set.actual_reps))||!(Number(set.actual_reps)>0)||
        Number(set.actual_reps)>30||set.actual_reps==null||set.actual_reps==='')){
        setSaveState('Complete the 100% TM test set and enter the actual weight and reps to calculate the next cycle.')
        return
      }
    }
    setFinishing(true)
    await inFlightSaveRef.current.catch(()=>{})
    const now=new Date().toISOString()
    const quickDurationText=quickCardio&&quickElapsedSeconds>0 ? formatQuickTime(quickElapsedSeconds) : ''
    const reliableOutdoor=quickOutdoorKind ? withoutUnreliableRoute(workout.outdoor||emptyOutdoorTrack(quickOutdoorKind)) : null
    const quickOutdoorMetrics=quickOutdoorKind ? outdoorMetrics(reliableOutdoor,quickElapsedSeconds,quickOutdoorKind) : null
    const distanceDisplay=quickOutdoorKind?outdoorDistancePresentation(reliableOutdoor):null
    const quickStepCount=quickOutdoorKind==='walk'||quickOutdoorKind==='run'?effectiveSteps(reliableOutdoor):0
    const gpsDistanceText=distanceDisplay?.meters>0
      ? distanceDisplay.label+(distanceDisplay.estimated?' (GPS estimate)':'')
      : ''
    const manualDistance=String(workout.metcon?.distance||'').trim()
    const reportedDurationSeconds=effectiveCardioDurationSeconds(workout)
    const challengeTestResults=isOriginalChallengeMaxTest(planned)?originalChallengeCompletedTest(workout):[]
    const challengeTestEstimate=challengeTestResults[0]?.estimated_1rm||null
    const finalWorkout={
      ...workout,
      ...(challengeTestResults.length?{challenge_test_results:challengeTestResults}:{}),
      ...(quickCardio?{
        quick_timer_started_at:null,
        quick_timer_elapsed_seconds:quickElapsedSeconds,
        ...(quickOutdoorKind?{
          outdoor:{
            ...reliableOutdoor,
            status:'completed',
            elapsed_seconds:quickElapsedSeconds,
            completed_at:now,
            updated_at:now,
          }
        }:{}),
        metcon:{
          ...(workout.metcon||{}),
          duration:String(workout.metcon?.duration||'').trim()||quickDurationText,
          distance:manualDistance||gpsDistanceText,
          distance_source:manualDistance?'manual':gpsDistanceText?'gps':'none',
        },
      }:{}),
      complete:true,savedAt:now,baseline_results:baselineResults
    }
    const displayedDistance=quickOutdoorKind?workoutDistancePresentation(finalWorkout):null
    // Outdoor activities always get outdoor stats—even when GPS failed.
    // Showing strength "0 sets / 0 lb" for a 47-minute walk is misleading.
    const completionOutdoor=quickOutdoorKind&&quickOutdoorMetrics ? {
      kind:quickOutdoorKind,
      gpsFixes:Number(reliableOutdoor?.gps_health?.received||0),
      gpsLastAccuracy:Number(reliableOutdoor?.last_accuracy_m||0)||null,
      gpsError:reliableOutdoor?.gps_health?.error_code??null,
      gpsUnavailable:quickOutdoorMetrics.distanceM<=0,
      miles:displayedDistance.miles,
      distanceM:displayedDistance.meters,
      distanceLabel:displayedDistance.label,
      distanceMilesLabel:displayedDistance.milesLabel,
      distanceNote:displayedDistance.note,
      distanceEstimated:displayedDistance.estimated,
      distanceManual:displayedDistance.manual,
      routeAvailable:distanceDisplay.hasRoute,
      elapsedSeconds:reportedDurationSeconds,
      avgPaceSecPerMile:quickOutdoorMetrics.avgPaceSecPerMile,
      avgMph:quickOutdoorMetrics.avgMph,
      elevationFt:quickOutdoorMetrics.elevationGainM*3.28084,
      steps:quickStepCount,
      points:quickOutdoorMetrics.points,
      splits:quickOutdoorMetrics.splits,
    } : null
    const generatedSessionId=offlineUuid()
    const completedSets=(finalWorkout.exercises||[]).reduce((sum,item)=>sum+(item.setProgress||[]).filter(set=>set.done).length,0)
    const completedExercises=(finalWorkout.exercises||[]).filter(item=>item.done||(item.setProgress||[]).some(set=>set.done)).length
    const finishPayload=sessionId=>({
      id:sessionId,
      user_id:planned.user_id,
      planned_workout_id:planned.id,
      title:planned.title,
      program:planned.source_program_name||'Custom workout',
      week:planned.source_week||null,
      primary_lift:planned.source_day||null,
      session_date:planned.scheduled_date,
      workout:finalWorkout,
      total_volume:Math.round(totalVolume),
      estimated_1rm:challengeTestEstimate||bestEstimated1rm||null,
      bodyweight:Number(workout.bodyweight||0)||null,
      shared_session_id:sharedSessionId||null,
      started_at:planned.created_at||now,
      completed_at:now,
      created_at:planned.created_at||now,
      updated_at:now,
    })
    const finishLocally=async(sessionId)=>{
      try {
      await queueUpsert({
        userId:planned.user_id,
        table:'planned_workouts',
        payload:{...planned,status:'completed',workout:finalWorkout,updated_at:now},
        onConflict:'id',
        dedupeKey:'planned:'+planned.id,
      })
      await queueUpsert({
        userId:planned.user_id,
        table:'training_sessions',
        payload:finishPayload(sessionId),
        onConflict:'id',
        dedupeKey:'training:'+sessionId,
      })
      if(sharedSessionId){
        await queueUpsert({
          userId:planned.user_id,
          table:'session_results',
          payload:{
            session_id:sharedSessionId,
            user_id:planned.user_id,
            workout:{...finalWorkout,shared_template:planned.workout?.shared_template||planned.workout,shared_meta:planned.workout?.shared_meta||null},
            total_volume:Math.round(totalVolume),
            estimated_1rm:challengeTestEstimate||bestEstimated1rm||null,
            completed_at:now,
            updated_at:now,
          },
          onConflict:'session_id,user_id',
          dedupeKey:'session-result:'+sharedSessionId+':'+planned.user_id,
        })
      }
      await clearWorkoutDraft(planned.user_id,planned.id)
      clearWorkoutFocus(planned.user_id,planned.id)
      }catch(error){
        setSaveState('Finish not saved: '+(error?.message||'Storage unavailable'))
        setFinishing(false)
        return
      }
      setSaveState('Saved offline')
      onFinished?.({
        title:planned.title,
        program:planned.source_program_name||'Custom workout',
        exercises:completedExercises,
        sets:completedSets,
        volume:Math.round(totalVolume),
        strengthBaseline:Boolean(finalWorkout.strength_baseline),
        baselinePath:finalWorkout.baseline_path||null,
        baselineResults,
        challengeTestResults,challengeTestWeek:Number(planned.source_week)||null,
        trainingSessionId:sessionId,
        outdoor:completionOutdoor,
        offline:true,
      })
      setFinishing(false)
    }
    if(navigator.onLine===false){
      await finishLocally(generatedSessionId)
      return
    }
    const existing=await supabase.from('training_sessions').select('id').eq('planned_workout_id',planned.id).maybeSingle()
    if(existing.error&&isOfflineError(existing.error)){
      await finishLocally(generatedSessionId)
      return
    }
    let error=existing.error||null
    let trainingSessionId=existing.data?.id||null
    if (trainingSessionId) {
      const result=await supabase.from('training_sessions').update({
        title:planned.title,program:planned.source_program_name||'Custom workout',week:planned.source_week||null,
        primary_lift:planned.source_day||null,session_date:planned.scheduled_date,workout:finalWorkout,
        total_volume:Math.round(totalVolume),bodyweight:Number(workout.bodyweight||0)||null,
        estimated_1rm:challengeTestEstimate||bestEstimated1rm||null,
        shared_session_id:sharedSessionId||null,
        completed_at:now,updated_at:now
      }).eq('id',trainingSessionId).select('id').single()
      error=result.error
      trainingSessionId=result.data?.id||trainingSessionId
    } else {
      const result=await supabase.from('training_sessions').insert(finishPayload(generatedSessionId)).select('id').single()
      error=result.error
      trainingSessionId=result.data?.id||generatedSessionId
    }
    if(error&&isOfflineError(error)){
      await finishLocally(trainingSessionId||generatedSessionId)
      return
    }
    if (!error) {
      const plannedResult=await upsertOfflineFirst(supabase,{
        userId:planned.user_id,
        table:'planned_workouts',
        payload:{...planned,status:'completed',workout:finalWorkout,updated_at:now},
        onConflict:'id',
        dedupeKey:'planned:'+planned.id,
      })
      if(plannedResult.error){
        setSaveState('Finish failed: '+plannedResult.error.message)
        setFinishing(false)
        return
      }

      if(trainingSessionId){
        const {data:communityProfile}=await supabase.from('profiles')
          .select('display_name,community_opt_in,community_display_name,community_share_bodyweight')
          .eq('id',planned.user_id).maybeSingle()
        if(communityProfile?.community_opt_in){
          await supabase.from('community_activity').upsert({
            user_id:planned.user_id,
            training_session_id:trainingSessionId,
            display_name:communityProfile.community_display_name||communityProfile.display_name||'Member',
            activity_date:planned.scheduled_date,
            title:planned.title,
            summary:{
              program:planned.source_program_name||'Custom workout',
              program_key:planned.workout?.tracking_program_key||null,
              week:planned.source_week||null,
              completed_at:now,
              lift:planned.source_day||null,
              volume:Math.round(totalVolume),
              estimated_1rm:challengeTestEstimate||bestEstimated1rm||null,
              exercises:completedExercises,
              sets:completedSets,
              bodyweight:communityProfile.community_share_bodyweight ? (Number(workout.bodyweight||0)||null) : null
            }
          },{onConflict:'training_session_id'})
        }
      }
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
          estimated_1rm:challengeTestEstimate||bestEstimated1rm||null,
          completed_at:now,
          updated_at:now,
        },{onConflict:'session_id,user_id'})
      }
      await clearWorkoutDraft(planned.user_id,planned.id)
      clearWorkoutFocus(planned.user_id,planned.id)
      setSaveState(plannedResult.offline?'Saved offline':'Saved')
      onFinished?.({
        title:planned.title,
        program:planned.source_program_name||'Custom workout',
        exercises:(finalWorkout.exercises||[]).filter(item=>item.done||(item.setProgress||[]).some(set=>set.done)).length,
        sets:completedSets,
        volume:Math.round(totalVolume),
        strengthBaseline:Boolean(finalWorkout.strength_baseline),
        baselinePath:finalWorkout.baseline_path||null,
        baselineResults:baselineResults,
        challengeTestResults,challengeTestWeek:Number(planned.source_week)||null,
        trainingSessionId,
        outdoor:completionOutdoor,
      })
    } else {
      setSaveState('Finish failed: '+error.message)
    }
    setFinishing(false)
  }

  if(quickCardio){
    const activity=String(workout.metcon?.activity||planned.title||'Cardio')
    const isGeneric=String(workout.quick_cardio_kind||'')==='conditioning'
    return <section className="flex-runner quick-cardio-runner">
      <button type="button" className="quick-cardio-back" onClick={()=>setCancelConfirm(true)}>← Today</button>

      <div className="quick-cardio-head">
        <div>
          <span className="card-label">CARDIO</span>
          <h2>{planned.title}</h2>
          <p>{isGeneric?'Pick your effort, start the timer, then log the details.':'Pick your effort, start the timer, and go.'}</p>
        </div>
        <span className="save-pill">{saveState}</span>
      </div>

      <section className="simple-card quick-cardio-intensity-card">
        <span className="quick-cardio-section-label">How hard?</span>
        <div className="quick-intensity">
          {['Light','Moderate','Hard'].map(level=>{
            const current=(workout.metcon?.intensity==='Easy'?'Light':workout.metcon?.intensity)||'Light'
            return <button type="button" key={level} className={current===level?'active':''} onClick={()=>setQuickMetcon('intensity',level)}>{level}</button>
          })}
        </div>
      </section>

      <section className="quick-cardio-timer">
        <span className="quick-cardio-timer-state">
          {workout.quick_timer_started_at ? 'TIMING NOW' : quickElapsedSeconds ? 'PAUSED' : 'READY'}
        </span>
        {quickOutdoorGps&&<GpsStatusBadge status={quickOutdoorGps}
          onClick={()=>document.getElementById('workset-gps-panel')?.scrollIntoView({behavior:'smooth',block:'start'})}/>}
        <strong>{formatQuickTime(quickElapsedSeconds)}</strong>
        <p className="quick-cardio-timer-hint">
          {workout.quick_timer_started_at
            ? 'Your time is being tracked.'
            : quickElapsedSeconds
              ? 'Resume when you start moving again.'
              : 'Tap Start when you begin.'}
        </p>
        <div>
          {workout.quick_timer_started_at
            ? <button type="button" className="primary-action" onClick={pauseQuickTimer}>Pause</button>
            : <button type="button" className="primary-action" onClick={startQuickTimer}>{quickElapsedSeconds?'Resume':'Start'}</button>}
          {quickElapsedSeconds>0&&<button type="button" className="secondary-action" onClick={resetQuickTimer}>Reset</button>}
        </div>
      </section>

      {quickOutdoorKind&&<OutdoorTracker
        activity={quickOutdoorKind}
        outdoor={workout.outdoor||emptyOutdoorTrack(quickOutdoorKind)}
        onChange={setQuickOutdoor}
        running={Boolean(workout.quick_timer_started_at)}
        elapsedSeconds={quickElapsedSeconds}
      />}

      {quickOutdoorKind&&<BeatTimer compact/>}

      <section className="simple-card quick-cardio-fields">
        <div className="quick-cardio-details-head">
          <span className="quick-cardio-section-label">Workout details <small>(optional)</small></span>
          {quickOutdoorKind
            ? <button type="button" className="secondary-action" aria-expanded={cardioDetailsOpen}
                onClick={()=>setCardioDetailsOpen(value=>!value)}>
                {cardioDetailsOpen?'Hide details':'Add details / manual distance'}
              </button>
            : <small>Enter these during or after your workout.</small>}
        </div>

        {(!quickOutdoorKind||cardioDetailsOpen)&&<>
        <label className="quick-cardio-field">
          <span>Duration</span>
          <input value={workout.metcon?.duration||''} onChange={e=>setQuickMetcon('duration',e.target.value)} placeholder={quickElapsedSeconds?formatQuickTime(quickElapsedSeconds):'e.g. 30 min'}/>
          <small>{quickElapsedSeconds
            ? 'Timer: '+formatQuickTime(quickElapsedSeconds)+' · leave blank to use it automatically.'
            : 'Only enter this manually if you did not use the timer.'}</small>
        </label>

        <div className="quick-cardio-two-col">
          <label className="quick-cardio-field">
            <span>Distance <small>{quickOutdoorKind?'GPS or manual':'optional'}</small></span>
            <input value={workout.metcon?.distance||''} onChange={e=>setQuickMetcon('distance',e.target.value)} placeholder={quickOutdoorKind&&Number(workout.outdoor?.distance_m||0)>0 ? (Number(workout.outdoor.distance_m)/1609.344).toFixed(2)+' mi from GPS' : 'e.g. 2.5 mi'}/>
            {quickOutdoorKind&&<small>{Number(workout.outdoor?.distance_m||0)>0?'Leave blank to use GPS distance automatically.':'If GPS is unavailable, enter distance manually.'}</small>}
          </label>
          <label className="quick-cardio-field quick-calories">
            <span>Calories <small>optional</small></span>
            <input type="number" inputMode="numeric" value={workout.metcon?.calories||''} onChange={e=>setQuickMetcon('calories',e.target.value)} placeholder="Calories"/>
          </label>
        </div>

        {isGeneric&&<label className="quick-cardio-field">
          <span>Activity <small>optional</small></span>
          <input value={workout.metcon?.activity||''} onChange={e=>setQuickMetcon('activity',e.target.value)} placeholder="Row, elliptical, sled, hike…"/>
        </label>}

        <label className="quick-cardio-field">
          <span>Notes <small>optional</small></span>
          <textarea value={workout.note||''} onChange={e=>change('note',e.target.value)} placeholder="Route, how it felt, anything worth remembering…"/>
        </label>
        </>}
      </section>

      <div className="quick-cardio-actions">
        <button type="button" className="secondary-action" onClick={()=>setCancelConfirm(true)}>Cancel</button>
        <button type="button" className="finish" onClick={finish} disabled={finishing||cancelling||!canFinishCardio}>{finishing?'FINISHING…':'FINISH'}</button>
      </div>

      {!canFinishCardio&&<small className="quick-cardio-finish-hint">Start the timer or enter a workout duration before finishing.</small>}
      {cancelConfirm&&<OverlayPortal onDismiss={()=>{if(!cancelling)setCancelConfirm(false)}}><div className="same-day-sheet-backdrop workout-cancel-backdrop" onClick={()=>!cancelling&&setCancelConfirm(false)}>
        <section className="same-day-sheet cancel-workout-confirm cancel-workout-modal" onClick={e=>e.stopPropagation()}>
          <span className="card-label">ACTIVE WORKOUT</span>
          <h3>Cancel this {String(planned.title||'workout').toLowerCase()}?</h3>
          <p>This discards this unfinished workout and returns to Today.</p>
          <div><button type="button" className="secondary-action" onClick={()=>setCancelConfirm(false)} disabled={cancelling}>Keep it</button><button type="button" className="danger-action" onClick={cancelWorkout} disabled={cancelling}>{cancelling?'Cancelling…':'Yes, cancel'}</button></div>
        </section>
      </div></OverlayPortal>}
    </section>
  }

  return <section className="flex-runner">
    <div className="flex-runner-head">
      <div><span className="card-label">PLANNED WORKOUT</span><h2>{planned.title}</h2><p>{planned.source_program_name||'Custom workout'}{planned.source_week?` · Week ${planned.source_week}`:''}</p></div>
      <div className="flex-runner-head-actions">
        <span className="save-pill">{saveState}</span>
        <button type="button" className="quick-add-exercise" onClick={()=>setExerciseAdderOpen(v=>!v)}>{exerciseAdderOpen?'Close':'+ Exercise'}</button>
      </div>
    </div>

    {needsChallengeCycle&&<section className="simple-card" aria-label="531 Original Challenge Week 6 auto-calculation">
      <div className="section-heading"><div><span className="card-label">POST-TEST TRAINING MAX</span><h3>Calculated from Week 6 results</h3></div></div>
      {cyclePending?<p className="helper-text">Loading the completed Week 6 test reps before calculating today's weights…</p>:<>
        {Object.keys(cycleMaxes).length>0&&<p className="helper-text">The new 1RM estimates from Week 6 are applied to this program only. This week's target weights use 85% of those estimates{Number(planned.source_week)>=10?', plus the programmed 5/10 lb increase':''}.</p>}
        {ORIGINAL_CHALLENGE_LIFTS.filter(lift=>cycleMaxes[lift]).map(lift=><div className="helper-text" key={lift}>
          {lift}: {challengeCycle.results?.[lift]?.weight} lb × {challengeCycle.results?.[lift]?.reps} reps → estimated 1RM {Number(cycleMaxes[lift]).toFixed(2)} lb
        </div>)}
        {ORIGINAL_CHALLENGE_LIFTS.filter(lift=>!cycleMaxes[lift]).length>0&&
          <p className="helper-text" role="status">Missing Week 6 test results for {ORIGINAL_CHALLENGE_LIFTS.filter(lift=>!cycleMaxes[lift]).join(', ')}. No calculated weight is shown for those lifts until a valid completed Week 6 test exists. You may still log a manual weight.</p>}
        {challengeCycle.message&&<p className="helper-text" role="status">{challengeCycle.message}</p>}
      </>}
    </section>}

    {missingOneRms.length>0&&onSaveOneRm&&<form className="simple-card workout-missing-one-rm" onSubmit={saveWorkoutOneRms}>
      <div className="section-heading"><div><span className="card-label">WORKOUT WEIGHT TARGETS</span><h3>Enter your 1RMs to calculate weights</h3></div></div>
      <p className="helper-text">Missing {missingOneRms.join(' and ')} 1RM{missingOneRms.length>1?'s':''}. Enter your one-rep maximum in pounds. WorkSet uses 85% as the training max, then applies this program's set percentages.</p>
      <div className="builder-two">
        {missingOneRms.map(lift=><label className="conditioning-field" key={lift}><span>{lift} 1RM (lb)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 200" value={oneRmDraft[lift]??''}
          onChange={event=>{const value=event.target.value;if(!validWeightDraft(value))return;setOneRmDraft(previous=>({...previous,[lift]:value}));setOneRmSaveMessage('')}}/></label>)}
      </div>
      <button className="primary-action" type="submit" disabled={oneRmSaving||readyOneRmDrafts.length===0}>{oneRmSaving?'Saving 1RMs…':'Save 1RM & calculate weights'}</button>
      {oneRmSaveMessage&&<p className="helper-text" role="status">{oneRmSaveMessage}</p>}
    </form>}

    {exerciseAdderOpen&&<section className="simple-card add-exercise-card add-exercise-card-top">
      <div className="section-heading">
        <div><span className="card-label">ADD EXERCISE</span><h3>Add to this workout</h3></div>
        <button type="button" className="conditioning-remove" onClick={()=>setExerciseAdderOpen(false)}>Cancel</button>
      </div>
      <div className="quick-add-row">
        <label className="conditioning-field"><span>Movement</span><ExerciseNamePicker
          autoFocus value={newExercise.name} label="Exercise name to add" placeholder="Type to find an exercise…"
          choices={[...knownExerciseNames,...(workout.exercises||[]).map(exercise=>exercise.name)]}
          onChange={name=>setNewExercise(v=>({...v,name}))}
          onSelect={name=>setNewExercise(v=>({...v,name}))}/></label>
        <button type="button" className="primary-action quick-add-submit" disabled={!String(newExercise.name||'').trim()} onClick={addExercise}>Add</button>
      </div>
      <div className="add-exercise-grid compact-add-details">
        <label className="conditioning-field"><span>Sets</span><input type="number" inputMode="numeric" min="1" max="20" value={newExercise.sets} onChange={e=>setNewExercise(v=>({...v,sets:e.target.value}))}/></label>
        <label className="conditioning-field"><span>Reps</span><input value={newExercise.target} onChange={e=>setNewExercise(v=>({...v,target:e.target.value}))} placeholder="10"/></label>
        <label className="conditioning-field"><span>Rest</span><input type="number" inputMode="numeric" min="0" value={newExercise.rest} onChange={e=>setNewExercise(v=>({...v,rest:e.target.value}))}/></label>
      </div>
    </section>}

    {(workout.exercises||[]).map((item,i)=>{
      const key=String(item.name||'').trim().toLowerCase()
      const hist=historyByExercise[resolveExerciseHistoryKey(item.name,aliasLookup)]
      const aliasRow=exerciseAliases.find(row=>row.alias_key===exerciseHistoryKey(item.name))
      const historyCandidates=knownExerciseNames.filter(name=>
        exerciseHistoryKey(name)!==exerciseHistoryKey(item.name))
      const currentBest=bestLoadedSet(item)
      const current=currentBest&&!isDistanceExercise(item.name)?{weight:currentBest.weight,reps:currentBest.reps,e1rm:currentBest.weight*(1+currentBest.reps/30)}:null
      const isPR=Boolean(current&&hist&&(current.weight>(hist.bestWeight||0)||current.e1rm>(hist.bestE||0)+.5))
      const loadField=loadFieldForExercise(item.name)
      const fallbackRest=/squat|deadlift|bench|press|clean|snatch/i.test(item.name||'')?Number(localStorage.getItem('wb-setting-compound-rest')||180):Number(localStorage.getItem('wb-setting-accessory-rest')||90)
      const programRest=Number(item.rest_seconds||fallbackRest)
      const rest=timerPresets[key]||programRest
      const sub=substitutions[key]?.[0]
      const firstIncompleteIndex=(workout.exercises||[]).findIndex(exerciseIncomplete)
      const focusedExerciseIndex=exerciseIncomplete((workout.exercises||[])[activeExerciseIndex]) ? activeExerciseIndex : firstIncompleteIndex
      const targetSet=(item.setProgress||[]).find(pendingWorkoutSet)||(item.setProgress||[])[0]
      const partnerTargets=Object.entries(partnerOneRms||{}).map(([userId,maxes])=>({
        userId,
        name:maxes?.displayName||'Partner',
        target:partnerSetTarget(maxes,targetSet),
      })).filter(x=>x.target)
      const cardActivatable=exerciseIncomplete(item)
      const activateFromCard=e=>{
        if(!cardActivatable)return
        if(e.target.closest('button,input,select,textarea,a,label,summary,details'))return
        activateExercise(i,null,{scroll:false})
      }
      return <article
        id={'workout-exercise-'+i}
        className={'flex-exercise '+(item.done?'done ':'')+(item.group?'grouped ':'')+(cardActivatable?'tappable-exercise ':'')+(i===focusedExerciseIndex?'current-exercise':'')}
        key={item.id||i}
        role={cardActivatable?'button':undefined}
        tabIndex={cardActivatable?0:undefined}
        aria-label={cardActivatable?`Work on ${item.name}`:undefined}
        onClick={activateFromCard}
        onKeyDown={e=>{if(cardActivatable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();activateExercise(i,null,{scroll:false})}}}
      >
        <div className="flex-exercise-title">
          <div>
            <div className="exercise-name-line"><strong>{item.name}</strong>{isPR&&<b className="pr-mini">PR</b>}<PlannedAlternatives name={item.name}/></div>
            <span className="exercise-plan-line">{humanPrescription(item.prescription)}{rest?' · '+(rest<120?rest+' sec':rest/60+' min')+' rest':''}</span>
            {item.setProgress?.some(set=>Number(set.tm_offset)>0)&&
              <small className="program-increment-indicator">
                +{Number(item.setProgress.find(set=>Number(set.tm_offset)>0)?.tm_offset)} lb added to training max — already included in set weights
              </small>}
            {partnerTargets.length>0&&<small className="partner-targets"><strong>Targets:</strong> {partnerTargets.map(x=>x.name+' '+x.target).join(' · ')}</small>}
            {item.note&&<details className="exercise-cue"><summary>Cue</summary><small>{item.note}</small></details>}
            {hist?.last&&<small className="flex-history"><strong>Last time{hist.sourceName&&exerciseHistoryKey(hist.sourceName)!==exerciseHistoryKey(item.name)?' ('+hist.sourceName+')':''}:</strong> {hist.last}</small>}
            {(aliasRow||historyCandidates.length>0)&&<details className="exercise-history-link">
              <summary>Match exercise history</summary>
              {aliasRow&&<p className="history-alias-connected">
                Linked to <strong>{aliasRow.canonical_name}</strong>
                <button type="button" disabled={linkingHistory||navigator.onLine===false} onClick={()=>unlinkExerciseHistory(item.name)}>Unlink</button>
              </p>}
              <p>Only link names you know are the same exercise and movement. Brand names alone are not enough.</p>
              {historyCandidates.length>0&&<div className="exercise-history-link-row">
                <ExerciseNamePicker
                  value={historyLinkDrafts[exerciseHistoryKey(item.name)]||''}
                  label={'Find a matching past exercise for '+item.name}
                  placeholder="Type a past exercise name…"
                  choices={historyCandidates}
                  onChange={value=>setHistoryLinkDrafts(v=>({...v,[exerciseHistoryKey(item.name)]:value}))}
                  onSelect={value=>setHistoryLinkDrafts(v=>({...v,[exerciseHistoryKey(item.name)]:value}))}
                />
                <button type="button" disabled={linkingHistory||!historyCandidates.some(name=>
                    exerciseHistoryKey(name)===exerciseHistoryKey(historyLinkDrafts[exerciseHistoryKey(item.name)]))}
                  onClick={()=>linkExerciseHistory(item.name,
                    historyCandidates.find(name=>exerciseHistoryKey(name)===exerciseHistoryKey(historyLinkDrafts[exerciseHistoryKey(item.name)])))}>
                  Link history
                </button>
              </div>}
              <details className="exercise-rename-inline">
                <summary>Edit this workout's exercise name</summary>
                <div className="exercise-history-link-row">
                  <ExerciseNamePicker
                    value={renameExerciseDrafts[item.id||String(i)]??item.name}
                    label={'Change exercise name for '+item.name} placeholder="Exercise name…"
                    choices={knownExerciseNames}
                    onChange={value=>setRenameExerciseDrafts(v=>({...v,[item.id||String(i)]:value}))}
                    onSelect={value=>setRenameExerciseDrafts(v=>({...v,[item.id||String(i)]:value}))}
                  />
                  <button type="button" disabled={!String(renameExerciseDrafts[item.id||String(i)]??item.name).trim()||
                    exerciseHistoryKey(renameExerciseDrafts[item.id||String(i)]??item.name)===exerciseHistoryKey(item.name)}
                    onClick={()=>{
                      const updated=String(renameExerciseDrafts[item.id||String(i)]||'').trim()
                      if(!updated)return
                      changeExercise(i,{name:updated})
                      setRenameExerciseDrafts(v=>({...v,[item.id||String(i)]:updated}))
                      setHistoryLinkStatus('Name changed for this workout. Past workout names are unchanged.')
                    }}>Use name</button>
                </div>
                <small>Only changes this workout. It does not rename your saved program or previous sessions.</small>
              </details>
              {historyLinkStatus&&<small role="status">{historyLinkStatus}</small>}
            </details>}
            {sub&&<small className="sub-suggestion">Saved substitute: {sub.substitute}{sub.reason?' · '+sub.reason:''}</small>}
          </div>
          <div className="exercise-title-actions">
            <button type="button" className="remove-exercise-x" aria-label={'Remove '+item.name+' from this workout'} onClick={()=>setRemoveExercisePrompt({index:i,name:item.name})}>×</button>
            {!item.setProgress?.length&&<button type="button" className={'check '+(item.done?'checked':'')} onClick={()=>{ const next=!item.done; changeExercise(i,{done:next}); if(next) window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds:rest}})) }}>✓</button>}
          </div>
        </div>
        {item.setProgress?.length>0&&(()=>{
          const exerciseKey=item.id||String(i)
          const selectedSetIndex=activeSetByExercise[exerciseKey]
          const selectedSet=Number.isInteger(selectedSetIndex)&&pendingWorkoutSet(item.setProgress[selectedSetIndex]) ? selectedSetIndex : -1
          const activeIndex=selectedSet>=0 ? selectedSet : item.setProgress.findIndex(pendingWorkoutSet)
          const activeSet=activeIndex>=0?item.setProgress[activeIndex]:null
          const programmedTargetText=activeSet&&!cyclePending ? partnerSetTarget(workoutOneRms,activeSet) : ''
          const weightNote=explainProgramSetWeight(workoutOneRms,activeSet,{programId:workout.archive_program_id,week:planned?.source_week})
          const programmedTarget=Number(String(programmedTargetText||'').match(/^\d+/)?.[0]||0)
          const previousWeight=activeIndex>0 ? Number(item.setProgress[activeIndex-1]?.weight||0) : 0
          const lastTimeWeight=activeIndex>=0 ? Number(hist?.lastWeights?.[Math.min(activeIndex,(hist?.lastWeights?.length||1)-1)]||0) : 0
          const legacyWeight=item.load!==undefined&&item.load!=='' ? Number(item.load)||0 : 0
          const lacksTestResult=needsChallengeCycle&&activeSet?.weight_lift&&!cycleMaxes[activeSet.weight_lift]
          const shownWeight=(cyclePending||lacksTestResult)&&activeSet?.weight_lift&&!activeSet?.done&&!activeSet?.weight_edited
            ? ''
            : programmedTarget>0&&activeSet?.weight_lift&&!activeSet?.weight_edited&&!activeSet?.done
              ? String(programmedTarget)
              : displayedSetWeight(activeSet,[programmedTarget,previousWeight,lastTimeWeight,legacyWeight])
          return <>
            {activeSet&&i===focusedExerciseIndex&&<section className="current-set-panel">
              <div className="current-set-panel-head">
                <div><span className="card-label">{activeSet.drop_set?'DROP SET · AMRAP':activeSet.extra?'EXTRA SET':'CURRENT SET'}</span><h3>{activeSet.drop_set?'Drop stage '+activeSet.drop_stage:activeSet.extra?'Extra set':'Set '+(activeIndex+1)+' of '+item.setProgress.length}</h3></div>
                <strong>{activeSet.label || (activeSet.reps?activeSet.reps+' reps':'Complete')}{activeSet.target_weight_range?' · '+activeSet.target_weight_range:programmedTargetText?' · '+programmedTargetText:''}</strong>
              </div>
              <div className="current-set-entry-grid">
                {loadField&&<label className="current-set-weight">
                  <span>{loadField.label}{loadField.optional?' (optional)':''}</span>
                  <div>
                    <input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" autoComplete="off" enterKeyHint="done" value={shownWeight}
                      onFocus={e=>e.currentTarget.select()}
                      onChange={e=>{
                        const value=e.target.value
                        if(!validWeightDraft(value))return
                        changeExercise(i,{
                          load:value,
                          result:'',
                          setProgress:item.setProgress.map((sp,k)=>k===activeIndex?{...sp,weight:value,weight_edited:true}:sp)
                        })
                      }}
                      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}
                      placeholder={loadField.placeholder}/>
                    <b>lb</b>
                  </div>
                </label>}
                {activeSet&&!isDistanceExercise(item.name)&&<label className="current-set-weight current-set-reps">
                  <span>Reps</span>
                  <div>
                    <input type="text" inputMode="numeric" enterKeyHint="done" pattern="[0-9]*" autoComplete="off"
                      value={activeSet.actual_reps??''}
                      onFocus={e=>e.currentTarget.select()}
                      onChange={e=>{
                        const value=e.target.value
                        if(!validRepsDraft(value))return
                        changeExercise(i,{setProgress:item.setProgress.map((sp,k)=>k===activeIndex?{...sp,actual_reps:value}:sp)})
                      }}
                      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}
                      placeholder={activeSet.drop_set?'Actual AMRAP reps':activeSet.reps!==undefined&&activeSet.reps!==null&&activeSet.reps!==''?String(activeSet.reps):'Reps'}/>
                    <b>reps</b>
                  </div>
                </label>}
              </div>
              {activeSet&&!isDistanceExercise(item.name)&&<small className="rep-default-hint">{activeSet.drop_set?'Drop stage: enter the ACTUAL weight and reps. Reduce weight for the next stage with little or no rest.':isOriginalChallengeMaxTest(planned)&&isOriginalChallengeTestSet(activeSet)?'Test set: enter your ACTUAL completed reps. This calculates the next cycle.':'Leave blank = programmed reps. Enter only if different.'}</small>}

              {weightNote&&<div className="program-weight-note">
                <div className="program-weight-note-top">
                  <strong>{weightNote.basisLabel}</strong>
                  {weightNote.isProgramIncrease&&<span className="program-weight-included">{weightNote.offsetLabel}</span>}
                </div>
                <details>
                  <summary>How was this set's weight calculated?</summary>
                  <p>{weightNote.formula||'Enter the required 1RM or Week 6 test result to calculate this set.'}</p>
                  <small>Weights are rounded to the nearest 5 lb. This program's increase is already included in the target.</small>
                </details>
              </div>}
              {weightNote&&loadField&&<div className="program-weight-manual">
                <span>Optional: adjust this set only (does not change the program's training max)</span>
                <div className="program-weight-manual-actions">
                  {[5,10].map(increment=><button type="button" key={increment} disabled={cyclePending||!adjustedManualSetWeight(shownWeight,increment)}
                    onClick={()=>{
                      const value=adjustedManualSetWeight(shownWeight,increment)
                      if(value===null)return
                      changeExercise(i,{
                        load:value,result:'',
                        setProgress:item.setProgress.map((sp,k)=>k===activeIndex?{...sp,weight:value,weight_edited:true}:sp)
                      })
                    }}>+{increment} lb to this set</button>)}
                  {activeSet.weight_edited&&programmedTarget>0&&<button type="button" onClick={()=>
                    changeExercise(i,{
                      load:String(programmedTarget),result:'',
                      setProgress:item.setProgress.map((sp,k)=>k===activeIndex?{...sp,weight:String(programmedTarget),weight_edited:false}:sp)
                    })}>Use programmed weight</button>}
                </div>
              </div>}

              <div className="current-set-actions">
              <button type="button" className="primary-action complete-current-set" onClick={()=>{
                if(lacksTestResult&&!activeSet.weight_edited){
                  setSaveState('Missing this lift’s Week 6 test. Enter a manual weight or record the test before continuing.')
                  return
                }
                if(isOriginalChallengeMaxTest(planned)&&isOriginalChallengeTestSet(activeSet)&&
                  (!(Number(shownWeight)>0)||!(Number(activeSet.actual_reps)>0)||
                    !Number.isInteger(Number(activeSet.actual_reps))||Number(activeSet.actual_reps)>30)){
                  setSaveState('Enter the actual weight and reps for the 100% TM max test before completing this set.')
                  return
                }
                const dropIssue=validateDropStage(activeSet,shownWeight,activeSet.actual_reps)
                if(dropIssue){setSaveState(dropIssue);return}
                const nextItem=completeExerciseSet(item,activeIndex,loadField?shownWeight:undefined)
                const nextSetIndex=nextItem.setProgress.findIndex((sp,k)=>k!==activeIndex&&pendingWorkoutSet(sp))
                changeExercise(i,{...nextItem,load:shownWeight})
                if(nextSetIndex>=0){
                  setActiveSetByExercise(v=>({...v,[exerciseKey]:nextSetIndex}))
                  saveWorkoutFocus(planned?.user_id,planned?.id,item,nextSetIndex)
                  requestAnimationFrame(()=>document.getElementById('workout-exercise-'+i)?.scrollIntoView({behavior:'smooth',block:'nearest'}))
                }else{
                  setActiveSetByExercise(v=>({...v,[exerciseKey]:null}))
                  requestAnimationFrame(()=>goToNextExercise(i))
                }
                window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds:rest}}))
              }} disabled={cyclePending}>{activeSet.drop_set?'Complete Drop '+activeSet.drop_stage:'Complete Set '+(activeIndex+1)}</button>
              <button type="button" className="secondary-action next-exercise-button" onClick={()=>goToNextExercise(i)}>Next</button>
              </div>
            </section>}
            {unfinishedWorkoutSets(item).length>0&&<div className="exercise-finish-row">
              <button type="button" className="finish-exercise-early" onClick={()=>finishExerciseNow(i)}>
                {(item.setProgress||[]).some(set=>set.done)
                  ?'✓ Finish exercise ('+item.setProgress.filter(set=>set.done).length+' of '+item.setProgress.length+' sets)'
                  :'Skip exercise'}
              </button>
              <small>Unfinished sets are marked skipped, not completed. You can reopen them.</small>
            </div>}
            <div className="set-progress-grid compact flexible-set-progress">
              {item.setProgress.map((set,j)=>{
                const recordedWeight=set.weight!==undefined&&set.weight!=='' ? Number(set.weight)||0 : 0
                const suggestedWeight=cyclePending?0:Number(String(partnerSetTarget(workoutOneRms,set)).match(/^\d+/)?.[0]||0)
                const lacksTest=needsChallengeCycle&&set.weight_lift&&!cycleMaxes[set.weight_lift]
                const tileWeight=(cyclePending||lacksTest)&&!set.done&&!set.weight_edited?0:(set.done||set.weight_edited?recordedWeight:(suggestedWeight||recordedWeight))
                return <div className={'set-progress-wrap '+(set.extra?'extra-set ':'')+(item.setProgress.length>1?'removable-set':'')} key={j}>
                  <button
                    type="button"
                    className={'set-progress-button '+(set.done?'done ':'')+(set.skipped?'skipped ':'')+(i===focusedExerciseIndex&&j===activeIndex?'current-set ':'')}
                    onClick={()=>{
                      if(set.done||set.skipped||item.done){
                        changeExercise(i,reopenExerciseSet(item,j))
                      }
                      activateExercise(i,j,{scroll:false})
                    }}>
                    <strong>{set.drop_set?'Drop '+set.drop_stage:set.extra?'Extra set':'Set '+(j+1)}</strong>
                    <span>{set.skipped?'Skipped':set.done&&repsForSet(item,set) ? repsForSet(item,set)+' reps' : (set.drop_set?'AMRAP':set.label || (set.reps?set.reps+' reps':'Done'))}{!set.skipped&&tileWeight?' · '+tileWeight+' lb':''}</span>
                    <b>{set.done?'✓':set.skipped?'–':'○'}</b>
                  </button>
                  {item.setProgress.length>1&&<button type="button" className="remove-extra-set" onClick={()=>removeSet(i,j)}
                    aria-label={'Delete '+(set.drop_set?'drop stage '+set.drop_stage:'set '+(j+1))}>×</button>}
                </div>
              })}
            </div>
            <div className="exercise-set-add-actions">
              <button type="button" className="add-extra-set-button" onClick={()=>addExtraSet(i)}>+ Add set</button>
              {loadField&&!isDistanceExercise(item.name)&&<button type="button" className="add-extra-set-button drop-set-add" onClick={()=>addDropSetToExercise(i)}>+ Drop set</button>}
              {item.setProgress.some(set=>set.drop_set)&&<button type="button" className="add-extra-set-button drop-stage-add" onClick={()=>addDropStageToExercise(i)}>+ Drop stage</button>}
            </div>
          </>
        })()}
      </article>
    })}

    {!exerciseAdderOpen&&<button className="context-add-button add-exercise-button" type="button" onClick={()=>setExerciseAdderOpen(true)}>+ Exercise</button>}

    {(workout.conditioningEnabled || workout.metcon?.format || workout.metcon?.name || workout.metcon?.activity || workout.metcon?.duration || workout.metcon?.time || workout.metcon?.rounds || workout.metcon?.reps || workout.metcon?.distance || workout.metcon?.calories) ? <details className="today-collapsible conditioning-tools" open={conditioningOpen} onToggle={e=>setConditioningOpen(e.currentTarget.open)}>
      <summary><span><b>Conditioning</b><small>{workout.metcon?.format || 'Optional'}</small></span></summary>
      {workout.conditioning_plan&&<p className="helper-text"><strong>Program:</strong> {workout.conditioning_plan}</p>}
      <MetconTracker
        value={workout.metcon}
        onChange={value=>{change('conditioningEnabled',true);change('metcon',value)}}
        onRemove={()=>{setConditioningOpen(false);change('conditioningEnabled',false);change('metcon',{name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'})}}
      />
    </details> : <button className="context-add-button" type="button" onClick={()=>{setConditioningOpen(true);change('conditioningEnabled',true)}}>+ Conditioning</button>}

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

    {removeExercisePrompt&&<OverlayPortal onDismiss={()=>setRemoveExercisePrompt(null)}><div className="same-day-sheet-backdrop" onClick={()=>setRemoveExercisePrompt(null)}>
      <section className="same-day-sheet remove-exercise-confirm" onClick={e=>e.stopPropagation()}>
        <span className="card-label">REMOVE EXERCISE</span>
        <h3>Remove {removeExercisePrompt.name}?</h3>
        <p>This removes it from today's workout only. It won't change the program.</p>
        <div><button type="button" className="secondary-action" onClick={()=>setRemoveExercisePrompt(null)}>Keep it</button><button type="button" className="danger-action" onClick={()=>removeExercise(removeExercisePrompt.index)}>Remove</button></div>
      </section>
    </div></OverlayPortal>}

    {onDismiss&&<button className="secondary-action regular-workout-fallback" onClick={onDismiss}>Use regular Today workout</button>}
    <button type="button" className="secondary-action cancel-workout-button" onClick={()=>setCancelConfirm(true)}>Cancel workout</button>
    {cancelConfirm&&<OverlayPortal onDismiss={()=>{if(!cancelling)setCancelConfirm(false)}}><div className="same-day-sheet-backdrop workout-cancel-backdrop" onClick={()=>!cancelling&&setCancelConfirm(false)}>
      <section id="planned-cancel-confirm" className="same-day-sheet cancel-workout-confirm cancel-workout-modal" onClick={e=>e.stopPropagation()}>
        <span className="card-label">ACTIVE WORKOUT</span>
        <h3>Cancel this workout?</h3>
        <p>Your in-progress entries will not count as a completed workout. This will not advance your program.</p>
        <div><button type="button" className="secondary-action" onClick={()=>setCancelConfirm(false)} disabled={cancelling}>Keep workout</button><button type="button" className="danger-action" onClick={cancelWorkout} disabled={cancelling}>{cancelling?'Cancelling…':'Yes, cancel'}</button></div>
      </section>
    </div></OverlayPortal>}
    <div className="finish-wrap planned-finish-wrap">
      <button className="finish" onClick={finish} disabled={finishing||cancelling}>{finishing?'FINISHING…':'FINISH WORKOUT'}</button>
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

/** Always-visible version check. Never clears caches or unregisters workers. */
export function AppUpdateControls({onRefresh,refreshBlocked=false}){
  if(isNativeAndroid())return <AndroidAppUpdateControls refreshBlocked={refreshBlocked}/>;
  return <WebAppUpdateControls onRefresh={onRefresh} refreshBlocked={refreshBlocked}/>;
}

function WebAppUpdateControls({onRefresh,refreshBlocked=false}){
  const [updateState,setUpdateState]=useState('')
  const [availableBuild,setAvailableBuild]=useState(null)
  const [checking,setChecking]=useState(false)
  const checkForUpdate=async()=>{
    if(checking)return
    setChecking(true);setUpdateState('Checking…')
    try{
      const response=await fetch(import.meta.env.BASE_URL+'version.json?ts='+Date.now(),{cache:'no-store'})
      if(!response.ok)throw new Error('Version check failed')
      const info=await response.json()
      if(info?.buildId&&info.buildId!==__WORKSET_BUILD_ID__){
        setAvailableBuild(info.buildId)
        setUpdateState('New version available.')
      }else{
        setAvailableBuild(null)
        setUpdateState('Up to date.')
      }
    }catch{setUpdateState('Could not check. Check your connection.')}
    finally{setChecking(false)}
  }
  return <section className="me-update-card" aria-label="App updates">
    <div className="me-update-heading">
      <div><strong>WorkSet v{__WORKSET_APP_VERSION__}</strong><small>Version & updates</small></div>
      <span className="me-update-build">Build {String(__WORKSET_BUILD_ID__).slice(0,8)}</span>
    </div>
    <div className="me-update-actions">
      <button type="button" className="secondary-action" onClick={checkForUpdate} disabled={checking}>
        {checking?'Checking…':'Check for updates'}
      </button>
      <button type="button" className="secondary-action" onClick={onRefresh}
        disabled={refreshBlocked||!onRefresh}>
        {availableBuild?'Update now':'Refresh WorkSet'}
      </button>
    </div>
    {refreshBlocked&&<small role="status" className="me-update-note">Finish any active workout and sync saved changes before refreshing.</small>}
    {updateState&&<small role="status" className="me-update-note">{updateState}</small>}
  </section>
}


function AndroidAppUpdateControls({refreshBlocked=false}){
  const [checking,setChecking]=useState(false);
  const [installing,setInstalling]=useState(false);
  const [progress,setProgress]=useState(null);
  const [state,setState]=useState('');
  const [release,setRelease]=useState(null);
  const check=async()=>{
    if(checking||installing)return;
    setChecking(true);setState('Checking published Android releases…');setRelease(null);
    try{
      const result=await checkAndroidUpdate();
      if(result.state==='available'){
        setRelease(result.release);
        setState('A signed Android update is available.');
      }else if(result.state==='missing-digest'){
        setState('The Android release has no verifiable checksum. Update is unavailable.');
      }else if(result.state==='no-release'){
        setState('No signed Android release has been published yet.');
      }else setState('Your installed Android APK is current.');
    }catch(error){setState(error?.message||'Could not check Android releases.')}
    finally{setChecking(false)}
  };
  const install=async()=>{
    if(!release||installing||refreshBlocked)return;
    setInstalling(true);setProgress(null);
    setState('Downloading and verifying WorkSet.apk…');
    let listener=null;
    try{
      listener=await WorksetUpdater.addListener('downloadProgress',data=>{
        const value=Number(data?.percent);
        if(Number.isFinite(value))setProgress(Math.max(0,Math.min(99,value)));
      });
      const result=await WorksetUpdater.downloadAndInstall({
        url:release.url,sha256:release.sha256,versionCode:release.versionCode
      });
      if(result?.status==='permission-required'){
        setState('Allow WorkSet to install updates in Android settings, then tap Download & install again.');
      }else if(result?.status==='installer-opened'){
        setState('Android installer opened. Approve the WorkSet update to finish.');
      }else{
        setState('The installation process did not start. Please try again.');
      }
    }catch(error){setState(error?.message||'Android update could not be installed.')}
    finally{
      if(listener){try{await listener.remove()}catch{}}
      setInstalling(false);
    }
  };
  return <section className="me-update-card" aria-label="Android app updates">
    <div className="me-update-heading">
      <div><strong>WorkSet Android v{__WORKSET_APP_VERSION__}</strong>
        <small>Native APK updates · WorkSet.apk</small></div>
      <span className="me-update-build">APK build</span>
    </div>
    <div className="me-update-actions">
      <button type="button" className="secondary-action" onClick={check} disabled={checking||installing}>
        {checking?'Checking…':'Check APK updates'}
      </button>
      {release&&<button type="button" className="secondary-action" onClick={install}
        disabled={installing||refreshBlocked}>
        {installing?'Preparing installer…':'Download & install'}
      </button>}
    </div>
    {progress!==null&&installing&&<progress aria-label="APK download" max="100" value={progress}/>}
    {refreshBlocked&&<small className="me-update-note">Finish your workout and sync pending changes before installing an APK.</small>}
    {state&&<small role="status" className="me-update-note">{state}</small>}
    <small className="me-update-note">Android will ask you to approve the installation. APK updates do not happen silently.</small>
  </section>;
}

export function InstallAppButton(){
  const [prompt,setPrompt]=useState(null)
  const [installed,setInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches||false)
  useEffect(()=>{
    const before=e=>{e.preventDefault();setPrompt(e)}
    const done=()=>{setInstalled(true);setPrompt(null)}
    window.addEventListener('beforeinstallprompt',before)
    window.addEventListener('appinstalled',done)
    return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done)}
  },[])
  if(installed)return <p className="me-inline-status">WorkSet is installed on this device.</p>
  return <button type="button" className="wide-button" disabled={!prompt}
    onClick={async()=>{if(!prompt)return;await prompt.prompt();setPrompt(null)}}>
    {prompt?'Install WorkSet':'Install from your browser menu'}
  </button>
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
    download(`Workset-sessions-${stamp}.csv`,csv,'text/csv')
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
