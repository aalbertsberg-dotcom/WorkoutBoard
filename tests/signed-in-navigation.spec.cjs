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
