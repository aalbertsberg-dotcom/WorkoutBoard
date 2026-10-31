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

const round5 = n => Math.round(n / 5) * 5
const keyFor = (week, lift) => `wb:w${week}:${lift}`

function NumberControl({value, onChange, step=5, min=0, suffix=''}) {
  return (
    <div className="number-control">
      <button type="button" onClick={() => onChange(Math.max(min, Number(value || 0) - step))}>−{step}</button>
      <div className="number-value">{value || 0}{suffix}</div>
      <button type="button" onClick={() => onChange(Number(value || 0) + step)}>+{step}</button>
    </div>
  )
}

function App() {
  const [week, setWeek] = useState(1)
  const [lift, setLift] = useState('Squat')
  const [trainingMaxes, setTrainingMaxes] = useState(() => JSON.parse(localStorage.getItem('wb:tms') || '{"Squat":0,"Bench":0,"Deadlift":0,"Press":0}'))
  const [showSetup, setShowSetup] = useState(false)
  const plan = weeks[week]

  const initial = useMemo(() => ({
    main: plan.main.map(([pct, reps]) => ({ pct, reps, weight:'', actualReps:String(reps).replace('+','') })),
    supplemental: '',
    assistance: dayPlan[lift].assistance.map(x => ({name:x, result:''})),
    conditioning: '',
    rpe: '',
    bodyweight: '',
    note: '',
    complete: false,
  }), [week, lift])

  const [log, setLog] = useState(initial)

  useEffect(() => {
    const saved = localStorage.getItem(keyFor(week,lift))
    setLog(saved ? JSON.parse(saved) : initial)
  }, [week, lift, initial])

  useEffect(() => {
    localStorage.setItem('wb:tms', JSON.stringify(trainingMaxes))
  }, [trainingMaxes])

  const tm = Number(trainingMaxes[lift] || 0)
  const plannedWeight = pct => tm ? round5(tm * pct / 100) : null

  const updateMain = (i, field, value) => {
    setLog(v => ({...v, main:v.main.map((s,idx) => idx===i ? {...s,[field]:value} : s)}))
  }

  const saveWorkout = () => {
    const finalLog = {...log, complete:true, savedAt:new Date().toISOString()}
    setLog(finalLog)
    localStorage.setItem(keyFor(week,lift), JSON.stringify(finalLog))
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <div className="eyebrow">WORKOUTBOARD</div>
          <h1>{dayPlan[lift].day} · {lift}</h1>
          <div className="phase">Week {week} · {plan.phase}</div>
        </div>
        <button className="setup" onClick={() => setShowSetup(!showSetup)}>TM</button>
      </header>

      {showSetup && (
        <section className="setup-panel">
          <h2>Training Maxes</h2>
          {lifts.map(x => (
            <label key={x}>
              <span>{x}</span>
              <input inputMode="decimal" type="number" value={trainingMaxes[x]} onChange={e => setTrainingMaxes(v => ({...v,[x]:e.target.value}))} />
            </label>
          ))}
        </section>
      )}

      <section className="selectors">
        <select value={week} onChange={e => setWeek(Number(e.target.value))}>
          {Object.keys(weeks).map(w => <option key={w} value={w}>Week {w}</option>)}
        </select>
        <select value={lift} onChange={e => setLift(e.target.value)}>
          {lifts.map(x => <option key={x}>{x}</option>)}
        </select>
      </section>

      {!tm && <div className="hint">Set your {lift} training max with the <b>TM</b> button to see suggested working weights.</div>}

      <section className="board">
        <div className="board-title">MAIN WORK</div>
        {log.main.map((set, i) => (
          <article className="set-card" key={i}>
            <div className="set-plan">
              <span>SET {i+1}</span>
              <strong>{set.pct}% × {set.reps}</strong>
              {plannedWeight(set.pct) && <small>Suggested: {plannedWeight(set.pct)} lb</small>}
            </div>
            <div className="entry-label">MY WEIGHT</div>
            <NumberControl value={set.weight} onChange={v => updateMain(i,'weight',v)} step={5} suffix=" lb" />
            <div className="entry-label">REPS</div>
            <NumberControl value={set.actualReps} onChange={v => updateMain(i,'actualReps',v)} step={1} />
          </article>
        ))}
      </section>

      <section className="simple-card">
        <div>
          <span className="card-label">BACKOFF</span>
          <strong>{plan.supplemental}</strong>
        </div>
        <input placeholder="Example: 225 × 5 × 5" value={log.supplemental} onChange={e => setLog(v => ({...v,supplemental:e.target.value}))} />
      </section>

      <section className="simple-card">
        <span className="card-label">ASSISTANCE</span>
        {log.assistance.map((a,i) => (
          <label className="assist" key={a.name}>
            <span>{a.name}</span>
            <input placeholder="weight × reps" value={a.result} onChange={e => setLog(v => ({...v,assistance:v.assistance.map((x,idx)=>idx===i?{...x,result:e.target.value}:x)}))} />
          </label>
        ))}
      </section>

      <section className="simple-card">
        <div>
          <span className="card-label">CONDITIONING</span>
          <strong>{plan.conditioning}</strong>
        </div>
        <input placeholder="time / rounds / distance" value={log.conditioning} onChange={e => setLog(v => ({...v,conditioning:e.target.value}))} />
      </section>

      <section className="metrics">
        <label>RPE<input inputMode="decimal" value={log.rpe} onChange={e => setLog(v=>({...v,rpe:e.target.value}))} /></label>
        <label>Bodyweight<input inputMode="decimal" value={log.bodyweight} onChange={e => setLog(v=>({...v,bodyweight:e.target.value}))} /></label>
      </section>

      <textarea className="notes" placeholder="Quick note…" value={log.note} onChange={e => setLog(v=>({...v,note:e.target.value}))} />

      <button className={log.complete ? 'finish done' : 'finish'} onClick={saveWorkout}>
        {log.complete ? '✓ WORKOUT SAVED' : 'FINISH WORKOUT'}
      </button>

      <div className="bottom-space" />
    </main>
  )
}

export default App
