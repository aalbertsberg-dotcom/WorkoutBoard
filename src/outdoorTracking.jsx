import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MIN_MOVING_SPEED_MPS,paceIsMeaningful,hasReliableOutdoorRoute,hasRecordingGaps,hasLiveGpsFix,gpsJitterFloorMeters,shouldSplitGpsTrack,gpsMovementAssessment } from './trackingRules'
import { createMotionStepCounter,effectiveSteps,readMotionMagnitude,initialMotionAccess,gpsMarkerCount } from './stepTracking'
import { canTrackInBackground,nativeGpsDeviceName,startNativeLocationWatch,stopNativeLocationWatch } from './nativeLocation'
import PocketMode from './PocketMode'

export const METERS_PER_MILE=1609.344
const MOTION_ACCESS_HINT_KEY='workset-browser-motion-granted-v1'
const rememberedMotionAccess=()=>{
  try{return window.localStorage.getItem(MOTION_ACCESS_HINT_KEY)==='granted'}catch{return false}
}
const saveMotionAccessHint=granted=>{
  try{
    if(granted)window.localStorage.setItem(MOTION_ACCESS_HINT_KEY,'granted')
    else window.localStorage.removeItem(MOTION_ACCESS_HINT_KEY)
  }catch{}
}

export function emptyOutdoorTrack(activity='walk'){
  return {
    version:1,
    activity,
    status:'ready',
    points:[],
    distance_m:0,
    elevation_gain_m:0,
    splits:[],
    started_at:null,
    updated_at:null,
  }
}

export function outdoorActivityKind(value=''){
  const v=String(value||'').trim().toLowerCase()
  if(v.includes('bike')||v.includes('cycling')||v.includes('ride'))return 'bike'
  if(v.includes('run'))return 'run'
  if(v.includes('walk'))return 'walk'
  return ''
}

export function formatOutdoorDuration(seconds){
  const total=Math.max(0,Math.round(Number(seconds)||0))
  const h=Math.floor(total/3600)
  const m=Math.floor((total%3600)/60)
  const s=total%60
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
}

export function formatPace(secondsPerMile){
  const value=Number(secondsPerMile||0)
  if(!Number.isFinite(value)||value<=0)return '—'
  const rounded=Math.max(0,Math.round(value))
  const minutes=Math.floor(rounded/60)
  const seconds=rounded%60
  return `${minutes}:${String(seconds).padStart(2,'0')}/mi`
}

export function outdoorMetrics(outdoor={},elapsedSeconds=0,activity='walk'){
  const points=Array.isArray(outdoor?.points)?outdoor.points:[]
  const distanceM=Math.max(0,Number(outdoor?.distance_m||points.at(-1)?.d||0))
  const miles=distanceM/METERS_PER_MILE
  const seconds=Math.max(0,Number(elapsedSeconds||outdoor?.elapsed_seconds||0))
  const validRoute=points.length>=2&&!hasRecordingGaps(outdoor)&&paceIsMeaningful(distanceM,seconds)
  const speeds=points.map(p=>Number(p.s||0)).filter(v=>Number.isFinite(v)&&v>=MIN_MOVING_SPEED_MPS)
  const lastPoint=points.at(-1)
  const lastSpeed=Number(lastPoint?.s)
  const lastPointAge=Date.now()-Number(lastPoint?.t||0)
  const currentSpeed=validRoute&&lastPointAge>=0&&lastPointAge<8000&&Number.isFinite(lastSpeed)&&lastSpeed>=MIN_MOVING_SPEED_MPS?lastSpeed:0
  const maxSpeed=validRoute&&speeds.length?Math.max(...speeds):0
  const avgSpeed=validRoute&&seconds>0?distanceM/seconds:0
  return {
    activity,
    points,
    distanceM,
    miles,
    elapsedSeconds:seconds,
    elevationGainM:Math.max(0,Number(outdoor?.elevation_gain_m||0)),
    currentSpeedMps:currentSpeed,
    maxSpeedMps:maxSpeed,
    avgSpeedMps:avgSpeed,
    currentMph:currentSpeed*2.236936,
    avgMph:avgSpeed*2.236936,
    maxMph:maxSpeed*2.236936,
    avgPaceSecPerMile:validRoute&&miles>0?seconds/miles:0,
    currentPaceSecPerMile:currentSpeed>0?METERS_PER_MILE/currentSpeed:0,
    splits:Array.isArray(outdoor?.splits)?outdoor.splits:[],
  }
}

function haversineMeters(a,b){
  const toRad=x=>x*Math.PI/180
  const R=6371000
  const dLat=toRad(Number(b.lat)-Number(a.lat))
  const dLon=toRad(Number(b.lng)-Number(a.lng))
  const lat1=toRad(Number(a.lat)),lat2=toRad(Number(b.lat))
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))
}

function pointFromPosition(position){
  const c=position.coords||{}
  const optionalNumber=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value)
  const measuredSpeed=optionalNumber(c.speed)
  return {
    lat:Number(c.latitude),
    lng:Number(c.longitude),
    alt:optionalNumber(c.altitude),
    aa:optionalNumber(c.altitudeAccuracy),
    a:optionalNumber(c.accuracy),
    s:measuredSpeed==null?null:Math.max(0,measuredSpeed),
    h:optionalNumber(c.heading),
    t:Number(position.timestamp||Date.now()),
  }
}

export function RouteMap({points=[],compact=false,provisional=false}){
  const elementRef=useRef(null)
  const mapRef=useRef(null)
  const routeRef=useRef(null)
  const markersRef=useRef([])

  useEffect(()=>{
    if(!elementRef.current)return
    if(!mapRef.current){
      const map=L.map(elementRef.current,{zoomControl:!compact,attributionControl:true,preferCanvas:true})
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,
        attribution:'© OpenStreetMap'
      }).addTo(map)
      mapRef.current=map
      requestAnimationFrame(()=>map.invalidateSize())
    }
    const map=mapRef.current
    const validPoints=(points||[]).filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)))
    const coords=validPoints.map(p=>[Number(p.lat),Number(p.lng)])
    if(routeRef.current){routeRef.current.remove();routeRef.current=null}
    for(const marker of markersRef.current)marker.remove()
    markersRef.current=[]
    if(!coords.length){
      map.setView([37.8,-96],3)
      return
    }
    if(coords.length===1){
      map.setView(coords[0],16)
    }else{
      const sections=[]
      for(const point of validPoints){
        if(!sections.length||point.break_before)sections.push([])
        sections[sections.length-1].push([Number(point.lat),Number(point.lng)])
      }
      routeRef.current=L.layerGroup(sections.filter(section=>section.length>1).map(section=>
        L.polyline(section,{weight:provisional?3:5,opacity:provisional?0.6:0.9,lineJoin:'round',...(provisional?{dashArray:'5, 8'}:{})})
      )).addTo(map)
      map.fitBounds(L.latLngBounds(coords),{padding:[22,22],maxZoom:17})
    }
    const markerCount=gpsMarkerCount(coords.length,provisional)
    if(markerCount===1){
      const current=L.circleMarker(coords.at(-1),{radius:6,weight:3,fillOpacity:1}).addTo(map).bindTooltip('Current location')
      markersRef.current.push(current)
    }else if(markerCount===2){
      const start=L.circleMarker(coords[0],{radius:6,weight:3,fillOpacity:1}).addTo(map).bindTooltip('Start')
      const finish=L.circleMarker(coords.at(-1),{radius:6,weight:3,fillOpacity:1}).addTo(map).bindTooltip('Current location')
      markersRef.current.push(start,finish)
    }
    requestAnimationFrame(()=>map.invalidateSize())
  },[points,compact,provisional])

  useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null},[])

  return <div className={compact?'outdoor-route-map compact':'outdoor-route-map'} ref={elementRef}/>
}

export function OutdoorTracker({activity='walk',outdoor,onChange,running=false,elapsedSeconds=0}){
  const current=outdoor&&typeof outdoor==='object'?outdoor:emptyOutdoorTrack(activity)
  const outdoorRef=useRef(current)
  const elapsedRef=useRef(elapsedSeconds)
  const watchRef=useRef(null)
  const lastGpsFixAtRef=useRef(null)
  const candidateMovementRef=useRef(null)
  const nativeWatchRef=useRef(null)
  const nativeStartingRef=useRef(false)
  const wakeLockRef=useRef(null)
  const wakeLockPendingRef=useRef(null)
  const [wakeStatus,setWakeStatus]=useState('checking')
  const [pocketLocked,setPocketLocked]=useState(false)
  const runningRef=useRef(running)
  const onChangeRef=useRef(onChange)
  const motionSupported=typeof window!=='undefined'&&typeof window.DeviceMotionEvent!=='undefined'
  const motionNeedsPermission=motionSupported&&typeof window.DeviceMotionEvent.requestPermission==='function'
  const [motionPermission,setMotionPermission]=useState(()=>initialMotionAccess({
    supported:motionSupported,requiresPermission:motionNeedsPermission,
    previouslyGranted:rememberedMotionAccess()
  }))
  const [motionFeedback,setMotionFeedback]=useState(motionSupported?'Motion sensor starts with the timer':'Motion sensor not available')
  const [message,setMessage]=useState('')
  const [permission,setPermission]=useState('prompt')
  outdoorRef.current=current
  elapsedRef.current=elapsedSeconds
  runningRef.current=running
  onChangeRef.current=onChange

  const metrics=useMemo(()=>outdoorMetrics(current,elapsedSeconds,activity),[current,elapsedSeconds,activity])

  useEffect(()=>{
    let cancelled=false
    if(navigator.permissions?.query){
      navigator.permissions.query({name:'geolocation'}).then(result=>{
        if(cancelled)return
        setPermission(result.state)
        result.onchange=()=>setPermission(result.state)
      }).catch(()=>{})
    }
    return()=>{cancelled=true}
  },[])

  const pushPosition=position=>{
    if(!runningRef.current)return
    const nextPoint=pointFromPosition(position)
    if(!Number.isFinite(nextPoint.lat)||!Number.isFinite(nextPoint.lng))return
    if(nextPoint.a!=null&&nextPoint.a>50){
      setMessage('Waiting for a better GPS signal…')
      return
    }
    const prev=outdoorRef.current||emptyOutdoorTrack(activity)
    const points=Array.isArray(prev.points)?prev.points:[]
    const last=points.at(-1)
    // GPS heartbeat: a stationary fix is not a lost signal.
    const precedingFixTime=lastGpsFixAtRef.current??last?.t??null
    const missingUpdates=precedingFixTime!=null&&
      shouldSplitGpsTrack({t:precedingFixTime},nextPoint)
    lastGpsFixAtRef.current=nextPoint.t
    let segment=0
    let speed=nextPoint.s
    if(last){
      if(prev.status==='paused'){
        segment=0
        nextPoint.break_before=true
        nextPoint.gap_reason='paused'
        candidateMovementRef.current=null
        speed=0
      }else if(missingUpdates){
        // Never interpolate a shortcut across a background/screen-lock gap.
        segment=0
        nextPoint.break_before=true
        nextPoint.gap_reason='no_updates'
        candidateMovementRef.current=null
        speed=0
      }else{
        segment=haversineMeters(last,nextPoint)
        const dt=Math.max(.1,(nextPoint.t-Number(last.t||nextPoint.t))/1000)
        const calculated=segment/dt
        const maxReasonable=activity==='bike'?45:activity==='run'?15:8
        if(calculated>maxReasonable&&segment>25){
          candidateMovementRef.current=null
          setMessage('GPS jump ignored.')
          return
        }
        const prior=candidateMovementRef.current
        const candidateDistance=prior?.anchorTime===last.t?prior.distance:null
        const decision=gpsMovementAssessment({
          distanceMeters:segment,currentAccuracy:nextPoint.a,
          previousAccuracy:last.a,reportedSpeed:nextPoint.s,
          priorCandidateDistance:candidateDistance,
        })
        if(!decision.accept){
          candidateMovementRef.current=decision.pending
            ?{anchorTime:last.t,distance:segment}:null
          setMessage(decision.reason==='stationary'
            ? 'Stationary · GPS movement not counted'
            : 'GPS acquired · waiting for consistent movement')
          return
        }
        candidateMovementRef.current=null
        if(!Number.isFinite(speed)||speed<=0)speed=calculated
      }
    }
    nextPoint.s=Number.isFinite(Number(speed))?Number(speed):null
    const distance=Math.max(0,Number(prev.distance_m||last?.d||0))+segment
    nextPoint.d=distance

    let elevation=Math.max(0,Number(prev.elevation_gain_m||0))
    if(last&&!nextPoint.break_before&&nextPoint.alt!=null&&last.alt!=null){
      const quality=(nextPoint.aa==null||nextPoint.aa<=30)&&(last.aa==null||last.aa<=30)
      const gain=nextPoint.alt-last.alt
      if(quality&&gain>=1.5&&gain<40)elevation+=gain
    }

    const splits=[...(prev.splits||[])]
    while(distance>=(splits.length+1)*METERS_PER_MILE){
      const totalElapsed=Math.max(1,Math.round(elapsedRef.current||0))
      const previousElapsed=Number(splits.at(-1)?.elapsed_total_seconds||0)
      splits.push({
        mile:splits.length+1,
        elapsed_total_seconds:totalElapsed,
        split_seconds:Math.max(1,totalElapsed-previousElapsed),
        at:new Date(nextPoint.t).toISOString(),
      })
    }

    let nextPoints=[...points,nextPoint]
    if(nextPoints.length>6000){
      nextPoints=[nextPoints[0],...nextPoints.slice(1).filter((_,index)=>index%2===0)]
    }
    const next={
      ...prev,
      version:1,
      activity,
      status:'tracking',
      points:nextPoints,
      distance_m:Math.round(distance*10)/10,
      elevation_gain_m:Math.round(elevation*10)/10,
      splits,
      started_at:prev.started_at||new Date().toISOString(),
      updated_at:new Date().toISOString(),
      last_accuracy_m:nextPoint.a,
    }
    outdoorRef.current=next
    onChangeRef.current?.(next)
    setMessage(nextPoint.gap_reason==='no_updates'
      ? 'GPS paused while screen was locked · gap marked'
      : 'GPS locked')
  }

  const stopWatch=()=>{
    if(watchRef.current!=null&&navigator.geolocation){
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current=null
    }
    candidateMovementRef.current=null
    lastGpsFixAtRef.current=null
    if(nativeWatchRef.current!=null){
      const id=nativeWatchRef.current
      nativeWatchRef.current=null
      stopNativeLocationWatch(id).catch(()=>{})
    }
  }

  const releaseWakeLock=async()=>{
    const held=wakeLockRef.current
    wakeLockRef.current=null
    try{await held?.release?.()}catch{}
    setWakeStatus('released')
  }
  const requestWakeLock=async()=>{
    if(canTrackInBackground()){
      setWakeStatus('native')
      return true
    }
    if(!navigator.wakeLock?.request){
      setWakeStatus('unsupported')
      return false
    }
    if(document.visibilityState!=='visible'){
      setWakeStatus('hidden')
      return false
    }
    if(wakeLockRef.current&&!wakeLockRef.current.released){
      setWakeStatus('active')
      return true
    }
    if(wakeLockPendingRef.current)return wakeLockPendingRef.current
    const pending=(async()=>{
      try{
        const sentinel=await navigator.wakeLock.request('screen')
        if(!runningRef.current){
          try{await sentinel.release()}catch{}
          return false
        }
        wakeLockRef.current=sentinel
        setWakeStatus('active')
        sentinel.addEventListener?.('release',()=>{
          if(wakeLockRef.current===sentinel){
            wakeLockRef.current=null
            setWakeStatus(document.visibilityState==='visible'?'released':'hidden')
          }
        })
        return true
      }catch{
        setWakeStatus('error')
        return false
      }
    })()
    wakeLockPendingRef.current=pending
    try{return await pending}finally{
      if(wakeLockPendingRef.current===pending)wakeLockPendingRef.current=null
    }
  }

  const startWatch=async()=>{
    if(canTrackInBackground()){
      setWakeStatus('native')
      if(nativeWatchRef.current!=null||nativeStartingRef.current)return
      nativeStartingRef.current=true
      setMessage('Starting '+nativeGpsDeviceName()+' background GPS…')
      try{
        const id=await startNativeLocationWatch(
          pushPosition,
          error=>setMessage(error?.message||'Native GPS permission or signal unavailable')
        )
        if(!runningRef.current)await stopNativeLocationWatch(id)
        else{
          nativeWatchRef.current=id
          setMessage(nativeGpsDeviceName()+' background GPS active · tracking with screen locked')
        }
      }catch(error){
        setMessage(error?.message||'Could not start Android background GPS')
        setPermission('denied')
      }finally{nativeStartingRef.current=false}
      return
    }
    if(!navigator.geolocation){
      setMessage('GPS is not available on this device.')
      return
    }
    if(watchRef.current!=null)return
    setMessage('Getting GPS signal…')
    await requestWakeLock()
    if(!runningRef.current){await releaseWakeLock();return}
    watchRef.current=navigator.geolocation.watchPosition(
      pushPosition,
      error=>{
        if(error?.code===1){setPermission('denied');setMessage('Location permission is off. Timer still works; enter distance manually.')}
        else if(error?.code===2)setMessage('GPS signal unavailable. Keep moving with a clear view of the sky.')
        else setMessage('Still getting your GPS position…')
      },
      {enableHighAccuracy:true,maximumAge:1000,timeout:15000}
    )
  }

  useEffect(()=>{
    if(running)startWatch()
    else{
      setPocketLocked(false)
      stopWatch()
      releaseWakeLock()
      if((outdoorRef.current?.points||[]).length){
        const next={...outdoorRef.current,status:'paused',updated_at:new Date().toISOString()}
        outdoorRef.current=next
        onChange?.(next)
      }
    }
    return()=>{stopWatch();releaseWakeLock()}
  },[running,activity])

  useEffect(()=>{
    const onVisible=()=>{
      if(document.visibilityState==='visible'&&running){
        requestWakeLock()
        if(watchRef.current==null&&nativeWatchRef.current==null&&!nativeStartingRef.current)startWatch()
      }else if(document.visibilityState!=='visible'&&running){
        setWakeStatus('hidden')
      }
    }
    document.addEventListener('visibilitychange',onVisible)
    return()=>document.removeEventListener('visibilitychange',onVisible)
  },[running,activity])

  // Motion sensors are an optional, approximate step counter in supporting browsers.
  // They work only while the page can receive motion events (not reliably screen-off).
  useEffect(()=>{
    if(!running||!motionSupported||motionPermission==='required'||motionPermission==='denied')return
    let heardMotion=false
    const detector=createMotionStepCounter()
    setMotionFeedback('Listening for phone motion…')
    const onMotion=event=>{
      if(!runningRef.current)return
      if(!readMotionMagnitude(event))return
      if(!heardMotion){heardMotion=true;setMotionFeedback('Phone motion detected · estimating steps')}
      const delta=detector.sample(event,Date.now())
      if(delta<=0)return
      const prev=outdoorRef.current||emptyOutdoorTrack(activity)
      const steps=prev.step_tracking||{}
      const next={...prev,step_tracking:{
        ...steps,sensor_steps:Math.max(0,Number(steps.sensor_steps||0))+delta,
        updated_at:new Date().toISOString()
      }}
      outdoorRef.current=next
      onChangeRef.current?.(next)
    }
    window.addEventListener('devicemotion',onMotion,{passive:true})
    const timeout=setTimeout(()=>{
      if(heardMotion)return
      if(motionPermission==='remembered'&&motionNeedsPermission&&document.visibilityState==='visible'){
        // Some browsers require a fresh gesture each time the page is loaded.
        saveMotionAccessHint(false)
        setMotionPermission('required')
        setMotionFeedback('Motion access needs permission again on this browser')
      }else{
        setMotionFeedback('No motion data received · enter steps manually')
      }
    },6000)
    return()=>{window.removeEventListener('devicemotion',onMotion);clearTimeout(timeout)}
  },[running,motionSupported,motionPermission,activity])

  const enableMotion=async()=>{
    if(!motionSupported){setMotionFeedback('Motion sensor not supported · enter steps manually');return}
    try{
      if(motionNeedsPermission){
        // Must be called directly from the button gesture.
        const granted=await window.DeviceMotionEvent.requestPermission()
        if(granted!=='granted'){
          saveMotionAccessHint(false)
          setMotionPermission('denied')
          setMotionFeedback('Motion permission denied · enter steps manually')
          return
        }
      }
      saveMotionAccessHint(true)
      setMotionPermission('granted')
      setMotionFeedback('Motion access enabled · start walking')
    }catch{
      saveMotionAccessHint(false)
      setMotionPermission('denied')
      setMotionFeedback('Motion unavailable · enter steps manually')
    }
  }

  const setManualSteps=value=>{
    if(!/^\d*$/.test(String(value)))return
    const prev=outdoorRef.current||emptyOutdoorTrack(activity)
    const next={...prev,step_tracking:{...(prev.step_tracking||{}),manual_steps:value}}
    outdoorRef.current=next
    onChangeRef.current?.(next)
  }

  const paceMode=activity!=='bike'
  const signal=current?.last_accuracy_m
  const liveFix=hasLiveGpsFix(current)
  const credibleRoute=hasReliableOutdoorRoute(current)
  const partialRoute=hasRecordingGaps(current)
  const feetTracked=Math.round(metrics.distanceM*3.28084)
  return <section className="outdoor-tracker">
    <div className="outdoor-live-grid">
      <div><span>Distance</span><strong>{metrics.miles?metrics.miles.toFixed(metrics.miles<10?2:1):'0.00'} mi</strong>{feetTracked>0&&metrics.miles<0.1&&<small className="outdoor-short-distance">{feetTracked} ft tracked</small>}</div>
      <div><span>{paceMode?'Avg pace':'Avg speed'}</span><strong>{paceMode?formatPace(metrics.avgPaceSecPerMile):(metrics.avgMph?metrics.avgMph.toFixed(1)+' mph':'—')}</strong></div>
      <div><span>{paceMode?'Current pace':'Current speed'}</span><strong>{!running?'—':paceMode?formatPace(metrics.currentPaceSecPerMile):(metrics.currentMph?metrics.currentMph.toFixed(1)+' mph':'—')}</strong></div>
      <div><span>Elevation</span><strong>{Math.round(metrics.elevationGainM*3.28084)} ft</strong></div>
    </div>

    <div className="outdoor-gps-status">
      <span className={(running&&permission!=='denied')?'live':''}>{running?'● GPS':'GPS paused'}</span>
      <b>{message||((current.points||[]).length?'Route saved':'GPS starts with the timer')}</b>
      {signal!=null&&<small>±{Math.round(signal)} m</small>}
    </div>
    {running&&<div className="outdoor-pocket-control">
      <button type="button" className="outdoor-pocket-button"
        onClick={()=>{
          setPocketLocked(true)
          requestWakeLock()
        }}>🔒 Pocket Mode <span>Prevent accidental touches</span></button>
    </div>}
    {running&&pocketLocked&&<PocketMode
      activity={activity}
      elapsed={formatOutdoorDuration(elapsedSeconds)}
      distance={(metrics.miles||0).toFixed(2)+' mi'}
      gps={permission==='denied'?'GPS permission required':partialRoute?'GPS has gaps':!liveFix?'Waiting for GPS':signal!=null&&signal>35?'GPS weak · ±'+Math.round(signal)+' m':'GPS recording'}
      wakeStatus={wakeStatus}
      onUnlock={()=>setPocketLocked(false)}
    />}

    {liveFix
      ? <><RouteMap points={current.points} provisional={!credibleRoute}/>
          {partialRoute&&<p className="outdoor-route-preview-note">GPS gap detected: unrecorded distance was not counted. Screen-off GPS requires the native WorkSet app.</p>}
           {!credibleRoute&&!partialRoute&&<p className="outdoor-route-preview-note">Live GPS preview · short distances are approximate. A longer, reliable route is needed to save the map.</p>}
        </>
      : <div className="outdoor-map-placeholder">
          <strong>Your live location will appear here</strong>
          <span>Allow location when you tap Start. Indoor GPS can be inaccurate.</span>
        </div>}

    {(activity==='walk'||activity==='run')&&<section className="outdoor-steps-card">
      <div className="outdoor-steps-header">
        <div><span className="card-label">STEPS</span><strong>{effectiveSteps(current).toLocaleString()} steps</strong></div>
        <small>{motionFeedback}</small>
      </div>
      {motionNeedsPermission&&motionPermission==='required'&&
        <button type="button" className="secondary-action" onClick={enableMotion}>Enable phone motion</button>}
      <label className="outdoor-step-manual">
        <span>Manual steps <small>optional override</small></span>
        <input type="text" inputMode="numeric" pattern="[0-9]*"
          placeholder="Enter steps if motion is unavailable"
          value={current.step_tracking?.manual_steps??''}
          onChange={e=>setManualSteps(e.target.value)}/>
      </label>
      <p>Steps are estimated from phone movement while WorkSet is open. GPS distance remains separate.</p>
    </section>}

    {metrics.splits.length>0&&<div className="outdoor-splits">
      <div className="quick-cardio-details-head"><span className="quick-cardio-section-label">Splits</span><small>Per mile</small></div>
      {metrics.splits.map(split=><div key={split.mile}><span>Mile {split.mile}</span><strong>{formatPace(split.split_seconds)}</strong></div>)}
    </div>}

    <p className="outdoor-web-note">{canTrackInBackground()
      ? nativeGpsDeviceName()==='iPhone'
        ? 'iPhone records location during an active workout when permission allows it. iOS shows a location-use indicator while background tracking.'
        : 'Android background location is enabled during an active workout. A persistent notification indicates recording.'
      : 'Chrome cannot reliably record GPS with the screen locked. Gaps are marked rather than connected; use the WorkSet mobile app for background tracking.'}</p>
  </section>
}
