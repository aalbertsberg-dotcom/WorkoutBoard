import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { MetconTracker } from './advancedFeatures'

function partnerSetTarget(maxes,set) {
  const lift=set?.weight_lift
  const pct=set?.pct
  const oneRm=Number(maxes?.[lift]||0)
  if(!lift||pct==null||!oneRm)return ''
  const base=set.weight_basis==='tm'?oneRm*.85:oneRm
  const low=Math.round((base*Number(pct)/100)/5)*5
  if(set.pct_high!=null){
    const high=Math.round((base*Number(set.pct_high)/100)/5)*5
    if(high&&high!==low)return low+'-'+high+' lb'
  }
  return low?low+' lb':''
}

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
  if(set?.weight!==undefined && set?.weight!=='') return Number(set.weight)||0
  return legacyLoad(item)
}

function repsForSet(item,set) {
  if(set?.actual_reps!==undefined && set?.actual_reps!==null && set?.actual_reps!=='') return Number(set.actual_reps)||0
  if(set?.reps!==undefined && set?.reps!==null && set?.reps!=='') return Number(set.reps)||0
  const m=String(item?.prescription||'').match(/\d+\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  return m?Number(m[1]):0
}

function isDistanceExercise(name) {
  return /carry|walk|run|row|bike|sled|sprint/i.test(String(name||''))
}

function bestLoadedSet(item) {
  const loaded=(item?.setProgress||[])
    .map(set=>({weight:setWeight(item,set),reps:repsForSet(item,set),done:Boolean(set.done)}))
    .filter(set=>set.weight&&set.reps)
  if(!loaded.length){
    const weight=legacyLoad(item)
    const reps=repsForSet(item,null)
    return weight&&reps?{weight,reps,done:Boolean(item?.done)}:null
  }
  return loaded.reduce((best,set)=>!best || set.weight>best.weight ? set : best,null)
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

export function PlannedWorkoutRunner({planned,onFinished,onCancelled,onDismiss,sharedSessionId=null,partnerOneRms={},oneRepMaxes={}}) {
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
  const [historyByExercise,setHistoryByExercise]=useState({})
  const [substitutions,setSubstitutions]=useState({})
  const [timerPresets,setTimerPresets]=useState({})
  const [conditioningOpen,setConditioningOpen]=useState(()=>Boolean(planned?.workout?.conditioning_prescribed))
  const [exerciseAdderOpen,setExerciseAdderOpen]=useState(false)
  const [newExercise,setNewExercise]=useState({name:'',sets:3,target:'10',rest:90})
  const [activeExerciseIndex,setActiveExerciseIndex]=useState(0)
  const [activeSetByExercise,setActiveSetByExercise]=useState({})
  const [removeExercisePrompt,setRemoveExercisePrompt]=useState(null)

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
    setWorkout(withSetProgress({exercises:[],sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',circuit_rounds:'',conditioningEnabled:false,metcon:{name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'},...(planned?.workout||{}),...(cached||{})}))
    setConditioningOpen(Boolean(planned?.workout?.conditioning_prescribed))
    setExerciseAdderOpen(false)
    setNewExercise({name:'',sets:3,target:'10',rest:90})
    setActiveExerciseIndex(0)
    setActiveSetByExercise({})
    setRemoveExercisePrompt(null)
  },[planned?.id,planned?.updated_at])

  useEffect(()=>{
    if(!planned?.id)return
    try {
      localStorage.setItem('wb-planned-draft-'+planned.id,JSON.stringify(workout))
      localStorage.setItem('wb-planned-draft-ts-'+planned.id,String(Date.now()))
    } catch {}
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
          const loadedSets=(item.setProgress||[]).map(set=>({weight:setWeight(item,set),reps:repsForSet(item,set),done:Boolean(set.done)})).filter(set=>set.weight&&set.done)
          const bestSet=loadedSets.reduce((best,set)=>!best||set.weight>best.weight?set:best,null)
          const parsed=bestSet&&!isDistanceExercise(item.name)&&bestSet.reps?{weight:bestSet.weight,reps:bestSet.reps,e1rm:bestSet.weight*(1+bestSet.reps/30)}:null
          if(!key||(!bestSet&&!item.result))continue
          const lastText=loadedSets.length ? loadedSets.map((set,idx)=>'S'+(idx+1)+' '+set.weight+' lb').join(' · ') : String(item.result||'')
          if(!map[key])map[key]={last:lastText,lastWeights:loadedSets.map(set=>set.weight),bestE:parsed?.e1rm||0,bestWeight:parsed?.weight||0}
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

  const exerciseIncomplete=item=>Boolean(
    item && !item.done && (
      item.setProgress?.length
        ? item.setProgress.some(set=>!set.done)
        : !String(item.result||'').trim()
    )
  )

  const activateExercise=(index,setIndex=null,{scroll=true}={})=>{
    const item=(workout.exercises||[])[index]
    if(!item)return
    setActiveExerciseIndex(index)
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
      const previous=sets.at(-1)||{}
      const reps=previous.reps ?? repsForSet(item,previous) ?? null
      const label=previous.label || (reps?reps+' reps':'Done')
      const previousWeight=previous.weight!==undefined&&previous.weight!=='' ? previous.weight : (item.load??'')
      return {
        ...item,
        done:false,
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

  const removeExtraSet=(exerciseIndex,setIndex)=>{
    setSaveState('Unsaved')
    setWorkout(v=>({...v,exercises:(v.exercises||[]).map((item,i)=>{
      if(i!==exerciseIndex)return item
      const target=item.setProgress?.[setIndex]
      if(!target?.extra)return item
      const next=(item.setProgress||[])
        .filter((_,idx)=>idx!==setIndex)
        .map((set,idx)=>({...set,set:idx+1}))
      return {...item,setProgress:next}
    })}))
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
        if(!set.done)continue
        const weight=setWeight(item,set),reps=repsForSet(item,set)
        if(!weight||!reps)continue
        best=Math.max(best,weight*(1+reps/30))
      }
    }
    return best
  },[workout.exercises])

  const cancelWorkout=async()=>{
    if(!planned?.id || cancelling)return
    setCancelling(true)
    const {error}=await supabase.from('planned_workouts').update({
      status:'skipped',
      updated_at:new Date().toISOString(),
    }).eq('id',planned.id)
    if(error){
      setSaveState('Cancel failed: '+error.message)
      setCancelling(false)
      return
    }
    try { localStorage.removeItem('wb-planned-draft-'+planned.id) } catch {}
    setCancelConfirm(false)
    setCancelling(false)
    onCancelled?.({planned,sharedSessionId})
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
    if (!planned?.id || finishing) return
    setFinishing(true)
    const now=new Date().toISOString()
    const finalWorkout={...workout,complete:true,savedAt:now,baseline_results:baselineResults}
    const existing=await supabase.from('training_sessions').select('id').eq('planned_workout_id',planned.id).maybeSingle()
    let error=null
    let trainingSessionId=existing.data?.id||null
    if (trainingSessionId) {
      const result=await supabase.from('training_sessions').update({
        title:planned.title,program:planned.source_program_name||'Custom workout',week:planned.source_week||null,
        primary_lift:planned.source_day||null,session_date:planned.scheduled_date,workout:finalWorkout,
        total_volume:Math.round(totalVolume),bodyweight:Number(workout.bodyweight||0)||null,
        shared_session_id:sharedSessionId||null,
        completed_at:now,updated_at:now
      }).eq('id',trainingSessionId).select('id').single()
      error=result.error
      trainingSessionId=result.data?.id||trainingSessionId
    } else {
      const result=await supabase.from('training_sessions').insert({
        user_id:planned.user_id,planned_workout_id:planned.id,title:planned.title,
        program:planned.source_program_name||'Custom workout',week:planned.source_week||null,
        primary_lift:planned.source_day||null,session_date:planned.scheduled_date,workout:finalWorkout,
        total_volume:Math.round(totalVolume),bodyweight:Number(workout.bodyweight||0)||null,
        shared_session_id:sharedSessionId||null,
        started_at:planned.created_at||now,completed_at:now,updated_at:now
      }).select('id').single()
      error=result.error
      trainingSessionId=result.data?.id||null
    }
    if (!error) {
      await supabase.from('planned_workouts').update({status:'completed',workout:finalWorkout,updated_at:now}).eq('id',planned.id)

      if(trainingSessionId){
        const {data:communityProfile}=await supabase.from('profiles')
          .select('display_name,community_opt_in,community_display_name,community_share_bodyweight')
          .eq('id',planned.user_id).maybeSingle()
        if(communityProfile?.community_opt_in){
          const completedSets=(finalWorkout.exercises||[]).reduce((sum,item)=>sum+(item.setProgress||[]).filter(set=>set.done).length,0)
          const completedExercises=(finalWorkout.exercises||[]).filter(item=>item.done||(item.setProgress||[]).some(set=>set.done)).length
          await supabase.from('community_activity').upsert({
            user_id:planned.user_id,
            training_session_id:trainingSessionId,
            display_name:communityProfile.community_display_name||communityProfile.display_name||'Member',
            activity_date:planned.scheduled_date,
            title:planned.title,
            summary:{
              program:planned.source_program_name||'Custom workout',
              lift:planned.source_day||null,
              volume:Math.round(totalVolume),
              estimated_1rm:bestEstimated1rm||null,
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
          estimated_1rm:bestEstimated1rm||null,
          completed_at:now,
          updated_at:now,
        },{onConflict:'session_id,user_id'})
      }
      try { localStorage.removeItem('wb-planned-draft-'+planned.id) } catch {}
      const completedSets=(finalWorkout.exercises||[]).reduce((sum,item)=>sum+(item.setProgress||[]).filter(set=>set.done).length,0)
      onFinished?.({
        title:planned.title,
        program:planned.source_program_name||'Custom workout',
        exercises:(finalWorkout.exercises||[]).filter(item=>item.done||(item.setProgress||[]).some(set=>set.done)).length,
        sets:completedSets,
        volume:Math.round(totalVolume),
        strengthBaseline:Boolean(finalWorkout.strength_baseline),
        baselinePath:finalWorkout.baseline_path||null,
        baselineResults:baselineResults,
        trainingSessionId,
      })
    } else {
      setSaveState('Finish failed: '+error.message)
    }
    setFinishing(false)
  }

  return <section className="flex-runner">
    <div className="flex-runner-head">
      <div><span className="card-label">PLANNED WORKOUT</span><h2>{planned.title}</h2><p>{planned.source_program_name||'Custom workout'}{planned.source_week?` · Week ${planned.source_week}`:''}</p></div>
      <div className="flex-runner-head-actions">
        <span className="save-pill">{saveState}</span>
        <button type="button" className="quick-add-exercise" onClick={()=>setExerciseAdderOpen(v=>!v)}>{exerciseAdderOpen?'Close':'+ Exercise'}</button>
      </div>
    </div>

    {exerciseAdderOpen&&<section className="simple-card add-exercise-card add-exercise-card-top">
      <div className="section-heading">
        <div><span className="card-label">ADD EXERCISE</span><h3>Add to this workout</h3></div>
        <button type="button" className="conditioning-remove" onClick={()=>setExerciseAdderOpen(false)}>Cancel</button>
      </div>
      <div className="quick-add-row">
        <label className="conditioning-field"><span>Movement</span><input autoFocus enterKeyHint="done" value={newExercise.name} onChange={e=>setNewExercise(v=>({...v,name:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&String(newExercise.name||'').trim()){e.preventDefault();addExercise()}}} placeholder="e.g. Lat Pulldown"/></label>
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
      const hist=historyByExercise[key]
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
      const targetSet=(item.setProgress||[]).find(set=>!set.done)||(item.setProgress||[])[0]
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
            {partnerTargets.length>0&&<small className="partner-targets"><strong>Targets:</strong> {partnerTargets.map(x=>x.name+' '+x.target).join(' · ')}</small>}
            {item.note&&<details className="exercise-cue"><summary>Cue</summary><small>{item.note}</small></details>}
            {hist?.last&&<small className="flex-history"><strong>Last time:</strong> {hist.last}</small>}
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
          const selectedSet=Number.isInteger(selectedSetIndex)&&item.setProgress[selectedSetIndex]&&!item.setProgress[selectedSetIndex].done ? selectedSetIndex : -1
          const activeIndex=selectedSet>=0 ? selectedSet : item.setProgress.findIndex(set=>!set.done)
          const activeSet=activeIndex>=0?item.setProgress[activeIndex]:null
          const activeWeight=activeSet?.weight!==undefined&&activeSet?.weight!=='' ? Number(activeSet.weight)||0 : 0
          const programmedTargetText=activeSet ? partnerSetTarget(oneRepMaxes,activeSet) : ''
          const programmedTarget=Number(String(programmedTargetText||'').match(/^\d+/)?.[0]||0)
          const previousWeight=activeIndex>0 ? Number(item.setProgress[activeIndex-1]?.weight||0) : 0
          const lastTimeWeight=activeIndex>=0 ? Number(hist?.lastWeights?.[Math.min(activeIndex,(hist?.lastWeights?.length||1)-1)]||0) : 0
          const legacyWeight=item.load!==undefined&&item.load!=='' ? Number(item.load)||0 : 0
          const shownWeight=activeWeight||programmedTarget||previousWeight||lastTimeWeight||legacyWeight||''
          return <>
            {activeSet&&i===focusedExerciseIndex&&<section className="current-set-panel">
              <div className="current-set-panel-head">
                <div><span className="card-label">{activeSet.extra?'EXTRA SET':'CURRENT SET'}</span><h3>{activeSet.extra?'Extra set':'Set '+(activeIndex+1)+' of '+item.setProgress.length}</h3></div>
                <strong>{activeSet.label || (activeSet.reps?activeSet.reps+' reps':'Complete')}{activeSet.target_weight_range?' · '+activeSet.target_weight_range:programmedTargetText?' · '+programmedTargetText:''}</strong>
              </div>
              <div className="current-set-entry-grid">
                {loadField&&<label className="current-set-weight">
                  <span>{loadField.label}{loadField.optional?' (optional)':''}</span>
                  <div>
                    <input type="number" inputMode="decimal" enterKeyHint="done" value={shownWeight}
                      onFocus={e=>e.currentTarget.select()}
                      onChange={e=>{
                        const value=e.target.value===''?'':Number(e.target.value)
                        changeExercise(i,{
                          load:value,
                          result:'',
                          setProgress:item.setProgress.map((sp,k)=>k===activeIndex?{...sp,weight:value}:sp)
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
                    <input type="number" inputMode="numeric" enterKeyHint="done" min="0" step="1"
                      value={activeSet.actual_reps??''}
                      onChange={e=>{
                        const value=e.target.value===''?'':Math.max(0,Math.floor(Number(e.target.value)||0))
                        changeExercise(i,{setProgress:item.setProgress.map((sp,k)=>k===activeIndex?{...sp,actual_reps:value}:sp)})
                      }}
                      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}
                      placeholder={activeSet.reps!==undefined&&activeSet.reps!==null&&activeSet.reps!==''?String(activeSet.reps):'Reps'}/>
                    <b>reps</b>
                  </div>
                </label>}
              </div>
              {activeSet&&!isDistanceExercise(item.name)&&<small className="rep-default-hint">Leave blank = programmed reps. Enter only if different.</small>}
              <div className="current-set-actions">
              <button type="button" className="primary-action complete-current-set" onClick={()=>{
                const currentWeight=loadField ? Number(shownWeight||0) : 0
                const nextSetIndex=item.setProgress.findIndex((sp,k)=>k!==activeIndex&&!sp.done)
                changeExercise(i,{load:shownWeight,setProgress:item.setProgress.map((sp,k)=>k===activeIndex?{...sp,done:true,weight:currentWeight||sp.weight}:sp)})
                if(nextSetIndex>=0){
                  setActiveSetByExercise(v=>({...v,[exerciseKey]:nextSetIndex}))
                  requestAnimationFrame(()=>document.getElementById('workout-exercise-'+i)?.scrollIntoView({behavior:'smooth',block:'nearest'}))
                }else{
                  setActiveSetByExercise(v=>({...v,[exerciseKey]:null}))
                  requestAnimationFrame(()=>goToNextExercise(i))
                }
                window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds:rest}}))
              }}>Complete Set {activeIndex+1}</button>
              <button type="button" className="secondary-action next-exercise-button" onClick={()=>goToNextExercise(i)}>Next</button>
              </div>
            </section>}
            <div className="set-progress-grid compact flexible-set-progress">
              {item.setProgress.map((set,j)=>{
                const recordedWeight=set.weight!==undefined&&set.weight!=='' ? Number(set.weight)||0 : 0
                return <div className={'set-progress-wrap '+(set.extra?'extra-set':'')} key={j}>
                  <button
                    type="button"
                    className={'set-progress-button '+(set.done?'done ':'')+(i===focusedExerciseIndex&&j===activeIndex?'current-set ':'')}
                    onClick={()=>{
                      if(set.done){
                        changeExercise(i,{setProgress:item.setProgress.map((sp,k)=>k===j?{...sp,done:false}:sp)})
                      }
                      activateExercise(i,j,{scroll:false})
                    }}>
                    <strong>{set.extra?'Extra set':'Set '+(j+1)}</strong>
                    <span>{set.done&&repsForSet(item,set) ? repsForSet(item,set)+' reps' : (set.label || (set.reps?set.reps+' reps':'Done'))}{recordedWeight?' · '+recordedWeight+' lb':''}</span>
                    <b>{set.done?'✓':'○'}</b>
                  </button>
                  {set.extra&&<button type="button" className="remove-extra-set" onClick={()=>removeExtraSet(i,j)} aria-label={'Remove extra set '+(j+1)}>×</button>}
                </div>
              })}
            </div>
            <button type="button" className="add-extra-set-button" onClick={()=>addExtraSet(i)}>+ Add set</button>
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

    {removeExercisePrompt&&<div className="same-day-sheet-backdrop" onClick={()=>setRemoveExercisePrompt(null)}>
      <section className="same-day-sheet remove-exercise-confirm" onClick={e=>e.stopPropagation()}>
        <span className="card-label">REMOVE EXERCISE</span>
        <h3>Remove {removeExercisePrompt.name}?</h3>
        <p>This removes it from today's workout only. It won't change the program.</p>
        <div><button type="button" className="secondary-action" onClick={()=>setRemoveExercisePrompt(null)}>Keep it</button><button type="button" className="danger-action" onClick={()=>removeExercise(removeExercisePrompt.index)}>Remove</button></div>
      </section>
    </div>}

    {onDismiss&&<button className="secondary-action regular-workout-fallback" onClick={onDismiss}>Use regular Today workout</button>}
    <button type="button" className="secondary-action cancel-workout-button" onClick={()=>setCancelConfirm(true)}>Cancel workout</button>
    {cancelConfirm&&<section className="cancel-workout-confirm">
      <strong>Cancel this workout?</strong>
      <p>Your in-progress entries will not count as a completed workout. This will not advance your program.</p>
      <div><button type="button" className="secondary-action" onClick={()=>setCancelConfirm(false)} disabled={cancelling}>Keep workout</button><button type="button" className="danger-action" onClick={cancelWorkout} disabled={cancelling}>{cancelling?'Cancelling…':'Yes, cancel'}</button></div>
    </section>}
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

export function InstallAppButton() {
  const [prompt,setPrompt]=useState(null)
  const [installed,setInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches||false)
  const [updateState,setUpdateState]=useState('')
  const [availableBuild,setAvailableBuild]=useState(null)

  useEffect(()=>{
    const before=e=>{e.preventDefault();setPrompt(e)}
    const installedHandler=()=>{setInstalled(true);setPrompt(null)}
    window.addEventListener('beforeinstallprompt',before)
    window.addEventListener('appinstalled',installedHandler)
    return ()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',installedHandler)}
  },[])

  const cleanReload=async buildId=>{
    setUpdateState('Refreshing…')
    try{
      if('caches' in window){
        const keys=await caches.keys()
        await Promise.all(keys.filter(key=>/^(workoutboard|workset)-/i.test(key)).map(key=>caches.delete(key)))
      }
      if('serviceWorker' in navigator){
        const regs=await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(reg=>reg.unregister()))
      }
    }catch{}
    const url=new URL(window.location.href)
    url.searchParams.set('_workset_refresh',String(buildId||Date.now()).slice(0,16))
    window.location.replace(url.toString())
  }

  const checkForUpdate=async()=>{
    setUpdateState('Checking…')
    try{
      const res=await fetch(import.meta.env.BASE_URL+'version.json?ts='+Date.now(),{cache:'no-store'})
      if(!res.ok)throw new Error('Version check failed')
      const info=await res.json()
      if(info?.buildId&&info.buildId!==__WORKSET_BUILD_ID__){
        setAvailableBuild(info.buildId)
        setUpdateState('Update available')
      }else{
        setAvailableBuild(null)
        setUpdateState('Up to date')
      }
    }catch{
      setUpdateState('Could not check')
    }
  }

  if (installed) return <div className="installed-app-controls">
    <div className="status-message">
      <strong>Workset is installed.</strong>
      <span>Build {String(__WORKSET_BUILD_ID__).slice(0,8)}{updateState?' · '+updateState:''}</span>
    </div>
    <div className="app-update-actions">
      <button type="button" className="wide-button" onClick={availableBuild?()=>cleanReload(availableBuild):checkForUpdate} disabled={updateState==='Checking…'||updateState==='Refreshing…'}>
        {availableBuild?'Update Workset':updateState==='Checking…'?'Checking…':'Check for update'}
      </button>
      <button type="button" className="secondary-action" onClick={()=>cleanReload(availableBuild||Date.now())} disabled={updateState==='Refreshing…'}>Refresh Workset</button>
    </div>
  </div>

  return <button className="wide-button" disabled={!prompt} onClick={async()=>{if(!prompt)return;await prompt.prompt();setPrompt(null)}}>{prompt?'Install Workset':'Install from your browser menu'}</button>
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
