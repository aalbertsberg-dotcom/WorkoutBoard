import {PlatformProgress,FeedbackPanel} from './platform'
import {InstallAppButton,ExportDataButton} from './productFeatures'
import {AccountSecurityPanel,BackupRestorePanel,WorkoutSettingsPanel} from './advancedFeatures'
import {MeSection,MeDisplayNameEditor,MeOneRmEditor} from './MeSections'

/** The Me landing page is navigation-first, with secondary tools closed by default.
 * Existing tools are mounted only when explicitly expanded. */
export default function MePage({
  session,displayName,onSaveDisplayName,onOpenHistory,onOpenProgress,
  onOpenWeight,onOpenPrograms,
  profile,setProfile,progress,lifts,formatWeight,programs,dbNameToProgram,
  oneRepMaxes,onSaveOneRm,oneRmWeight,setOneRmWeight,oneRmReps,setOneRmReps,
  oneRmEstimate,oneRmRounded,oneRmTrainingMax,oneRmLift,setOneRmLift,oneRmNotice,
  calculatedOneRms,baselineTestChoice,setBaselineTestChoice,onStartBaseline,
  trackedProgramsInfo,personalProgramName,shareInvite,inviteState,
  isAdmin,feedbackUnread,onOpenAdmin,onSignOut,appUrl
}){
  return <section className="page-section me-page" aria-label="Me">
    {displayName==='WorkoutAdmin'&&!isAdmin&&<section className="admin-setup-warning">
      <span className="card-label">ADMIN SETUP INCOMPLETE</span>
      <h3>WorkoutAdmin account exists, but the admin role has not been granted yet.</h3>
      <p>Run the admin migration and one-time grant query in Supabase. Then sign out and back in.</p>
    </section>}

    <MeDisplayNameEditor name={displayName} email={session?.user?.email} onSave={onSaveDisplayName}/>

    <nav className="me-quick-links" aria-label="Training shortcuts">
      <button type="button" onClick={onOpenHistory}>
        <span className="me-shortcut-icon" aria-hidden="true">▦</span>
        <span><strong>Workout History</strong><small>Calendar, saved activities and routes</small></span>
        <b aria-hidden="true">›</b>
      </button>
      <button type="button" onClick={onOpenProgress}>
        <span className="me-shortcut-icon" aria-hidden="true">⌁</span>
        <span><strong>Progress & Analytics</strong><small>Charts, PRs, trends and measurements</small></span>
        <b aria-hidden="true">›</b>
      </button>
    </nav>

    <div className="me-section-group">
      <div className="me-section-group-label">YOUR TRAINING</div>

      <MeSection id="overview" title="Training at a glance"
        description="Workout totals, current weight and latest PR" icon="◫">
        <PlatformProgress view="mine" compact
          onOpenProgress={onOpenProgress}
          onOpenHistory={onOpenHistory}
          onOpenWeight={onOpenWeight} onOpenMeasurements={onOpenWeight}
          session={session} profile={profile} setProfile={setProfile}
          progress={progress} lifts={lifts} formatWeight={formatWeight}
          programs={programs} dbNameToProgram={dbNameToProgram}/>
      </MeSection>

      <MeSection id="strength" title="Strength & 1RMs"
        description="Current maxes, calculator and baseline tests" icon="◆">
        <section className="me-inner-card" aria-label="Current 1 rep maxes">
          <div className="me-inner-heading">
            <span className="card-label">SAVED STRENGTH</span>
            <h4>Your current 1RMs</h4>
          </div>
          <p>Saved to two decimals. Training programs calculate working weights using these numbers.</p>
          <MeOneRmEditor lifts={lifts} values={oneRepMaxes} onSave={onSaveOneRm}/>
        </section>

        <section className="me-inner-card" aria-label="1 rep max calculator">
          <div className="me-inner-heading">
            <span className="card-label">1RM CALCULATOR</span>
            <h4>Estimate from a rep set</h4>
            {oneRmEstimate>0&&<b className="one-rm-result">{oneRmRounded} lb</b>}
          </div>
          <p>Uses Epley: weight × (1 + reps ÷ 30). The result is an estimate, not a tested max.</p>
          <div className="one-rm-inputs">
            <label><span>Weight lifted</span><div className="input-with-unit">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={oneRmWeight} placeholder="225"
                onFocus={e=>e.currentTarget.select()}
                onChange={e=>setOneRmWeight(e.target.value===''?'':Math.max(0,Number(e.target.value)))}/>
              <b>lb</b>
            </div></label>
            <label><span>Reps</span><input type="number" inputMode="numeric" min="1" max="15"
              value={oneRmReps} onFocus={e=>e.currentTarget.select()}
              onChange={e=>setOneRmReps(Math.max(1,Math.min(15,Number(e.target.value)||1)))}/></label>
          </div>
          {oneRmEstimate>0&&<div className="one-rm-summary">
            <div><span>Estimated 1RM</span><strong>{oneRmRounded} lb</strong></div>
            <div><span>85% training max</span><strong>{oneRmTrainingMax} lb</strong></div>
          </div>}
          {oneRmEstimate>0&&<div className="one-rm-apply">
            <label className="one-rm-add-to"><span>Add estimate to</span>
              <select value={oneRmLift} onChange={e=>setOneRmLift(e.target.value)}>
                <option value="">Choose lift…</option>
                {lifts.map(name=><option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <button type="button" className="wide-button" disabled={!oneRmLift||!oneRmRounded}
              onClick={()=>onSaveOneRm(oneRmLift,oneRmRounded)}>
              {oneRmNotice?.type==='success'&&oneRmNotice.name===oneRmLift&&Number(oneRmNotice.value)===Number(oneRmRounded)
                ?'✓ Saved '+oneRmLift+' at '+oneRmRounded+' lb'
                :oneRmLift?'Add '+oneRmRounded+' lb to '+oneRmLift+' 1RM':'Choose a lift to save this estimate'}
            </button>
          </div>}
        </section>

        <section className="me-inner-card" aria-label="Estimated 1 rep maxes">
          <div className="me-inner-heading"><span className="card-label">CALCULATED FROM WORKOUTS</span><h4>Best estimated 1RMs</h4></div>
          <p>Calculated from completed lift sets. Use a result or run a strength baseline to verify it.</p>
          <div className="one-rm-summary">
            {lifts.map(name=>{
              const candidate=calculatedOneRms[name]
              return <div key={name}>
                <span>{name}</span><strong>{candidate?candidate.value.toFixed(2)+' lb':'—'}</strong>
                {candidate&&<small>{candidate.weight} × {candidate.reps}</small>}
                {candidate&&<button type="button" onClick={()=>onSaveOneRm(name,candidate.value)}>Use</button>}
              </div>
            })}
          </div>
          <div className="baseline-test-picker">
            <label htmlFor="me-baseline-choice" className="me-baseline-label">Start a strength baseline</label>
            <select id="me-baseline-choice" value={baselineTestChoice} onChange={e=>setBaselineTestChoice(e.target.value)}>
              <option value="">Choose a baseline test…</option>
              <option value="full">All 4 lifts</option>
              <option value="upper">Upper</option>
              <option value="lower">Lower</option>
              {lifts.map(name=><option key={name} value={'single:'+name}>Test {name}</option>)}
            </select>
            <button type="button" className="wide-button" disabled={!baselineTestChoice} onClick={onStartBaseline}>Start test</button>
          </div>
        </section>
      </MeSection>

      <MeSection id="programs" title="My Programs"
        description="Tracked programs and upcoming workouts" icon="▤">
        <div className="me-inner-card">
          {trackedProgramsInfo.length>0?
            <div className="me-tracked-program-list">{trackedProgramsInfo.map(info=><div key={info.key}>
              <div><strong>{info.name}</strong><span>{info.nextTitle?'Next: '+info.nextTitle:info.complete?'Complete':'Tracking'}</span></div>
              <b>{info.completed}/{info.total}</b>
            </div>)}</div>:
            <p>Current program: {personalProgramName}. Track programs from the Plan page.</p>}
          <button type="button" className="wide-button" onClick={onOpenPrograms}>Plan & programs</button>
        </div>
      </MeSection>
    </div>

    <div className="me-section-group">
      <div className="me-section-group-label">ACCOUNT & PREFERENCES</div>
      <MeSection id="preferences" title="Workout Preferences"
        description="Timers, sound, vibration and equipment" icon="⚙">
        <WorkoutSettingsPanel session={session}/>
      </MeSection>
      <MeSection id="security" title="Account & Security"
        description="Email confirmation and password access" icon="♧">
        <AccountSecurityPanel session={session} appUrl={appUrl}/>
      </MeSection>
      <MeSection id="app-data" title="App & Data"
        description="Install, updates, exports, backup and restore" icon="▣">
        <div className="me-inner-card">
          <div className="me-inner-heading"><span className="card-label">APP</span><h4>Install & update WorkSet</h4></div>
          <p>Install WorkSet, check for updates, or refresh when the installed app looks stale.</p>
          <InstallAppButton/>
        </div>
        <div className="me-inner-card">
          <div className="me-inner-heading"><span className="card-label">EXPORT</span><h4>Training history CSV</h4></div>
          <p>Download your completed session history.</p>
          <ExportDataButton userId={session.user.id}/>
        </div>
        <BackupRestorePanel session={session}/>
      </MeSection>
      <MeSection id="community" title="Community & Support"
        description="Invitations and feedback" icon="♧">
        <div className="me-inner-card">
          <div className="me-inner-heading"><span className="card-label">INVITE</span><h4>Invite someone</h4></div>
          <p>Everyone receives their own account, programs, maxes, history and progress.</p>
          <button type="button" className="wide-button invite-button" onClick={shareInvite}>Share WorkSet</button>
          {inviteState&&<p role="status" className="me-inline-status">{inviteState}</p>}
        </div>
        <FeedbackPanel session={session} profile={profile}/>
      </MeSection>
    </div>

    {isAdmin&&<button type="button" className="me-admin-link" onClick={onOpenAdmin}>
      <span><strong>Administration</strong><small>Manage WorkSet and feedback</small></span>
      <span>{feedbackUnread?'('+feedbackUnread+' new) ':''}›</span>
    </button>}

    <button type="button" className="signout-button me-signout" onClick={onSignOut}>Sign out</button>
  </section>
}
