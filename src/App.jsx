import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const lifts = ['Squat', 'Bench', 'Deadlift', 'Press']

const weeks = {
  1: { phase:'Leader 1', main:[[65,5],[75,5],[85,5]], supplemental:'FSL 5x5 @ 65%', conditioning:'Easy only' },
  2: { phase:'Leader 1', main:[[70,5],[80,5],[90,5]], supplemental:'FSL 5x5 @ 70%', conditioning:'Easy only' },
  3: { phase:'Leader 1', main:[[75,5],[85,5],[95,5]], supplemental:'FSL 5x5 @ 75%', conditioning:'Easy only' },
  4: { phase:'Leader 2', main:[[65,5],[75,5],[85,5]], supplemental:'BBB 5x10 @ 50%', conditioning:'Moderate' },
  5: { phase:'Leader 2', main:[[70,5],[80,5],[90,5]], supplemental:'BBB 5x10 @ 55%', conditioning:'Moderate' },
  6: { phase:'Leader 2', main:[[75,5],[85,5],[95,5]], supplemental:'BBB 5x10 @ 60%', conditioning:'Moderate' },
  7: { phase:'Deload', main:[[40,5],[50,5],[60,5]], supplemental:'2x5 @ 50%', conditioning:'None' },
  8: { phase:'Anchor', main:[[65,5],[75,5],[85,'5+']], supplemental:'FSL 3x5', conditioning:'1 hard + 1 easy' },
  9: { phase:'Anchor', main:[[70,3],[80,3],[90,'3+']], supplemental:'FSL 3x5', conditioning:'1 hard + 1 easy' },
  10:{ phase:'Anchor', main:[[75,5],[85,3],[95,'1+']], supplemental:'FSL 3x5', conditioning:'1 hard + 1 easy' },
  11:{ phase:'TM Test', main:[[70,5],[80,5],[90,3]], supplemental:'100% TM x 3-5', conditioning:'Easy only' },
  12:{ phase:'Deload / Rebase', main:[[40,5],[50,5],[60,5]], supplemental:'2x5 @ 50%', conditioning:'Optional test' },
}

const dayPlan = {
  Squat: { day:'Mon', assistance:['DB Split Squat','Row','Leg Raises'] },
  Bench: { day:'Tue', assistance:['Incline DB / Dips','Pullups','Triceps'] },
  Deadlift: { day:'Thu', assistance:['RDL / Back Raise','Row','Abs'] },
  Press: { day:'Fri', assistance:['DB Press','Pullups','Curls / Face Pulls'] },
}

const defaultTms = { Squat:'', Bench:'', Deadlift:'', Press:'' }
const round5 = n => Math.round(n / 5) * 5

function backoffPercent(text) {
  const match = String(text || '').match(/@\s*(\d+)%/)
  return match ? Number(match[1]) : null
}

function makeLog(plan, lift, tm) {
  const pct = backoffPercent(plan.supplemental)
  return {
    version: 4,
    main: plan.main.map(([percent, reps]) => ({
      pct: percent,
      reps,
      weight: tm ? round5(tm * percent / 100) : '',
      actualReps: String(reps).replace('+',''),
      done: false,
    })),
    backoffWeight: pct && tm ? round5(tm * pct / 100) : '',
    backoffNote: '',
    assistance: dayPlan[lift].assistance.map(name => ({ name, result:'' })),
    conditioning: '',
    rpe: '',
    bodyweight: '',
    note: '',
    complete: false,
  }
}

function normalizeLog(saved, plan, lift, tm) {
  const base = makeLog(plan, lift, tm)
  if (!saved) return base
  return {
    ...base,
    ...saved,
    version: 4,
    main: base.main.map((item, i) => ({ ...item, ...(saved.main?.[i] || {}) })),
    assistance: base.assistance.map((item, i) => ({ ...item, ...(saved.assistance?.[i] || {}) })),
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
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: name.trim() || email.split('@')[0] }
        }
      })
      setMessage(error ? error.message : 'Account created. Check your email if confirmation is required.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    }

    setBusy(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">WORKOUTBOARD</div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-sub">Your weights, maxes, and workout history are saved to your account.</p>

        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label>Name
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Andy or Tracey" required />
            </label>
          )}
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" minLength="6" required />
          </label>
          <button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>

        {message && <div className="auth-message">{message}</div>}
      </section>
    </main>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [profile, setProfile] = useState(null)
  const [week, setWeek] = useState(1)
  const [lift, setLift] = useState('Squat')
  const [trainingMaxes, setTrainingMaxes] = useState(defaultTms)
  const [history, setHistory] = useState([])
  const [saveState, setSaveState] = useState('Saved')
  const [log, setLog] = useState(() => makeLog(weeks[1], 'Squat', 0))

  const plan = weeks[week]
  const tm = Number(trainingMaxes[lift] || 0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false

    const load = async () => {
      setDataLoading(true)
      const userId = session.user.id

      const [{ data: profileData }, { data: tmData }, { data: logsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('training_maxes').select('*').eq('user_id', userId).single(),
        supabase.from('workout_logs').select('*').eq('user_id', userId).order('updated_at', { ascending:false }),
      ])

      if (cancelled) return

      const currentWeek = profileData?.current_week || 1
      const rows = logsData || []
      setProfile(profileData)
      setWeek(currentWeek)
      setHistory(rows)

      if (tmData) {
        setTrainingMaxes({
          Squat: tmData.squat ?? '',
          Bench: tmData.bench ?? '',
          Deadlift: tmData.deadlift ?? '',
          Press: tmData.press ?? '',
        })
      }

      const completedThisWeek = new Set(rows.filter(r => r.week === currentWeek && r.completed_at).map(r => r.lift))
      const nextLift = lifts.find(x => !completedThisWeek.has(x)) || 'Press'
      setLift(nextLift)
      setDataLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user || dataLoading) return
    const found = history.find(row => row.week === week && row.lift === lift)
    setLog(normalizeLog(found?.workout || null, plan, lift, tm))
    setSaveState('Saved')
  }, [week, lift, history, tm, dataLoading, session?.user?.id])

  const completedByWeek = useMemo(() => {
    const map = {}
    history.filter(r => r.completed_at).forEach(r => {
      map[r.week] ||= new Set()
      map[r.week].add(r.lift)
    })
    return map
  }, [history])

  const previousWorkout = useMemo(() => {
    const rows = history
      .filter(row => row.lift === lift && row.completed_at)
      .sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    return rows.find(row => !(row.week === week && row.lift === lift))?.workout || null
  }, [history, lift, week])

  const completedHistory = useMemo(
    () => history.filter(r => r.completed_at).sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at))),
    [history]
  )

  const updateMain = (i, field, value) => {
    setSaveState('Unsaved')
    setLog(v => ({
      ...v,
      complete:false,
      main:v.main.map((set, idx) => idx === i ? { ...set, [field]:value } : set)
    }))
  }

  const saveTrainingMaxes = async next => {
    setTrainingMaxes(next)
    if (!session?.user) return
    await supabase.from('training_maxes').upsert({
      user_id: session.user.id,
      squat: next.Squat === '' ? null : Number(next.Squat),
      bench: next.Bench === '' ? null : Number(next.Bench),
      deadlift: next.Deadlift === '' ? null : Number(next.Deadlift),
      press: next.Press === '' ? null : Number(next.Press),
      updated_at: new Date().toISOString(),
    })
  }

  const setTm = (name, raw) => {
    const value = raw === '' ? '' : Math.max(0, Number(raw))
    saveTrainingMaxes({ ...trainingMaxes, [name]:value })
  }

  const usePrevious = i => {
    const prev = previousWorkout?.main?.[i]
    if (!prev) return
    setSaveState('Unsaved')
    setLog(v => ({
      ...v,
      complete:false,
      main:v.main.map((set, idx) => idx === i ? { ...set, weight:prev.weight, actualReps:prev.actualReps } : set)
    }))
  }

  const saveWorkout = async (complete=false) => {
    if (!session?.user) return null
    setSaveState('Saving…')
    const now = new Date().toISOString()
    const payload = { ...log, complete, savedAt:now, week, lift, phase:plan.phase }

    const { data, error } = await supabase.from('workout_logs').upsert({
      user_id: session.user.id,
      program: '12 Week Andy Hybrid',
      week,
      lift,
      workout_date: new Date().toISOString().slice(0,10),
      workout: payload,
      completed_at: complete ? now : null,
      updated_at: now,
    }, { onConflict:'user_id,program,week,lift' }).select().single()

    if (error || !data) {
      setSaveState('Save failed')
      return null
    }

    setLog(payload)
    setHistory(rows => [data, ...rows.filter(row => row.id !== data.id && !(row.week === week && row.lift === lift))])
    setSaveState('Saved')
    return data
  }

  useEffect(() => {
    if (!session?.user || dataLoading || saveState !== 'Unsaved') return
    const timer = setTimeout(() => saveWorkout(false), 900)
    return () => clearTimeout(timer)
  }, [log, session?.user?.id, dataLoading, saveState])

  const changeWeek = async nextWeek => {
    setWeek(Number(nextWeek))
    if (!session?.user) return
    await supabase.from('profiles').update({
      current_week:Number(nextWeek),
      updated_at:new Date().toISOString()
    }).eq('id', session.user.id)
    setProfile(v => v ? { ...v, current_week:Number(nextWeek) } : v)
  }

  const finishWorkout = async () => {
    const saved = await saveWorkout(true)
    if (!saved) return

    const completed = new Set([
      ...(completedByWeek[week] ? Array.from(completedByWeek[week]) : []),
      lift
    ])

    const nextLift = lifts.find(x => !completed.has(x))
    if (nextLift) {
      setLift(nextLift)
      return
    }

    if (week < 12) {
      const nextWeek = week + 1
      await changeWeek(nextWeek)
      setLift('Squat')
    }
  }

  const saveDisplayName = async name => {
    if (!session?.user) return
    const clean = name.trim()
    if (!clean) return
    await supabase.from('profiles').update({
      display_name:clean,
      updated_at:new Date().toISOString()
    }).eq('id', session.user.id)
    setProfile(v => ({ ...v, display_name:clean }))
  }

  const jumpToWorkout = (targetWeek, targetLift='Squat') => {
    setWeek(Number(targetWeek))
    setLift(targetLift)
    setActiveTab('today')
  }

  const backPct = backoffPercent(plan.supplemental)
  const backTarget = backPct && tm ? round5(tm * backPct / 100) : null

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
                <span className="card-label">CURRENT WORKOUT</span>
                <h2>{lift} Day</h2>
                <p>Week {week} · {plan.phase} · {dayPlan[lift].day}</p>
              </div>
              <div className="progress-badge">{completedByWeek[week]?.size || 0}/4 done</div>
            </section>

            <details className="change-workout">
              <summary>Change workout</summary>
              <div className="selectors">
                <label><span>Week</span>
                  <select value={week} onChange={e => setWeek(Number(e.target.value))}>
                    {Object.keys(weeks).map(w => <option key={w} value={w}>Week {w}</option>)}
                  </select>
                </label>
                <label><span>Workout</span>
                  <select value={lift} onChange={e => setLift(e.target.value)}>
                    {lifts.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
              </div>
            </details>

            {!tm && (
              <div className="hint">
                <strong>No {lift} training max yet.</strong>
                <span>Add it under Me → Training Maxes, or type your working weights directly.</span>
              </div>
            )}

            <section className="exercise-card">
              <div className="exercise-title">
                <div><span>MAIN LIFT</span><h2>{lift}</h2></div>
                {previousWorkout && <small>Tap “Last” to reuse your previous set.</small>}
              </div>

              <div className="column-head"><span>SET / TARGET</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div>

              {log.main.map((set, i) => {
                const target = tm ? round5(tm * set.pct / 100) : null
                const prev = previousWorkout?.main?.[i]
                return (
                  <div className={'set-row ' + (set.done ? 'completed' : '')} key={i}>
                    <div className="set-meta">
                      <strong>Set {i+1}</strong>
                      <span>{set.pct}% × {set.reps}</span>
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

            <section className="simple-card">
              <div className="section-heading">
                <div><span className="card-label">BACKOFF</span><h3>{plan.supplemental}</h3></div>
                {backTarget && <strong className="target-pill">{backTarget} lb</strong>}
              </div>
              <label className="field-label"><span>Working weight</span>
                <NumericInput value={log.backoffWeight} placeholder={backTarget ? String(backTarget) : 'lb'} step={5}
                  onChange={v => { setSaveState('Unsaved'); setLog(x => ({ ...x, complete:false, backoffWeight:v })) }} />
              </label>
              <input className="text-input" placeholder="Optional note, e.g. 5x5 completed" value={log.backoffNote}
                onChange={e => { setSaveState('Unsaved'); setLog(v => ({ ...v, complete:false, backoffNote:e.target.value })) }} />
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">ASSISTANCE</span><h3>Write it like the board</h3></div></div>
              {log.assistance.map((item,i) => (
                <label className="assist" key={item.name}><span>{item.name}</span>
                  <input placeholder="50 × 8 × 3" value={item.result}
                    onChange={e => { setSaveState('Unsaved'); setLog(v => ({ ...v, complete:false, assistance:v.assistance.map((x,idx)=>idx===i?{...x,result:e.target.value}:x) })) }} />
                </label>
              ))}
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">CONDITIONING</span><h3>{plan.conditioning}</h3></div></div>
              <input className="text-input" placeholder="Time / rounds / distance" value={log.conditioning}
                onChange={e => { setSaveState('Unsaved'); setLog(v => ({ ...v, complete:false, conditioning:e.target.value })) }} />
            </section>

            <section className="metrics">
              <label><span>Workout RPE</span><input type="number" inputMode="decimal" placeholder="1-10" value={log.rpe}
                onChange={e => { setSaveState('Unsaved'); setLog(v => ({ ...v, complete:false, rpe:e.target.value })) }} /></label>
              <label><span>Bodyweight</span><input type="number" inputMode="decimal" placeholder="lb" value={log.bodyweight}
                onChange={e => { setSaveState('Unsaved'); setLog(v => ({ ...v, complete:false, bodyweight:e.target.value })) }} /></label>
            </section>

            <textarea className="notes" placeholder="Quick workout note…" value={log.note}
              onChange={e => { setSaveState('Unsaved'); setLog(v => ({ ...v, complete:false, note:e.target.value })) }} />

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
                  const date = new Date(row.completed_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
                  return (
                    <article className="history-card" key={row.id}>
                      <div>
                        <span>{date}</span>
                        <h3>Week {row.week} · {row.lift}</h3>
                        <p>{top?.weight ? 'Top set: ' + top.weight + ' × ' + top.actualReps : 'Workout completed'}</p>
                      </div>
                      <button onClick={() => jumpToWorkout(row.week, row.lift)}>Open</button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        ) : activeTab === 'program' ? (
          <section className="page-section">
            <div className="program-summary">
              <span className="card-label">12 WEEK ANDY HYBRID</span>
              <h2>Your program</h2>
              <p>4 workouts per week. Tap a week to view or repeat it.</p>
            </div>
            <div className="week-list">
              {Object.entries(weeks).map(([number, info]) => {
                const count = completedByWeek[number]?.size || 0
                return (
                  <button className={'week-card ' + (Number(number) === week ? 'current' : '')} key={number} onClick={() => jumpToWorkout(number, lifts.find(x => !completedByWeek[number]?.has(x)) || 'Squat')}>
                    <div>
                      <strong>Week {number}</strong>
                      <span>{info.phase}</span>
                    </div>
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
              <label>Display name
                <input defaultValue={displayName} onBlur={e => saveDisplayName(e.target.value)} />
              </label>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">TRAINING MAXES</span><h3>Your current numbers</h3></div></div>
              <div className="tm-grid">
                {lifts.map(x => (
                  <label key={x}>
                    <span>{x}</span>
                    <div className="input-with-unit">
                      <input type="number" inputMode="decimal" value={trainingMaxes[x] || ''} placeholder="0"
                        onFocus={e => e.currentTarget.select()}
                        onChange={e => setTm(x, e.target.value)} />
                      <b>lb</b>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">PROGRAM</span><h3>Current week</h3></div></div>
              <select className="wide-select" value={week} onChange={e => changeWeek(e.target.value)}>
                {Object.keys(weeks).map(w => <option key={w} value={w}>Week {w} · {weeks[w].phase}</option>)}
              </select>
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
