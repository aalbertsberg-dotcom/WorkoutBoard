import { useEffect, useMemo, useState } from 'react'

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
const keyFor = (week, lift) => 'wb:w' + week + ':' + lift

function safeJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback }
  catch { return fallback }
}

function backoffPercent(text) {
  const match = String(text || '').match(/@\s*(\d+)%/)
  return match ? Number(match[1]) : null
}

function makeLog(plan, lift, tm) {
  const pct = backoffPercent(plan.supplemental)
  return {
    version: 2,
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

  const oldVersion = saved.version || 1
  const oldMain = Array.isArray(saved.main) ? saved.main : []

  return {
    ...base,
    ...saved,
    version: 2,
    main: base.main.map((item, i) => {
      const old = oldMain[i] || {}
      const oldWeight = old.weight
      const migrateBadV1Weight = oldVersion < 2 && Number(oldWeight || 0) <= 10
      return {
        ...item,
        ...old,
        weight: migrateBadV1Weight ? item.weight : (oldWeight === undefined ? item.weight : oldWeight),
        done: Boolean(old.done),
      }
    }),
    backoffWeight: saved.backoffWeight || base.backoffWeight,
    backoffNote: saved.backoffNote || saved.supplemental || '',
    assistance: base.assistance.map((item, i) => ({
      ...item,
      ...(saved.assistance && saved.assistance[i] ? saved.assistance[i] : {}),
    })),
  }
}

function NumericInput({ value, onChange, placeholder, step=1, className='' }) {
  const adjust = delta => {
    const next = Math.max(0, Number(value || 0) + delta)
    onChange(next)
  }

  return (
    <div className={'numeric ' + className}>
      <button type="button" onClick={() => adjust(-step)} aria-label={'Decrease by ' + step}>−{step}</button>
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
      <button type="button" onClick={() => adjust(step)} aria-label={'Increase by ' + step}>+{step}</button>
    </div>
  )
}

function App() {
  const [week, setWeek] = useState(1)
  const [lift, setLift] = useState('Squat')
  const [trainingMaxes, setTrainingMaxes] = useState(() => ({
    ...defaultTms,
    ...safeJson(localStorage.getItem('wb:tms'), {}),
  }))
  const [showSetup, setShowSetup] = useState(false)
  const [history, setHistory] = useState(() => safeJson(localStorage.getItem('wb:history'), []))
  const [saveState, setSaveState] = useState('Saved')
  const plan = weeks[week]
  const tm = Number(trainingMaxes[lift] || 0)

  const [log, setLog] = useState(() => normalizeLog(
    safeJson(localStorage.getItem(keyFor(1, 'Squat')), null),
    weeks[1],
    'Squat',
    Number(trainingMaxes.Squat || 0)
  ))

  useEffect(() => {
    localStorage.setItem('wb:tms', JSON.stringify(trainingMaxes))
  }, [trainingMaxes])

  useEffect(() => {
    const saved = safeJson(localStorage.getItem(keyFor(week, lift)), null)
    setLog(normalizeLog(saved, plan, lift, tm))
  }, [week, lift, tm, plan])

  useEffect(() => {
    localStorage.setItem(keyFor(week, lift), JSON.stringify(log))
    setSaveState('Saved')
  }, [log])

  const previousWorkout = useMemo(() => {
    return history
      .filter(item => item.lift === lift && !(item.week === week && item.complete))
      .sort((a,b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0] || null
  }, [history, lift, week])

  const updateMain = (i, field, value) => {
    setSaveState('Saving…')
    setLog(v => ({
      ...v,
      complete: false,
      main: v.main.map((set, idx) => idx === i ? { ...set, [field]: value } : set)
    }))
  }

  const usePrevious = (i) => {
    const prev = previousWorkout && previousWorkout.main ? previousWorkout.main[i] : null
    if (!prev) return
    setLog(v => ({
      ...v,
      complete:false,
      main:v.main.map((set, idx) => idx === i
        ? { ...set, weight:prev.weight, actualReps:prev.actualReps }
        : set)
    }))
  }

  const setTm = (name, raw) => {
    const cleaned = raw === '' ? '' : Math.max(0, Number(raw))
    setTrainingMaxes(v => ({ ...v, [name]: cleaned }))
  }

  const finishWorkout = () => {
    const finalLog = {
      ...log,
      complete:true,
      savedAt:new Date().toISOString(),
      week,
      lift,
      phase:plan.phase,
    }

    const nextHistory = [
      finalLog,
      ...history.filter(item => !(item.week === week && item.lift === lift))
    ].slice(0, 200)

    setLog(finalLog)
    setHistory(nextHistory)
    localStorage.setItem('wb:history', JSON.stringify(nextHistory))
    localStorage.setItem(keyFor(week, lift), JSON.stringify(finalLog))
  }

  const backPct = backoffPercent(plan.supplemental)
  const backTarget = backPct && tm ? round5(tm * backPct / 100) : null

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <div className="eyebrow">WORKOUTBOARD</div>
          <h1>{lift} Day</h1>
          <div className="phase">Week {week} · {plan.phase} · {dayPlan[lift].day}</div>
        </div>
        <button className="setup-button" type="button" onClick={() => setShowSetup(!showSetup)}>
          Setup
        </button>
      </header>

      <section className="selectors" aria-label="Choose workout">
        <label>
          <span>Week</span>
          <select value={week} onChange={e => setWeek(Number(e.target.value))}>
            {Object.keys(weeks).map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </label>
        <label>
          <span>Workout</span>
          <select value={lift} onChange={e => setLift(e.target.value)}>
            {lifts.map(x => <option key={x}>{x}</option>)}
          </select>
        </label>
      </section>

      {showSetup && (
        <section className="setup-panel">
          <div className="section-heading">
            <div>
              <h2>Training Max Setup</h2>
              <p>Enter these once. Workout weights will fill in automatically.</p>
            </div>
          </div>
          <div className="tm-grid">
            {lifts.map(x => (
              <label key={x}>
                <span>{x}</span>
                <div className="input-with-unit">
                  <input
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="done"
                    value={trainingMaxes[x] || ''}
                    placeholder="0"
                    onFocus={e => e.currentTarget.select()}
                    onChange={e => setTm(x, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  />
                  <b>lb</b>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}

      {!tm ? (
        <div className="hint">
          <strong>No {lift} training max yet.</strong>
          <span>Tap Setup to calculate targets, or just type your working weights below.</span>
        </div>
      ) : (
        <div className="tm-summary">
          <span>{lift} training max</span>
          <strong>{tm} lb</strong>
          <span className="autosave">● {saveState}</span>
        </div>
      )}

      <section className="exercise-card">
        <div className="exercise-title">
          <div>
            <span>MAIN LIFT</span>
            <h2>{lift}</h2>
          </div>
          {previousWorkout && <small>Previous workout shown below</small>}
        </div>

        <div className="column-head">
          <span>SET / TARGET</span>
          <span>WEIGHT</span>
          <span>REPS</span>
          <span>DONE</span>
        </div>

        {log.main.map((set, i) => {
          const target = tm ? round5(tm * set.pct / 100) : null
          const prev = previousWorkout && previousWorkout.main ? previousWorkout.main[i] : null

          return (
            <div className={'set-row ' + (set.done ? 'completed' : '')} key={i}>
              <div className="set-meta">
                <strong>Set {i + 1}</strong>
                <span>{set.pct}% × {set.reps}</span>
                {target && <small>Target {target} lb</small>}
                {prev && (
                  <button className="previous" type="button" onClick={() => usePrevious(i)}>
                    Last {prev.weight || '—'} × {prev.actualReps || '—'}
                  </button>
                )}
              </div>

              <NumericInput
                value={set.weight}
                placeholder={target ? String(target) : 'lb'}
                step={5}
                onChange={value => updateMain(i, 'weight', value)}
                className="weight-input"
              />

              <input
                className="reps-input"
                type="number"
                inputMode="numeric"
                enterKeyHint="done"
                value={set.actualReps}
                placeholder={String(set.reps).replace('+','')}
                onFocus={e => e.currentTarget.select()}
                onChange={e => updateMain(i, 'actualReps', e.target.value === '' ? '' : Number(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />

              <button
                type="button"
                className={'check ' + (set.done ? 'checked' : '')}
                onClick={() => updateMain(i, 'done', !set.done)}
                aria-label={'Mark set ' + (i + 1) + ' complete'}
              >
                ✓
              </button>
            </div>
          )
        })}
      </section>

      <section className="simple-card">
        <div className="section-heading">
          <div>
            <span className="card-label">BACKOFF</span>
            <h3>{plan.supplemental}</h3>
          </div>
          {backTarget && <strong className="target-pill">{backTarget} lb</strong>}
        </div>
        <label className="field-label">
          <span>Working weight</span>
          <NumericInput
            value={log.backoffWeight}
            placeholder={backTarget ? String(backTarget) : 'lb'}
            step={5}
            onChange={value => setLog(v => ({ ...v, complete:false, backoffWeight:value }))}
          />
        </label>
        <input
          className="text-input"
          placeholder="Optional note, e.g. 5x5 completed"
          value={log.backoffNote}
          onChange={e => setLog(v => ({ ...v, complete:false, backoffNote:e.target.value }))}
        />
      </section>

      <section className="simple-card">
        <div className="section-heading">
          <div>
            <span className="card-label">ASSISTANCE</span>
            <h3>Write it like the board</h3>
          </div>
        </div>
        {log.assistance.map((item, i) => (
          <label className="assist" key={item.name}>
            <span>{item.name}</span>
            <input
              type="text"
              enterKeyHint="next"
              placeholder="50 × 8 × 3"
              value={item.result}
              onChange={e => setLog(v => ({
                ...v,
                complete:false,
                assistance:v.assistance.map((x, idx) => idx === i ? { ...x, result:e.target.value } : x)
              }))}
            />
          </label>
        ))}
      </section>

      <section className="simple-card">
        <div className="section-heading">
          <div>
            <span className="card-label">CONDITIONING</span>
            <h3>{plan.conditioning}</h3>
          </div>
        </div>
        <input
          className="text-input"
          placeholder="Time / rounds / distance"
          value={log.conditioning}
          onChange={e => setLog(v => ({ ...v, complete:false, conditioning:e.target.value }))}
        />
      </section>

      <section className="metrics">
        <label>
          <span>Workout RPE</span>
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="next"
            placeholder="1-10"
            value={log.rpe}
            onFocus={e => e.currentTarget.select()}
            onChange={e => setLog(v => ({ ...v, complete:false, rpe:e.target.value }))}
          />
        </label>
        <label>
          <span>Bodyweight</span>
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="lb"
            value={log.bodyweight}
            onFocus={e => e.currentTarget.select()}
            onChange={e => setLog(v => ({ ...v, complete:false, bodyweight:e.target.value }))}
          />
        </label>
      </section>

      <textarea
        className="notes"
        placeholder="Quick workout note…"
        value={log.note}
        onChange={e => setLog(v => ({ ...v, complete:false, note:e.target.value }))}
      />

      <div className="finish-wrap">
        <button className={'finish ' + (log.complete ? 'done' : '')} onClick={finishWorkout}>
          {log.complete ? '✓ WORKOUT FINISHED' : 'FINISH WORKOUT'}
        </button>
      </div>

      <div className="bottom-space" />
    </main>
  )
}

export default App
