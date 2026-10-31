import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

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

function weekDays() {
  const start = startOfWeek()
  return Array.from({length:7},(_,i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function quickWorkoutPayload(lift, scheme, notes='') {
  const definitions = {
    '3x10': Array.from({length:3},() => ({pct:null,reps:10,label:'3 × 10'})),
    '5x5': Array.from({length:5},() => ({pct:null,reps:5,label:'5 × 5'})),
    '531-fsl': [
      {pct:65,reps:5,label:'65% × 5'},
      {pct:75,reps:5,label:'75% × 5'},
      {pct:85,reps:'5+',label:'85% × 5+'},
    ],
  }
  return {
    type:'quick',
    primary_lift:lift,
    scheme,
    main:definitions[scheme] || [],
    secondary:scheme === '531-fsl' ? {title:'FSL 5x5 @ 65%',sets:5,reps:5,pct:65} : null,
    notes,
  }
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
}) {
  const [mode,setMode] = useState('mine')
  const [community,setCommunity] = useState([])
  const [ready,setReady] = useState(null)
  const [message,setMessage] = useState('')
  const [resetPassword,setResetPassword] = useState('')

  const loadCommunity = async () => {
    const {data,error} = await supabase
      .from('community_activity')
      .select('*')
      .order('created_at',{ascending:false})
      .limit(50)

    if (error) {
      setReady(false)
      return
    }
    setReady(true)
    setCommunity(data || [])
  }

  useEffect(() => {
    loadCommunity()
  },[])

  const toggleCommunity = async enabled => {
    if (!session?.user) return
    setMessage('Saving…')
    const {error} = await supabase
      .from('profiles')
      .update({community_opt_in:enabled,updated_at:new Date().toISOString()})
      .eq('id',session.user.id)

    if (error) {
      setReady(false)
      setMessage('Platform migration still needs to be run.')
      return
    }

    if (!enabled) {
      await supabase.from('community_activity').delete().eq('user_id',session.user.id)
    }

    setProfile(v => ({...v,community_opt_in:enabled}))
    setMessage(enabled ? 'Community sharing is on for future completed workouts.' : 'Community sharing is off and your community posts were removed.')
    await loadCommunity()
  }

  const toggleBodyweight = async enabled => {
    if (!session?.user) return
    const {error} = await supabase
      .from('profiles')
      .update({community_share_bodyweight:enabled,updated_at:new Date().toISOString()})
      .eq('id',session.user.id)
    if (!error) setProfile(v => ({...v,community_share_bodyweight:enabled}))
  }

  const maxWeeklyVolume = Math.max(1,...progress.weekly.map(item => item.volume))

  return (
    <section className="page-section">
      <div className="segmented">
        <button className={mode === 'mine' ? 'active' : ''} onClick={() => setMode('mine')}>My Progress</button>
        <button className={mode === 'community' ? 'active' : ''} onClick={() => setMode('community')}>Community</button>
      </div>

      {mode === 'mine' ? (
        <>
          <section className="summary-grid">
            <div><span>Workouts</span><strong>{progress.completed.length}</strong></div>
            <div><span>7-day volume</span><strong>{formatWeight(progress.volume7)} lb</strong></div>
            <div><span>30-day volume</span><strong>{formatWeight(progress.volume30)} lb</strong></div>
            <div><span>Bodyweight</span><strong>{progress.latestBodyweight ? progress.latestBodyweight + ' lb' : '—'}</strong></div>
          </section>

          <section className="simple-card">
            <div className="section-heading"><div><span className="card-label">STRENGTH PROGRESS</span><h3>Estimated 1RM</h3></div></div>
            <div className="strength-list">
              {lifts.map(name => {
                const stat = progress.strength[name]
                return (
                  <div className="strength-row" key={name}>
                    <div><strong>{name}</strong><span>{stat?.bestSet ? 'Best set ' + stat.bestSet.weight + ' × ' + stat.bestSet.reps : 'No completed data yet'}</span></div>
                    <div className="strength-number">
                      <strong>{stat ? formatWeight(stat.latest) + ' lb' : '—'}</strong>
                      {stat && <span className={stat.delta >= 0 ? 'positive' : 'negative'}>{stat.delta >= 0 ? '+' : ''}{formatWeight(stat.delta)} since first log</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="simple-card">
            <div className="section-heading"><div><span className="card-label">VOLUME TREND</span><h3>Last 8 weeks</h3></div></div>
            <div className="volume-chart">
              {progress.weekly.map(item => (
                <div className="volume-bar-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{width:(item.volume / maxWeeklyVolume * 100) + '%'}} /></div>
                  <strong>{formatWeight(item.volume)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="simple-card">
            <div className="section-heading"><div><span className="card-label">RECENT WORKOUTS</span><h3>Volume by day</h3></div></div>
            <div className="history-list">
              {progress.completed.slice(-12).reverse().map(row => {
                const programId = dbNameToProgram[row.program] || 'andy-hybrid-12'
                const date = new Date(row.completed_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})
                return (
                  <article className="progress-workout" key={row.id}>
                    <div><strong>{date} · {row.lift}</strong><span>{programs[programId]?.shortName || row.program} · Week {row.week}</span></div>
                    <div><strong>{formatWeight(row._metrics.volume)} lb</strong><span>{row._metrics.estimated1rm ? 'e1RM ' + formatWeight(row._metrics.estimated1rm) : ''}</span></div>
                  </article>
                )
              })}
              {!progress.completed.length && <div className="empty-state">Your progress summary fills in as you finish workouts.</div>}
            </div>
            <p className="helper-text progress-note">Tracked volume includes main work, programmed weighted backoff sets, and assistance entered as weight × reps × sets.</p>
          </section>
        </>
      ) : (
        <>
          {ready === false ? (
            <div className="setup-needed">
              <span className="card-label">PLATFORM UPDATE NEEDED</span>
              <h2>Community is ready in the app</h2>
              <p>Run the platform-foundation SQL migration once to enable it.</p>
            </div>
          ) : (
            <>
              <section className="community-control">
                <div>
                  <span className="card-label">PRIVACY</span>
                  <h3>{profile?.community_opt_in ? 'Community sharing is ON' : 'Community sharing is OFF'}</h3>
                  <p>Off is the default. Turning it on shares future workout summaries, not your email.</p>
                </div>
                <button className={profile?.community_opt_in ? 'on' : ''} onClick={() => toggleCommunity(!profile?.community_opt_in)}>
                  {profile?.community_opt_in ? 'Turn off' : 'Opt in'}
                </button>
              </section>

              {profile?.community_opt_in && (
                <label className="privacy-row">
                  <div><strong>Share bodyweight</strong><span>Off unless you explicitly enable it.</span></div>
                  <input type="checkbox" checked={Boolean(profile?.community_share_bodyweight)} onChange={e => toggleBodyweight(e.target.checked)} />
                </label>
              )}

              {message && <div className="status-message">{message}</div>}

              <div className="community-feed">
                {community.map(item => (
                  <article className="community-card" key={item.id}>
                    <div className="community-card-head">
                      <strong>{item.display_name}</strong>
                      <span>{new Date(item.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <div className="community-stats">
                      <span>{item.summary?.volume ? Number(item.summary.volume).toLocaleString() + ' lb volume' : 'Workout complete'}</span>
                      {item.summary?.estimated_1rm ? <span>e1RM {Math.round(item.summary.estimated_1rm)} lb</span> : null}
                      {item.summary?.bodyweight ? <span>BW {item.summary.bodyweight} lb</span> : null}
                    </div>
                  </article>
                ))}
                {!community.length && <div className="empty-state">No community workouts yet. Community is opt-in, so this will grow as people choose to share.</div>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
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
  const [planned,setPlanned] = useState([])
  const [library,setLibrary] = useState([])
  const [showAdd,setShowAdd] = useState(false)
  const [showSubmit,setShowSubmit] = useState(false)
  const [submitMode,setSubmitMode] = useState('build')
  const [form,setForm] = useState({
    scheduled_date:isoDate(new Date()),
    title:'Squat 3×10',
    lift:'Squat',
    scheme:'3x10',
    notes:'',
  })
  const [submission,setSubmission] = useState({
    name:'',
    description:'',
    source_url:'',
    visibility:'private',
  })
  const [message,setMessage] = useState('')

  const days = useMemo(() => weekDays(),[])
  const start = isoDate(days[0])
  const end = isoDate(days[6])

  const load = async () => {
    if (!session?.user) return
    const [{data:plannedRows,error:plannedError},{data:libraryRows,error:libraryError}] = await Promise.all([
      supabase.from('planned_workouts').select('*').eq('user_id',session.user.id).gte('scheduled_date',start).lte('scheduled_date',end).order('scheduled_date'),
      supabase.from('program_library').select('*').order('created_at',{ascending:false}),
    ])
    if (plannedError || libraryError) {
      setReady(false)
      return
    }
    setReady(true)
    setPlanned(plannedRows || [])
    setLibrary(libraryRows || [])
  }

  useEffect(() => { load() },[session?.user?.id])

  const addWorkout = async e => {
    e.preventDefault()
    const workout = quickWorkoutPayload(form.lift,form.scheme,form.notes)
    const {error} = await supabase.from('planned_workouts').insert({
      user_id:session.user.id,
      scheduled_date:form.scheduled_date,
      title:form.title.trim() || form.lift + ' workout',
      source_program_name:form.scheme === '531-fsl' ? 'Flexible 5/3/1' : 'Flexible',
      source_day:form.lift,
      workout,
      status:'planned',
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setShowAdd(false)
    setMessage('Workout added to this week.')
    await load()
  }

  const removePlanned = async id => {
    await supabase.from('planned_workouts').delete().eq('id',id)
    await load()
  }

  const submitPlan = async e => {
    e.preventDefault()
    let imported = null
    const sourceUrl = submitMode === 'link' ? submission.source_url.trim() : null

    if (submitMode === 'link') {
      setMessage('Reading workout page…')
      try {
        const {data:{session:authSession}} = await supabase.auth.getSession()
        const response = await fetch('/.netlify/functions/import-program',{
          method:'POST',
          headers:{
            'content-type':'application/json',
            Authorization:'Bearer ' + authSession.access_token,
          },
          body:JSON.stringify({url:sourceUrl}),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Import failed')
        imported = payload
      } catch (error) {
        setMessage('Could not read that site automatically. The link will still be saved: ' + (error?.message || 'Import failed'))
      }
    }

    const name = submission.name.trim() || imported?.title || (submitMode === 'link' ? 'Imported program' : 'Custom program')
    const {error} = await supabase.from('program_library').insert({
      owner_user_id:session.user.id,
      name,
      description:submission.description.trim() || null,
      source_type:submitMode === 'link' ? 'url' : 'manual',
      source_url:sourceUrl || null,
      visibility:submission.visibility,
      status:submitMode === 'link' && !imported ? 'pending_import' : 'draft',
      plan:{
        submission_mode:submitMode,
        notes:submission.description.trim(),
        source_title:imported?.title || null,
        detected_lines:imported?.detected_lines || [],
      },
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setShowSubmit(false)
    setSubmission({name:'',description:'',source_url:'',visibility:'private'})
    setMessage(submitMode === 'link'
      ? (imported ? 'Workout page imported for review.' : 'Link saved. Some sites block automated imports.')
      : 'Workout plan draft saved.')
    await load()
  }

  if (ready === false) {
    return (
      <section className="page-section">
        <div className="setup-needed">
          <span className="card-label">PLATFORM UPDATE NEEDED</span>
          <h2>Flexible planning is ready</h2>
          <p>Run the platform-foundation SQL migration once. Your existing workout history stays intact.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-section">
      <section className="program-summary">
        <span className="card-label">THIS WEEK</span>
        <h2>Train what fits the week</h2>
        <p>Mix your program, Tracey-style 3×10, 5×5, or one-off workouts without changing your long-term history.</p>
      </section>

      <section className="active-program-card">
        <div>
          <span className="card-label">ACTIVE PROGRAM</span>
          <h3>{programs[activeProgram].name}</h3>
          <p>Changing this affects what is suggested next. Completed workout history is never deleted.</p>
        </div>
        <select value={activeProgram} onChange={e => chooseProgram(e.target.value)}>
          {programOrder.map(id => <option value={id} key={id}>{programs[id].name}</option>)}
        </select>
      </section>

      <div className="weekly-plan">
        {days.map(day => {
          const date = isoDate(day)
          const rows = planned.filter(item => item.scheduled_date === date)
          return (
            <article className="day-plan" key={date}>
              <div className="day-plan-head">
                <div><strong>{day.toLocaleDateString(undefined,{weekday:'short'})}</strong><span>{day.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></div>
                {date === isoDate(new Date()) && <b>Today</b>}
              </div>
              {rows.map(row => (
                <div className="planned-item" key={row.id}>
                  <div><strong>{row.title}</strong><span>{row.workout?.scheme || row.source_program_name || 'Workout'}</span></div>
                  <button onClick={() => removePlanned(row.id)}>×</button>
                </div>
              ))}
              {!rows.length && <span className="rest-label">Open / rest / add workout</span>}
            </article>
          )
        })}
      </div>

      <button className="primary-action" onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Close' : '+ Add workout this week'}</button>

      {showAdd && (
        <form className="builder-card" onSubmit={addWorkout}>
          <h3>Quick workout</h3>
          <label>Date<input type="date" value={form.scheduled_date} onChange={e => setForm(v => ({...v,scheduled_date:e.target.value}))} /></label>
          <label>Name<input value={form.title} onChange={e => setForm(v => ({...v,title:e.target.value}))} /></label>
          <div className="builder-two">
            <label>Primary lift<select value={form.lift} onChange={e => setForm(v => ({...v,lift:e.target.value}))}>{lifts.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Scheme<select value={form.scheme} onChange={e => setForm(v => ({...v,scheme:e.target.value}))}><option value="3x10">3 × 10</option><option value="5x5">5 × 5</option><option value="531-fsl">5/3/1 + FSL 5×5</option><option value="custom">Custom notes</option></select></label>
          </div>
          <label>Notes<textarea value={form.notes} onChange={e => setForm(v => ({...v,notes:e.target.value}))} placeholder="Optional accessories, conditioning, substitutions…" /></label>
          <button className="primary-action">Add to week</button>
        </form>
      )}

      <section className="simple-card">
        <div className="section-heading">
          <div><span className="card-label">WORKOUT PLANS</span><h3>Program library</h3></div>
          <button className="mini-action" onClick={() => setShowSubmit(v => !v)}>Submit plan</button>
        </div>
        <p className="helper-text">Build your own plan or submit a link to a program from another site. Links are fetched server-side when the site allows it. Imported set/rep lines are saved with the source URL for review before becoming a runnable program.</p>
      </section>

      {showSubmit && (
        <form className="builder-card" onSubmit={submitPlan}>
          <div className="segmented">
            <button type="button" className={submitMode === 'build' ? 'active' : ''} onClick={() => setSubmitMode('build')}>Build</button>
            <button type="button" className={submitMode === 'link' ? 'active' : ''} onClick={() => setSubmitMode('link')}>Link</button>
          </div>
          <label>Plan name<input value={submission.name} onChange={e => setSubmission(v => ({...v,name:e.target.value}))} placeholder="My 3-day strength plan" /></label>
          {submitMode === 'link' && <label>Source URL<input type="url" required value={submission.source_url} onChange={e => setSubmission(v => ({...v,source_url:e.target.value}))} placeholder="https://..." /></label>}
          <label>{submitMode === 'build' ? 'Plan outline' : 'Notes'}<textarea value={submission.description} onChange={e => setSubmission(v => ({...v,description:e.target.value}))} placeholder="Days, exercises, sets/reps, progression, substitutions…" /></label>
          <label>Visibility<select value={submission.visibility} onChange={e => setSubmission(v => ({...v,visibility:e.target.value}))}><option value="private">Private</option><option value="community">Community</option></select></label>
          <button className="primary-action">{submitMode === 'link' ? 'Save link for import' : 'Save plan draft'}</button>
        </form>
      )}

      {message && <div className="status-message">{message}</div>}

      <div className="program-picker">
        {programOrder.map(id => {
          const p = programs[id]
          const selected = id === activeProgram
          return (
            <article className={'program-card ' + (selected ? 'selected' : '')} key={id}>
              <div><span className="program-length">{p.weeksCount} weeks</span><h3>{p.name}</h3><p>{p.description}</p></div>
              <button onClick={() => chooseProgram(id)}>{selected ? 'Current program' : 'Use this program'}</button>
            </article>
          )
        })}
      </div>

      {library.filter(item => item.owner_user_id).length > 0 && (
        <section className="simple-card">
          <div className="section-heading"><div><span className="card-label">YOUR SUBMISSIONS</span><h3>Drafts & links</h3></div></div>
          {library.filter(item => item.owner_user_id === session.user.id).map(item => (
            <div className="library-row" key={item.id}>
              <div><strong>{item.name}</strong><span>{item.source_type === 'url' ? 'Link · ' + item.status : 'Build · ' + item.status}</span></div>
              <span>{item.visibility}</span>
            </div>
          ))}
        </section>
      )}

      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">CURRENT PROGRAM</span><h3>{programs[activeProgram].shortName}</h3></div></div>
        <div className="week-list">
          {Array.from({length:programs[activeProgram].weeksCount},(_,i) => i+1).map(number => {
            const count = completedByWeek[number]?.size || 0
            return (
              <button className={'week-card ' + (number === week ? 'current' : '')} key={number}
                onClick={() => jumpToWorkout(activeProgram,number,lifts.find(x => !completedByWeek[number]?.has(x)) || 'Squat')}>
                <div><strong>Week {number}</strong><span>{programs[activeProgram].phases[number]}</span></div>
                <div className="week-progress">{count}/4</div>
              </button>
            )
          })}
        </div>
      </section>
    </section>
  )
}


export function AdminPanel({ programs }) {
  const [users,setUsers] = useState([])
  const [selected,setSelected] = useState(null)
  const [maxes,setMaxes] = useState(null)
  const [sessions,setSessions] = useState([])
  const [message,setMessage] = useState('')
  const [resetPassword,setResetPassword] = useState('')

  const loadUsers = async () => {
    const {data,error} = await supabase.rpc('admin_user_overview')
    if (error) {
      setMessage(error.message)
      return
    }
    setUsers(data || [])
  }

  useEffect(() => { loadUsers() },[])

  const openUser = async user => {
    setSelected(user)
    setMessage('')
    const [{data:tm},{data:rows}] = await Promise.all([
      supabase.from('training_maxes').select('*').eq('user_id',user.user_id).maybeSingle(),
      supabase.from('training_sessions').select('*').eq('user_id',user.user_id).order('session_date',{ascending:false}).limit(20),
    ])
    setMaxes(tm || null)
    setSessions(rows || [])
  }

  const saveProgram = async (programId,week) => {
    if (!selected) return
    const {error} = await supabase.rpc('admin_set_user_program',{
      target_user:selected.user_id,
      new_program:programId,
      new_week:Number(week || 1),
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('User program updated.')
    await loadUsers()
    setSelected(v => v ? {...v,active_program:programId,current_week:Number(week || 1)} : v)
  }

  const resetUserPassword = async () => {
    if (!selected || resetPassword.length < 10) {
      setMessage('Enter a new password with at least 10 characters.')
      return
    }
    const {error} = await supabase.rpc('admin_reset_user_password',{
      target_user:selected.user_id,
      new_password:resetPassword
    })
    setMessage(error ? error.message : 'Password reset successfully.')
    if (!error) setResetPassword('')
  }

  const resetUserTraining = async () => {
    if (!selected) return

    const label = selected.display_name || selected.email || 'this user'
    if (!window.confirm(`Reset ALL workouts and training maxes for ${label}? This cannot be undone.`)) return

    setMessage('Resetting training data…')
    const target = selected.user_id

    const results = await Promise.all([
      supabase.from('session_results').delete().eq('user_id',target),
      supabase.from('training_sessions').delete().eq('user_id',target),
      supabase.from('workout_logs').delete().eq('user_id',target),
      supabase.from('planned_workouts').delete().eq('user_id',target),
      supabase.from('community_activity').delete().eq('user_id',target),
      supabase.from('training_maxes').update({
        squat:null,
        bench:null,
        deadlift:null,
        press:null,
        updated_at:new Date().toISOString(),
      }).eq('user_id',target),
      supabase.from('profiles').update({
        current_week:1,
        updated_at:new Date().toISOString(),
      }).eq('id',target),
    ])

    const failed = results.find(result => result.error)
    if (failed?.error) {
      setMessage('Reset failed: ' + failed.error.message)
      return
    }

    setMaxes({squat:null,bench:null,deadlift:null,press:null})
    setSessions([])
    setSelected(v => v ? {...v,workout_count:0,total_volume:0,last_workout:null,current_week:1} : v)
    await loadUsers()
    setMessage('Workout history and training maxes reset.')

    const {data:{user}} = await supabase.auth.getUser()
    if (user?.id === target) window.setTimeout(() => window.location.reload(),500)
  }

  const fmtDate = value => value ? new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'Never'

  if (!selected) {
    const totalWorkouts = users.reduce((sum,u) => sum + Number(u.workout_count || 0),0)
    return (
      <section className="page-section">
        <section className="summary-grid">
          <div><span>Users</span><strong>{users.length}</strong></div>
          <div><span>Completed workouts</span><strong>{totalWorkouts}</strong></div>
        </section>

        <section className="simple-card">
          <div className="section-heading"><div><span className="card-label">ADMIN</span><h3>WorkoutBoard users</h3></div></div>
          <div className="admin-user-list">
            {users.map(user => (
              <button className="admin-user-row" key={user.user_id} onClick={() => openUser(user)}>
                <div>
                  <strong>{user.display_name || 'Unnamed user'}</strong>
                  <span>{user.email}</span>
                </div>
                <div>
                  <strong>{user.workout_count || 0} workouts</strong>
                  <span>{fmtDate(user.last_workout)}</span>
                </div>
              </button>
            ))}
          </div>
          {!users.length && <div className="empty-state">No users returned.</div>}
        </section>
        {message && <div className="status-message">{message}</div>}
      </section>
    )
  }

  return (
    <section className="page-section">
      <button className="secondary-action" onClick={() => { setSelected(null); setMaxes(null); setSessions([]) }}>← All users</button>

      <section className="profile-card">
        <span className="card-label">USER</span>
        <h2>{selected.display_name || 'Unnamed user'}</h2>
        <p>{selected.email}</p>
        <div className="admin-meta">
          <span>{selected.workout_count || 0} workouts</span>
          <span>{Number(selected.total_volume || 0).toLocaleString()} lb tracked volume</span>
          <span>Last: {fmtDate(selected.last_workout)}</span>
        </div>
      </section>

      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">PROGRAM</span><h3>Manage current program</h3></div></div>
        <div className="builder-two">
          <label className="admin-field">Program
            <select id="admin-program" defaultValue={selected.active_program || 'andy-hybrid-12'}>
              {Object.entries(programs).map(([id,p]) => <option value={id} key={id}>{p.name}</option>)}
            </select>
          </label>
          <label className="admin-field">Week
            <input id="admin-week" type="number" min="1" max="12" defaultValue={selected.current_week || 1} />
          </label>
        </div>
        <button className="wide-button" onClick={() => {
          const programId = document.getElementById('admin-program').value
          const week = document.getElementById('admin-week').value
          saveProgram(programId,week)
        }}>Save program/week</button>
      </section>

      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">ACCOUNT ACCESS</span><h3>Reset password</h3></div></div>
        <p className="helper-text">Set a new password for this user without sending email.</p>
        <div className="admin-password-row">
          <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="New password (10+ characters)" />
          <button onClick={resetUserPassword}>Reset</button>
        </div>
      </section>

      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">TRAINING MAXES</span><h3>Current numbers</h3></div></div>
        <div className="admin-max-grid">
          <div><span>Squat</span><strong>{maxes?.squat ?? '—'}</strong></div>
          <div><span>Bench</span><strong>{maxes?.bench ?? '—'}</strong></div>
          <div><span>Deadlift</span><strong>{maxes?.deadlift ?? '—'}</strong></div>
          <div><span>Press</span><strong>{maxes?.press ?? '—'}</strong></div>
        </div>
      </section>

      <section className="simple-card danger-card">
        <div className="section-heading"><div><span className="card-label">RESET TRAINING DATA</span><h3>Start this user over</h3></div></div>
        <p className="helper-text">Deletes workout history, planned workouts, shared results, community activity, and clears all training maxes. The account and selected program stay in place.</p>
        <button className="danger-button" onClick={resetUserTraining}>Reset workouts + training maxes</button>
      </section>

      <section className="simple-card">
        <div className="section-heading"><div><span className="card-label">RECENT HISTORY</span><h3>Training sessions</h3></div></div>
        <div className="admin-session-list">
          {sessions.map(row => (
            <div className="library-row" key={row.id}>
              <div>
                <strong>{row.title}</strong>
                <span>{fmtDate(row.session_date)}{row.program ? ' · ' + row.program : ''}</span>
              </div>
              <div className="admin-session-volume">
                <strong>{Number(row.total_volume || 0).toLocaleString()} lb</strong>
                <span>{row.estimated_1rm ? 'e1RM ' + Math.round(row.estimated_1rm) : ''}</span>
              </div>
            </div>
          ))}
          {!sessions.length && <div className="empty-state">No completed sessions yet.</div>}
        </div>
      </section>

      {message && <div className="status-message">{message}</div>}
    </section>
  )
}
