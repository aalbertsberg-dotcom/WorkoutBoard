const {test,expect}=require('@playwright/test')

const userId='00000000-0000-4000-8000-000000000001'
async function signedIn(page,{withStartedWalk=false,withStartedStrength=false,withStrengthSession=false,withOvernightWalk=false,withNotification=false,withAdmin=false}={}){
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
  let storedMaxes={squat:null,bench:197.33,deadlift:261.33,press:160}
  let storedAliases=[]
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
    if(url.includes('/rest/v1/exercise_name_aliases')){
      if(method==='POST'){
        const row=Array.isArray(req.postDataJSON())?req.postDataJSON()[0]:req.postDataJSON()
        storedAliases=[row,...storedAliases.filter(item=>item.alias_key!==row.alias_key)]
        await route.fulfill({status:201,contentType:'application/json',headers,body:'[]'})
      }else if(method==='DELETE'){
        const alias=new URL(url).searchParams.get('alias_key')?.replace(/^eq\./,'')
        storedAliases=storedAliases.filter(item=>item.alias_key!==alias)
        await route.fulfill({status:204,headers})
      }else await route.fulfill({status:200,contentType:'application/json',headers,
        body:JSON.stringify(storedAliases)})
      return
    }
    if(withStartedStrength && method==='GET' && url.includes('/rest/v1/planned_workouts')){
      const now=new Date().toISOString()
      const row={
        id:'00000000-0000-4000-8000-000000000099',user_id:userId,
        title:'Strength set test',scheduled_date:now.slice(0,10),status:'started',
        created_at:now,updated_at:now,source_program_name:'Test Workout',
        workout:{version:2,type:'flexible',standalone:true,started_explicitly:true,
          exercises:[{id:'test-press',name:'Strict press',prescription:'4x4',
            done:false,setProgress:[
              {set:1,reps:4,done:true,weight:'90'},
              {set:2,reps:4,done:true,weight:'105'},
              {set:3,reps:4,done:false,weight:''},
              {set:4,reps:4,done:false,weight:''}
            ]}],
          metcon:{activity:'',duration:'',distance:''}}
      }
      await route.fulfill({status:200,contentType:'application/json',headers,
        body:JSON.stringify([row])})
      return
    }
    if(withOvernightWalk && method==='GET' && url.includes('/rest/v1/planned_workouts')){
      const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1)
      const y=[yesterday.getFullYear(),String(yesterday.getMonth()+1).padStart(2,'0'),
        String(yesterday.getDate()).padStart(2,'0')].join('-')
      const now=new Date().toISOString()
      const row={id:'00000000-0000-4000-8000-000000000007',user_id:userId,
        title:'Walk',scheduled_date:y,status:'started',
        created_at:new Date(Date.now()-30*60*1000).toISOString(),updated_at:now,
        workout:{version:2,type:'flexible',standalone:true,started_explicitly:true,
          quick_cardio:true,quick_cardio_kind:'walk',exercises:[],
          quick_timer_started_at:new Date(Date.now()-60*1000).toISOString(),
          quick_timer_elapsed_seconds:40,
          metcon:{activity:'Walk',intensity:'Light',duration:'',distance:''}}
      }
      const isPreviousDateRequest=url.includes('scheduled_date=eq.'+y)
      await route.fulfill({status:200,contentType:'application/json',headers,
        body:JSON.stringify(isPreviousDateRequest?[row]:[])})
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
    if(withStartedStrength && method==='GET' && url.includes('/rest/v1/training_sessions')){
      const now=new Date().toISOString()
      const names=['Hammer ISO lateral','ISO lateral raises','Cable Lateral Raises','Bench Press']
      const rows=names.map((name,i)=>({
        id:'00000000-0000-4000-8000-'+String(100+i).padStart(12,'0'),
        user_id:userId,title:name,program:'Recent gym activity',
        completed_at:now,session_date:now.slice(0,10),
        workout:{exercises:[{id:'hist-'+i,name,setProgress:[
          {set:1,done:true,weight:40+i*5,actual_reps:10}
        ]}]}
      }))
      await route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify(rows)})
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
    if(withAdmin && url.includes('/rpc/admin_user_overview_v2')){
      await route.fulfill({status:200,contentType:'application/json',headers,
        body:JSON.stringify([{user_id:userId,display_name:'Test Athlete',email:'tester@example.test',
          workout_count:2,total_volume:1200,last_workout:null,active_program:'andy-hybrid-12',current_week:1}])})
      return
    }
    if(withAdmin && url.includes('/rpc/admin_set_one_rep_maxes')){
      const data=req.postDataJSON()
      if(Number(data.new_press)===9999){
        await route.fulfill({status:400,contentType:'application/json',headers,
          body:JSON.stringify({message:'Test database refused the 1RM update',code:'P0001'})})
        return
      }
      storedMaxes={
        squat:data.new_squat,bench:data.new_bench,
        deadlift:data.new_deadlift,press:data.new_press
      }
      await route.fulfill({status:200,contentType:'application/json',headers,body:'null'})
      return
    }
    if(withAdmin && url.includes('/rest/v1/one_rep_maxes')){
      const singular=(req.headers()['accept']||'').includes('application/vnd.pgrst.object+json')
      const row={user_id:userId,...storedMaxes}
      await route.fulfill({status:200,contentType:'application/json',headers,
        body:JSON.stringify(singular?row:[row])})
      return
    }
    if(url.includes('/rpc/is_workout_admin')){
      await route.fulfill({status:200,contentType:'application/json',headers,body:withAdmin?'true':'false'})
      return
    }
    if(withNotification && url.includes('/rest/v1/workset_notifications') && method==='GET'){
      await route.fulfill({status:200,contentType:'application/json',headers,
        body:JSON.stringify([{
          id:'00000000-0000-4000-8000-000000000099',
          kind:'friend_request',title:'Friend request',
          body:'A friend wants to connect.',related_id:'00000000-0000-4000-8000-000000000098',
          read_at:null,created_at:new Date().toISOString(),resolved_at:null
        }])})
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
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
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
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
  await page.locator('.progress-section-tabs').getByRole('button',{name:'Strength'}).click()
  await expect(page.locator('.progress-saved-maxes')).toBeVisible()
  await page.locator('.progress-saved-maxes').getByRole('button',{name:/Track.*update saved 1RMs/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  const track=page.locator('[data-me-section="strength"]')
  await expect(track.locator(':scope > .me-section-title > .me-section-toggle')).toHaveAttribute('aria-expanded','true')
  await expect(track.getByRole('spinbutton',{name:'Bench'})).toBeVisible()
  expect(errors).toEqual([])
})

test('Weight & Measurements charts are view-only; Track contains a bodyweight input',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
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
  const nav=page.viewportSize().width<700
    ?page.getByRole('navigation',{name:'Workset mobile navigation'})
    :page.locator('.primary-nav')
  await nav.getByRole('button',{name:'Board'}).click()
  const board=page.locator('.draw-board-section')
  await expect(board).toBeVisible({timeout:15000})
  await board.getByRole('button',{name:'Line'}).click()
  const canvas=board.locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const r=await canvas.boundingBox()
  const p=(x,y)=>({x:r.x+x*r.width,y:r.y+y*r.height})
  await page.mouse.move(p(.2,.25).x,p(.2,.25).y);await page.mouse.down()
  await page.mouse.move(p(.65,.65).x,p(.65,.65).y,{steps:6});await page.mouse.up()
  const key='workset-board-draft-v1:00000000-0000-4000-8000-000000000001:unsaved'
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.items?.length,key)).toBe(1)
  await nav.getByRole('button',{name:'Today'}).click()
  await nav.getByRole('button',{name:'Board'}).click()
  await expect(board).toBeVisible({timeout:15000})
  // The returned page appears before its async Board load finishes.
  await expect(canvas).toHaveAttribute('data-loaded','true',{timeout:15000})
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.items?.length,key)).toBe(1)
  await board.getByRole('button',{name:'Move',exact:true}).click()
  const savedShape=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0],key)
  const before=savedShape.start.x
  await canvas.scrollIntoViewIfNeeded()
  const restored=await canvas.boundingBox()
  const q=(x,y)=>({x:restored.x+x*restored.width,y:restored.y+y*restored.height})
  // Grab the actual center of the restored line, not an approximate pixel.
  const grab={x:(savedShape.start.x+savedShape.end.x)/2,y:(savedShape.start.y+savedShape.end.y)/2}
  const hitPoint=q(grab.x,grab.y)
  expect(hitPoint.y).toBeGreaterThanOrEqual(0)
  expect(hitPoint.y).toBeLessThan(page.viewportSize().height)
  await page.mouse.move(hitPoint.x,hitPoint.y)
  await page.mouse.down()
  await page.mouse.move(q(grab.x+.1,grab.y+.04).x,q(grab.x+.1,grab.y+.04).y,{steps:12})
  await page.mouse.up()
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
  const nav=page.viewportSize().width<700
    ?page.getByRole('navigation',{name:'Workset mobile navigation'})
    :page.locator('.primary-nav')
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
  const nav=page.viewportSize().width<700
    ?page.getByRole('navigation',{name:'Workset mobile navigation'})
    :page.locator('.primary-nav')
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
  const nav=page.viewportSize().width<700
    ?page.getByRole('navigation',{name:'Workset mobile navigation'})
    :page.locator('.primary-nav')
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
  await expect(board.locator('canvas')).toBeVisible()
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

test('Weight entry stays readable with the keyboard open on narrow phones',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:360,height:780})
  await signedIn(page)
  await page.locator('.account-chip').click()
  await page.locator('.me-main-menu').getByRole('button',{name:/Training & Goals/}).click()
  const section=page.locator('[data-me-section="measurements"]')
  await section.locator('.me-section-toggle').click()
  await expect(section.locator('.measurement-edit-card').first()).toBeVisible({timeout:15000})
  for(const width of [320,360,390]){
    await page.setViewportSize({width,height:780})
    const card=section.locator('.measurement-edit-card').first()
    const opener=card.locator('button.measurement-edit-main')
    if(await opener.count())await opener.click()
    const field=section.getByRole('spinbutton',{name:'Enter Bodyweight in lb'})
    await field.fill('197.33')
    await expect(field).toHaveValue('197.33')
    await expect(card.locator('.measurement-entry-preview')).toHaveText('197.33 lb')
    const layout=await page.evaluate(()=>{
      const panel=document.querySelector('.measurement-edit-card.editing')
      const field=panel.querySelector('.measurement-inline-row input')
      const bounds=field.getBoundingClientRect(),card=panel.getBoundingClientRect()
      return {inputWidth:bounds.width,inputRight:bounds.right,cardRight:card.right,
        viewport:document.documentElement.clientWidth,cardWidth:card.width}
    })
    // The value preview makes the entire number visible even on a 320px phone.
    expect(layout.inputWidth).toBeGreaterThan(90)
    expect(layout.cardWidth).toBeGreaterThan(240)
    expect(layout.inputRight).toBeLessThanOrEqual(layout.cardRight+1)
    expect(layout.cardRight).toBeLessThanOrEqual(layout.viewport+1)
  }
  await section.getByRole('button',{name:'Cancel Bodyweight edit'}).click()
  expect(errors).toEqual([])
})

test('Editing a saved 1RM expands the focused input instead of clipping its digits',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:320,height:780})
  await signedIn(page)
  await page.locator('.account-chip').click()
  await page.locator('.me-main-menu').getByRole('button',{name:/Training & Goals/}).click()
  const strength=page.locator('[data-me-section="strength"]')
  await strength.locator('.me-section-toggle').click()
  const field=strength.locator('#me-max-Bench')
  await field.fill('197.33')
  await expect(field).toHaveValue('197.33')
  const layout=await field.evaluate(input=>{
    const active=input.closest('.me-max-field'),field=input.getBoundingClientRect(),parent=active.getBoundingClientRect()
    return {width:field.width,parentWidth:parent.width,right:field.right,parentRight:parent.right}
  })
  expect(layout.width).toBeGreaterThan(140)
  expect(layout.right).toBeLessThanOrEqual(layout.parentRight+1)
  expect(errors).toEqual([])
})

test('a started Walk from yesterday resumes after refresh instead of vanishing at midnight',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page,{withOvernightWalk:true})
  await expect(page.locator('.quick-cardio-runner')).toBeVisible({timeout:15000})
  await expect(page.locator('.quick-cardio-timer-state')).toHaveText('TIMING NOW')
  await expect(page.locator('.quick-cardio-runner').getByRole('button',{name:'Pause'})).toBeVisible()
  await page.reload()
  await expect(page.locator('.quick-cardio-runner')).toBeVisible({timeout:15000})
  await expect(page.locator('.quick-cardio-timer-state')).toHaveText('TIMING NOW')
  expect(errors).toEqual([])
})


test('Today keeps workouts first and offers Food & Water as the final activity choice',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page)
  await expect(page.getByRole('heading',{name:'What are we doing today?'})).toBeVisible({timeout:15000})
  await expect(page.locator('.nutrition-today-card')).toHaveCount(0)
  const choices=page.locator('.today-choice-grid > button')
  const nutrition=choices.last()
  await expect(nutrition).toHaveClass(/today-choice-nutrition/)
  await expect(nutrition).toContainText('Food & Water')
  await expect(page.getByRole('button',{name:/Walk Time, distance or both/})).toBeVisible()
  await nutrition.click()
  await expect(page.locator('.app-header h1')).toHaveText('Nutrition')
  await expect(page.getByRole('heading',{name:'Nutrition & hydration'})).toBeVisible()
  await page.getByRole('button',{name:'← Back'}).last().click()
  await expect(page.locator('.app-header h1')).toHaveText('Today')
  await expect(page.getByRole('heading',{name:'What are we doing today?'})).toBeVisible()
  expect(errors).toEqual([])
})

test('Header bell previews notifications; full inbox opens inside Me, not over Today',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page,{withNotification:true})
  await expect(page.locator('.app-header h1')).toHaveText('Today',{timeout:15000})
  const bell=page.getByRole('button',{name:/1 unread WorkSet notifications/})
  await expect(bell).toBeVisible({timeout:12000})
  const bellPosition=await bell.boundingBox()
  const mePosition=await page.locator('.app-header .account-chip').boundingBox()
  expect(Math.abs(bellPosition.y-mePosition.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(bellPosition.height-mePosition.height)).toBeLessThanOrEqual(1)
  await bell.click()
  const preview=page.getByRole('region',{name:'Recent notifications'})
  await expect(preview).toBeVisible()
  await expect(preview.getByText('Friend request',{exact:true})).toBeVisible()
  await expect(page.locator('.ws-inbox-panel')).toHaveCount(0)
  const box=await preview.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width+1)
  await preview.getByRole('button',{name:'View all in Me'}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  const inboxPage=page.locator('.me-view-inbox')
  await expect(inboxPage).toBeVisible()
  const full=inboxPage.locator('.ws-inbox-inline')
  await expect(full).toBeVisible()
  expect(await full.evaluate(el=>getComputedStyle(el).position)).toBe('relative')
  await expect(page.locator('.ws-inbox-backdrop')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Header messages icon opens a full Me inbox page; profile button returns home',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page)
  await expect(page.locator('.app-header h1')).toHaveText('Today',{timeout:15000})
  const bell=page.locator('.app-header .ws-bell')
  const messages=page.getByRole('button',{name:'Open messages'})
  const me=page.locator('.app-header .account-chip')
  await expect(messages).toBeVisible()
  const b=await bell.boundingBox(),m=await messages.boundingBox(),p=await me.boundingBox()
  expect(Math.abs(b.y-m.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(m.height-p.height)).toBeLessThanOrEqual(2)
  await messages.click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  await expect(page.locator('.me-view-inbox')).toBeVisible()
  await expect(page.locator('.ws-inbox-tabs .selected')).toContainText('Messages')
  await expect(page.locator('.me-main-menu')).toHaveCount(0)
  await page.locator('.app-header .account-chip').click()
  await expect(page.locator('.me-view-home')).toBeVisible()
  await expect(page.locator('.me-main-menu button')).toHaveCount(5)
  expect(errors).toEqual([])
})

test('Empty notification preview is compact and header controls align',async({page})=>{
  await signedIn(page)
  await expect(page.locator('.app-header h1')).toHaveText('Today',{timeout:15000})
  const bell=page.locator('.app-header .ws-bell')
  const me=page.locator('.app-header .account-chip')
  await expect(bell).toBeVisible()
  const bellBox=await bell.boundingBox(),meBox=await me.boundingBox()
  expect(Math.abs(bellBox.y-meBox.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(bellBox.height-meBox.height)).toBeLessThanOrEqual(1)
  await bell.click()
  const preview=page.getByRole('region',{name:'Recent notifications'})
  await expect(preview).toBeVisible()
  await expect(preview.getByRole('button',{name:'Open inbox & messages'})).toBeVisible()
  const box=await preview.boundingBox()
  expect(box.width).toBeLessThanOrEqual(265)
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width+1)
})

test('Planned strength runner finishes after two sets, deletes a set, and records a drop stage',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page,{withStartedStrength:true})
  const exercise=page.locator('.flex-exercise').filter({hasText:'Strict press'})
  await expect(exercise).toBeVisible({timeout:15000})
  await expect(exercise.locator('.set-progress-button')).toHaveCount(4)
  await expect(exercise.getByRole('button',{name:/Finish exercise \(2 of 4 sets\)/})).toBeVisible()
  await exercise.locator('.finish-exercise-early').click()
  await expect(exercise.locator('.set-progress-button.skipped')).toHaveCount(2)
  await expect(exercise.locator('.set-progress-button.done')).toHaveCount(2)
  await exercise.getByRole('button',{name:'Delete set 4'}).click()
  await expect(exercise.locator('.set-progress-button')).toHaveCount(3)
  await expect(exercise.locator('.set-progress-button.skipped')).toHaveCount(1)
  await exercise.getByRole('button',{name:'+ Drop set'}).click()
  await expect(exercise.locator('.set-progress-button')).toHaveCount(6)
  await expect(exercise.getByText('Drop stage 1')).toBeVisible()
  await exercise.getByRole('button',{name:'Complete Drop 1'}).click()
  await expect(page.getByText('Enter the actual reps completed for this drop stage.')).toBeVisible()
  await exercise.locator('.current-set-reps input').fill('11')
  await exercise.getByRole('button',{name:'Complete Drop 1'}).click()
  await expect(exercise.locator('.set-progress-button.done')).toHaveCount(3)
  await expect(exercise.getByText('Drop stage 2')).toBeVisible()
  expect(errors).toEqual([])
})

test('Admin 1RM save confirms persisted weights directly under Save button',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page,{withAdmin:true})
  await expect(page.locator('.app-header h1')).toHaveText('Today',{timeout:15000})
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/Administration/}).click()
  await expect(page.locator('.app-header h1')).toHaveText('Admin')
  await page.locator('.admin-user-row').first().click()
  const card=page.locator('.simple-card').filter({has:page.getByRole('heading',{name:'Coach training numbers'})})
  await expect(card).toBeVisible()
  await card.getByLabel('Press').fill('165.50')
  await card.getByRole('button',{name:'Save 1 rep maxes'}).click()
  const saved=card.locator('.admin-max-save-feedback.success')
  await expect(saved).toBeVisible()
  await expect(saved).toContainText('1RMs saved and verified')
  await expect(saved).toContainText('Confirmed at')
  await card.getByLabel('Bench').fill('202.5')
  await expect(saved).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Admin 1RM database rejection is visibly reported beside Save',async({page})=>{
  await signedIn(page,{withAdmin:true})
  await expect(page.locator('.app-header h1')).toHaveText('Today',{timeout:15000})
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/Administration/}).click()
  await page.locator('.admin-user-row').first().click()
  const card=page.locator('.simple-card').filter({has:page.getByRole('heading',{name:'Coach training numbers'})})
  await card.getByLabel('Press').fill('9999')
  await card.getByRole('button',{name:'Save 1 rep maxes'}).click()
  await expect(card.getByRole('alert')).toContainText('Test database refused')
  await expect(card.locator('.admin-max-save-feedback.success')).toHaveCount(0)
})

test('Exercise entry suggests only a few past names, supports manual match and rename',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signedIn(page,{withStartedStrength:true})
  await expect(page.locator('.flex-exercise').first()).toBeVisible({timeout:15000})
  await page.locator('.quick-add-exercise').click()
  const add=page.locator('.add-exercise-card')
  await add.getByRole('textbox',{name:'Exercise name to add'}).fill('lat')
  const suggestions=page.getByRole('group',{name:'Matching exercise names'})
  await expect(suggestions).toBeVisible()
  expect(await suggestions.getByRole('button').count()).toBeLessThanOrEqual(5)
  await suggestions.getByRole('button',{name:/ISO lateral raises/}).click()
  await expect(add.getByRole('textbox',{name:'Exercise name to add'})).toHaveValue('ISO lateral raises')
  await add.getByRole('button',{name:'Add',exact:true}).click()
  const exercise=page.locator('.flex-exercise').filter({hasText:'ISO lateral raises'})
  await expect(exercise).toBeVisible()
  await exercise.getByText('Match exercise history',{exact:true}).click()
  await exercise.getByRole('textbox',{name:/Find a matching past exercise for ISO lateral raises/}).fill('hammer')
  const match=page.getByRole('group',{name:'Matching exercise names'})
  await expect(match.getByRole('button',{name:/Hammer ISO lateral/})).toBeVisible()
  await match.getByRole('button',{name:/Hammer ISO lateral/}).click()
  page.once('dialog',dialog=>dialog.accept())
  await exercise.getByRole('button',{name:'Link history'}).click()
  await expect(exercise.getByText('Linked to')).toBeVisible()
  const rename=exercise.locator('.exercise-rename-inline')
  await rename.locator('summary').click()
  await rename.getByRole('textbox',{name:/Change exercise name/}).fill('Cable Lateral Raises')
  await rename.getByRole('button',{name:'Use name'}).click()
  await expect(page.locator('.flex-exercise').filter({hasText:'Cable Lateral Raises'})).toBeVisible()
  expect(errors).toEqual([])
})

test('Me can link and unlink names later; previous workout records remain untouched',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page,{withStartedStrength:true})
  await expect(page.locator('.app-header h1')).toHaveText('Today',{timeout:15000})
  await page.locator('.account-chip').click()
  await expect(page.locator('.app-header h1')).toHaveText('Me')
  await page.locator('.me-main-menu').getByRole('button',{name:/Training & Goals/}).click()
  await page.locator('[data-me-section="exercise-names"] .me-section-toggle').click()
  const manager=page.getByRole('region',{name:'Manage exercise names'}).or(page.locator('.exercise-history-manager'))
  await expect(manager).toBeVisible()
  await manager.getByRole('textbox',{name:'Exercise to match'}).fill('iso lat')
  await page.getByRole('group',{name:'Matching exercise names'})
    .getByRole('button',{name:/ISO lateral raises/}).click()
  await manager.getByRole('textbox',{name:'Preferred exercise name'}).fill('hammer')
  await page.getByRole('group',{name:'Matching exercise names'})
    .getByRole('button',{name:/Hammer ISO lateral/}).click()
  page.once('dialog',dialog=>dialog.accept())
  await manager.getByRole('button',{name:'Link exercise history'}).click()
  await expect(manager.getByRole('status')).toContainText('Exercise history linked')
  const row=manager.locator('.exercise-manager-link-row')
  await expect(row).toContainText('ISO lateral raises')
  await expect(row).toContainText('Hammer ISO lateral')
  await row.getByRole('button',{name:'Unlink'}).click()
  await expect(manager.getByRole('status')).toContainText('History link removed')
  await expect(manager.locator('.exercise-manager-link-row')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Exercise name results stay visible when keyboard shrinks phone viewport',async({page})=>{
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await signedIn(page,{withStartedStrength:true})
  await expect(page.locator('.flex-exercise').first()).toBeVisible({timeout:15000})
  await page.locator('.quick-add-exercise').click()
  const field=page.getByRole('textbox',{name:'Exercise name to add'})
  await field.fill('lat')
  const dropdown=page.getByRole('group',{name:'Matching exercise names'})
  await expect(dropdown).toBeVisible()
  await page.setViewportSize({width:390,height:475})
  await field.scrollIntoViewIfNeeded()
  await expect(dropdown).toBeVisible()
  await expect.poll(async()=>{
    const input=await field.boundingBox(),box=await dropdown.boundingBox()
    return Boolean(box&&input&&box.y>=-1&&box.y+box.height<=475&&box.x>=-1&&box.x+box.width<=391)
  }).toBe(true)
  await dropdown.getByRole('button',{name:/ISO lateral raises/}).click()
  await expect(field).toHaveValue('ISO lateral raises')
  expect(errors).toEqual([])
})


test('Settings survives refresh; browser Back returns to Me without leaving WorkSet',async({page})=>{
  await signedIn(page)
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/Settings & Account/}).click()
  await expect(page.getByRole('region',{name:'App updates'})).toBeVisible()
  await page.reload()
  await expect(page.locator('.me-view-settings')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.me-view-home')).toBeVisible()
})


test('History has one Back action and preserves filtered list and workout details across refresh',async({page})=>{
  await signedIn(page,{withStrengthSession:true})
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/Workout History/}).click()
  await expect(page.getByRole('button',{name:'← Back',exact:true})).toHaveCount(1)
  await page.getByRole('button',{name:'List & search'}).click()
  await page.getByLabel('Activity').selectOption('Strength')
  await page.getByRole('searchbox').fill('Bench')
  await page.getByRole('button',{name:/Bench workout.*View details/s}).click()
  await expect(page.getByRole('heading',{name:'Workout details'})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading',{name:'Bench workout',exact:true})).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('searchbox')).toHaveValue('Bench')
  await expect(page.getByLabel('Activity')).toHaveValue('Strength')
  await page.getByRole('button',{name:'← Back',exact:true}).click()
  await expect(page.locator('.me-view-home')).toBeVisible()
})

test('Progress Track & Update returns to the original chart on Back',async({page})=>{
  await signedIn(page,{withStrengthSession:true})
  await page.locator('.account-chip').click()
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
  await page.locator('.progress-section-tabs').getByRole('button',{name:'Strength'}).click()
  await page.locator('.progress-saved-maxes').getByRole('button',{name:/Track.*update saved 1RMs/}).click()
  await expect(page.getByRole('button',{name:'Back to Progress'})).toBeVisible()
  await page.getByRole('button',{name:'Back to Progress'}).click()
  await expect(page.locator('.progress-section-tabs').getByRole('button',{name:'Strength',exact:true})).toHaveAttribute('aria-current','page')
})
