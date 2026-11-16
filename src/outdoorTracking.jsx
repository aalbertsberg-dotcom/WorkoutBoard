import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MIN_MOVING_SPEED_MPS,paceIsMeaningful } from './trackingRules'

export const METERS_PER_MILE=1609.344

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
  const validRoute=points.length>=2&&paceIsMeaningful(distanceM,seconds)
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

export function RouteMap({points=[],compact=false}){
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
        L.polyline(section,{weight:5,opacity:.9,lineJoin:'round'})
      )).addTo(map)
      map.fitBounds(L.latLngBounds(coords),{padding:[22,22],maxZoom:17})
    }
    const start=L.circleMarker(coords[0],{radius:6,weight:3,fillOpacity:1}).addTo(map).bindTooltip('Start')
    markersRef.current.push(start)
    if(coords.length>1){
      const finish=L.circleMarker(coords.at(-1),{radius:6,weight:3,fillOpacity:1}).addTo(map).bindTooltip('Current')
      markersRef.current.push(finish)
    }
    requestAnimationFrame(()=>map.invalidateSize())
  },[points,compact])

  useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null},[])

  return <div className={compact?'outdoor-route-map compact':'outdoor-route-map'} ref={elementRef}/>
}

export function OutdoorTracker({activity='walk',outdoor,onChange,running=false,elapsedSeconds=0}){
  const current=outdoor&&typeof outdoor==='object'?outdoor:emptyOutdoorTrack(activity)
  const outdoorRef=useRef(current)
  const elapsedRef=useRef(elapsedSeconds)
  const watchRef=useRef(null)
  const wakeLockRef=useRef(null)
  const runningRef=useRef(running)
  const [message,setMessage]=useState('')
  const [permission,setPermission]=useState('prompt')
  outdoorRef.current=current
  elapsedRef.current=elapsedSeconds
  runningRef.current=running

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
    let segment=0
    let speed=nextPoint.s
    if(last){
      if(prev.status==='paused'){
        // Resume from this fix; don't count motion while the timer was paused.
        segment=0
        nextPoint.break_before=true
        speed=0
      }else{
        segment=haversineMeters(last,nextPoint)
        const dt=Math.max(.1,(nextPoint.t-Number(last.t||nextPoint.t))/1000)
        const calculated=segment/dt
        if(!Number.isFinite(speed)||speed<=0)speed=calculated
        const maxReasonable=activity==='bike'?45:activity==='run'?15:8
        if(calculated>maxReasonable&&segment>25){
          setMessage('GPS jump ignored.')
          return
        }
        const jitterFloor=Math.max(4,Math.min(16,Number(nextPoint.a||0)*.35+Number(last.a||0)*.25))
        if(segment<jitterFloor){
          setMessage('GPS locked')
          return
        }
      }
    }
    nextPoint.s=Number.isFinite(Number(speed))?Number(speed):null
    const distance=Math.max(0,Number(prev.distance_m||last?.d||0))+segment
    nextPoint.d=distance

    let elevation=Math.max(0,Number(prev.elevation_gain_m||0))
    if(last&&nextPoint.alt!=null&&last.alt!=null){
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
    onChange?.(next)
    setMessage('GPS locked')
  }

  const stopWatch=()=>{
    if(watchRef.current!=null&&navigator.geolocation){
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current=null
    }
  }

  const releaseWakeLock=async()=>{
    try{await wakeLockRef.current?.release?.()}catch{}
    wakeLockRef.current=null
  }

  const startWatch=async()=>{
    if(!navigator.geolocation){
      setMessage('GPS is not available on this device.')
      return
    }
    if(watchRef.current!=null)return
    setMessage('Getting GPS signal…')
    try{
      if(navigator.wakeLock?.request)wakeLockRef.current=await navigator.wakeLock.request('screen')
    }catch{}
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
        if(navigator.wakeLock?.request&&!wakeLockRef.current)navigator.wakeLock.request('screen').then(lock=>{wakeLockRef.current=lock}).catch(()=>{})
        if(watchRef.current==null)startWatch()
      }
    }
    document.addEventListener('visibilitychange',onVisible)
    return()=>document.removeEventListener('visibilitychange',onVisible)
  },[running,activity])

  const paceMode=activity!=='bike'
  const signal=current?.last_accuracy_m
  return <section className="outdoor-tracker">
    <div className="outdoor-live-grid">
      <div><span>Distance</span><strong>{metrics.miles?metrics.miles.toFixed(metrics.miles<10?2:1):'0.00'} mi</strong></div>
      <div><span>{paceMode?'Avg pace':'Avg speed'}</span><strong>{paceMode?formatPace(metrics.avgPaceSecPerMile):(metrics.avgMph?metrics.avgMph.toFixed(1)+' mph':'—')}</strong></div>
      <div><span>{paceMode?'Current pace':'Current speed'}</span><strong>{!running?'—':paceMode?formatPace(metrics.currentPaceSecPerMile):(metrics.currentMph?metrics.currentMph.toFixed(1)+' mph':'—')}</strong></div>
      <div><span>Elevation</span><strong>{Math.round(metrics.elevationGainM*3.28084)} ft</strong></div>
    </div>

    <div className="outdoor-gps-status">
      <span className={(running&&permission!=='denied')?'live':''}>{running?'● GPS':'GPS paused'}</span>
      <b>{message||((current.points||[]).length?'Route saved':'GPS starts with the timer')}</b>
      {signal!=null&&<small>±{Math.round(signal)} m</small>}
    </div>

    {(current.points||[]).length>0
      ? <RouteMap points={current.points}/>
      : <div className="outdoor-map-placeholder"><strong>Your route will appear here</strong><span>Allow location when you tap Start.</span></div>}

    {metrics.splits.length>0&&<div className="outdoor-splits">
      <div className="quick-cardio-details-head"><span className="quick-cardio-section-label">Splits</span><small>Per mile</small></div>
      {metrics.splits.map(split=><div key={split.mile}><span>Mile {split.mile}</span><strong>{formatPace(split.split_seconds)}</strong></div>)}
    </div>}

    <p className="outdoor-web-note">For reliable web GPS, keep Workset open. The screen is kept awake while tracking when your device allows it.</p>
  </section>
}
