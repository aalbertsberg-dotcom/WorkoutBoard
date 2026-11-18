const {test,expect}=require('@playwright/test')

const flexId='00000000-0000-4000-8000-000000000002'
const legacyId='00000000-0000-4000-8000-000000000003'
async function openProgress(page,delayMs=0){
 const session={id:flexId,user_id:'00000000-0000-4000-8000-000000000001',
   title:'Walk',program:'Standalone workout',
   session_date:'2026-11-17',completed_at:'2026-11-17T11:30:00Z',
   workout:{quick_cardio_kind:'walk',outdoor:{distance_m:600,points:[]},quick_timer_elapsed_seconds:1000}}
 await page.route('https://example.supabase.co/**',async route=>{
   const request=route.request()
   if(request.method()==='OPTIONS'){
     await route.fulfill({status:204,headers:{
       'Access-Control-Allow-Origin':'*',
       'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS',
       'Access-Control-Allow-Headers':'apikey,authorization,content-type,prefer,x-client-info'
     }})
     return
   }
   const url=request.url()
   const isSession=url.includes('/rest/v1/training_sessions')
   if(isSession&&delayMs)await new Promise(done=>setTimeout(done,delayMs))
   await route.fulfill({status:200,contentType:'application/json',
     headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(isSession?[session]:[])})
 })
 await page.goto('/tests/fixtures/progress.html')
 await expect(page.getByRole('heading',{name:'Completed workouts'})).toBeVisible()
}
test('Progress rows for recent workouts open the matching session and return',async({page})=>{
 await openProgress(page)
 const workout=page.getByRole('button',{name:'View Walk workout details'})
 await expect(workout).toBeVisible()
 await workout.click()
 await expect(page.getByRole('heading',{name:'Workout details'})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Walk'})).toBeVisible()
 await expect(page.locator('#progress-test-links')).toContainText(flexId)
 await page.getByRole('button',{name:'← Progress'}).click()
 await expect(page.getByRole('heading',{name:'Completed workouts'})).toBeVisible()
})
test('Legacy program workout opens read-only details with recorded weights',async({page})=>{
 await openProgress(page)
 await page.getByRole('button',{name:'View Bench Day workout details'}).click()
 await expect(page.getByRole('heading',{name:'Workout details'})).toBeVisible()
 await expect(page.getByText('Older program workout · read-only history')).toBeVisible()
 await expect(page.getByText('185 lb × 3 reps')).toBeVisible()
 await expect(page.getByRole('button',{name:'Delete',exact:true})).toHaveCount(0)
 await expect(page.locator('#progress-test-links')).toContainText('legacy-'+legacyId)
 await page.getByRole('button',{name:'← Progress'}).click()
 await expect(page.getByRole('heading',{name:'Completed workouts'})).toBeVisible()
})
test('History shows loading rather than a false empty state during fetch',async({page})=>{
 await openProgress(page,300)
 await expect(page.getByRole('button',{name:'View Walk workout details'})).toBeVisible()
 await expect(page.getByText('No completed workouts yet.')).toHaveCount(0)
})
test('Five Progress tabs remain accessible in a single swipeable mobile row',async({page})=>{
 await openProgress(page)
 const tabs=page.locator('.progress-section-tabs')
 await expect(tabs.locator('button')).toHaveCount(5)
 const styles=await tabs.evaluate(node=>{
   const style=getComputedStyle(node)
   return {display:style.display,overflow:style.overflowX,cols:style.gridTemplateColumns}
 })
 if(page.viewportSize().width<700){
   expect(styles.display).toBe('flex')
   expect(styles.overflow).toBe('auto')
 }
 await tabs.getByRole('button',{name:'Cardio'}).click()
 await expect(tabs.getByRole('button',{name:'Cardio'})).toHaveAttribute('aria-current','page')
})
