import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

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
  const program = programs[programId]
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
  const plan = getProgramWeek(programId, week, lift)
  const secondaryTarget = plan.secondary?.pct != null ? targetWeight(tm, plan.secondary.pct, program.basis) : ''

  return {
    version:5,
    main:plan.main.map(set => ({
      ...set,
      weight:set.pct != null ? targetWeight(tm, set.pct, program.basis) : '',
      actualReps:Number.parseInt(String(set.reps),10) || '',
      done:false,
    })),
    backoffWeight:secondaryTarget || '',
    backoffNote:'',
    assistance:plan.assistance.map(name => ({ name, result:'' })),
    conditioning:'',
    rpe:'',
    bodyweight:'',
    note:'',
    complete:false,
  }
}

function normalizeLog(saved, programId, week, lift, tm) {
  const base = makeLog(programId, week, lift, tm)
  if (!saved) return base
  return {
    ...base,
    ...saved,
    version:5,
    main:base.main.map((item,i) => ({ ...item, ...(saved.main?.[i] || {}) })),
    assistance:base.assistance.map((item,i) => ({ ...item, ...(saved.assistance?.[i] || {}) })),
  }
}

function NumericInput({ value, onChange, placeholder, step=1 }) {
  const adjust = delta => onChange(Math.max(0, Number(value || 0) + delta))
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options:{
          emailRedirectTo:window.location.origin,
          data:{ display_name:name.trim() || email.split('@')[0], active_program:'andy-hybrid-12' }
        }
      })
      setMessage(error ? error.message : 'Account created. Check your email if confirmation is required.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email,password })
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

  const program = programs[activeProgram]
  const plan = getProgramWeek(activeProgram,week,lift)
  const tm = Number(trainingMaxes[lift] || 0)

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data:listener } = supabase.auth.onAuthStateChange((_event,nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  },[])

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
      const currentWeek = Math.min(profileData?.current_week || 1, chosen.weeksCount)

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
    }

    load()
    return () => { cancelled = true }
  },[session?.user?.id])

  const activeRows = useMemo(
    () => history.filter(row => row.program === program.dbName),
    [history,program.dbName]
  )

  useEffect(() => {
    if (!session?.user || dataLoading) return
    const found = activeRows.find(row => row.week === week && row.lift === lift)
    setLog(normalizeLog(found?.workout || null,activeProgram,week,lift,tm))
    setSaveState('Saved')
  },[activeProgram,week,lift,activeRows,tm,dataLoading,session?.user?.id])

  const completedByWeek = useMemo(() => {
    const map = {}
    activeRows.filter(r => r.completed_at).forEach(r => {
      map[r.week] ||= new Set()
      map[r.week].add(r.lift)
    })
    return map
  },[activeRows])

  const completedHistory = useMemo(
    () => history.filter(r => r.completed_at).sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at))),
    [history]
  )

  const previousWorkout = useMemo(() => {
    const rows = activeRows.filter(r => r.lift === lift && r.completed_at).sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    return rows.find(r => !(r.week === week && r.lift === lift))?.workout || null
  },[activeRows,lift,week])

  const updateMain = (i,field,value) => {
    setSaveState('Unsaved')
    setLog(v => ({ ...v,complete:false,main:v.main.map((set,idx) => idx === i ? {...set,[field]:value} : set) }))
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

  const saveWorkout = async (complete=false) => {
    if (!session?.user) return null
    setSaveState('Saving…')
    const now = new Date().toISOString()
    const payload = { ...log,complete,savedAt:now,week,lift,phase:plan.phase,program:program.name }

    const {data,error} = await supabase.from('workout_logs').upsert({
      user_id:session.user.id,
      program:program.dbName,
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

    setLog(payload)
    setHistory(rows => [data,...rows.filter(row => row.id !== data.id && !(row.program === program.dbName && row.week === week && row.lift === lift))])
    setSaveState('Saved')
    return data
  }

  useEffect(() => {
    if (!session?.user || dataLoading || saveState !== 'Unsaved') return
    const timer = setTimeout(() => saveWorkout(false),900)
    return () => clearTimeout(timer)
  },[log,session?.user?.id,dataLoading,saveState])

  const changeWeek = async nextWeek => {
    const safeWeek = Math.max(1,Math.min(Number(nextWeek),program.weeksCount))
    setWeek(safeWeek)
    if (!session?.user) return
    await supabase.from('profiles').update({current_week:safeWeek,updated_at:new Date().toISOString()}).eq('id',session.user.id)
    setProfile(v => v ? {...v,current_week:safeWeek} : v)
  }

  const chooseProgram = async programId => {
    if (!programs[programId] || programId === activeProgram) {
      setActiveTab('today')
      return
    }

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

  const finishWorkout = async () => {
    const saved = await saveWorkout(true)
    if (!saved) return

    const completed = new Set([...(completedByWeek[week] ? Array.from(completedByWeek[week]) : []),lift])
    const nextLift = lifts.find(x => !completed.has(x))

    if (nextLift) {
      setLift(nextLift)
      return
    }

    if (week < program.weeksCount) {
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
    const nextProgram = programs[programId] ? programId : activeProgram
    setSaveState('Saved')
    setActiveProgram(nextProgram)
    setWeek(Number(targetWeek))
    setLift(targetLift)
    setActiveTab('today')
  }

  const shareInvite = async () => {
    const url = window.location.origin
    const data = {
      title:'WorkoutBoard',
      text:'Join me on WorkoutBoard. Create your own account and track your own workouts.',
      url
    }
    try {
      if (navigator.share) {
        await navigator.share(data)
        setInviteState('Invite opened')
      } else {
        await navigator.clipboard.writeText(url)
        setInviteState('Invite link copied')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        setInviteState('Invite link copied')
      } catch {
        setInviteState(url)
      }
    }
  }

  const secondary = plan.secondary
  const secondaryTarget = secondary?.pct != null ? targetWeight(tm,secondary.pct,program.basis) : null

  if (authLoading) return <div className="loading-screen">Loading WorkoutBoard…</div>
  if (!session) return <AuthScreen />

  const displayName = profile?.display_name || session.user.email?.split('@')[0] || 'You'

  return (
    <>
      <main className="app">
        <header className="app-header">
          <div>
            <div className="eyebrow">WORKOUTBOARD</div>
            <h1>{activeTab === 'today' ? 'Today' : activeTab[0].toUpperCase() + activeTab.slice(1)}</h1>
          </div>
          <div className="mini-user">{displayName}</div>
        </header>

        {dataLoading ? (
          <div className="loading-card">Loading your workouts…</div>
        ) : activeTab === 'today' ? (
          <>
            <section className="today-card">
              <div>
                <span className="card-label">{program.shortName}</span>
                <h2>{lift} Day</h2>
                <p>Week {week} · {plan.phase} · {dayNames[lift]}</p>
                {plan.rule && <p className="rule-text">{plan.rule}</p>}
              </div>
              <div className="progress-badge">{completedByWeek[week]?.size || 0}/4 done</div>
            </section>

            <details className="change-workout">
              <summary>Change workout</summary>
              <div className="selectors">
                <label><span>Week</span>
                  <select value={week} onChange={e => setWeek(Number(e.target.value))}>
                    {Array.from({length:program.weeksCount},(_,i) => i+1).map(w => <option key={w} value={w}>Week {w}</option>)}
                  </select>
                </label>
                <label><span>Workout</span>
                  <select value={lift} onChange={e => setLift(e.target.value)}>
                    {lifts.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
              </div>
            </details>

            {!tm && <div className="hint"><strong>No {lift} training max yet.</strong><span>Add it under Me → Training Maxes, or type working weights directly.</span></div>}

            <section className="exercise-card">
              <div className="exercise-title">
                <div><span>MAIN LIFT</span><h2>{lift}</h2></div>
                {previousWorkout && <small>Tap “Last” to reuse your previous set.</small>}
              </div>
              <div className="column-head"><span>SET / TARGET</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div>

              {log.main.map((set,i) => {
                const target = targetWeight(tm,set.pct,program.basis)
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
                      onChange={v => { setSaveState('Unsaved'); setLog(x => ({...x,complete:false,backoffWeight:v})) }} />
                  </label>
                )}
                <input className="text-input" placeholder={secondary.pct != null ? 'Optional note, e.g. all sets completed' : 'What you did / weight / reps'}
                  value={log.backoffNote}
                  onChange={e => { setSaveState('Unsaved'); setLog(v => ({...v,complete:false,backoffNote:e.target.value})) }} />
              </section>
            )}

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">ASSISTANCE</span><h3>Write it like the board</h3></div></div>
              {log.assistance.map((item,i) => (
                <label className="assist" key={item.name}><span>{item.name}</span>
                  <input placeholder="weight × reps × sets" value={item.result}
                    onChange={e => { setSaveState('Unsaved'); setLog(v => ({...v,complete:false,assistance:v.assistance.map((x,idx) => idx === i ? {...x,result:e.target.value} : x)})) }} />
                </label>
              ))}
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">CONDITIONING</span><h3>{plan.conditioning}</h3></div></div>
              <input className="text-input" placeholder="Time / rounds / distance" value={log.conditioning}
                onChange={e => { setSaveState('Unsaved'); setLog(v => ({...v,complete:false,conditioning:e.target.value})) }} />
            </section>

            <section className="metrics">
              <label><span>Workout RPE</span><input type="number" inputMode="decimal" placeholder="1-10" value={log.rpe}
                onChange={e => { setSaveState('Unsaved'); setLog(v => ({...v,complete:false,rpe:e.target.value})) }} /></label>
              <label><span>Bodyweight</span><input type="number" inputMode="decimal" placeholder="lb" value={log.bodyweight}
                onChange={e => { setSaveState('Unsaved'); setLog(v => ({...v,complete:false,bodyweight:e.target.value})) }} /></label>
            </section>

            <textarea className="notes" placeholder="Quick workout note…" value={log.note}
              onChange={e => { setSaveState('Unsaved'); setLog(v => ({...v,complete:false,note:e.target.value})) }} />

            <div className="save-line">● {saveState}</div>
            <div className="finish-wrap">
              <button className={'finish ' + (log.complete ? 'done' : '')} onClick={finishWorkout}>
                {log.complete ? '✓ WORKOUT FINISHED' : 'FINISH WORKOUT'}
              </button>
            </div>
          </>
        ) : activeTab === 'history' ? (
          <section className="page-section">
            {completedHistory.length === 0 ? (
              <div className="empty-state">Finish your first workout and it will appear here.</div>
            ) : (
              <div className="history-list">
                {completedHistory.map(row => {
                  const top = row.workout?.main?.[row.workout.main.length - 1]
                  const date = new Date(row.completed_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})
                  const programId = dbNameToProgram[row.program] || 'andy-hybrid-12'
                  return (
                    <article className="history-card" key={row.id}>
                      <div>
                        <span>{date} · {programs[programId].shortName}</span>
                        <h3>Week {row.week} · {row.lift}</h3>
                        <p>{top?.weight ? 'Top set: ' + top.weight + ' × ' + top.actualReps : 'Workout completed'}</p>
                      </div>
                      <button onClick={() => jumpToWorkout(programId,row.week,row.lift)}>Open</button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        ) : activeTab === 'program' ? (
          <section className="page-section">
            <div className="program-summary">
              <span className="card-label">PROGRAM LIBRARY</span>
              <h2>Choose your program</h2>
              <p>These are the four programs built from your workout archive.</p>
            </div>

            <div className="program-picker">
              {programOrder.map(id => {
                const p = programs[id]
                const selected = id === activeProgram
                return (
                  <article className={'program-card ' + (selected ? 'selected' : '')} key={id}>
                    <div>
                      <span className="program-length">{p.weeksCount} weeks</span>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                    </div>
                    <button onClick={() => chooseProgram(id)}>{selected ? 'Current program' : 'Use this program'}</button>
                  </article>
                )
              })}
            </div>

            <div className="program-summary compact">
              <span className="card-label">{program.shortName}</span>
              <h2>Week progress</h2>
            </div>

            <div className="week-list">
              {Array.from({length:program.weeksCount},(_,i) => i+1).map(number => {
                const count = completedByWeek[number]?.size || 0
                return (
                  <button className={'week-card ' + (number === week ? 'current' : '')} key={number}
                    onClick={() => jumpToWorkout(activeProgram,number,lifts.find(x => !completedByWeek[number]?.has(x)) || 'Squat')}>
                    <div><strong>Week {number}</strong><span>{program.phases[number]}</span></div>
                    <div className="week-progress">{count}/4</div>
                  </button>
                )
              })}
            </div>
          </section>
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
              <p className="helper-text">Enter your normal 85% training max. Powerbuilding and Strength + Power convert it internally for their e1RM-based percentages.</p>
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
              <div className="section-heading"><div><span className="card-label">CURRENT PROGRAM</span><h3>{program.name}</h3></div></div>
              <button className="wide-button" onClick={() => setActiveTab('program')}>Change program</button>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">INVITE</span><h3>Invite a workout partner</h3></div></div>
              <p className="helper-text">Tracey, Myra, or anyone else gets their own account, program, maxes, and workout history.</p>
              <button className="wide-button invite-button" onClick={shareInvite}>Share WorkoutBoard</button>
              {inviteState && <div className="invite-status">{inviteState}</div>}
            </section>

            <button className="signout-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </section>
        )}

        <div className="bottom-space" />
      </main>

      <nav className="bottom-nav">
        <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}><b>●</b><span>Today</span></button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}><b>↺</b><span>History</span></button>
        <button className={activeTab === 'program' ? 'active' : ''} onClick={() => setActiveTab('program')}><b>▦</b><span>Program</span></button>
        <button className={activeTab === 'me' ? 'active' : ''} onClick={() => setActiveTab('me')}><b>☺</b><span>Me</span></button>
      </nav>
    </>
  )
}

export default App
