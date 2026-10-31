import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { PlatformProgress, PlanPage } from './platform'

const lifts = ['Squat', 'Bench', 'Deadlift', 'Press']
const repeatSets = (count, pct, reps, pctLabel) =>
  Array.from({ length: count }, () => ({ pct, reps, pctLabel: pctLabel || (pct != null ? pct + '%' : '') }))

const dayNames = { Squat:'Mon', Bench:'Tue', Deadlift:'Thu', Press:'Fri' }

const programs = {
  'andy-hybrid-12': {
    name:'12 Week Andy Hybrid',
    shortName:'12W Andy Hybrid',
    dbName:'12 Week Andy Hybrid',
    weeksCount:12,
    basis:'tm',
    description:'Strength-first 5/3/1-style training, assistance, and conditioning. Best all-around starting point.',
    phases:{
      1:'Leader 1',2:'Leader 1',3:'Leader 1',4:'Leader 2',5:'Leader 2',6:'Leader 2',
      7:'Deload',8:'Anchor',9:'Anchor',10:'Anchor',11:'TM Test',12:'Deload / Rebase'
    },
    main:{
      1:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      2:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5}],
      3:[{pct:75,reps:5},{pct:85,reps:5},{pct:95,reps:5}],
      4:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      5:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5}],
      6:[{pct:75,reps:5},{pct:85,reps:5},{pct:95,reps:5}],
      7:[{pct:40,reps:5},{pct:50,reps:5},{pct:60,reps:5}],
      8:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:'5+'}],
      9:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:'3+'}],
      10:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:'1+'}],
      11:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:3}],
      12:[{pct:40,reps:5},{pct:50,reps:5},{pct:60,reps:5}],
    },
    secondary:{
      1:{label:'BACKOFF',title:'FSL 5x5 @ 65%',pct:65},
      2:{label:'BACKOFF',title:'FSL 5x5 @ 70%',pct:70},
      3:{label:'BACKOFF',title:'FSL 5x5 @ 75%',pct:75},
      4:{label:'BACKOFF',title:'BBB 5x10 @ 50%',pct:50},
      5:{label:'BACKOFF',title:'BBB 5x10 @ 55%',pct:55},
      6:{label:'BACKOFF',title:'BBB 5x10 @ 60%',pct:60},
      7:{label:'BACKOFF',title:'2x5 @ 50%',pct:50},
      8:{label:'BACKOFF',title:'FSL 3x5',pct:65},
      9:{label:'BACKOFF',title:'FSL 3x5',pct:70},
      10:{label:'BACKOFF',title:'FSL 3x5',pct:75},
      11:{label:'TM TEST',title:'100% TM x 3-5',pct:100},
      12:{label:'BACKOFF',title:'2x5 @ 50%',pct:50},
    },
    assistance:{
      Squat:['DB Split Squat','Row','Leg Raises'],
      Bench:['Incline DB / Dips','Pullups','Triceps'],
      Deadlift:['RDL / Back Raise','Row','Abs'],
      Press:['DB Press','Pullups','Curls / Face Pulls'],
    },
    conditioning:(week,lift) => {
      if (week <= 3) return 'Easy only'
      if (week <= 6) return lift === 'Press' ? '1 short moderate session' : 'None'
      if (week === 7) return 'None'
      if (week <= 10) return lift === 'Press' ? '1 hard + 1 easy' : 'None'
      if (week === 11) return 'Easy only'
      return 'Optional performance test'
    }
  },

  'powerbuilding-8': {
    name:'8 Week Powerbuilding',
    shortName:'8W Powerbuilding',
    dbName:'8 Week Powerbuilding',
    weeksCount:8,
    basis:'e1rm',
    description:'More muscle-building volume while keeping squat, bench, deadlift, and press moving.',
    phases:{1:'Volume',2:'Volume',3:'Volume',4:'Deload',5:'Strength',6:'Strength',7:'Strength',8:'Performance'},
    main:{
      1:repeatSets(4,70,6),
      2:repeatSets(4,72.5,6),
      3:repeatSets(4,75,6),
      4:repeatSets(3,60,5),
      5:repeatSets(5,75,5),
      6:repeatSets(5,80,4),
      7:repeatSets(6,82.5,3,'82.5–85%'),
      8:[{pct:null,reps:'3-5',pctLabel:'Top set @ RPE 8'}, ...repeatSets(2,70,5)],
    },
    assistance:{
      Squat:['RDL 3x8','Bulgarian Split Squat 3x10','Calf 3x15','Abs 3x12'],
      Bench:['Row 4x8','Strict Press 3x8','Pullups 4 sets','Triceps 3x12'],
      Deadlift:['Front Squat 3x8','Ham Curl 3x12','Reverse Lunge 3x10/leg','Carry 4x40 yd'],
      Press:['Incline DB 4x10','Pulldown 3x12','Chest-Supported Row 3x12','Lateral Raise 3x15','Curl + Pushdown 3x12'],
    },
    conditioning:(week,lift) => {
      if (lift === 'Squat') return 'Easy carry/sled 10 min'
      if (lift === 'Deadlift') return '20-30 min Zone 2 optional'
      if (lift === 'Press') return '8-12 min short metcon optional'
      return 'None'
    }
  },

  'strength-power-6': {
    name:'6 Week Strength + Power',
    shortName:'6W Strength + Power',
    dbName:'6 Week Strength-Power',
    weeksCount:6,
    basis:'e1rm',
    description:'Heavy strength with speed work, jumps, cleans, and short conditioning.',
    phases:{1:'Base',2:'Build',3:'Build',4:'Deload',5:'Heavy',6:'Peak'},
    main:{
      1:repeatSets(5,70,5),
      2:repeatSets(5,75,4),
      3:repeatSets(6,80,3),
      4:repeatSets(3,60,5),
      5:repeatSets(5,82.5,3,'82.5–85%'),
      6:[{pct:null,reps:3,pctLabel:'Top triple @ RPE 8'}, ...repeatSets(3,80,3)],
    },
    secondaryByLift:{
      Squat:{label:'POWER / SPEED',title:'Bench speed 6x2 @ 55-60% + Box Jump 3x3'},
      Bench:{label:'POWER / SPEED',title:'Push Press 5x3 @ RPE 6-7'},
      Deadlift:{label:'POWER / SPEED',title:'Squat speed 6x2 @ 55-60%'},
      Press:{label:'POWER / SPEED',title:'Power Clean 5x2 @ RPE 6-7'},
    },
    assistance:{
      Squat:['Split Squat 3x8','Abs 3x12'],
      Bench:['Row 4x8','Pullups 4 sets','Triceps 3x10'],
      Deadlift:['RDL 3x8','Ham Curl 3x12','Carry 4x40 yd'],
      Press:['Incline DB 3x10','Row 3x10','Curls 3x12'],
    },
    conditioning:(week,lift) => {
      if (lift === 'Squat') return 'Easy 10-15 min'
      if (lift === 'Press') return 'Short row/sled 8-10 min'
      return 'None'
    }
  },

  'reset-4': {
    name:'4 Week Reset',
    shortName:'4W Reset',
    dbName:'4 Week Reset',
    weeksCount:4,
    basis:'tm',
    description:'Simple restart/rebuild when current strength is uncertain or you want an easier re-entry.',
    phases:{1:'Reset',2:'Build',3:'Build',4:'Deload'},
    main:{
      1:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      2:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:3}],
      3:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:'1-3'}],
      4:[{pct:50,reps:5},{pct:60,reps:5},{pct:70,reps:5}],
    },
    secondary:{
      1:{label:'BACKOFF',title:'FSL 3x5 @ 65%',pct:65},
      2:{label:'BACKOFF',title:'FSL 3x5 @ 70%',pct:70},
      3:{label:'BACKOFF',title:'FSL 3x5 @ 75%',pct:75},
      4:{label:'BACKOFF',title:'2x5 @ 50%',pct:50},
    },
    rules:{1:'Cap RPE 7',2:'Cap RPE 8',3:'Cap RPE 8',4:'Deload'},
    assistance:{
      Squat:['DB Split Squat 3x8/leg','DB Row 4x10','Leg Raise 3x10'],
      Bench:['Incline DB Press 3x10','Pullups 4 sets','Triceps 3x12'],
      Deadlift:['RDL 3x8','Chest-Supported Row 3x10','Farmer Carry 4x40 yd'],
      Press:['DB Shoulder Press 3x10','Pullups 4 sets','Curls 3x12'],
    },
    conditioning:(week,lift) => {
      if (lift === 'Squat') return '10-15 min easy sled/carry or incline walk'
      if (lift === 'Press') return '8-12 min easy-moderate row/KB circuit'
      return 'None'
    }
  }
}

const programOrder = ['andy-hybrid-12','powerbuilding-8','strength-power-6','reset-4']
const dbNameToProgram = Object.fromEntries(Object.entries(programs).map(([id,p]) => [p.dbName,id]))
const defaultTms = { Squat:'', Bench:'', Deadlift:'', Press:'' }
const round5 = n => Math.round(n / 5) * 5

function targetWeight(tm, pct, basis) {
  if (!tm || pct == null) return null
  const base = basis === 'e1rm' ? tm / 0.85 : tm
  return round5(base * pct / 100)
}

function getProgramWeek(programId, week, lift) {
  const program = programs[programId] || programs['andy-hybrid-12']
  return {
    phase:program.phases[week],
    main:program.main[week] || [],
    secondary:program.secondary?.[week] || program.secondaryByLift?.[lift] || null,
    assistance:program.assistance[lift] || [],
    conditioning:program.conditioning(week,lift),
    rule:program.rules?.[week] || '',
  }
}

function makeLog(programId, week, lift, tm) {
  const program = programs[programId]
  const plan = getProgramWeek(programId,week,lift)
  const secondaryTarget = plan.secondary?.pct != null ? targetWeight(tm,plan.secondary.pct,program.basis) : ''

  return {
    version:6,
    main:plan.main.map(set => ({
      ...set,
      weight:set.pct != null ? targetWeight(tm,set.pct,program.basis) : '',
      actualReps:Number.parseInt(String(set.reps),10) || '',
      done:false,
    })),
    backoffWeight:secondaryTarget || '',
    backoffNote:'',
    assistance:plan.assistance.map(name => ({name,result:''})),
    conditioning:'',
    rpe:'',
    bodyweight:'',
    note:'',
    complete:false,
  }
}

function normalizeLog(saved, programId, week, lift, tm) {
  const base = makeLog(programId,week,lift,tm)
  if (!saved) return base
  return {
    ...base,
    ...saved,
    version:6,
    main:base.main.map((item,i) => ({...item,...(saved.main?.[i] || {})})),
    assistance:base.assistance.map((item,i) => ({...item,...(saved.assistance?.[i] || {})})),
  }
}

function e1rm(weight, reps) {
  const w = Number(weight || 0)
  const r = Number(reps || 0)
  if (!w || !r) return 0
  return w * (1 + r / 30)
}

function parseLoggedVolume(value) {
  if (!value) return 0
  const text = String(value).replace(/,/g,'').replace(/[×X]/g,'x')
  const match = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i)
  if (!match) return 0
  const weight = Number(match[1])
  const reps = Number(match[2])
  const sets = match[3] ? Number(match[3]) : 1
  return weight * reps * sets
}

function secondarySetsReps(title) {
  const match = String(title || '').match(/(\d+)\s*x\s*(\d+)/i)
  return match ? {sets:Number(match[1]),reps:Number(match[2])} : null
}

function metricsForWorkout(workout, programId, week, lift) {
  if (!workout) return {volume:0,estimated1rm:0,bestSet:null}
  const plan = getProgramWeek(programId,week,lift)
  let volume = 0
  let estimated1rm = 0
  let bestSet = null

  ;(workout.main || []).forEach(set => {
    const weight = Number(set.weight || 0)
    const reps = Number(set.actualReps || 0)
    if (weight && reps) {
      volume += weight * reps
      const estimate = e1rm(weight,reps)
      if (estimate > estimated1rm) {
        estimated1rm = estimate
        bestSet = {weight,reps}
      }
    }
  })

  const secondaryRx = secondarySetsReps(plan.secondary?.title)
  if (secondaryRx && Number(workout.backoffWeight || 0)) {
    volume += Number(workout.backoffWeight) * secondaryRx.reps * secondaryRx.sets
  } else {
    volume += parseLoggedVolume(workout.backoffNote)
  }

  ;(workout.assistance || []).forEach(item => {
    volume += parseLoggedVolume(item.result)
  })

  return {volume,estimated1rm,bestSet}
}

function metricsForRow(row) {
  const programId = dbNameToProgram[row.program] || 'andy-hybrid-12'
  return metricsForWorkout(row.workout,programId,row.week,row.lift)
}

function formatWeight(value) {
  return Math.round(Number(value || 0)).toLocaleString()
}

function buildProgress(history) {
  const completed = history
    .filter(row => row.completed_at)
    .sort((a,b) => new Date(a.completed_at) - new Date(b.completed_at))
    .map(row => ({...row,_metrics:metricsForRow(row)}))

  const now = Date.now()
  const withinDays = (row,days) => now - new Date(row.completed_at).getTime() <= days * 86400000
  const totalVolume = completed.reduce((sum,row) => sum + row._metrics.volume,0)
  const volume7 = completed.filter(r => withinDays(r,7)).reduce((sum,row) => sum + row._metrics.volume,0)
  const volume30 = completed.filter(r => withinDays(r,30)).reduce((sum,row) => sum + row._metrics.volume,0)

  const bodyRows = completed.filter(row => Number(row.workout?.bodyweight || 0))
  const latestBodyweight = bodyRows.at(-1)?.workout?.bodyweight || null

  const strength = {}
  lifts.forEach(lift => {
    const rows = completed.filter(row => row.lift === lift && row._metrics.estimated1rm > 0)
    if (!rows.length) {
      strength[lift] = null
      return
    }
    const first = rows[0]._metrics.estimated1rm
    const latest = rows.at(-1)._metrics.estimated1rm
    const best = Math.max(...rows.map(row => row._metrics.estimated1rm))
    const bestRow = rows.find(row => row._metrics.estimated1rm === best)
    strength[lift] = {
      first,
      latest,
      best,
      delta:latest-first,
      bestSet:bestRow?._metrics.bestSet || null,
    }
  })

  const weekly = Array.from({length:8},(_,i) => {
    const end = now - (7-i) * 7 * 86400000
    const start = end - 7 * 86400000
    const volume = completed
      .filter(row => {
        const t = new Date(row.completed_at).getTime()
        return t > start && t <= end
      })
      .reduce((sum,row) => sum + row._metrics.volume,0)
    return {label:i === 7 ? 'This week' : (7-i) + 'w ago',volume}
  })

  return {
    completed,
    totalVolume,
    volume7,
    volume30,
    latestBodyweight,
    strength,
    weekly,
  }
}

function randomJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)]
  return code
}

function NumericInput({value,onChange,placeholder,step=1}) {
  const adjust = delta => onChange(Math.max(0,Number(value || 0)+delta))
  return (
    <div className="numeric">
      <button type="button" onClick={() => adjust(-step)}>−{step}</button>
      <input
        type="number"
        inputMode="decimal"
        enterKeyHint="done"
        value={value}
        placeholder={placeholder || '0'}
        onFocus={e => e.currentTarget.select()}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <button type="button" onClick={() => adjust(step)}>+{step}</button>
    </div>
  )
}

function AuthScreen() {
  const [mode,setMode] = useState('signin')
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    if (mode === 'signup') {
      const {error} = await supabase.auth.signUp({
        email,
        password,
        options:{
          emailRedirectTo:window.location.origin,
          data:{display_name:name.trim() || email.split('@')[0],active_program:'andy-hybrid-12'}
        }
      })
      setMessage(error ? error.message : 'Account created. Check your email if confirmation is required.')
    } else {
      const {error} = await supabase.auth.signInWithPassword({email,password})
      if (error) setMessage(error.message)
    }

    setBusy(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">WORKOUTBOARD</div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-sub">Your program, weights, maxes, and history are saved to your account.</p>
        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' && <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Andy, Tracey, Myra…" required /></label>}
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength="6" required /></label>
          <button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        {message && <div className="auth-message">{message}</div>}
      </section>
    </main>
  )
}

function App() {
  const [session,setSession] = useState(null)
  const [authLoading,setAuthLoading] = useState(true)
  const [dataLoading,setDataLoading] = useState(true)
  const [activeTab,setActiveTab] = useState('today')
  const [profile,setProfile] = useState(null)
  const [activeProgram,setActiveProgram] = useState('andy-hybrid-12')
  const [week,setWeek] = useState(1)
  const [lift,setLift] = useState('Squat')
  const [trainingMaxes,setTrainingMaxes] = useState(defaultTms)
  const [history,setHistory] = useState([])
  const [saveState,setSaveState] = useState('Saved')
  const [inviteState,setInviteState] = useState('')
  const [log,setLog] = useState(() => makeLog('andy-hybrid-12',1,'Squat',0))

  const [togetherReady,setTogetherReady] = useState(null)
  const [activeSession,setActiveSession] = useState(null)
  const [participants,setParticipants] = useState([])
  const [sessionResults,setSessionResults] = useState([])
  const [joinCode,setJoinCode] = useState('')
  const [togetherMessage,setTogetherMessage] = useState('')
  const [sharedWorkoutActive,setSharedWorkoutActive] = useState(false)

  const personalProgram = programs[activeProgram]
  const sharedProgramId = activeSession ? (dbNameToProgram[activeSession.program] || activeProgram) : activeProgram
  const workoutProgramId = sharedWorkoutActive && activeSession ? sharedProgramId : activeProgram
  const workoutProgram = programs[workoutProgramId]
  const plan = getProgramWeek(workoutProgramId,week,lift)
  const tm = Number(trainingMaxes[lift] || 0)

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const {data:listener} = supabase.auth.onAuthStateChange((_event,nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  },[])

  const loadOpenSession = async userId => {
    const {data:memberships,error} = await supabase
      .from('session_participants')
      .select('session_id,joined_at')
      .eq('user_id',userId)
      .order('joined_at',{ascending:false})
      .limit(10)

    if (error) {
      setTogetherReady(false)
      return
    }

    setTogetherReady(true)
    if (!memberships?.length) return

    const ids = memberships.map(item => item.session_id)
    const {data:sessions} = await supabase
      .from('shared_sessions')
      .select('*')
      .in('id',ids)
      .eq('status','open')
      .order('created_at',{ascending:false})
      .limit(1)

    if (sessions?.[0]) setActiveSession(sessions[0])
  }

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false

    const load = async () => {
      setDataLoading(true)
      const userId = session.user.id
      const [{data:profileData},{data:tmData},{data:logsData}] = await Promise.all([
        supabase.from('profiles').select('*').eq('id',userId).single(),
        supabase.from('training_maxes').select('*').eq('user_id',userId).single(),
        supabase.from('workout_logs').select('*').eq('user_id',userId).order('updated_at',{ascending:false}),
      ])

      if (cancelled) return

      const rows = logsData || []
      const metaProgram = session.user.user_metadata?.active_program
      const latestProgram = rows[0]?.program ? dbNameToProgram[rows[0].program] : null
      const chosenProgram = programs[metaProgram] ? metaProgram : latestProgram || 'andy-hybrid-12'
      const chosen = programs[chosenProgram]
      const currentWeek = Math.min(profileData?.current_week || 1,chosen.weeksCount)

      setProfile(profileData)
      setActiveProgram(chosenProgram)
      setWeek(currentWeek)
      setHistory(rows)

      if (tmData) {
        setTrainingMaxes({
          Squat:tmData.squat ?? '',
          Bench:tmData.bench ?? '',
          Deadlift:tmData.deadlift ?? '',
          Press:tmData.press ?? '',
        })
      }

      const completed = new Set(rows.filter(r => r.program === chosen.dbName && r.week === currentWeek && r.completed_at).map(r => r.lift))
      setLift(lifts.find(x => !completed.has(x)) || 'Press')
      setDataLoading(false)
      loadOpenSession(userId)
    }

    load()
    return () => { cancelled = true }
  },[session?.user?.id])

  const personalRows = useMemo(
    () => history.filter(row => row.program === personalProgram.dbName),
    [history,personalProgram.dbName]
  )

  const workoutRows = useMemo(
    () => history.filter(row => row.program === workoutProgram.dbName),
    [history,workoutProgram.dbName]
  )

  useEffect(() => {
    if (!session?.user || dataLoading) return
    const found = workoutRows.find(row => row.week === week && row.lift === lift)
    setLog(normalizeLog(found?.workout || null,workoutProgramId,week,lift,tm))
    setSaveState('Saved')
  },[workoutProgramId,week,lift,workoutRows,tm,dataLoading,session?.user?.id])

  const completedByWeek = useMemo(() => {
    const map = {}
    personalRows.filter(r => r.completed_at).forEach(r => {
      map[r.week] ||= new Set()
      map[r.week].add(r.lift)
    })
    return map
  },[personalRows])

  const completedHistory = useMemo(
    () => history.filter(r => r.completed_at).sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at))),
    [history]
  )

  const progress = useMemo(() => buildProgress(history),[history])

  const previousWorkout = useMemo(() => {
    const rows = workoutRows.filter(r => r.lift === lift && r.completed_at).sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    return rows.find(r => !(r.week === week && r.lift === lift))?.workout || null
  },[workoutRows,lift,week])

  const refreshTogether = async sessionId => {
    if (!sessionId) return
    const [{data:sessionData},{data:people},{data:results}] = await Promise.all([
      supabase.from('shared_sessions').select('*').eq('id',sessionId).single(),
      supabase.from('session_participants').select('*').eq('session_id',sessionId).order('joined_at'),
      supabase.from('session_results').select('*').eq('session_id',sessionId).order('updated_at',{ascending:false}),
    ])
    if (sessionData) setActiveSession(sessionData)
    setParticipants(people || [])
    setSessionResults(results || [])
  }

  useEffect(() => {
    if (!activeSession?.id || togetherReady !== true) return
    refreshTogether(activeSession.id)
    const timer = setInterval(() => refreshTogether(activeSession.id),5000)
    return () => clearInterval(timer)
  },[activeSession?.id,togetherReady])

  const updateMain = (i,field,value) => {
    setSaveState('Unsaved')
    setLog(v => ({...v,complete:false,main:v.main.map((set,idx) => idx === i ? {...set,[field]:value} : set)}))
  }

  const saveTrainingMaxes = async next => {
    setTrainingMaxes(next)
    if (!session?.user) return
    await supabase.from('training_maxes').upsert({
      user_id:session.user.id,
      squat:next.Squat === '' ? null : Number(next.Squat),
      bench:next.Bench === '' ? null : Number(next.Bench),
      deadlift:next.Deadlift === '' ? null : Number(next.Deadlift),
      press:next.Press === '' ? null : Number(next.Press),
      updated_at:new Date().toISOString(),
    })
  }

  const setTm = (name,raw) => {
    const value = raw === '' ? '' : Math.max(0,Number(raw))
    saveTrainingMaxes({...trainingMaxes,[name]:value})
  }

  const usePrevious = i => {
    const prev = previousWorkout?.main?.[i]
    if (!prev) return
    setSaveState('Unsaved')
    setLog(v => ({
      ...v,
      complete:false,
      main:v.main.map((set,idx) => idx === i ? {...set,weight:prev.weight,actualReps:prev.actualReps} : set)
    }))
  }

  const saveSharedResult = async payload => {
    if (!activeSession?.id || !session?.user || !sharedWorkoutActive) return
    const metrics = metricsForWorkout(payload,workoutProgramId,week,lift)
    await supabase.from('session_results').upsert({
      session_id:activeSession.id,
      user_id:session.user.id,
      workout:payload,
      total_volume:Math.round(metrics.volume),
      estimated_1rm:metrics.estimated1rm || null,
      completed_at:payload.complete ? payload.savedAt : null,
      updated_at:new Date().toISOString(),
    },{onConflict:'session_id,user_id'})
  }

  const saveWorkout = async (complete=false) => {
    if (!session?.user) return null
    setSaveState('Saving…')
    const now = new Date().toISOString()
    const payload = {...log,complete,savedAt:now,week,lift,phase:plan.phase,program:workoutProgram.name}

    const {data,error} = await supabase.from('workout_logs').upsert({
      user_id:session.user.id,
      program:workoutProgram.dbName,
      week,
      lift,
      workout_date:new Date().toISOString().slice(0,10),
      workout:payload,
      completed_at:complete ? now : null,
      updated_at:now,
    },{onConflict:'user_id,program,week,lift'}).select().single()

    if (error || !data) {
      setSaveState('Save failed')
      return null
    }

    await saveSharedResult(payload)

    // Platform v2 dual-write. If the new tables are not deployed yet, legacy saving still succeeds.
    const workoutMetrics = metricsForWorkout(payload,workoutProgramId,week,lift)
    const {data:durableSession} = await supabase.from('training_sessions').upsert({
      legacy_log_id:data.id,
      user_id:session.user.id,
      shared_session_id:sharedWorkoutActive && activeSession ? activeSession.id : null,
      title:lift + ' Day',
      program:workoutProgram.dbName,
      week,
      primary_lift:lift,
      session_date:new Date().toISOString().slice(0,10),
      workout:payload,
      total_volume:Math.round(workoutMetrics.volume),
      estimated_1rm:workoutMetrics.estimated1rm || null,
      bodyweight:Number(payload.bodyweight || 0) || null,
      started_at:data.created_at || now,
      completed_at:complete ? now : null,
      updated_at:now,
    },{onConflict:'legacy_log_id'}).select().maybeSingle()

    if (complete && durableSession && profile?.community_opt_in) {
      await supabase.from('community_activity').upsert({
        user_id:session.user.id,
        training_session_id:durableSession.id,
        display_name:profile?.community_display_name || profile?.display_name || session.user.email?.split('@')[0] || 'Member',
        activity_date:new Date().toISOString().slice(0,10),
        title:lift + ' Day',
        summary:{
          lift,
          program:workoutProgram.name,
          volume:Math.round(workoutMetrics.volume),
          estimated_1rm:workoutMetrics.estimated1rm || null,
          bodyweight:profile?.community_share_bodyweight ? (Number(payload.bodyweight || 0) || null) : null
        }
      },{onConflict:'training_session_id'})
    }

    setLog(payload)
    setHistory(rows => [data,...rows.filter(row => row.id !== data.id && !(row.program === workoutProgram.dbName && row.week === week && row.lift === lift))])
    setSaveState('Saved')
    return data
  }

  useEffect(() => {
    if (!session?.user || dataLoading || saveState !== 'Unsaved') return
    const timer = setTimeout(() => saveWorkout(false),900)
    return () => clearTimeout(timer)
  },[log,session?.user?.id,dataLoading,saveState,sharedWorkoutActive,activeSession?.id])

  const changeWeek = async nextWeek => {
    const safeWeek = Math.max(1,Math.min(Number(nextWeek),personalProgram.weeksCount))
    setWeek(safeWeek)
    if (!session?.user || sharedWorkoutActive) return
    await supabase.from('profiles').update({current_week:safeWeek,updated_at:new Date().toISOString()}).eq('id',session.user.id)
    setProfile(v => v ? {...v,current_week:safeWeek} : v)
  }

  const chooseProgram = async programId => {
    if (!programs[programId] || programId === activeProgram) {
      setActiveTab('today')
      return
    }
    setSharedWorkoutActive(false)
    setSaveState('Saved')
    setActiveProgram(programId)
    setWeek(1)
    setLift('Squat')
    setActiveTab('today')

    if (session?.user) {
      await Promise.all([
        supabase.auth.updateUser({data:{...session.user.user_metadata,active_program:programId}}),
        supabase.from('profiles').update({current_week:1,updated_at:new Date().toISOString()}).eq('id',session.user.id)
      ])
      setProfile(v => v ? {...v,current_week:1} : v)
    }
  }

  const restorePersonalWorkout = () => {
    const personalWeek = Math.min(profile?.current_week || 1,personalProgram.weeksCount)
    const completed = new Set(personalRows.filter(r => r.week === personalWeek && r.completed_at).map(r => r.lift))
    setSharedWorkoutActive(false)
    setWeek(personalWeek)
    setLift(lifts.find(x => !completed.has(x)) || 'Press')
  }

  const finishWorkout = async () => {
    const saved = await saveWorkout(true)
    if (!saved) return

    if (sharedWorkoutActive && activeSession) {
      await refreshTogether(activeSession.id)
      restorePersonalWorkout()
      setActiveTab('together')
      return
    }

    const completed = new Set([...(completedByWeek[week] ? Array.from(completedByWeek[week]) : []),lift])
    const nextLift = lifts.find(x => !completed.has(x))

    if (nextLift) {
      setLift(nextLift)
      return
    }

    if (week < personalProgram.weeksCount) {
      const nextWeek = week + 1
      await changeWeek(nextWeek)
      setLift('Squat')
    }
  }

  const saveDisplayName = async name => {
    if (!session?.user) return
    const clean = name.trim()
    if (!clean) return
    await supabase.from('profiles').update({display_name:clean,updated_at:new Date().toISOString()}).eq('id',session.user.id)
    setProfile(v => ({...v,display_name:clean}))
  }

  const jumpToWorkout = (programId,targetWeek,targetLift='Squat') => {
    setSharedWorkoutActive(false)
    const nextProgram = programs[programId] ? programId : activeProgram
    setSaveState('Saved')
    setActiveProgram(nextProgram)
    setWeek(Number(targetWeek))
    setLift(targetLift)
    setActiveTab('today')
  }

  const shareInvite = async () => {
    const url = window.location.origin
    const data = {title:'WorkoutBoard',text:'Join me on WorkoutBoard. Create your own account and track your workouts.',url}
    try {
      if (navigator.share) {
        await navigator.share(data)
        setInviteState('Invite opened')
      } else {
        await navigator.clipboard.writeText(url)
        setInviteState('Invite link copied')
      }
    } catch {
      setInviteState(url)
    }
  }

  const createTogetherSession = async () => {
    if (!session?.user || togetherReady === false) return
    setTogetherMessage('Creating session…')

    let created = null
    for (let attempt=0; attempt<4 && !created; attempt++) {
      const code = randomJoinCode()
      const {data,error} = await supabase.from('shared_sessions').insert({
        join_code:code,
        host_user_id:session.user.id,
        program:personalProgram.dbName,
        week:Math.min(profile?.current_week || week,personalProgram.weeksCount),
        lift,
        status:'open',
      }).select().single()
      if (!error) created = data
    }

    if (!created) {
      setTogetherMessage('Could not create the session. Try again.')
      return
    }

    const displayName = profile?.display_name || session.user.email?.split('@')[0] || 'You'
    await supabase.from('session_participants').insert({
      session_id:created.id,
      user_id:session.user.id,
      display_name:displayName,
    })

    setTogetherReady(true)
    setActiveSession(created)
    setTogetherMessage('')
    await refreshTogether(created.id)
  }

  const joinTogetherSession = async () => {
    if (!session?.user || !joinCode.trim()) return
    setTogetherMessage('Joining…')
    const code = joinCode.trim().toUpperCase()

    const {data:found,error} = await supabase
      .from('shared_sessions')
      .select('*')
      .eq('join_code',code)
      .eq('status','open')
      .single()

    if (error || !found) {
      setTogetherMessage('No open session found with that code.')
      return
    }

    const displayName = profile?.display_name || session.user.email?.split('@')[0] || 'You'
    const {error:joinError} = await supabase.from('session_participants').upsert({
      session_id:found.id,
      user_id:session.user.id,
      display_name:displayName,
    },{onConflict:'session_id,user_id'})

    if (joinError) {
      setTogetherMessage(joinError.message)
      return
    }

    setActiveSession(found)
    setJoinCode('')
    setTogetherMessage('')
    await refreshTogether(found.id)
  }

  const openSharedWorkout = () => {
    if (!activeSession) return
    const programId = dbNameToProgram[activeSession.program] || 'andy-hybrid-12'
    setSharedWorkoutActive(true)
    setWeek(activeSession.week)
    setLift(activeSession.lift)
    setSaveState('Saved')
    setActiveTab('today')
    const found = history.find(row => row.program === programs[programId].dbName && row.week === activeSession.week && row.lift === activeSession.lift)
    setLog(normalizeLog(found?.workout || null,programId,activeSession.week,activeSession.lift,Number(trainingMaxes[activeSession.lift] || 0)))
  }

  const shareSession = async () => {
    if (!activeSession) return
    const text = 'Join my WorkoutBoard session with code ' + activeSession.join_code
    try {
      if (navigator.share) await navigator.share({title:'WorkoutBoard Together',text,url:window.location.origin})
      else {
        await navigator.clipboard.writeText(text + ' — ' + window.location.origin)
        setTogetherMessage('Session code and link copied.')
      }
    } catch {
      setTogetherMessage(text)
    }
  }

  const endTogetherSession = async () => {
    if (!activeSession || activeSession.host_user_id !== session?.user?.id) return
    await supabase.from('shared_sessions').update({
      status:'completed',
      completed_at:new Date().toISOString()
    }).eq('id',activeSession.id)
    await refreshTogether(activeSession.id)
  }

  const leaveTogetherView = () => {
    restorePersonalWorkout()
    setActiveSession(null)
    setParticipants([])
    setSessionResults([])
    setTogetherMessage('')
  }

  const secondary = plan.secondary
  const secondaryTarget = secondary?.pct != null ? targetWeight(tm,secondary.pct,workoutProgram.basis) : null
  const displayName = profile?.display_name || session?.user?.email?.split('@')[0] || 'You'
  const ownSessionResult = sessionResults.find(result => result.user_id === session?.user?.id)
  const combinedSessionVolume = sessionResults.reduce((sum,result) => sum + Number(result.total_volume || 0),0)
  const maxWeeklyVolume = Math.max(1,...progress.weekly.map(item => item.volume))

  if (authLoading) return <div className="loading-screen">Loading WorkoutBoard…</div>
  if (!session) return <AuthScreen />

  return (
    <>
      <main className="app">
        <header className="app-header">
          <div>
            <div className="eyebrow">WORKOUTBOARD</div>
            <h1>{activeTab === 'today' ? 'Today' : activeTab === 'together' ? 'Together' : activeTab === 'progress' ? 'Progress' : activeTab === 'program' ? 'Plan' : activeTab[0].toUpperCase() + activeTab.slice(1)}</h1>
          </div>
          <div className="mini-user">{displayName}</div>
        </header>

        {dataLoading ? (
          <div className="loading-card">Loading your workouts…</div>
        ) : activeTab === 'today' ? (
          <>
            {sharedWorkoutActive && activeSession && (
              <section className="together-banner">
                <div><span>WORKOUT TOGETHER</span><strong>Code {activeSession.join_code}</strong></div>
                <button onClick={() => setActiveTab('together')}>{participants.length} people</button>
              </section>
            )}

            <section className="today-card">
              <div>
                <span className="card-label">{workoutProgram.shortName}</span>
                <h2>{lift} Day</h2>
                <p>Week {week} · {plan.phase} · {dayNames[lift]}</p>
                {plan.rule && <p className="rule-text">{plan.rule}</p>}
              </div>
              {!sharedWorkoutActive && <div className="progress-badge">{completedByWeek[week]?.size || 0}/4 done</div>}
            </section>

            {!sharedWorkoutActive && (
              <details className="change-workout">
                <summary>Change workout</summary>
                <div className="selectors">
                  <label><span>Week</span>
                    <select value={week} onChange={e => setWeek(Number(e.target.value))}>
                      {Array.from({length:personalProgram.weeksCount},(_,i) => i+1).map(w => <option key={w} value={w}>Week {w}</option>)}
                    </select>
                  </label>
                  <label><span>Workout</span>
                    <select value={lift} onChange={e => setLift(e.target.value)}>
                      {lifts.map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                </div>
              </details>
            )}

            {!tm && <div className="hint"><strong>No {lift} training max yet.</strong><span>Add it under Me → Training Maxes, or type working weights directly.</span></div>}

            <section className="exercise-card">
              <div className="exercise-title">
                <div><span>MAIN LIFT</span><h2>{lift}</h2></div>
                {previousWorkout && <small>Tap “Last” to reuse your previous set.</small>}
              </div>
              <div className="column-head"><span>SET / TARGET</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div>

              {log.main.map((set,i) => {
                const target = targetWeight(tm,set.pct,workoutProgram.basis)
                const prev = previousWorkout?.main?.[i]
                return (
                  <div className={'set-row ' + (set.done ? 'completed' : '')} key={i}>
                    <div className="set-meta">
                      <strong>Set {i+1}</strong>
                      <span>{set.pctLabel || (set.pct != null ? set.pct + '%' : '')} × {set.reps}</span>
                      {target && <small>Target {target} lb</small>}
                      {prev && <button className="previous" type="button" onClick={() => usePrevious(i)}>Last {prev.weight || '—'} × {prev.actualReps || '—'}</button>}
                    </div>
                    <NumericInput value={set.weight} placeholder={target ? String(target) : 'lb'} step={5} onChange={v => updateMain(i,'weight',v)} />
                    <input className="reps-input" type="number" inputMode="numeric" value={set.actualReps}
                      onFocus={e => e.currentTarget.select()}
                      onChange={e => updateMain(i,'actualReps',e.target.value === '' ? '' : Number(e.target.value))} />
                    <button type="button" className={'check ' + (set.done ? 'checked' : '')} onClick={() => updateMain(i,'done',!set.done)}>✓</button>
                  </div>
                )
              })}
            </section>

            {secondary && (
              <section className="simple-card">
                <div className="section-heading">
                  <div><span className="card-label">{secondary.label}</span><h3>{secondary.title}</h3></div>
                  {secondaryTarget && <strong className="target-pill">{secondaryTarget} lb</strong>}
                </div>
                {secondary.pct != null && (
                  <label className="field-label"><span>Working weight</span>
                    <NumericInput value={log.backoffWeight} placeholder={secondaryTarget ? String(secondaryTarget) : 'lb'} step={5}
                      onChange={v => {setSaveState('Unsaved');setLog(x => ({...x,complete:false,backoffWeight:v}))}} />
                  </label>
                )}
                <input className="text-input" placeholder={secondary.pct != null ? 'Optional note, e.g. all sets completed' : 'What you did / weight / reps'}
                  value={log.backoffNote}
                  onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,backoffNote:e.target.value}))}} />
              </section>
            )}

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">ASSISTANCE</span><h3>Write it like the board</h3></div></div>
              {log.assistance.map((item,i) => (
                <label className="assist" key={item.name}><span>{item.name}</span>
                  <input placeholder="weight × reps × sets" value={item.result}
                    onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,assistance:v.assistance.map((x,idx) => idx === i ? {...x,result:e.target.value} : x)}))}} />
                </label>
              ))}
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">CONDITIONING</span><h3>{plan.conditioning}</h3></div></div>
              <input className="text-input" placeholder="Time / rounds / distance" value={log.conditioning}
                onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,conditioning:e.target.value}))}} />
            </section>

            <section className="metrics">
              <label><span>Workout RPE</span><input type="number" inputMode="decimal" placeholder="1-10" value={log.rpe}
                onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,rpe:e.target.value}))}} /></label>
              <label><span>Bodyweight</span><input type="number" inputMode="decimal" placeholder="lb" value={log.bodyweight}
                onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,bodyweight:e.target.value}))}} /></label>
            </section>

            <textarea className="notes" placeholder="Quick workout note…" value={log.note}
              onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,note:e.target.value}))}} />

            <div className="save-line">● {saveState}</div>
            <div className="finish-wrap">
              <button className={'finish ' + (log.complete ? 'done' : '')} onClick={finishWorkout}>
                {log.complete ? '✓ WORKOUT FINISHED' : sharedWorkoutActive ? 'FINISH MY SHARED WORKOUT' : 'FINISH WORKOUT'}
              </button>
            </div>
          </>
        ) : activeTab === 'together' ? (
          <section className="page-section">
            {togetherReady === false ? (
              <div className="setup-needed">
                <span className="card-label">ONE DATABASE UPDATE NEEDED</span>
                <h2>Enable Workout Together</h2>
                <p>The app code is ready. Run the new shared-workouts SQL migration in Supabase once, then refresh.</p>
              </div>
            ) : !activeSession ? (
              <>
                <section className="together-start-card">
                  <span className="card-label">START TOGETHER</span>
                  <h2>{personalProgram.shortName}</h2>
                  <p>Week {profile?.current_week || week} · {lift} Day</p>
                  <button className="primary-action" onClick={createTogetherSession}>Create join code</button>
                </section>

                <section className="together-start-card">
                  <span className="card-label">JOIN SOMEONE</span>
                  <h2>Enter their code</h2>
                  <div className="join-row">
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength="6" placeholder="ABC123" />
                    <button onClick={joinTogetherSession}>Join</button>
                  </div>
                  {togetherMessage && <p className="status-message">{togetherMessage}</p>}
                </section>
              </>
            ) : (
              <>
                <section className="session-hero">
                  <span className="card-label">{activeSession.status === 'open' ? 'LIVE SESSION' : 'SESSION SUMMARY'}</span>
                  <div className="session-code">{activeSession.join_code}</div>
                  <h2>{programs[sharedProgramId]?.shortName || activeSession.program}</h2>
                  <p>Week {activeSession.week} · {activeSession.lift}</p>
                  <div className="session-actions">
                    {activeSession.status === 'open' && <button onClick={shareSession}>Share code</button>}
                    <button onClick={() => refreshTogether(activeSession.id)}>Refresh</button>
                  </div>
                </section>

                <section className="summary-grid together-summary">
                  <div><span>People</span><strong>{participants.length}</strong></div>
                  <div><span>Finished</span><strong>{sessionResults.filter(r => r.completed_at).length}</strong></div>
                  <div><span>Combined volume</span><strong>{formatWeight(combinedSessionVolume)} lb</strong></div>
                </section>

                <section className="simple-card">
                  <div className="section-heading"><div><span className="card-label">PARTNERS</span><h3>Live results</h3></div></div>
                  <div className="partner-list">
                    {participants.map(person => {
                      const result = sessionResults.find(r => r.user_id === person.user_id)
                      return (
                        <div className="partner-row" key={person.user_id}>
                          <div>
                            <strong>{person.display_name}{person.user_id === session.user.id ? ' (You)' : ''}</strong>
                            <span>{result?.completed_at ? 'Finished' : result ? 'Working' : 'Not started'}</span>
                          </div>
                          <div>
                            <strong>{result ? formatWeight(result.total_volume) + ' lb' : '—'}</strong>
                            <span>{result?.estimated_1rm ? 'e1RM ' + formatWeight(result.estimated_1rm) : ''}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {activeSession.status === 'open' && !ownSessionResult?.completed_at && (
                  <button className="primary-action" onClick={openSharedWorkout}>Open my shared workout</button>
                )}

                {ownSessionResult?.completed_at && (
                  <div className="completed-callout">✓ Your workout is finished. Your personal history and this shared summary both have it.</div>
                )}

                {activeSession.host_user_id === session.user.id && activeSession.status === 'open' && (
                  <button className="secondary-action danger-lite" onClick={endTogetherSession}>End shared session</button>
                )}

                <button className="secondary-action" onClick={leaveTogetherView}>Leave this view</button>
                {togetherMessage && <p className="status-message">{togetherMessage}</p>}
              </>
            )}
          </section>
        ) : activeTab === 'progress' ? (
          <PlatformProgress
            session={session}
            profile={profile}
            setProfile={setProfile}
            progress={progress}
            lifts={lifts}
            formatWeight={formatWeight}
            programs={programs}
            dbNameToProgram={dbNameToProgram}
          />
        ) : activeTab === 'program' ? (
          <PlanPage
            session={session}
            profile={profile}
            programs={programs}
            programOrder={programOrder}
            activeProgram={activeProgram}
            chooseProgram={chooseProgram}
            completedByWeek={completedByWeek}
            week={week}
            lifts={lifts}
            jumpToWorkout={jumpToWorkout}
          />
        ) : (
          <section className="page-section">
            <section className="profile-card">
              <span className="card-label">ACCOUNT</span>
              <h2>{displayName}</h2>
              <p>{session.user.email}</p>
              <label>Display name<input defaultValue={displayName} onBlur={e => saveDisplayName(e.target.value)} /></label>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">TRAINING MAXES</span><h3>Your current numbers</h3></div></div>
              <p className="helper-text">Enter your normal 85% training max. Powerbuilding and Strength + Power convert it internally for e1RM-based percentages.</p>
              <div className="tm-grid">
                {lifts.map(x => (
                  <label key={x}><span>{x}</span>
                    <div className="input-with-unit">
                      <input type="number" inputMode="decimal" value={trainingMaxes[x] || ''} placeholder="0"
                        onFocus={e => e.currentTarget.select()}
                        onChange={e => setTm(x,e.target.value)} />
                      <b>lb</b>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">CURRENT PROGRAM</span><h3>{personalProgram.name}</h3></div></div>
              <button className="wide-button" onClick={() => setActiveTab('program')}>Plan & programs</button>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">INVITE</span><h3>Invite someone</h3></div></div>
              <p className="helper-text">Tracey, Myra, or anyone else gets their own account, program, maxes, history, and progress dashboard.</p>
              <button className="wide-button invite-button" onClick={shareInvite}>Share WorkoutBoard</button>
              {inviteState && <div className="invite-status">{inviteState}</div>}
            </section>

            <button className="signout-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </section>
        )}

        <div className="bottom-space" />
      </main>

      <nav className="bottom-nav five">
        <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}><b>●</b><span>Today</span></button>
        <button className={activeTab === 'together' ? 'active' : ''} onClick={() => setActiveTab('together')}><b>⇄</b><span>Together</span></button>
        <button className={activeTab === 'progress' ? 'active' : ''} onClick={() => setActiveTab('progress')}><b>↗</b><span>Progress</span></button>
        <button className={activeTab === 'program' ? 'active' : ''} onClick={() => setActiveTab('program')}><b>▦</b><span>Plan</span></button>
        <button className={activeTab === 'me' ? 'active' : ''} onClick={() => setActiveTab('me')}><b>☺</b><span>Me</span></button>
      </nav>
    </>
  )
}

export default App
