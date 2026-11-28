import {FeedbackPanel} from './platform'
import {InstallAppButton,AppUpdateControls,ExportDataButton} from './productFeatures'
import {AccountSecurityPanel,BackupRestorePanel,WorkoutSettingsPanel} from './advancedFeatures'
import {MeSection,MeDisplayNameEditor,MeOneRmEditor} from './MeSections'
import {ProgressToolbox} from './trainingTools'
import {useEffect,useState} from 'react'
import {isNativeAndroid} from './androidUpdates.js'
import WorksetInbox from './WorksetInbox.jsx'
import ExerciseHistoryManager from './ExerciseHistoryManager.jsx'
import WhatsNewPage from './WhatsNewPage.jsx'

/** The Me landing page is navigation-first, with secondary tools closed by default.
 * Existing tools are mounted only when explicitly expanded. */
export default function MePage({
  session,displayName,onSaveDisplayName,onOpenHistory,onOpenNutrition,onOpenProgress,
  onOpenWeight,onOpenPrograms,
  profile,setProfile,progress,lifts,formatWeight,programs,dbNameToProgram,
  oneRepMaxes,onSaveOneRm,oneRmWeight,setOneRmWeight,oneRmReps,setOneRmReps,
  oneRmEstimate,oneRmRounded,oneRmTrainingMax,oneRmLift,setOneRmLift,oneRmNotice,
  calculatedOneRms,baselineTestChoice,setBaselineTestChoice,onStartBaseline,
  trackedProgramsInfo,personalProgramName,shareInvite,inviteState,
  isAdmin,feedbackUnread,onOpenAdmin,onSignOut,appUrl,onRefreshWorkset,refreshBlocked=false,
  autoOpenSection=null,
  friends=[],inboxRequest={id:0,view:'notifications',chatId:null,groupId:null},
  onInboxOpen,onInboxOpenTogether,onInboxAcceptLive,homeRequest=0,
}){
  const savedNav=()=>window.history.state?.tab==='me'?window.history.state:null
  const [meView,setMeView]=useState(()=>savedNav()?.meView||'home')
  const [trackTarget,setTrackTarget]=useState(()=>autoOpenSection||savedNav()?.meTrack||null)
  const [trackRequest,setTrackRequest]=useState(()=>autoOpenSection||savedNav()?.meTrack?1:0)
  const openMeView=(view,{replace=false,track=null}={})=>{
    const state=savedNav()
    if(state){
      const previous=state.meView||'home'
      if(previous==='updates'&&state.meUpdatesParent&&!replace&&(view==='settings'||view==='home')){
        window.history.go(view==='home'&&state.meParent?-2:-1)
        return
      }
      if(view==='home'&&previous!=='home'&&state.meParent&&!replace){
        window.history.back()
        return
      }
      if(view!==previous||track!==state.meTrack){
        const nestedUpdates=!replace&&previous==='settings'&&view==='updates'
        const push=!replace&&((previous==='home'&&view!=='home')||nestedUpdates)
        const next={...state,meView:view,meTrack:track,meParent:(!nestedUpdates&&push)||(!replace&&state.meParent),meUpdatesParent:nestedUpdates,meFromProgress:!replace&&state.meFromProgress,
          worksetDepth:Math.max(0,Number(state.worksetDepth)||0)+(push?1:0)}
        if(push)window.history.pushState(next,'',window.location.href)
        else window.history.replaceState(next,'',window.location.href)
      }
    }
    setMeView(view)
    if(!track)setTrackTarget(null)
    window.scrollTo({top:0,behavior:'instant'})
  }
  useEffect(()=>{
    const restore=event=>{
      if(event.state?.tab!=='me')return
      setMeView(event.state.meView||'home')
      setTrackTarget(event.state.meTrack||null)
      if(event.state.meTrack)setTrackRequest(n=>n+1)
      window.scrollTo({top:0,behavior:'instant'})
    }
    window.addEventListener('popstate',restore)
    return()=>window.removeEventListener('popstate',restore)
  },[])
  useEffect(()=>{
    const nativeBack=event=>{
      if(meView==='home')return
      event.preventDefault()
      openMeView(meView==='updates'?'settings':'home')
    }
    window.addEventListener('workset-native-back',nativeBack)
    return()=>window.removeEventListener('workset-native-back',nativeBack)
  },[meView])
  const jumpToTrack=section=>{
    openMeView(['preferences','security','app-data','community'].includes(section)?'settings':'training',{track:section})
    setTrackTarget(section)
    setTrackRequest(request=>request+1)
    setTimeout(()=>document.querySelector('[data-me-section="'+section+'"]')
      ?.scrollIntoView({block:'start',behavior:'smooth'}),140)
  }
  useEffect(()=>{if(autoOpenSection)jumpToTrack(autoOpenSection)},[autoOpenSection])
  useEffect(()=>{
    if(!inboxRequest?.id)return
    openMeView('inbox')
    const state=savedNav()
    if(state)window.history.replaceState({...state,meInbox:{view:inboxRequest.view,chatId:inboxRequest.chatId,groupId:inboxRequest.groupId}},'',window.location.href)
  },[inboxRequest?.id])
  useEffect(()=>{
    // Progress deep links to edit a specific field take precedence over the
    // header's previous "Me home" request.
    if(homeRequest>0&&!inboxRequest?.id&&!autoOpenSection)openMeView('home',{replace:Boolean(savedNav()?.meFromProgress)})
  },[homeRequest])
  return <section className={'page-section me-page me-view-'+meView} aria-label="Me">
    {meView==='home'?<>
    {displayName==='WorkoutAdmin'&&!isAdmin&&<section className="admin-setup-warning">
      <span className="card-label">ADMIN SETUP INCOMPLETE</span>
      <h3>WorkoutAdmin account exists, but the admin role has not been granted yet.</h3>
      <p>Run the admin migration and one-time grant query in Supabase. Then sign out and back in.</p>
    </section>}

    <MeDisplayNameEditor name={displayName} email={session?.user?.email} onSave={onSaveDisplayName}/>

    <nav className="me-quick-links me-main-menu" aria-label="Me menu">
      <button type="button" onClick={onOpenHistory}>
        <span className="me-shortcut-icon" aria-hidden="true">▦</span>
        <span><strong>Workout History</strong><small>Calendar and completed workouts</small></span>
        <b aria-hidden="true">›</b>
      </button>
      <button type="button" onClick={onOpenProgress}>
        <span className="me-shortcut-icon" aria-hidden="true">⌁</span>
        <span><strong>Progress &amp; Analytics</strong><small>Records, charts and training trends</small></span>
        <b aria-hidden="true">›</b>
      </button>
      <button type="button" onClick={onOpenNutrition}>
        <span className="me-shortcut-icon" aria-hidden="true">◈</span>
        <span><strong>Food &amp; Water</strong><small>Meals, hydration, calories and macro goals</small></span>
        <b aria-hidden="true">›</b>
      </button>
      <button type="button" onClick={()=>openMeView('training')}>
        <span className="me-shortcut-icon" aria-hidden="true">◆</span>
        <span><strong>Training &amp; Goals</strong><small>1RMs, exercise names, weight and goals</small></span>
        <b aria-hidden="true">›</b>
      </button>
      <button type="button" onClick={()=>openMeView('settings')}>
        <span className="me-shortcut-icon" aria-hidden="true">⚙</span>
        <span><strong>Settings &amp; Account</strong><small>Preferences, security and support</small><small className="me-version-label">WorkSet v{__WORKSET_APP_VERSION__} · Version &amp; updates</small></span>
        <b aria-hidden="true">›</b>
      </button>
    </nav>
    {isAdmin&&<button type="button" className="me-admin-link" onClick={onOpenAdmin}>
      <span><strong>Administration</strong><small>Manage WorkSet and feedback</small></span>
      <span>{feedbackUnread?'('+feedbackUnread+' new) ':''}›</span>
    </button>}


    </>:meView==='inbox'?<>
    <div className="me-subpage-header">
      <button type="button" className="me-subpage-back" onClick={()=>openMeView('home')} aria-label="Back to Me">
        <span aria-hidden="true">←</span> Me
      </button>
      <h2>Inbox &amp; Messages</h2>
      <p>Notifications, invitations and private conversations</p>
    </div>
      <WorksetInbox session={session} profile={profile} setProfile={setProfile} friends={friends}
        initialView={(inboxRequest?.id?inboxRequest.view:savedNav()?.meInbox?.view)||'notifications'}
        initialChatId={(inboxRequest?.id?inboxRequest.chatId:savedNav()?.meInbox?.chatId)||null}
        initialProgramGroupId={(inboxRequest?.id?inboxRequest.groupId:savedNav()?.meInbox?.groupId)||null}
        openRequest={inboxRequest?.id||0}
        onOpenTogether={onInboxOpenTogether} onAcceptLive={onInboxAcceptLive}/>

    </>:meView==='training'?<>
    <div className="me-subpage-header">
      <button type="button" className="me-subpage-back" onClick={()=>openMeView('home')} aria-label={savedNav()?.meFromProgress?'Back to Progress':'Back to Me'}>
        <span aria-hidden="true">←</span> {savedNav()?.meFromProgress?'Progress':'Me'}
      </button>
      <h2>Training &amp; Goals</h2>
      <p>Edit training details whenever you need to</p>
    </div>
    <div className="me-section-group">
      <MeSection id="strength" title="Track Strength &amp; 1RMs"
        description="Edit saved maxes, use the calculator or take a baseline test" icon="◆"
        openOnRequest={trackTarget==='strength'?trackRequest:0}>
        <section className="me-inner-card" aria-label="Current 1 rep maxes">
          <div className="me-inner-heading">
            <span className="card-label">SAVED STRENGTH</span>
            <h4>Your current 1RMs</h4>
          </div>
          <p>Saved to two decimals. Training programs calculate working weights using these numbers.</p>
          <MeOneRmEditor lifts={lifts} values={oneRepMaxes} onSave={onSaveOneRm}/>
        </section>

        <MeSection id="strength-calculator" title="1RM Calculator"
          description="Estimate a max from your weight and reps" icon="≈">
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
        </MeSection>

        <MeSection id="strength-estimates" title="Best estimated 1RMs"
          description="Calculated from completed workouts" icon="▥">
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
          </section>
        </MeSection>

        <MeSection id="strength-baseline" title="Strength Baseline Tests"
          description="Test one lift, upper/lower, or all four" icon="◉">
          <section className="me-inner-card" aria-label="Strength baseline tests">
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
      </MeSection>

      <MeSection id="exercise-names" title="Exercise Names &amp; History"
        description="Review and match exercise names at any time" icon="≡"
        openOnRequest={trackTarget==='exercise-names'?trackRequest:0}>
        <ExerciseHistoryManager session={session}/>
      </MeSection>

      <MeSection id="measurements" title="Track Weight &amp; Measurements"
        description="Log today's weight, body measurements and check-ins" icon="◫"
        openOnRequest={trackTarget==='measurements'?trackRequest:0}>
        <ProgressToolbox session={session} legacyHistory={progress.completed}
          formatWeight={formatWeight} onlyTab="Measurements"/>
      </MeSection>

      <MeSection id="goals" title="Track Goals"
        description="Set and update training targets" icon="◎"
        openOnRequest={trackTarget==='goals'?trackRequest:0}>
        <ProgressToolbox session={session} legacyHistory={progress.completed}
          formatWeight={formatWeight} onlyTab="Goals"/>
      </MeSection>


    </div>


    </>:meView==='updates'?<WhatsNewPage onBack={()=>openMeView('settings')}/>:<>
    <div className="me-subpage-header">
      <button type="button" className="me-subpage-back" onClick={()=>openMeView('home')} aria-label="Back to Me">
        <span aria-hidden="true">←</span> Me
      </button>
      <h2>Settings &amp; Account</h2>
      <p>Manage WorkSet preferences and your account</p>
    </div>
    <AppUpdateControls onRefresh={onRefreshWorkset} refreshBlocked={refreshBlocked}/>
    <button type="button" className="whats-new-link" onClick={()=>openMeView('updates')}>
      <span><strong>What's New</strong><small>Update history · features, fixes and improvements</small></span><b aria-hidden="true">›</b>
    </button>
    <div className="me-section-group">
      <MeSection id="preferences" title="Workout Preferences"
        description="Timers, sound, vibration and equipment" icon="⚙">
        <WorkoutSettingsPanel session={session}/>
      </MeSection>
      <MeSection id="security" title="Account & Security"
        description="Email confirmation and password access" icon="♧">
        <AccountSecurityPanel session={session} appUrl={appUrl}/>
      </MeSection>
      <MeSection id="app-data" title="App & Data"
        description="Install, exports, backup and restore" icon="▣">
        <div className="me-inner-card">
          <div className="me-inner-heading"><span className="card-label">APP</span><h4>Install WorkSet</h4></div>
          {isNativeAndroid()
            ?<p>Installed Android app. Check and install signed APK updates above.</p>
            :<><p>Add WorkSet to your home screen. Check for updates or refresh WorkSet above.</p>
                <InstallAppButton/></>}
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


    <button type="button" className="signout-button me-signout" onClick={onSignOut}>Sign out</button>
    </>}
  </section>
}
