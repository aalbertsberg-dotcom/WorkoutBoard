import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { allArchivePrograms, archiveProgramById, makePlannedFromArchive } from './archivePrograms'
import { ProgressToolbox, WorkoutTemplates } from './trainingTools'
import { AdvancedProgressCenter, PlannedWorkoutTools, ShareImportPanel, AdminDashboardSummary } from './advancedFeatures'

function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}

function isoDate(date) {
  return date.toISOString().slice(0,10)
}

function localDateKey(value=new Date()) {
  const d=value instanceof Date?value:new Date(value)
  if(Number.isNaN(d.getTime()))return ''
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

function weekDays() {
  const start = startOfWeek()
  return Array.from({length:7},(_,i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function quickWorkoutPayload(lift, scheme, notes='') {
  const rx = scheme === '3x10' ? '3 × 10'
    : scheme === '5x5' ? '5 × 5'
    : scheme === '531-fsl' ? '65% × 5, 75% × 5, 85% × 5+; then FSL 5 × 5'
    : 'Custom - use notes'
  return {
    version:2,
    type:'flexible',
    scheme,
    notes,
    sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',
    exercises:[{id:'main',name:lift,prescription:rx,note:notes,result:'',done:false}],
  }
}


function AnalyticsLineChart({series=[],unit='lb',emptyText='Not enough data to draw this trend yet.',showPointLabels=false}) {
  const cleaned=series.map(item=>({
    ...item,
    points:(item.points||[])
      .filter(point=>point?.date&&Number.isFinite(Number(point.value))&&Number(point.value)>0)
      .sort((a,b)=>new Date(a.date)-new Date(b.date))
  })).filter(item=>item.points.length)
  const points=cleaned.flatMap(item=>item.points)
  if(!points.length)return <div className="empty-state action-empty"><strong>No chart data yet.</strong><span>{emptyText}</span></div>

  const times=points.map(point=>new Date(point.date).getTime())
  const values=points.map(point=>Number(point.value))
  const minTime=Math.min(...times),maxTime=Math.max(...times)
  const minValue=Math.min(...values),maxValue=Math.max(...values)
  const width=720,height=230,left=34,right=18,top=18,bottom=26
  const x=time=>minTime===maxTime ? left+(width-left-right)/2 : left+((time-minTime)/(maxTime-minTime))*(width-left-right)
  const paddedMin=minValue===maxValue?minValue-Math.max(1,Math.abs(minValue)*.05):minValue
  const paddedMax=minValue===maxValue?maxValue+Math.max(1,Math.abs(maxValue)*.05):maxValue
  const y=value=>top+(1-(value-paddedMin)/Math.max(1,paddedMax-paddedMin))*(height-top-bottom)
  const dateLabel=value=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'})

  return <div className="analytics-line-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Training trend chart">
      {[0,.25,.5,.75,1].map(step=><line key={step} className="analytics-grid-line" x1={left} x2={width-right} y1={top+step*(height-top-bottom)} y2={top+step*(height-top-bottom)}/>)}
      {cleaned.map((item,index)=>{
        const path=item.points.map((point,i)=>{
          const px=x(new Date(point.date).getTime()),py=y(Number(point.value))
          return `${i?'L':'M'} ${px.toFixed(1)} ${py.toFixed(1)}`
        }).join(' ')
        const last=item.points.at(-1)
        return <g key={item.name} className={`analytics-series analytics-series-${index%4}`}>
          <path d={path}/>
          {item.points.map((point,i)=>{
            const px=x(new Date(point.date).getTime()),py=y(Number(point.value))
            const label=Number(point.value).toLocaleString(undefined,{maximumFractionDigits:2})
            return <g key={i}><circle cx={px} cy={py} r={i===item.points.length-1?4:3}/>{showPointLabels&&item.points.length<=12&&<text className="analytics-point-label" x={px} y={Math.max(12,py-8)} textAnchor="middle">{label}</text>}</g>
          })}
        </g>
      })}
    </svg>
    <div className="analytics-chart-range"><span>{dateLabel(minTime)}</span><span>{dateLabel(maxTime)}</span></div>
    <div className="analytics-chart-legend">{cleaned.map((item,index)=>{
      const last=item.points.at(-1)
      return <div key={item.name} className={`analytics-legend-item analytics-series-${index%4}`}><i/><span>{item.name}</span><strong>{Math.round(Number(last?.value||0)).toLocaleString()} {unit}</strong></div>
    })}</div>
  </div>
}

export function PlatformProgress({
  session,
  profile,
  setProfile,
  progress,
  lifts,
  formatWeight,
  programs,
  dbNameToProgram,
  view=null,
  compact=false,
  onOpenProgress=null,
  onOpenWeight=null,
  trackedProgramInfo=null,
  initialSection='Overview',
}) {
  const [mode,setMode] = useState('mine')
  const effectiveMode=view || mode
  const [community,setCommunity] = useState([])
  const [flexSessions,setFlexSessions] = useState([])
  const [measurements,setMeasurements] = useState([])
  const [ready,setReady] = useState(null)
  const [message,setMessage] = useState('')
  const [progressSection,setProgressSection] = useState(initialSection)
  const [quickWeight,setQuickWeight] = useState('')
  const [quickWeightStatus,setQuickWeightStatus] = useState('')
  const [bodyTrendRange,setBodyTrendRange] = useState('3M')
  const [bodyTrendMetric,setBodyTrendMetric] = useState('waist')

  const loadData = async () => {
    if (!session?.user) return
    const [{data:communityRows,error:communityError},{data:sessionRows},{data:measurementRows}] = await Promise.all([
      supabase.from('community_activity').select('*').order('created_at',{ascending:false}).limit(50),
      supabase.from('training_sessions').select('*').eq('user_id',session.user.id).is('legacy_log_id',null).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(250),
      supabase.from('body_measurements').select('*').eq('user_id',session.user.id).order('measured_on',{ascending:true}).limit(500),
    ])
    if (communityError) { setReady(false); return }
    setReady(true)
    setCommunity(communityRows || [])
    setFlexSessions(sessionRows || [])
    setMeasurements(measurementRows || [])
  }

  useEffect(() => { loadData() },[session?.user?.id])

  const toggleCommunity = async enabled => {
    if (!session?.user) return
    setMessage('Saving…')
    const {error}=await supabase.from('profiles').update({community_opt_in:enabled,updated_at:new Date().toISOString()}).eq('id',session.user.id)
    if(error){setReady(false);setMessage('Platform migration still needs to be run.');return}
    if(!enabled) await supabase.from('community_activity').delete().eq('user_id',session.user.id)
    setProfile(v=>({...v,community_opt_in:enabled}))
    setMessage(enabled?'Community sharing is on for future completed workouts.':'Community sharing is off and your community posts were removed.')
    await loadData()
  }

  const toggleBodyweight = async enabled => {
    if(!session?.user)return
    const {error}=await supabase.from('profiles').update({community_share_bodyweight:enabled,updated_at:new Date().toISOString()}).eq('id',session.user.id)
    if(!error)setProfile(v=>({...v,community_share_bodyweight:enabled}))
  }

  const now=Date.now()
  const dayMs=86400000
  const flexWithin=(row,minDays,maxDays=0)=>{
    const age=(now-new Date(row.completed_at||row.session_date).getTime())/dayMs
    return age<=minDays && age>maxDays
  }
  const legacyPrevious30=progress.completed.filter(r=>{
    const age=(now-new Date(r.completed_at).getTime())/dayMs
    return age>30&&age<=60
  }).reduce((sum,r)=>sum+Number(r._metrics?.volume||0),0)
  const flex30=flexSessions.filter(r=>flexWithin(r,30)).reduce((sum,r)=>sum+Number(r.total_volume||0),0)
  const flexPrev30=flexSessions.filter(r=>flexWithin(r,60,30)).reduce((sum,r)=>sum+Number(r.total_volume||0),0)
  const volume30=progress.volume30+flex30
  const previous30=legacyPrevious30+flexPrev30
  const volumeDeltaPct=previous30?Math.round((volume30-previous30)/previous30*100):null

  const monthKey=localDateKey().slice(0,7)
  const thisMonth=progress.completed.filter(r=>String(r.completed_at).slice(0,7)===monthKey).length+
    flexSessions.filter(r=>String(r.completed_at||r.session_date).slice(0,7)===monthKey).length

  const weekKey=value=>{
    const d=new Date(value); const dow=d.getDay(); d.setDate(d.getDate()+(dow===0?-6:1-dow)); d.setHours(0,0,0,0); return localDateKey(d)
  }
  const activeWeeks=new Set([
    ...progress.completed.map(r=>weekKey(r.completed_at)),
    ...flexSessions.map(r=>weekKey(r.completed_at||r.session_date))
  ])
  let activeWeekStreak=0
  const cursor=startOfWeek()
  while(activeWeeks.has(isoDate(cursor))){
    activeWeekStreak++
    cursor.setDate(cursor.getDate()-7)
  }

  const volumeByLift=Object.fromEntries(lifts.map(x=>[x,0]))
  progress.completed.forEach(r=>{if(volumeByLift[r.lift]!=null)volumeByLift[r.lift]+=Number(r._metrics?.volume||0)})
  flexSessions.forEach(r=>{if(volumeByLift[r.primary_lift]!=null)volumeByLift[r.primary_lift]+=Number(r.total_volume||0)})
  const maxLiftVolume=Math.max(1,...Object.values(volumeByLift))

  const flexBody=flexSessions.find(r=>Number(r.bodyweight||0))?.bodyweight
  const measurementBody=[...measurements].reverse().find(r=>Number(r.bodyweight||0))?.bodyweight
  const latestBodyweight=measurementBody||flexBody||progress.latestBodyweight
  const totalWorkouts=progress.completed.length+flexSessions.length
  const weeklyAnalytics=useMemo(()=>{
    const rows=[
      ...progress.completed.map(r=>({date:r.completed_at,volume:Number(r._metrics?.volume||0)})),
      ...flexSessions.map(r=>({date:r.completed_at||r.session_date,volume:Number(r.total_volume||0)}))
    ]
    return Array.from({length:8},(_,i)=>{
      const end=now-(7-i)*7*dayMs
      const start=end-7*dayMs
      const matches=rows.filter(row=>{const t=new Date(row.date).getTime();return t>start&&t<=end})
      return {
        label:i===7?'This week':(7-i)+'w ago',
        volume:matches.reduce((sum,row)=>sum+row.volume,0),
        workouts:matches.length,
      }
    })
  },[progress.completed,flexSessions])
  const maxWeeklyVolume=Math.max(1,...weeklyAnalytics.map(item=>item.volume))
  const maxWeeklyWorkouts=Math.max(1,...weeklyAnalytics.map(item=>item.workouts))

  const strengthTrendSeries=useMemo(()=>lifts.map(name=>({
    name,
    points:[
      ...progress.completed.filter(r=>r.lift===name&&Number(r._metrics?.estimated1rm||0)>0).map(r=>({date:r.completed_at,value:Number(r._metrics.estimated1rm)})),
      ...flexSessions.filter(r=>r.primary_lift===name&&Number(r.estimated_1rm||0)>0).map(r=>({date:r.completed_at||r.session_date,value:Number(r.estimated_1rm)})),
    ]
  })).filter(series=>series.points.length),[progress.completed,flexSessions,lifts])

  const bodyweightTrendSeries=useMemo(()=>[{
    name:'Bodyweight',
    points:[
      ...measurements.filter(r=>Number(r.bodyweight||0)>0).map(r=>({date:r.measured_on,value:Number(r.bodyweight)})),
      ...progress.completed.filter(r=>Number(r.workout?.bodyweight||0)>0).map(r=>({date:r.completed_at,value:Number(r.workout.bodyweight)})),
      ...flexSessions.filter(r=>Number(r.bodyweight||0)>0).map(r=>({date:r.completed_at||r.session_date,value:Number(r.bodyweight)})),
    ]
  }],[measurements,progress.completed,flexSessions])

  const measurementTotalInches=row=>{
    const fields=['left_forearm','right_forearm','neck','left_arm','right_arm','waist','hips','left_thigh','right_thigh','left_calf','right_calf','chest']
    return fields.reduce((sum,key)=>{
      let value=Number(row?.[key]||0)
      if(!value&&key==='left_arm')value=Number(row?.arm||0)
      if(!value&&key==='right_arm')value=Number(row?.arm||0)
      if(!value&&key==='left_thigh')value=Number(row?.thigh||0)
      if(!value&&key==='right_thigh')value=Number(row?.thigh||0)
      return sum+(Number.isFinite(value)?value:0)
    },0)
  }

  const measurementTrendSeries=useMemo(()=>[
    {name:'Waist',points:measurements.filter(r=>Number(r.waist||0)>0).map(r=>({date:r.measured_on,value:Number(r.waist)}))},
    {name:'Chest',points:measurements.filter(r=>Number(r.chest||0)>0).map(r=>({date:r.measured_on,value:Number(r.chest)}))},
    {name:'Hips',points:measurements.filter(r=>Number(r.hips||0)>0).map(r=>({date:r.measured_on,value:Number(r.hips)}))},
    {name:'Total inches',points:measurements.map(r=>({date:r.measured_on,value:measurementTotalInches(r)})).filter(p=>p.value>0)},
  ].filter(series=>series.points.length),[measurements])

  const bodyTrendMetrics=[
    {key:'waist',label:'Waist',unit:'in'},
    {key:'hips',label:'Hips',unit:'in'},
    {key:'chest',label:'Chest',unit:'in'},
    {key:'neck',label:'Neck',unit:'in'},
    {key:'left_arm',label:'L arm',unit:'in'},
    {key:'right_arm',label:'R arm',unit:'in'},
    {key:'left_thigh',label:'L thigh',unit:'in'},
    {key:'right_thigh',label:'R thigh',unit:'in'},
    {key:'left_calf',label:'L calf',unit:'in'},
    {key:'right_calf',label:'R calf',unit:'in'},
    {key:'left_forearm',label:'L forearm',unit:'in'},
    {key:'right_forearm',label:'R forearm',unit:'in'},
    {key:'total_inches',label:'Total inches',unit:'in'},
    {key:'body_fat',label:'Body fat',unit:'%'},
  ]

  const rangeStart=range=>{
    const now=new Date()
    if(range==='30D'){const d=new Date(now);d.setDate(d.getDate()-30);return d}
    if(range==='3M'){const d=new Date(now);d.setMonth(d.getMonth()-3);return d}
    if(range==='1Y'){const d=new Date(now);d.setFullYear(d.getFullYear()-1);return d}
    return null
  }
  const filterTrendSeries=(series,range)=>{
    const start=rangeStart(range)
    if(!start)return series
    return series.map(item=>({...item,points:(item.points||[]).filter(point=>new Date(point.date)>=start)}))
  }
  const selectedBodyMetric=bodyTrendMetrics.find(item=>item.key===bodyTrendMetric)||bodyTrendMetrics[0]
  const selectedMeasurementSeries=useMemo(()=>{
    const points=measurements.map(row=>{
      const value=bodyTrendMetric==='total_inches'?measurementTotalInches(row):Number(row[bodyTrendMetric]||0)
      return {date:row.measured_on,value}
    }).filter(point=>Number(point.value)>0)
    return [{name:selectedBodyMetric.label,points}]
  },[measurements,bodyTrendMetric])
  const rangedWeightSeries=filterTrendSeries(bodyweightTrendSeries,bodyTrendRange)
  const rangedMeasurementSeries=filterTrendSeries(selectedMeasurementSeries,bodyTrendRange)

  const recentCombined=[
    ...progress.completed.map(r=>({
      id:'legacy-'+r.id,date:r.completed_at,title:r.lift+' Day',
      subtitle:(programs[dbNameToProgram[r.program]]?.shortName||r.program)+(r.week?' · Week '+r.week:''),
      volume:r._metrics?.volume||0,e1rm:r._metrics?.estimated1rm||0
    })),
    ...flexSessions.map(r=>({
      id:'flex-'+r.id,date:r.completed_at||r.session_date,title:r.title,
      subtitle:r.program||'Custom workout',volume:Number(r.total_volume||0),e1rm:Number(r.estimated_1rm||0)
    }))
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,15)

  const recentPrs=useMemo(()=>{
    const events=[]
    const best={}
    const rows=[
      ...progress.completed.map(r=>({date:r.completed_at,key:r.lift,label:r.lift,e1rm:Number(r._metrics?.estimated1rm||0),set:r._metrics?.bestSet})),
      ...flexSessions.flatMap(r=>(r.workout?.exercises||[]).map(item=>{
        const m=String(item.result||'').replace(/[×X]/g,'x').match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i)
        const weight=m?Number(m[1]):0,reps=m?Number(m[2]):0
        return {date:r.completed_at||r.session_date,key:item.name||r.title,label:item.name||r.title,e1rm:weight&&reps?weight*(1+reps/30):0,set:weight&&reps?{weight,reps}:null}
      }))
    ].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    for(const row of rows){
      if(!row.e1rm)continue
      if(row.e1rm>(best[row.key]||0)){
        best[row.key]=row.e1rm
        events.push(row)
      }
    }
    return events.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,3)
  },[progress.completed,flexSessions])

  const saveQuickWeight=async e=>{
    e.preventDefault()
    const value=Number(quickWeight)
    if(!session?.user||!Number.isFinite(value)||value<=0){
      setQuickWeightStatus('Enter a valid bodyweight.')
      return
    }
    setQuickWeightStatus('Saving…')
    const date=localDateKey()
    const {data:existing}=await supabase.from('body_measurements').select('*').eq('user_id',session.user.id).eq('measured_on',date).maybeSingle()
    const {error}=await supabase.from('body_measurements').upsert({
      ...(existing||{}),
      user_id:session.user.id,
      measured_on:date,
      bodyweight:value,
    },{onConflict:'user_id,measured_on'})
    if(error){
      setQuickWeightStatus(error.message)
      return
    }
    setQuickWeight('')
    setQuickWeightStatus('Saved.')
    await loadData()
  }

  if(compact){
    const latestPr=recentPrs[0]
    return <section className="progress-summary-card">
      <div className="progress-summary-head">
        <div><span className="card-label">PROGRESS & ANALYTICS</span><h3>Your training at a glance</h3></div>
        <button type="button" className="progress-open-button" onClick={onOpenProgress}>Open Progress →</button>
      </div>
      <section className="summary-grid progress-home-kpis progress-summary-kpis">
        <div><span>Workouts this month</span><strong>{thisMonth}</strong></div>
        <div><span>30-day volume</span><strong>{formatWeight(volume30)} lb</strong></div>
        <div><span>Training streak</span><strong>{activeWeekStreak} wk</strong></div>
        <div className="progress-weight-kpi"><span>Current weight</span><strong>{latestBodyweight?latestBodyweight+' lb':'—'}</strong><button type="button" onClick={onOpenWeight}>Log weight</button></div>
      </section>
      <div className="progress-summary-pr">
        <span>Latest PR</span>
        {latestPr?<><strong>{latestPr.label}</strong><b>{latestPr.set?latestPr.set.weight+' × '+latestPr.set.reps:'e1RM '+formatWeight(latestPr.e1rm)}</b></>:<small>No PRs yet — complete weighted sets and they’ll appear here.</small>}
      </div>
      <button type="button" className="wide-button progress-open-wide" onClick={onOpenProgress}>Open full Progress & Analytics</button>
    </section>
  }

  return <section className={'page-section '+(view==='community'?'community-page-panel':'')}>
    {!view&&<div className="segmented">
      <button className={mode==='mine'?'active':''} onClick={()=>setMode('mine')}>Analytics</button>
      <button className={mode==='community'?'active':''} onClick={()=>setMode('community')}>Community</button>
    </div>}

    {effectiveMode==='mine'?<>
      <div className="progress-section-tabs">
        {['Overview','Strength','Weight & Measurements','History'].map(section=><button key={section} className={progressSection===section?'active':''} onClick={()=>{setProgressSection(section);window.scrollTo({top:0,behavior:'auto'})}}>{section}</button>)}
      </div>

      {progressSection==='Overview'&&<>
        <section className="summary-grid progress-home-kpis">
          <div><span>Workouts this month</span><strong>{thisMonth}</strong></div>
          <div><span>30-day volume</span><strong>{formatWeight(volume30)} lb</strong></div>
          <div><span>Training streak</span><strong>{activeWeekStreak} wk</strong></div>
          <div><span>Current weight</span><strong>{latestBodyweight?latestBodyweight+' lb':'—'}</strong></div>
        </section>

        {trackedProgramInfo&&<section className="simple-card progress-current-program">
          <div className="section-heading"><div><span className="card-label">CURRENT PROGRAM</span><h3>{trackedProgramInfo.name}</h3></div><b>{trackedProgramInfo.completed}/{trackedProgramInfo.total}</b></div>
          <div className="program-progress-track"><div style={{width:(trackedProgramInfo.total?Math.min(100,trackedProgramInfo.completed/trackedProgramInfo.total*100):0)+'%'}}/></div>
          <p className="helper-text">{trackedProgramInfo.complete?'Program complete':trackedProgramInfo.nextTitle?'Next: '+trackedProgramInfo.nextTitle:'Tracking in progress'}</p>
        </section>}

        <section className="simple-card recent-pr-home">
          <div className="section-heading"><div><span className="card-label">LATEST PRS</span><h3>Recent personal bests</h3></div></div>
          {recentPrs.length?<div className="recent-pr-list">{recentPrs.map((pr,i)=><div key={pr.key+'-'+i}><div><strong>{pr.label}</strong><span>{new Date(pr.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></div><b>{pr.set?pr.set.weight+' × '+pr.set.reps:'e1RM '+formatWeight(pr.e1rm)}</b></div>)}</div>:<div className="empty-state action-empty"><strong>No PRs yet.</strong><span>Complete weighted sets and your bests will appear here automatically.</span></div>}
        </section>

        <section className="analytics-dashboard-grid">
          <section className="simple-card analytics-chart-card">
            <div className="section-heading"><div><span className="card-label">TRAINING VOLUME</span><h3>Last 8 weeks</h3></div></div>
            <div className="volume-chart">{weeklyAnalytics.map(item=><div className="volume-bar-row" key={item.label}><span>{item.label}</span><div className="bar-track"><div className="bar-fill" style={{width:(item.volume/maxWeeklyVolume*100)+'%'}}/></div><strong>{formatWeight(item.volume)}</strong></div>)}</div>
          </section>
          <section className="simple-card analytics-chart-card">
            <div className="section-heading"><div><span className="card-label">WORKOUT FREQUENCY</span><h3>Sessions per week</h3></div></div>
            <div className="volume-chart frequency-chart">{weeklyAnalytics.map(item=><div className="volume-bar-row" key={item.label}><span>{item.label}</span><div className="bar-track"><div className="bar-fill" style={{width:(item.workouts/maxWeeklyWorkouts*100)+'%'}}/></div><strong>{item.workouts}</strong></div>)}</div>
          </section>
        </section>
      </>}

      {progressSection==='Strength'&&<>
        <section className="simple-card analytics-chart-card">
          <div className="section-heading"><div><span className="card-label">STRENGTH TREND</span><h3>Estimated 1RM over time</h3></div></div>
          <AnalyticsLineChart series={strengthTrendSeries} unit="lb" emptyText="Complete weighted Squat, Bench, Deadlift or Press workouts and the strength lines will build automatically."/>
        </section>

        <section className="simple-card">
          <div className="section-heading"><div><span className="card-label">STRENGTH PROGRESS</span><h3>Estimated 1RM</h3></div></div>
          <div className="strength-list">{lifts.map(name=>{
            const stat=progress.strength[name]
            const flexBest=Math.max(0,...flexSessions.filter(r=>r.primary_lift===name).map(r=>Number(r.estimated_1rm||0)))
            const shown=Math.max(stat?.latest||0,flexBest)
            return <div className="strength-row" key={name}><div><strong>{name}</strong><span>{stat?.bestSet?'Best set '+stat.bestSet.weight+' × '+stat.bestSet.reps:flexBest?'Workout estimate':'No completed data yet'}</span></div><div className="strength-number"><strong>{shown?formatWeight(shown)+' lb':'—'}</strong>{stat&&<span className={stat.delta>=0?'positive':'negative'}>{stat.delta>=0?'+':''}{formatWeight(stat.delta)} since first log</span>}</div></div>
          })}</div>
        </section>

        <section className="simple-card">
          <div className="section-heading"><div><span className="card-label">VOLUME BY LIFT</span><h3>Where your work is going</h3></div></div>
          <div className="volume-chart">{lifts.map(name=><div className="volume-bar-row" key={name}><span>{name}</span><div className="bar-track"><div className="bar-fill" style={{width:(volumeByLift[name]/maxLiftVolume*100)+'%'}}/></div><strong>{formatWeight(volumeByLift[name])}</strong></div>)}</div>
        </section>

        <ProgressToolbox session={session} legacyHistory={progress.completed} flexSessions={flexSessions} formatWeight={formatWeight} onlyTab="PRs"/>
      </>}

      {progressSection==='Weight & Measurements'&&<>
        <section className="simple-card quick-weight-card">
          <div className="section-heading"><div><span className="card-label">WEIGHT</span><h3>Log today's weight</h3></div><strong>{latestBodyweight?latestBodyweight+' lb':'No weight yet'}</strong></div>
          <form className="quick-weight-form" onSubmit={saveQuickWeight}>
            <div className="input-with-unit"><input type="number" step="0.1" inputMode="decimal" value={quickWeight} onChange={e=>setQuickWeight(e.target.value)} placeholder={latestBodyweight||'Weight'}/><b>lb</b></div>
            <button className="primary-action" disabled={!quickWeight}>Save weight</button>
          </form>
          <p className="helper-text">Saving here adds a dated bodyweight entry and immediately feeds the Weight over time chart.</p>
          {quickWeightStatus&&<div className="status-message">{quickWeightStatus}</div>}
        </section>

        <section className="body-trend-stack">
          <section className="simple-card analytics-chart-card body-trend-card">
            <div className="section-heading"><div><span className="card-label">WEIGHT TREND</span><h3>Your weight over time</h3></div></div>
            <div className="trend-range-tabs">{['30D','3M','1Y','All'].map(range=><button type="button" key={range} className={bodyTrendRange===range?'active':''} onClick={()=>setBodyTrendRange(range)}>{range}</button>)}</div>
            <AnalyticsLineChart series={rangedWeightSeries} unit="lb" showPointLabels emptyText="Log another weight on a different date and your trend line will grow here."/>
          </section>

          <section className="simple-card analytics-chart-card body-trend-card">
            <div className="section-heading"><div><span className="card-label">MEASUREMENT TREND</span><h3>{selectedBodyMetric.label} over time</h3></div></div>
            <div className="trend-metric-scroll">{bodyTrendMetrics.map(metric=><button type="button" key={metric.key} className={bodyTrendMetric===metric.key?'active':''} onClick={()=>setBodyTrendMetric(metric.key)}>{metric.label}</button>)}</div>
            <AnalyticsLineChart series={rangedMeasurementSeries} unit={selectedBodyMetric.unit} showPointLabels emptyText={'Save another '+selectedBodyMetric.label.toLowerCase()+' measurement on a different date and its trend will grow here.'}/>
          </section>
        </section>

        <ProgressToolbox session={session} legacyHistory={progress.completed} flexSessions={flexSessions} formatWeight={formatWeight} onlyTab="Measurements"/>
      </>}

      {progressSection==='History'&&<>
        <section className="simple-card">
          <div className="section-heading"><div><span className="card-label">RECENT WORKOUTS</span><h3>Completed workouts</h3></div></div>
          <div className="history-list">{recentCombined.map(row=><article className="progress-workout" key={row.id}><div><strong>{new Date(row.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {row.title}</strong><span>{row.subtitle}</span></div><div><strong>{formatWeight(row.volume)} lb</strong><span>{row.e1rm?'e1RM '+formatWeight(row.e1rm):''}</span></div></article>)}
          {!recentCombined.length&&<div className="empty-state action-empty"><strong>No completed workouts yet.</strong><span>Finish a workout and it will show here.</span></div>}</div>
        </section>

        <ProgressToolbox session={session} legacyHistory={progress.completed} flexSessions={flexSessions} formatWeight={formatWeight} initialTab="Exercises"/>
        <AdvancedProgressCenter session={session}/>
      </>}    </>:<>
      {ready===false?<div className="setup-needed"><span className="card-label">PLATFORM UPDATE NEEDED</span><h2>Community is ready in the app</h2><p>Run the platform-foundation SQL migration once to enable it.</p></div>:<>
        <section className="community-control">
          <div><span className="card-label">PRIVACY</span><h3>{profile?.community_opt_in?'Community sharing is ON':'Community sharing is OFF'}</h3><p>Off is the default. Turning it on shares future workout summaries, not your email.</p></div>
          <button className={profile?.community_opt_in?'on':''} onClick={()=>toggleCommunity(!profile?.community_opt_in)}>{profile?.community_opt_in?'Turn off':'Opt in'}</button>
        </section>
        {profile?.community_opt_in&&<label className="privacy-row"><div><strong>Share bodyweight</strong><span>Off unless you explicitly enable it.</span></div><input type="checkbox" checked={Boolean(profile?.community_share_bodyweight)} onChange={e=>toggleBodyweight(e.target.checked)}/></label>}
        {message&&<div className="status-message">{message}</div>}
        <div className="community-feed">{community.map(item=><article className="community-card" key={item.id}>
          <div className="community-card-head"><strong>{item.display_name}</strong><span>{new Date(item.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></div>
          <h3>{item.title}</h3><div className="community-stats"><span>{item.summary?.volume?Number(item.summary.volume).toLocaleString()+' lb volume':'Workout complete'}</span>{item.summary?.estimated_1rm?<span>e1RM {Math.round(item.summary.estimated_1rm)} lb</span>:null}{item.summary?.bodyweight?<span>BW {item.summary.bodyweight} lb</span>:null}</div>
        </article>)}
        {!community.length&&<div className="empty-state">No community workouts yet. Opt in above if you want to share completed workout summaries.</div>}</div>
      </>}
    </>}
  </section>
}

export function PlanPage({
  session,
  profile,
  programs,
  programOrder,
  activeProgram,
  chooseProgram,
  completedByWeek,
  week,
  lifts,
  jumpToWorkout,
}) {
  const [ready,setReady] = useState(null)
  const [trackingReady,setTrackingReady] = useState(true)
  const [trackingError,setTrackingError] = useState('')
  const [planned,setPlanned] = useState([])
  const [library,setLibrary] = useState([])
  const [tracking,setTracking] = useState([])
  const [sessions,setSessions] = useState([])
  const [showAdd,setShowAdd] = useState(false)
  const [showSubmit,setShowSubmit] = useState(false)
  const [submitMode,setSubmitMode] = useState('build')
  const [form,setForm] = useState({
    scheduled_date:isoDate(new Date()), title:'Squat 3×10', lift:'Squat', scheme:'3x10', notes:'',
  })
  const [submission,setSubmission] = useState({name:'',description:'',source_url:'',visibility:'private'})
  const [message,setMessage] = useState('')
  const [shareCode,setShareCode] = useState('')
  const [shareLink,setShareLink] = useState('')
  const [sharedPreview,setSharedPreview] = useState(null)
  const [planMode,setPlanMode] = useState('programs')
  const [undoAction,setUndoAction] = useState(null)
  const [category,setCategory] = useState('All')
  const [search,setSearch] = useState('')
  const [previewKey,setPreviewKey] = useState('archive:squatober')
  const [previewWeek,setPreviewWeek] = useState(1)
  const [previewDay,setPreviewDay] = useState(0)
  const [scheduleDate,setScheduleDate] = useState(isoDate(new Date()))
  const [favorites,setFavorites] = useState(() => {
    const fromProfile=profile?.favorite_programs
    if (Array.isArray(fromProfile)) return fromProfile
    try { return JSON.parse(localStorage.getItem('wb-program-favorites') || '[]') } catch { return [] }
  })

  const classicMeta = {
    'andy-hybrid-12':{category:'Strength + Conditioning',difficulty:'Intermediate'},
    'andy-531-original-6':{category:'Strength',difficulty:'Intermediate'},
    'new-531-leader-anchor-11':{category:'Strength',difficulty:'Intermediate'},
    'andy-bbb-jokers-11':{category:'Strength',difficulty:'Intermediate'},
    'powerbuilding-8':{category:'Powerbuilding',difficulty:'Intermediate'},
    'strength-power-6':{category:'Strength + Power',difficulty:'Intermediate'},
    'reset-4':{category:'General',difficulty:'Beginner'},
  }

  const classicCatalog = useMemo(() => programOrder.map(id => {
    const p=programs[id]
    const meta=classicMeta[id] || {category:'Strength',difficulty:'Intermediate'}
    return {
      key:'classic:'+id,
      id,
      kind:'classic',
      name:p.name,
      shortName:p.shortName,
      description:p.description,
      category:meta.category,
      difficulty:meta.difficulty,
      weeksCount:p.weeksCount,
      daysPerWeek:lifts.length,
      source:id==='andy-531-original-6' ? 'Andy_531 Spreadsheet.xlsx'
        : id==='new-531-leader-anchor-11' ? 'NEW 531 PROGRAM.docx'
        : id==='andy-bbb-jokers-11' ? 'ANDY 531-Boring But Big-Jokers.xlsx'
        : 'WorkoutBoard built-in',
      dbName:p.dbName,
      transcriptionStatus:'full',
      getWeek:(targetWeek)=>lifts.map(liftName=>{
        const main=(p.main?.[targetWeek]||[]).map(set => set.pct != null ? `${set.pct}% × ${set.reps}` : `× ${set.reps}`)
        const secondary=p.secondary?.[targetWeek] || p.secondaryByLift?.[liftName]
        const exercises=[
          {name:liftName,prescription:main.length?main.join(', '):'Main work',note:p.rules?.[targetWeek]||''},
        ]
        if(secondary) exercises.push({name:secondary.label||'Supplemental',prescription:secondary.title||'Supplemental work',note:secondary.pct!=null?`${secondary.pct}% target`:''})
        ;(p.assistance?.[liftName]||[]).forEach(name=>exercises.push({name,prescription:'Log as performed',note:''}))
        const conditioning=p.conditioning?.(targetWeek,liftName)
        if(conditioning && conditioning!=='None') exercises.push({name:'Conditioning',prescription:conditioning,note:''})
        return {title:liftName+' Day',exercises}
      })
    }
  }),[programs,programOrder,lifts])

  const archiveCatalog = useMemo(() => allArchivePrograms.map(p => ({
    ...p,
    key:'archive:'+p.id,
    kind:'archive',
    transcriptionStatus:p.getWeek?'full':(p.transcriptionStatus||'source'),
  })),[])

  const allPrograms = useMemo(() => [...classicCatalog,...archiveCatalog],[classicCatalog,archiveCatalog])
  const programByKey = useMemo(() => Object.fromEntries(allPrograms.map(p=>[p.key,p])),[allPrograms])
  const preview = sharedPreview || programByKey[previewKey] || allPrograms[0]
  const previewRunnable = Boolean(preview?.getWeek)
  const previewDays = previewRunnable ? preview.getWeek(previewWeek) : []

  const days = useMemo(() => weekDays(),[])
  const start = isoDate(days[0])
  const end = isoDate(days[6])

  const load = async () => {
    if (!session?.user) return
    const [plannedResult,libraryResult,trackingResult,sessionResult] = await Promise.all([
      supabase.from('planned_workouts').select('*').eq('user_id',session.user.id).gte('scheduled_date',start).lte('scheduled_date',end).order('scheduled_date'),
      supabase.from('program_library').select('*').order('created_at',{ascending:false}),
      supabase.from('user_program_tracking').select('*').eq('user_id',session.user.id).order('updated_at',{ascending:false}),
      supabase.from('training_sessions').select('id,program,workout,completed_at').eq('user_id',session.user.id).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(1000),
    ])

    if (plannedResult.error || libraryResult.error) {
      setReady(false)
      return
    }

    setReady(true)
    setPlanned(plannedResult.data || [])
    setLibrary(libraryResult.data || [])
    setSessions(sessionResult.data || [])

    if (trackingResult.error) {
      setTrackingReady(false)
      setTrackingError(trackingResult.error.message || 'Program tracking API unavailable')
      setTracking([])
    } else {
      setTrackingReady(true)
      setTrackingError('')
      setTracking(trackingResult.data || [])
    }
  }

  useEffect(() => { load() },[session?.user?.id])

  useEffect(() => {
    if(!session?.user)return
    const code=new URLSearchParams(window.location.search).get('program')?.trim().toUpperCase()
    if(!code)return
    let cancelled=false
    const loadSharedProgram=async()=>{
      const {data,error}=await supabase.from('shared_library_items').select('*').eq('share_code',code).eq('item_type','program').maybeSingle()
      if(cancelled)return
      if(error||!data){
        setMessage(error?.message||'Shared program link was not found.')
        return
      }
      const snap=data.payload||{}
      const shared={
        key:'shared:'+code,
        kind:'shared',
        name:snap.name||data.title||'Shared program',
        shortName:snap.name||data.title||'Shared program',
        source:snap.source||'Shared WorkoutBoard link',
        description:snap.description||'Shared WorkoutBoard program.',
        category:snap.category||'Shared',
        difficulty:snap.difficulty||'',
        weeksCount:Number(snap.weeksCount||snap.weeks?.length||1),
        daysPerWeek:Number(snap.daysPerWeek||snap.weeks?.[0]?.days?.length||0),
        durationLabel:snap.durationLabel||null,
        getWeek:(targetWeek)=>snap.weeks?.find(w=>Number(w.week)===Number(targetWeek))?.days||[],
      }
      setSharedPreview(shared)
      setPreviewKey(shared.key)
      setPreviewWeek(1)
      setPreviewDay(0)
      setPlanMode('programs')
      setSearch('')
      setCategory('All')
      setMessage('Shared program loaded from link.')
      setTimeout(()=>document.getElementById('program-preview')?.scrollIntoView({behavior:'smooth',block:'start'}),120)
    }
    loadSharedProgram()
    return()=>{cancelled=true}
  },[session?.user?.id])

  const matchingSessions = track => {
    const p=programByKey[track.program_key]
    if(!p)return []
    return sessions.filter(row => {
      if(new Date(row.completed_at).getTime() < new Date(track.started_at).getTime()) return false
      if(row.workout?.tracking_program_key === track.program_key) return true
      if(p.kind==='classic') return row.program === p.dbName
      return row.program === p.name
    })
  }

  const expectedSessions = track => {
    const p=programByKey[track.program_key]
    return p ? Number(p.weeksCount||0)*Number(p.daysPerWeek||0) : 0
  }

  useEffect(() => {
    if(!trackingReady || !tracking.length || !sessions.length)return
    const autoComplete=async()=>{
      let changed=false
      for(const track of tracking.filter(t=>t.status==='tracking')){
        const expected=expectedSessions(track)
        if(expected>0 && matchingSessions(track).length>=expected){
          const {error}=await supabase.rpc('complete_program_tracking',{target_tracking_id:track.id})
          if(!error) changed=true
        }
      }
      if(changed) await load()
    }
    autoComplete()
  },[trackingReady,tracking.length,sessions.length])

  const tracked = tracking.filter(t=>t.status==='tracking')
  const completed = tracking.filter(t=>t.status==='completed')
  const trackedKeys = new Set(tracked.map(t=>t.program_key))
  const completedKeys = new Set(completed.map(t=>t.program_key))

  const categories = useMemo(() => ['All','Favorites',...Array.from(new Set(allPrograms.map(p=>p.category))).sort()],[allPrograms])

  const recentProgramKeys = useMemo(()=>{
    const keys=[]
    for(const row of sessions){
      const match=allPrograms.find(p=>(p.kind==='classic'&&p.dbName===row.program)||p.name===row.program)
      if(match&&!keys.includes(match.key))keys.push(match.key)
      if(keys.length>=6)break
    }
    return keys
  },[sessions,allPrograms])

  const availablePrograms = useMemo(() => {
    const q=search.trim().toLowerCase()
    return allPrograms.filter(p => {
      if(trackedKeys.has(p.key) || completedKeys.has(p.key)) return false
      const categoryOk = category === 'All' || (category === 'Favorites' ? favorites.includes(p.key) : p.category === category)
      const searchOk = !q || [p.name,p.category,p.description,p.source].some(v=>String(v||'').toLowerCase().includes(q))
      return categoryOk && searchOk
    }).sort((a,b)=>{
      const ar=recentProgramKeys.indexOf(a.key), br=recentProgramKeys.indexOf(b.key)
      if(ar>=0||br>=0){
        if(ar<0)return 1
        if(br<0)return -1
        return ar-br
      }
      const af=favorites.includes(a.key)?0:1, bf=favorites.includes(b.key)?0:1
      return af-bf || String(a.name).localeCompare(String(b.name))
    })
  },[allPrograms,category,search,favorites,tracking,recentProgramKeys])

  const addWorkout = async e => {
    e.preventDefault()
    const {error} = await supabase.from('planned_workouts').insert({
      user_id:session.user.id,
      scheduled_date:form.scheduled_date,
      title:form.title.trim() || form.lift + ' workout',
      source_program_name:form.scheme === '531-fsl' ? 'Custom 5/3/1' : 'Custom workout',
      source_day:form.lift,
      workout:quickWorkoutPayload(form.lift,form.scheme,form.notes),
      status:'planned',
    })
    if (error) { setMessage(error.message); return }
    setShowAdd(false)
    setMessage('Workout added. If it is scheduled for today, tap Today to run it.')
    await load()
  }

  const removePlanned = async id => {
    const row=planned.find(x=>x.id===id)
    await supabase.from('planned_workouts').delete().eq('id',id)
    if(row)setUndoAction({label:'Workout removed',run:async()=>{const copy={...row};delete copy.id;await supabase.from('planned_workouts').insert(copy);setUndoAction(null);await load()}})
    await load()
  }

  const toggleFavorite = async key => {
    const next=favorites.includes(key) ? favorites.filter(x=>x!==key) : [...favorites,key]
    setFavorites(next)
    localStorage.setItem('wb-program-favorites',JSON.stringify(next))
    if(session?.user){
      const {error}=await supabase.from('profiles').update({favorite_programs:next,updated_at:new Date().toISOString()}).eq('id',session.user.id)
      if(error && !String(error.message).includes('favorite_programs')) setMessage(error.message)
    }
  }

  const openPreview = key => {
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur()
    setSharedPreview(null)
    setPreviewKey(key)
    setPreviewWeek(1)
    setPreviewDay(0)
    setTimeout(()=>document.getElementById('program-preview')?.scrollIntoView({behavior:'smooth',block:'start'}),80)
  }

  const snapshotProgram = p => ({
    key:p.key,
    name:p.name,
    kind:p.kind,
    source:p.source,
    description:p.description,
    category:p.category,
    difficulty:p.difficulty,
    weeksCount:p.weeksCount,
    daysPerWeek:p.daysPerWeek,
    weeks:Array.from({length:Number(p.weeksCount||0)},(_,i)=>{
      const n=i+1
      return {week:n,days:p.getWeek?p.getWeek(n):[]}
    })
  })

  const createProgramVersion = async p => {
    const {data:latest}=await supabase.from('program_versions').select('version_number')
      .eq('user_id',session.user.id).eq('program_key',p.key)
      .order('version_number',{ascending:false}).limit(1)
    const version=Number(latest?.[0]?.version_number||0)+1
    const {data,error}=await supabase.from('program_versions').insert({
      user_id:session.user.id,
      program_key:p.key,
      version_number:version,
      title:p.name,
      snapshot:snapshotProgram(p)
    }).select('id').single()
    if(error)return null
    return data?.id||null
  }

  const shareProgram = async p => {
    if(!session?.user||!p)return
    setMessage('Creating share link…')
    setShareCode('')
    setShareLink('')
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code=Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
    const {error}=await supabase.from('shared_library_items').insert({
      owner_user_id:session.user.id,
      share_code:code,
      item_type:'program',
      title:p.name,
      payload:snapshotProgram(p)
    })
    if(error){setMessage('Could not create share link: '+error.message);return}
    const url=new URL(window.location.href)
    url.search=''
    url.hash=''
    url.searchParams.set('program',code)
    const link=url.toString()
    setShareCode(code)
    setShareLink(link)
    let copied=false
    try{await navigator.clipboard.writeText(link);copied=true}catch{}
    setMessage(copied?'Program link copied to clipboard.':'Share link created. Tap Copy link below.')
  }

  const copyShareCode = async () => {
    if(!shareCode)return
    try{
      await navigator.clipboard.writeText(shareCode)
      setMessage('Share code copied to clipboard.')
    }catch{
      setMessage('Copy was blocked by the browser. Select the code and copy it manually.')
    }
  }

  const copyShareLink = async () => {
    if(!shareLink)return
    try{
      await navigator.clipboard.writeText(shareLink)
      setMessage('Program link copied to clipboard.')
    }catch{
      setMessage('Copy was blocked by the browser. Select the link and copy it manually.')
    }
  }

  const nativeShareProgram = async () => {
    if(!shareLink||!navigator.share)return
    try{await navigator.share({title:preview?.name||'WorkoutBoard program',text:'WorkoutBoard program',url:shareLink})}catch{}
  }

  const startTracking = async p => {
    if(!session?.user || !p)return
    if(!p.getWeek){
      setMessage(p.name+' is cataloged from your archive but still needs its source prescription transcribed before it can be tracked.')
      return
    }
    const versionId=await createProgramVersion(p)
    const {data,error}=await supabase.rpc('start_program_tracking',{
      target_program_key:p.key,
      target_program_name:p.name,
      target_program_kind:p.kind,
    })
    if(error){
      setTrackingReady(false)
      setMessage('Run the unified-program-tracking migration first: '+error.message)
      return
    }
    const trackId=Array.isArray(data)?data[0]?.id:data?.id
    if(trackId&&versionId)await supabase.from('user_program_tracking').update({program_version_id:versionId}).eq('id',trackId)
    if(p.kind==='classic') await chooseProgram(p.id)
    setMessage(p.name+' is now in Tracked Programs. Version snapshot saved.')
    await load()
  }

  const markComplete = async track => {
    const {error}=await supabase.rpc('complete_program_tracking',{target_tracking_id:track.id})
    if(error){setMessage(error.message);return}
    setMessage('')
    setUndoAction({label:track.program_name+' marked complete',run:async()=>{await supabase.from('user_program_tracking').update({status:'tracking',completed_at:null,updated_at:new Date().toISOString()}).eq('id',track.id);setUndoAction(null);await load()}})
    await load()
  }

  const scheduleProgramWorkout = async () => {
    if(!session?.user || !preview)return
    if(!previewRunnable){
      setMessage(preview.name+' is source-backed only right now. I will not create a fake workout from an untranscribed file.')
      return
    }
    const chosen=previewDays[Math.max(0,Math.min(previewDays.length-1,previewDay))]
    let payload
    if(preview.kind==='archive'){
      payload=makePlannedFromArchive(preview,previewWeek,previewDay,scheduleDate)
      payload.workout={...payload.workout,tracking_program_key:preview.key}
    } else {
      payload={
        scheduled_date:scheduleDate,
        title:chosen.title,
        source_program_name:preview.name,
        source_week:previewWeek,
        source_day:chosen.title,
        workout:{
          version:2,type:'flexible',tracking_program_key:preview.key,source:preview.source,
          notes:'',exercises:(chosen.exercises||[]).map((item,i)=>({...item,id:`e${i+1}`,result:'',done:false})),
          sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',
        },
        status:'planned',
      }
    }
    const {error}=await supabase.from('planned_workouts').insert({...payload,user_id:session.user.id})
    if(error){setMessage(error.message);return}
    setMessage(`${preview.name} · ${payload.title} added to ${scheduleDate}.`)
    await load()
  }

  const submitPlan = async e => {
    e.preventDefault()
    const sourceUrl=submitMode==='link'?submission.source_url.trim():null
    const name=submission.name.trim()||(submitMode==='link'?'Linked program':'Custom program')
    const {error}=await supabase.from('program_library').insert({
      owner_user_id:session.user.id,name,description:submission.description.trim()||null,
      source_type:submitMode==='link'?'url':'manual',source_url:sourceUrl||null,
      visibility:submission.visibility,status:'draft',
      plan:{submission_mode:submitMode,notes:submission.description.trim()},
    })
    if(error){setMessage(error.message);return}
    setShowSubmit(false)
    setSubmission({name:'',description:'',source_url:'',visibility:'private'})
    setMessage(submitMode==='link'?'Link saved as a draft.':'Workout plan draft saved.')
    await load()
  }

  const ProgramCard=({p})=>{
    const length=p.durationLabel || (p.weeksCount?(`${p.weeksCount} weeks`):'Program')
    const frequency=p.daysPerWeek?(`${p.daysPerWeek} day${p.daysPerWeek===1?'':'s'}/wk`):''
    return <article className={'archive-card simplified-program-card '+(previewKey===p.key?'selected':'')}>
      <div className="archive-card-head">
        <span className="program-length">{length}{frequency?' · '+frequency:''}</span>
        <button className={'favorite-button '+(favorites.includes(p.key)?'active':'')} onClick={()=>toggleFavorite(p.key)} title="Favorite">{favorites.includes(p.key)?'★':'☆'}</button>
      </div>
      <h3>{p.name}</h3>
      <div className="program-meta"><span>{p.category}</span></div>
      <button className="wide-button" onClick={()=>openPreview(p.key)}>Preview</button>
    </article>
  }

  if(ready===false){
    return <section className="page-section"><div className="setup-needed">
      <span className="card-label">PLATFORM UPDATE NEEDED</span>
      <h2>Planning tools are ready</h2>
      <p>Run the platform-foundation SQL migration once, then refresh.</p>
    </div></section>
  }

  return <section className="page-section">
    <section className="program-summary compact-plan-summary">
      <span className="card-label">PLAN</span>
      <h2>Programs & scheduling</h2>
      <p>Pick a program first. Scheduling and advanced tools stay out of the way until you need them.</p>
    </section>

    <div className="segmented plan-mode-tabs">
      <button className={planMode==='programs'?'active':''} onClick={()=>setPlanMode('programs')}>Programs</button>
      <button className={planMode==='tools'?'active':''} onClick={()=>setPlanMode('tools')}>Schedule & tools</button>
    </div>

    {!trackingReady&&<div className="setup-needed">
      <span className="card-label">ONE DATABASE UPDATE NEEDED</span>
      <h3>Enable tracked programs</h3>
      <p>{trackingError || 'Run 20261101_unified_program_tracking.sql in Supabase. Program browsing still works.'}</p>
    </div>}

    {undoAction&&<div className="undo-toast"><span>{undoAction.label}</span><button onClick={undoAction.run}>Undo</button></div>}
    {planMode!=='programs'&&message&&<div className="status-message">{message}</div>}

    {planMode==='programs'?<>
      {tracked.length>0&&<section className="program-state-section current-program-section">
        <div className="section-heading"><div><span className="card-label">CURRENT</span><h3>Programs you’re training</h3></div></div>
        <div className="archive-grid">{tracked.map(track=>{
          const p=programByKey[track.program_key]
          if(!p)return null
          const done=matchingSessions(track).length
          const expected=expectedSessions(track)
          return <article className="archive-card tracked-program-card" key={track.id}>
            <div className="archive-card-head"><span className="program-length">Run {track.run_number}</span><span className="tracking-badge">CURRENT</span></div>
            <h3>{p.name}</h3>
            <div className="program-progress-track"><div style={{width:(expected ? Math.min(100,done/expected*100) : 0)+'%'}} /></div>
            <small>{done} of {expected||'—'} workouts</small>
            <div className="program-card-actions"><button className="wide-button" onClick={()=>openPreview(p.key)}>Preview</button><button className="secondary-action" onClick={()=>markComplete(track)}>Complete</button></div>
          </article>
        })}</div>
      </section>}

      <section className="library-toolbar simple-card program-picker-toolbar">
        <div className="section-heading"><div><span className="card-label">PROGRAM LIBRARY</span><h3>Find your next program</h3></div><button className="mini-action" onClick={()=>setShowSubmit(v=>!v)}>Add your own</button></div>
        <input className="text-input program-search" value={search} onChange={e=>setSearch(e.target.value)} enterKeyHint="search" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}} placeholder="Search 5/3/1, Squatober, powerbuilding…"/>
        <div className="category-chips">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
        {recentProgramKeys.length>0&&<div className="recent-programs-row"><span>Recent</span>{recentProgramKeys.slice(0,4).map(key=>{const p=programByKey[key];return p?<button key={key} onClick={()=>openPreview(key)}>{p.name}</button>:null})}</div>}
      </section>

      {showSubmit&&<form className="builder-card" onSubmit={submitPlan}>
        <div className="segmented"><button type="button" className={submitMode==='build'?'active':''} onClick={()=>setSubmitMode('build')}>Build</button><button type="button" className={submitMode==='link'?'active':''} onClick={()=>setSubmitMode('link')}>Link</button></div>
        <label>Program name<input value={submission.name} onChange={e=>setSubmission(v=>({...v,name:e.target.value}))}/></label>
        {submitMode==='link'&&<label>Source URL<input type="url" required value={submission.source_url} onChange={e=>setSubmission(v=>({...v,source_url:e.target.value}))}/></label>}
        <label>{submitMode==='build'?'Program outline':'Notes'}<textarea value={submission.description} onChange={e=>setSubmission(v=>({...v,description:e.target.value}))}/></label>
        <label>Visibility<select value={submission.visibility} onChange={e=>setSubmission(v=>({...v,visibility:e.target.value}))}><option value="private">Private</option><option value="community">Community</option></select></label>
        <button className="primary-action">Save draft</button>
      </form>}

      <div className="archive-grid">
        {availablePrograms.map(p=><ProgramCard key={p.key} p={p}/>)}
        {!availablePrograms.length&&<div className="empty-state action-empty"><strong>No programs match.</strong><button onClick={()=>{setSearch('');setCategory('All')}}>Clear filters</button></div>}
      </div>

      {preview&&<section className="program-preview-card" id="program-preview">
        <div className="preview-head">
          <div><span className="card-label">PROGRAM PREVIEW</span><h2>{preview.name}</h2><p>{preview.description}</p></div>
          <button className={'favorite-button large '+(favorites.includes(preview.key)?'active':'')} onClick={()=>toggleFavorite(preview.key)}>{favorites.includes(preview.key)?'★':'☆'}</button>
        </div>
        <div className="preview-facts">
          <div><span>Category</span><strong>{preview.category}</strong></div>
          <div><span>Difficulty</span><strong>{preview.difficulty}</strong></div>
          <div><span>Length</span><strong>{preview.durationLabel || preview.weeksCount+' weeks'}</strong></div>
          <div><span>Frequency</span><strong>{preview.daysPerWeek+' days/week'}</strong></div>
        </div>
        <div className="source-pill">Source: {preview.source}</div>
        <div className="builder-two preview-controls">
          <label>Week<select value={previewWeek} onChange={e=>{setPreviewWeek(Number(e.target.value));setPreviewDay(0)}}>{Array.from({length:preview.weeksCount},(_,i)=>i+1).map(n=><option key={n} value={n}>Week {n}</option>)}</select></label>
          <label>Workout<select value={previewDay} onChange={e=>setPreviewDay(Number(e.target.value))}>{previewDays.map((d,i)=><option key={i} value={i}>{d.title}</option>)}</select></label>
        </div>
        <div className="sample-workout"><h3>{previewDays[previewDay]?.title}</h3>{previewDays[previewDay]?.exercises?.map((x,i)=><div className="sample-exercise" key={i}><strong>{x.name}</strong><span>{x.prescription}</span>{x.note&&<small>{x.note}</small>}</div>)}</div>
        <div className="program-preview-actions">
          <div className="schedule-row"><input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)}/><button className="primary-action" onClick={scheduleProgramWorkout}>Add workout</button></div>
          <button className="wide-button" onClick={()=>shareProgram(preview)}>Share program</button>
          {shareLink&&<div className="share-link-inline">
            <span>{shareLink}</span>
            <div><button type="button" onClick={copyShareLink}>Copy link</button>{navigator.share&&<button type="button" onClick={nativeShareProgram}>Share</button>}</div>
          </div>}
          {shareCode&&<div className="share-code-inline"><strong>{shareCode}</strong><button type="button" onClick={copyShareCode}>Copy code</button></div>}
          {trackingReady&&!trackedKeys.has(preview.key)&&preview.kind!=='shared'&&<button className="wide-button" onClick={()=>startTracking(preview)}>{completedKeys.has(preview.key)?'Track this program again':'Track this program'}</button>}
          {message&&<div className="status-message preview-action-status">{message}</div>}
        </div>
      </section>}

      {completed.length>0&&<details className="completed-programs">
        <summary><span><b>Completed programs</b><small>{completed.length} run{completed.length===1?'':'s'}</small></span></summary>
        <div className="archive-grid">{completed.map(track=>{const p=programByKey[track.program_key];if(!p)return null;return <article className="archive-card completed-program-card" key={track.id}><h3>{p.name}</h3><p>{track.completed_at?'Completed '+new Date(track.completed_at).toLocaleDateString():'Completed'}</p><button className="wide-button" onClick={()=>startTracking(p)}>Track again</button></article>})}</div>
      </details>}
    </>:<>
      <section className="simple-card weekly-schedule-card">
        <div className="section-heading"><div><span className="card-label">THIS WEEK</span><h3>Scheduled workouts</h3></div></div>
        <div className="weekly-plan">{days.map(calendarDay=>{
          const date=isoDate(calendarDay),rows=planned.filter(item=>item.scheduled_date===date)
          return <article className="day-plan" key={date}>
            <div className="day-plan-head"><div><strong>{calendarDay.toLocaleDateString(undefined,{weekday:'short'})}</strong><span>{calendarDay.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></div>{date===isoDate(new Date())&&<b>Today</b>}</div>
            {rows.map(row=><div className="planned-item" key={row.id}><div><strong>{row.title}</strong><span>{row.source_program_name||row.workout?.scheme||'Workout'} · {row.status}</span></div><button onClick={()=>removePlanned(row.id)}>×</button></div>)}
            {!rows.length&&<span className="rest-label">No workout planned</span>}
          </article>
        })}</div>
        <button className="primary-action" onClick={()=>setShowAdd(v=>!v)}>{showAdd?'Close':'+ Add one-off workout'}</button>
      </section>

      {showAdd&&<form className="builder-card" onSubmit={addWorkout}>
        <h3>Quick workout</h3>
        <label>Date<input type="date" value={form.scheduled_date} onChange={e=>setForm(v=>({...v,scheduled_date:e.target.value}))}/></label>
        <label>Name<input value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
        <div className="builder-two"><label>Primary lift<select value={form.lift} onChange={e=>setForm(v=>({...v,lift:e.target.value}))}>{lifts.map(x=><option key={x}>{x}</option>)}</select></label><label>Scheme<select value={form.scheme} onChange={e=>setForm(v=>({...v,scheme:e.target.value}))}><option value="3x10">3 × 10</option><option value="5x5">5 × 5</option><option value="531-fsl">5/3/1 + FSL 5×5</option><option value="custom">Custom</option></select></label></div>
        <label>Notes<textarea value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></label>
        <button className="primary-action">Add to calendar</button>
      </form>}

      <PlannedWorkoutTools session={session} />
      <ShareImportPanel session={session} />
      <WorkoutTemplates session={session} />

      {library.filter(item=>item.owner_user_id===session.user.id).length>0&&<section className="simple-card">
        <div className="section-heading"><div><span className="card-label">YOUR PROGRAM DRAFTS</span><h3>Drafts & links</h3></div></div>
        {library.filter(item=>item.owner_user_id===session.user.id).map(item=><div className="library-row" key={item.id}><div><strong>{item.name}</strong><span>{item.source_type==='url'?'Link · '+item.status:'Program · '+item.status}</span></div><span>{item.visibility}</span></div>)}
      </section>}
    </>}
  </section>
}


export function FeedbackPanel({session,profile}) {
  const [open,setOpen]=useState(false)
  const [category,setCategory]=useState('idea')
  const [message,setMessage]=useState('')
  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)

  const submit=async e=>{
    e.preventDefault()
    const clean=message.trim()
    if(!clean||!session?.user)return
    setBusy(true);setStatus('')
    const payload={
      user_id:session.user.id,
      email:session.user.email||null,
      display_name:profile?.display_name||null,
      category,
      message:clean,
      page:window.location.pathname+window.location.search,
      user_agent:navigator.userAgent||null,
    }
    const {data,error}=await supabase.from('feedback_submissions').insert(payload).select('id').single()
    if(error){
      setStatus(error.code==='42P01'?'Feedback storage is not enabled yet.':'Could not send feedback: '+error.message)
      setBusy(false);return
    }
    try{
      await supabase.functions.invoke('feedback-notify',{body:{feedback_id:data.id}})
    }catch{}
    setMessage('')
    setStatus('Thank you — feedback sent.')
    setBusy(false)
  }

  return <section className="simple-card feedback-card">
    <div className="section-heading">
      <div><span className="card-label">FEEDBACK</span><h3>Help make WorkoutBoard better</h3></div>
      <button type="button" className="feedback-toggle" onClick={()=>setOpen(v=>!v)}>{open?'Close':'Send feedback'}</button>
    </div>
    <p className="feedback-plea">WorkoutBoard is being built for you. If something feels confusing, broken, annoying, or missing, tell me. I can’t make it better without your help.</p>
    {open&&<form className="feedback-form" onSubmit={submit}>
      <label>What kind of feedback?
        <select value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="bug">Something is broken</option>
          <option value="confusing">Something is confusing</option>
          <option value="idea">I have an idea</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Tell me what happened or what you’d change
        <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="The more specific you are, the easier it is to improve." rows="5"/>
      </label>
      <button className="primary-action" disabled={busy||!message.trim()}>{busy?'Sending…':'Submit feedback'}</button>
    </form>}
    {status&&<div className="status-message">{status}</div>}
  </section>
}

export function AdminPanel({ programs }) {
  const [users,setUsers] = useState([])
  const [selected,setSelected] = useState(null)
  const [maxes,setMaxes] = useState(null)
  const [maxDraft,setMaxDraft] = useState({squat:'',bench:'',deadlift:'',press:''})
  const [sessions,setSessions] = useState([])
  const [editSession,setEditSession] = useState(null)
  const [message,setMessage] = useState('')
  const [resetPassword,setResetPassword] = useState('')
  const [feedback,setFeedback] = useState([])
  const [feedbackMessage,setFeedbackMessage] = useState('')

  const loadUsers = async () => {
    let {data,error} = await supabase.rpc('admin_user_overview_v2')
    if (error) ({data,error}=await supabase.rpc('admin_user_overview'))
    if (error) { setMessage(error.message); return }
    setUsers(data || [])
  }
  const loadFeedback=async()=>{
    const {data,error}=await supabase.from('feedback_submissions').select('*').order('created_at',{ascending:false}).limit(100)
    if(error){if(error.code!=='42P01')setFeedbackMessage(error.message);return}
    setFeedback(data||[])
    const unread=(data||[]).filter(row=>row.status==='new').map(row=>row.id)
    if(unread.length){
      await supabase.from('feedback_submissions').update({status:'read',read_at:new Date().toISOString()}).in('id',unread)
      setFeedback(rows=>rows.map(row=>unread.includes(row.id)?{...row,status:'read'}:row))
    }
  }
  useEffect(() => { loadUsers();loadFeedback() },[])

  const openUser = async user => {
    setSelected(user); setMessage(''); setEditSession(null)
    const [{data:tm},{data:rows}] = await Promise.all([
      supabase.from('training_maxes').select('*').eq('user_id',user.user_id).maybeSingle(),
      supabase.from('training_sessions').select('*').eq('user_id',user.user_id).order('session_date',{ascending:false}).limit(50),
    ])
    const next=tm||{squat:null,bench:null,deadlift:null,press:null}
    setMaxes(next)
    setMaxDraft({squat:next.squat??'',bench:next.bench??'',deadlift:next.deadlift??'',press:next.press??''})
    setSessions(rows || [])
  }

  const saveProgram = async (programId,week) => {
    if (!selected) return
    const {error}=await supabase.rpc('admin_set_user_program',{target_user:selected.user_id,new_program:programId,new_week:Number(week||1)})
    if(error){setMessage(error.message);return}
    setMessage('User program updated.')
    await loadUsers()
    setSelected(v=>v?{...v,active_program:programId,current_week:Number(week||1)}:v)
  }

  const resetUserPassword = async () => {
    if (!selected || resetPassword.length < 10) { setMessage('Enter a new password with at least 10 characters.'); return }
    const {error}=await supabase.rpc('admin_reset_user_password',{target_user:selected.user_id,new_password:resetPassword})
    setMessage(error?error.message:'Password reset successfully.')
    if(!error)setResetPassword('')
  }

  const saveMaxes = async () => {
    if(!selected)return
    const num=v=>v===''?null:Number(v)
    const {error}=await supabase.rpc('admin_set_training_maxes',{
      target_user:selected.user_id,new_squat:num(maxDraft.squat),new_bench:num(maxDraft.bench),
      new_deadlift:num(maxDraft.deadlift),new_press:num(maxDraft.press)
    })
    if(error){setMessage('Run the product-upgrades migration first: '+error.message);return}
    setMaxes({...maxDraft})
    setMessage('Training maxes updated.')
  }

  const resetUserTraining = async () => {
    if(!selected)return
    const label=selected.display_name||selected.email||'this user'
    if(!window.confirm(`Reset ALL workouts and training maxes for ${label}? This cannot be undone.`))return
    setMessage('Resetting training data…')
    const {error}=await supabase.rpc('admin_reset_training',{target_user:selected.user_id})
    if(error){setMessage('Run the product-upgrades migration first: '+error.message);return}
    setMaxes({squat:null,bench:null,deadlift:null,press:null})
    setMaxDraft({squat:'',bench:'',deadlift:'',press:''});setSessions([])
    setSelected(v=>v?{...v,workout_count:0,total_volume:0,last_workout:null,current_week:1}:v)
    await loadUsers();setMessage('Workout history and training maxes reset.')
  }

  const saveSessionEdit = async () => {
    if(!selected||!editSession)return
    const {error}=await supabase.rpc('admin_update_training_session',{
      target_user:selected.user_id,target_session:editSession.id,new_title:editSession.title,
      new_total_volume:Number(editSession.total_volume||0),new_bodyweight:editSession.bodyweight===''?null:Number(editSession.bodyweight)
    })
    if(error){setMessage('Run the product-upgrades migration first: '+error.message);return}
    setSessions(rows=>rows.map(r=>r.id===editSession.id?{...r,...editSession}:r))
    setEditSession(null);setMessage('Completed session updated.')
  }

  const deleteSession = async row => {
    if(!selected||!window.confirm(`Delete "${row.title}" from this user's history? This cannot be undone.`))return
    const {error}=await supabase.rpc('admin_delete_training_session',{target_user:selected.user_id,target_session:row.id})
    if(error){setMessage('Run the product-upgrades migration first: '+error.message);return}
    setSessions(rows=>rows.filter(r=>r.id!==row.id));setMessage('Session deleted.');await loadUsers()
  }

  const resolveFeedback=async id=>{
    const {error}=await supabase.from('feedback_submissions').update({status:'resolved',resolved_at:new Date().toISOString()}).eq('id',id)
    if(error){setFeedbackMessage(error.message);return}
    setFeedback(rows=>rows.map(row=>row.id===id?{...row,status:'resolved'}:row))
  }

  const fmtDate=value=>value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Never'
  const fmtFeedbackTime=value=>value?new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''

  if(!selected){
    const totalWorkouts=users.reduce((sum,u)=>sum+Number(u.workout_count||0),0)
    return <section className="page-section">
      <AdminDashboardSummary />
      <section className="summary-grid"><div><span>Users</span><strong>{users.length}</strong></div><div><span>Completed workouts</span><strong>{totalWorkouts}</strong></div></section>
      <section className="simple-card admin-feedback-inbox">
        <div className="section-heading"><div><span className="card-label">FEEDBACK INBOX</span><h3>User feedback</h3></div><b className="feedback-count">{feedback.filter(row=>row.status!=='resolved').length}</b></div>
        {feedback.length?<div className="feedback-admin-list">{feedback.map(row=><article className={'feedback-admin-item '+(row.status==='resolved'?'resolved':'')} key={row.id}>
          <div className="feedback-admin-meta"><span className={'feedback-type '+row.category}>{row.category}</span><span>{fmtFeedbackTime(row.created_at)}</span></div>
          <strong>{row.display_name||row.email||'WorkoutBoard user'}</strong>
          <p>{row.message}</p>
          <small>{row.email||''}{row.page?' · '+row.page:''}</small>
          {row.status!=='resolved'&&<button className="secondary-action" onClick={()=>resolveFeedback(row.id)}>Mark resolved</button>}
        </article>)}</div>:<div className="empty-state">No feedback yet.</div>}
        {feedbackMessage&&<div className="status-message">{feedbackMessage}</div>}
      </section>
      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">ADMIN</span><h3>WorkoutBoard users</h3></div></div>
        <div className="admin-user-list">{users.map(user=><button className="admin-user-row" key={user.user_id} onClick={()=>openUser(user)}>
          <div><strong>{user.display_name||'Unnamed user'}</strong><span>{user.email}</span></div>
          <div><strong>{user.workout_count||0} workouts</strong><span>{fmtDate(user.last_workout)}</span></div>
        </button>)}</div>
        {!users.length&&<div className="empty-state">No users returned.</div>}
      </section>
      {message&&<div className="status-message">{message}</div>}
    </section>
  }

  return <section className="page-section">
    <button className="secondary-action" onClick={()=>{setSelected(null);setMaxes(null);setSessions([]);setEditSession(null)}}>← All users</button>
    <section className="profile-card">
      <span className="card-label">USER</span><h2>{selected.display_name||'Unnamed user'}</h2><p>{selected.email}</p>
      <div className="admin-meta"><span>{selected.workout_count||0} workouts</span><span>{Number(selected.total_volume||0).toLocaleString()} lb tracked volume</span><span>Last: {fmtDate(selected.last_workout)}</span></div>
    </section>

    <section className="simple-card">
      <div className="section-heading"><div><span className="card-label">PROGRAM</span><h3>Manage current program</h3></div></div>
      <div className="builder-two">
        <label className="admin-field">Program<select id="admin-program" defaultValue={selected.active_program||'andy-hybrid-12'}>{Object.entries(programs).map(([id,p])=><option value={id} key={id}>{p.name}</option>)}</select></label>
        <label className="admin-field">Week<input id="admin-week" type="number" min="1" max="20" defaultValue={selected.current_week||1}/></label>
      </div>
      <button className="wide-button" onClick={()=>saveProgram(document.getElementById('admin-program').value,document.getElementById('admin-week').value)}>Save program/week</button>
    </section>

    <section className="simple-card">
      <div className="section-heading"><div><span className="card-label">TRAINING MAXES</span><h3>Edit current numbers</h3></div></div>
      <div className="admin-edit-max-grid">
        {['squat','bench','deadlift','press'].map(name=><label key={name}><span>{name[0].toUpperCase()+name.slice(1)}</span><input type="number" inputMode="decimal" value={maxDraft[name]} onChange={e=>setMaxDraft(v=>({...v,[name]:e.target.value}))} placeholder="—"/></label>)}
      </div>
      <button className="wide-button" onClick={saveMaxes}>Save training maxes</button>
    </section>

    <section className="simple-card">
      <div className="section-heading"><div><span className="card-label">ACCOUNT ACCESS</span><h3>Reset password</h3></div></div>
      <p className="helper-text">Set a new password for this user without email.</p>
      <div className="admin-password-row"><input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} placeholder="New password (10+ characters)"/><button onClick={resetUserPassword}>Reset</button></div>
    </section>

    <section className="simple-card danger-card">
      <div className="section-heading"><div><span className="card-label">RESET TRAINING DATA</span><h3>Start this user over</h3></div></div>
      <p className="helper-text">Deletes workout history, planned workouts, shared results, community activity, and clears all training maxes. Account and program stay in place.</p>
      <button className="danger-button" onClick={resetUserTraining}>Reset workouts + training maxes</button>
    </section>

    {editSession&&<section className="builder-card session-editor">
      <span className="card-label">EDIT COMPLETED SESSION</span>
      <label>Title<input value={editSession.title||''} onChange={e=>setEditSession(v=>({...v,title:e.target.value}))}/></label>
      <div className="builder-two"><label>Tracked volume<input type="number" value={editSession.total_volume??''} onChange={e=>setEditSession(v=>({...v,total_volume:e.target.value}))}/></label><label>Bodyweight<input type="number" value={editSession.bodyweight??''} onChange={e=>setEditSession(v=>({...v,bodyweight:e.target.value}))}/></label></div>
      <div className="session-edit-actions"><button className="secondary-action" onClick={()=>setEditSession(null)}>Cancel</button><button className="primary-action" onClick={saveSessionEdit}>Save session</button></div>
    </section>}

    <section className="simple-card">
      <div className="section-heading"><div><span className="card-label">RECENT HISTORY</span><h3>Training sessions</h3></div></div>
      <div className="admin-session-list">{sessions.map(row=><div className="library-row admin-history-row" key={row.id}>
        <div><strong>{row.title}</strong><span>{fmtDate(row.session_date)}{row.program?' · '+row.program:''}</span></div>
        <div className="admin-session-volume"><strong>{Number(row.total_volume||0).toLocaleString()} lb</strong><span>{row.estimated_1rm?'e1RM '+Math.round(row.estimated_1rm):''}</span></div>
        <div className="admin-history-actions"><button onClick={()=>setEditSession({...row,bodyweight:row.bodyweight??''})}>Edit</button><button className="danger-lite" onClick={()=>deleteSession(row)}>Delete</button></div>
      </div>)}
      {!sessions.length&&<div className="empty-state">No completed sessions yet.</div>}</div>
    </section>
    {message&&<div className="status-message">{message}</div>}
  </section>
}
