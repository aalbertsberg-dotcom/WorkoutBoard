const {test,expect}=require('@playwright/test')

const userId='00000000-0000-4000-8000-000000000001'
async function signedIn(page,{withStartedWalk=false,withStrengthSession=false}={}){
  await page.addInitScript(user=>{
    const expires=Math.floor(Date.now()/1000)+86400*365
    localStorage.setItem('sb-example-auth-token',JSON.stringify({
      access_token:'e2e.mock.access.token',
      refresh_token:'e2e-mock-refresh',
      expires_at:expires,
      expires_in:86400*365,
      token_type:'bearer',
      user:{id:user,aud:'authenticated',role:'authenticated',
        email:'tester@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',
        created_at:'2026-01-01T00:00:00Z',user_metadata:{},app_metadata:{}}
    }))
  },userId)
  await page.route('https://example.supabase.co/**',async route=>{
    const req=route.request(),url=req.url(),method=req.method()
    const headers={
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':'apikey,authorization,content-type,prefer,x-client-info',
      'Access-Control-Expose-Headers':'Content-Range'
    }
    if(method==='OPTIONS'){await route.fulfill({status:204,headers});return}
    if(url.includes('/auth/v1/user')){
      await route.fulfill({status:200,contentType:'application/json',headers,
        body:JSON.stringify({id:userId,aud:'authenticated',role:'authenticated',email:'tester@example.test',user_metadata:{},app_metadata:{}})})
      return
    }
    if(withStartedWalk && method==='GET' && url.includes('/rest/v1/planned_workouts')){
      const now=new Date().toISOString()
      const row={
        id:'00000000-0000-4000-8000-000000000002',user_id:userId,
        title:'Walk',scheduled_date:now.slice(0,10),status:'started',
        created_at:now,updated_at:now,
        workout:{
          version:2,type:'flexible',standalone:true,started_explicitly:true,
          quick_cardio:true,quick_cardio_kind:'walk',
          exercises:[],quick_timer_started_at:null,quick_timer_elapsed_seconds:0,
          metcon:{activity:'Walk',intensity:'Light',duration:'',distance:''}
        }
      }
      await route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify([row])})
      return
    }
    if(withStrengthSession && method==='GET' && url.includes('/rest/v1/training_sessions')){
      const now=new Date().toISOString()
      const row={
        id:'00000000-0000-4000-8000-000000000004',user_id:userId,
        title:'Bench workout',primary_lift:'Bench',program:'Test strength',
        session_date:now.slice(0,10),completed_at:now,legacy_log_id:null,
        total_volume:990,estimated_1rm:0,
        workout:{version:2,type:'flexible',exercises:[
          {id:'bench',name:'Bench Press',result:'',setProgress:[
            {weight:135,reps:5,done:true},
            {weight:165,reps:5,done:true}
          ]}
        ]}
      }
      await route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify([row])})
      return
    }
    if(url.includes('/rpc/is_workout_admin')){
      await route.fulfill({status:200,contentType:'application/json',headers,body:'false'})
      return
    }
    if(url.includes('/rest/v1/profiles')){
      const row={id:userId,display_name:'Test Athlete',active_program:'andy-hybrid-12',current_week:1,community_opt_in:false}
      const singular=(req.headers()['accept']||'').includes('application/vnd.pgrst.object+json')
      await route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify(singular?row:[row])})
      return
    }
    if(url.includes('/rpc/')){
      await route.fulfill({status:200,contentType:'application/json',headers,body:'[]'})
      return
    }
    await route.fulfill({status:200,contentType:'application/json',headers,body:'[]'})
  })
  await page.goto('/')
}
test('Real signed-in WorkSet navigates Today, Together, Plan, Board and Me without errors',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  await expect(page.locator('.app-header h1')).toHaveText('Today',{timeout:15000})
  const nav=page.viewportSize().width<700
    ?page.getByRole('navigation',{name:'Workset mobile navigation'})
    :page.locator('.primary-nav')
  await expect(nav).toBeVisible()
  for(const [label,title] of [['Together','Together'],['Plan','Plan'],['Board','Whiteboard'],['Today','Today']]){
    await nav.getByRole('button',{name:label}).click()
    await expect(page.locator('.app-header h1')).toHaveText(title)
  }
  await page.locator('.account-chip').click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  await expect(page.getByRole('button',{name:/Workout History/})).toBeVisible()
  await expect(page.getByRole('button',{name:/Progress & Analytics/})).toBeVisible()
  expect(errors).toEqual([])
})
test('Real signed-in History and Progress shortcuts keep navigation working',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  await page.locator('.account-chip').click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  await page.getByRole('button',{name:/Workout History/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('History')
  await page.getByRole('button',{name:'← Back'}).first().click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Progress')
  expect(errors).toEqual([])
})

test('Resuming an active Walk renders GPS status without crashing',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page,{withStartedWalk:true})
  await expect(page.locator('.quick-cardio-runner')).toBeVisible({timeout:15000})
  await expect(page.locator('.quick-cardio-gps-badge')).toBeVisible()
  await expect(page.locator('.workset-crash-screen')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Active Walk has compact details and opens manual distance on demand',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page,{withStartedWalk:true})
  await expect(page.locator('.quick-cardio-runner')).toBeVisible({timeout:15000})
  const show=page.getByRole('button',{name:'Add details / manual distance'})
  await expect(show).toBeVisible()
  await expect(page.locator('.quick-cardio-field input')).toHaveCount(0)
  await show.click()
  await expect(page.getByRole('button',{name:'Hide details'})).toHaveAttribute('aria-expanded','true')
  await expect(page.getByPlaceholder('e.g. 2.5 mi')).toBeVisible()
  await page.getByRole('button',{name:'Hide details'}).click()
  await expect(page.getByPlaceholder('e.g. 2.5 mi')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Today timer offers an optional BPM mode without affecting the rest timer',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page)
  const timer=page.locator('.training-timer-panel')
  await timer.locator('summary').click()
  await timer.getByRole('button',{name:'Beats'}).click()
  await expect(timer.getByRole('spinbutton',{name:'Beats per minute'})).toHaveValue('120')
  await timer.getByRole('checkbox',{name:'Sound'}).uncheck()
  await timer.getByRole('button',{name:'Start beats'}).click()
  // Start stays open so Stop, tempo adjustment, and Sound remain accessible.
  await expect(timer.getByRole('button',{name:'Stop beats'})).toBeVisible()
  await expect(page.locator('.floating-workout-timer')).toHaveCount(0)
  // Floating control appears only when the user closes the open timer.
  await timer.locator('summary').click()
  await expect(page.locator('.floating-workout-timer')).toContainText('120 BPM')
  await page.locator('.floating-workout-timer').click()
  await expect(timer.getByRole('button',{name:'Stop beats'})).toBeVisible()
  await timer.getByRole('button',{name:'Stop beats'}).click()
  await timer.getByRole('button',{name:'Rest'}).click()
  await expect(timer.getByRole('button',{name:'Start'})).toBeVisible()
  expect(errors).toEqual([])
})

test('Walk includes an independent optional beat timer with adjustable tempo',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page,{withStartedWalk:true})
  const beats=page.locator('.beats-timer.beats-compact')
  await expect(beats).toBeVisible()
  await beats.locator('summary').click()
  const input=beats.getByRole('spinbutton',{name:'Beats per minute'})
  await input.fill('135')
  await input.blur()
  await beats.getByRole('checkbox',{name:'Sound'}).uncheck()
  await beats.getByRole('button',{name:'Start beats'}).click()
  await expect(beats.locator('summary')).toContainText('135 BPM · Playing')
  await beats.getByRole('button',{name:'Stop beats'}).click()
  await expect(beats.locator('summary')).toContainText('Optional cadence')
  expect(errors).toEqual([])
})

test('Completed strength records do not automatically become new PR announcements',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page,{withStrengthSession:true})
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Progress')
  const overview=page.locator('.recent-pr-home')
  await expect(overview).toContainText('No PRs yet',{timeout:15000})
  await page.locator('.progress-section-tabs').getByRole('button',{name:'History'}).click()
  await page.locator('.advanced-tabs').getByRole('button',{name:'Records'}).click()
  await expect(page.locator('.rep-pr-card')).toContainText('Bench Press')
  await expect(page.locator('.rep-pr-card')).toContainText('165 lb')
  expect(errors).toEqual([])
})

test('Progress tabs stay in one browser Back step and data entry is in Me',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page,{withStrengthSession:true})
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/View Progress & Analytics/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Progress')
  const depth=await page.evaluate(()=>window.history.state?.worksetDepth)
  expect(depth).toBe(1)
  const tabs=page.locator('.progress-section-tabs')
  for(const section of ['Strength','Cardio','Weight & Measurements','Overview','Strength']){
    await tabs.getByRole('button',{name:section,exact:true}).click()
    await expect(tabs.getByRole('button',{name:section,exact:true})).toHaveAttribute('aria-current','page')
    expect(await page.evaluate(()=>window.history.state?.worksetDepth)).toBe(depth)
  }
  await expect(page.locator('.progress-saved-maxes')).toBeVisible()
  await expect(page.locator('.progress-saved-maxes input')).toHaveCount(0)
  await page.getByRole('button',{name:'← Back'}).first().click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  expect(errors).toEqual([])
})

test('Track & Update opens saved 1RM editor; charts remain read-only',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page,{withStrengthSession:true})
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/View Progress & Analytics/}).click()
  await page.locator('.progress-section-tabs').getByRole('button',{name:'Strength'}).click()
  await expect(page.locator('.progress-saved-maxes')).toBeVisible()
  await page.locator('.progress-saved-maxes').getByRole('button',{name:/Track.*update saved 1RMs/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  const track=page.locator('[data-me-section="strength"]')
  await expect(track.locator('.me-section-toggle')).toHaveAttribute('aria-expanded','true')
  await expect(track.getByRole('spinbutton',{name:'Bench'})).toBeVisible()
  expect(errors).toEqual([])
})

test('Weight & Measurements charts are view-only; Track contains a bodyweight input',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/View Progress & Analytics/}).click()
  await page.locator('.progress-section-tabs').getByRole('button',{name:'Weight & Measurements'}).click()
  await expect(page.locator('.quick-weight-form')).toHaveCount(0)
  await expect(page.locator('.measurement-edit-card')).toHaveCount(0)
  await page.locator('.progress-weight-readonly').getByRole('button',{name:/Track weight/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  const track=page.locator('[data-me-section="measurements"]')
  await expect(track.locator('.me-section-toggle')).toHaveAttribute('aria-expanded','true')
  await expect(track.getByRole('button',{name:/Bodyweight/})).toBeVisible()
  expect(errors).toEqual([])
})

test('Primary destinations do not accumulate browser history',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  const bottom=page.getByRole('navigation',{name:'Workset mobile navigation'})
  for(const name of ['Together','Plan','Board','Today','Together']){
    const button=bottom.getByRole('button',{name})
    if(await bottom.isVisible())await button.click()
    else await page.locator('.primary-nav').getByRole('button',{name}).click()
    expect(await page.evaluate(()=>window.history.state?.worksetDepth)).toBe(0)
  }
  expect(errors).toEqual([])
})

test('Board draft survives switching tabs and Move drags a saved stroke',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  const nav=page.getByRole('navigation',{name:'Workset mobile navigation'})
  await nav.getByRole('button',{name:'Board'}).click()
  const board=page.locator('.draw-board-section')
  await expect(board).toBeVisible({timeout:15000})
  await board.getByRole('button',{name:'Line'}).click()
  const canvas=board.locator('canvas')
  const r=await canvas.boundingBox()
  const p=(x,y)=>({x:r.x+x*r.width,y:r.y+y*r.height})
  await page.mouse.move(p(.2,.25).x,p(.2,.25).y);await page.mouse.down()
  await page.mouse.move(p(.65,.65).x,p(.65,.65).y,{steps:6});await page.mouse.up()
  const key='workset-board-draft-v1:00000000-0000-4000-8000-000000000001:unsaved'
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.items?.length,key)).toBe(1)
  await nav.getByRole('button',{name:'Today'}).click()
  await nav.getByRole('button',{name:'Board'}).click()
  await expect(board).toBeVisible({timeout:15000})
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.items?.length,key)).toBe(1)
  await board.getByRole('button',{name:'Move',exact:true}).click()
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0].start.x,key)
  const restored=await canvas.boundingBox()
  const q=(x,y)=>({x:restored.x+x*restored.width,y:restored.y+y*restored.height})
  await page.mouse.move(q(.43,.44).x,q(.43,.44).y);await page.mouse.down()
  await page.mouse.move(q(.54,.48).x,q(.54,.48).y,{steps:6});await page.mouse.up()
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0].start.x,key)).toBeGreaterThan(before)
  expect(errors).toEqual([])
})

test('AMRAP stays open, remains active across Board and cannot be silently replaced',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  const timer=page.locator('.training-timer-panel')
  await timer.locator('summary').click()
  await timer.getByRole('button',{name:'AMRAP'}).click()
  await timer.getByRole('button',{name:'Start',exact:true}).click()
  await expect(timer).toHaveAttribute('open','')
  await expect(timer.getByRole('button',{name:'Pause'})).toBeVisible()
  await timer.getByRole('button',{name:'EMOM'}).click()
  await expect(timer).toContainText('Pause and reset')
  const nav=page.getByRole('navigation',{name:'Workset mobile navigation'})
  await nav.getByRole('button',{name:'Board'}).click()
  await expect(page.locator('.floating-workout-timer')).toContainText('AMRAP')
  await page.locator('.floating-workout-timer').click()
  await expect(page.locator('.app-header h1')).toHaveText('Today')
  await expect(timer.getByRole('button',{name:'Pause'})).toBeVisible()
  await timer.getByRole('button',{name:'Pause'}).click()
  await timer.getByRole('button',{name:'Reset'}).click()
  await timer.getByRole('button',{name:'EMOM'}).click()
  await timer.getByRole('button',{name:'Start',exact:true}).click()
  await expect(timer).toHaveAttribute('open','')
  await expect(timer).toContainText('Minute 1 /')
  expect(errors).toEqual([])
})

test('Beats remains mounted and can be stopped after visiting Board',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page)
  const timer=page.locator('.training-timer-panel')
  await timer.locator('summary').click()
  await timer.getByRole('button',{name:'Beats'}).click()
  await timer.getByRole('checkbox',{name:'Sound'}).uncheck()
  await timer.getByRole('button',{name:'Start beats'}).click()
  await expect(timer.getByRole('button',{name:'Stop beats'})).toBeVisible()
  const nav=page.getByRole('navigation',{name:'Workset mobile navigation'})
  await nav.getByRole('button',{name:'Board'}).click()
  await expect(page.locator('.floating-workout-timer')).toContainText('120 BPM')
  await nav.getByRole('button',{name:'Today'}).click()
  await expect(timer.getByRole('button',{name:'Stop beats'})).toBeVisible()
  await timer.getByRole('button',{name:'Stop beats'}).click()
  await expect(page.locator('.floating-workout-timer')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Main Board can be cleared after confirmation without deleting a saved board',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page)
  const nav=page.getByRole('navigation',{name:'Workset mobile navigation'})
  await nav.getByRole('button',{name:'Board'}).click()
  const board=page.locator('.draw-board-section')
  await expect(board).toBeVisible({timeout:15000})
  const clearButton=board.getByRole('button',{name:'Clear Main Board'})
  await expect(clearButton).toBeEnabled()
  await board.getByRole('button',{name:'Line'}).click()
  const rect=await board.locator('canvas').boundingBox()
  await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.25)
  await page.mouse.down()
  await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.6,{steps:5})
  await page.mouse.up()
  const draftKey='workset-board-draft-v1:'+userId+':unsaved'
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.items?.length,draftKey)).toBe(1)
  await clearButton.click()
  await expect(page.getByRole('alertdialog')).toContainText('Clear the unsaved Main Board?')
  await page.getByRole('alertdialog').getByRole('button',{name:'Cancel'}).click()
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.items?.length,draftKey)).toBe(1)
  await clearButton.click()
  await page.getByRole('alertdialog').getByRole('button',{name:'Confirm'}).click()
  await expect(board.getByRole('status')).toContainText('Main Board cleared')
  await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),draftKey)).toBeNull()
  expect(errors).toEqual([])
})

test('Intervals mobile countdown and inputs never extend past the phone width',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.setViewportSize({width:360,height:780})
  await signedIn(page)
  const timer=page.locator('.training-timer-panel')
  await timer.locator('summary').click()
  await timer.getByRole('button',{name:'Intervals'}).click()
  const elements='.timer-display,.timer-display strong,.timer-round,.timer-phase,.timer-settings-grid input,.timer-controls button'
  for(const width of [320,360,390]){
    await page.setViewportSize({width,height:780})
    const layout=await page.evaluate(selector=>{
      const viewport=document.documentElement.clientWidth
      const panel=document.querySelector('.training-timer-panel').getBoundingClientRect()
      return [...document.querySelectorAll(selector)].filter(x=>x.getClientRects().length)
        .map(x=>({tag:x.tagName,text:x.textContent?.trim().slice(0,30),right:x.getBoundingClientRect().right,
          left:x.getBoundingClientRect().left,panelRight:panel.right,viewport}))
    },elements)
    expect(layout.length).toBeGreaterThan(5)
    for(const item of layout){
      expect(item.left,item.text).toBeGreaterThanOrEqual(-1)
      expect(item.right,item.text).toBeLessThanOrEqual(item.panelRight+1)
      expect(item.right,item.text).toBeLessThanOrEqual(width+1)
    }
  }
  await timer.getByRole('button',{name:'Start',exact:true}).click()
  await expect(timer.locator('.timer-phase')).toContainText('WORK')
  await expect(timer.locator('.timer-round')).toContainText('Round 1 /')
  await expect(timer.locator('.timer-display strong')).toBeVisible()
  expect(errors).toEqual([])
})
