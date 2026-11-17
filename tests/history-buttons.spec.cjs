const {test,expect}=require('@playwright/test')

const WORKOUT_ID='00000000-0000-4000-8000-000000000002'
async function openHistory(page){
  const today=new Date().toISOString().slice(0,10)
  let deleted=false
  const requests=[]
  const row={
    id:WORKOUT_ID,user_id:'00000000-0000-4000-8000-000000000001',
    title:'Walk',program:'Standalone workout',session_date:today,
    completed_at:today+'T12:35:00Z',created_at:today+'T11:45:00Z',
    workout:{quick_cardio:true,quick_cardio_kind:'walk',quick_timer_elapsed_seconds:3202,
      outdoor:{distance_m:0,points:[],step_tracking:{manual_steps:0}}}
  }
  await page.route('https://example.supabase.co/**',async route=>{
    const req=route.request(),url=req.url()
    if(req.method()==='OPTIONS'){
      await route.fulfill({status:204,headers:{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers':'apikey,authorization,content-type,prefer,x-client-info'
      }})
      return
    }
    if(url.includes('/rest/v1/training_sessions')){
      requests.push(req.method())
      if(req.method()==='DELETE'){
        deleted=true
        await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}})
        return
      }
      await route.fulfill({
        status:200,contentType:'application/json',
        headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Content-Range',
          'Content-Range':deleted?'*/0':'0-0/1'},
        body:JSON.stringify(deleted?[]:[row])
      })
      return
    }
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{}'})
  })
  await page.goto('/tests/fixtures/history.html')
  await expect(page.getByRole('heading',{name:'Workout details'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Delete',exact:true})).toBeVisible()
  return {requests,wasDeleted:()=>deleted}
}

test('History Edit and Delete are equal-size, aligned and clickable',async({page})=>{
  await openHistory(page)
  const edit=page.getByRole('button',{name:'Edit',exact:true})
  const remove=page.getByRole('button',{name:'Delete',exact:true})
  const a=await edit.boundingBox(),b=await remove.boundingBox()
  const viewport=page.viewportSize()
  expect(Math.abs(a.y-b.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(a.height-b.height)).toBeLessThanOrEqual(2)
  expect(Math.abs(a.width-b.width)).toBeLessThanOrEqual(2)
  expect(a.height).toBeGreaterThanOrEqual(44)
  expect(b.height).toBeGreaterThanOrEqual(44)
  expect(b.x+b.width).toBeLessThanOrEqual(viewport.width+1)
  expect(await remove.evaluate(node=>getComputedStyle(node).borderTopStyle)).toBe('solid')
  expect(await remove.evaluate(node=>getComputedStyle(node).borderTopWidth)).toBe('1px')
  await edit.click()
  await expect(page.getByRole('heading',{name:'EDIT COMPLETED WORKOUT'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await expect(page.getByRole('button',{name:'Edit',exact:true})).toBeVisible()
})

test('Delete opens centered prompt, Keep cancels, Delete actually removes record via mocked API',async({page})=>{
  const {requests,wasDeleted}=await openHistory(page)
  await page.getByRole('button',{name:'Delete',exact:true}).click()
  const dialog=page.getByRole('alertdialog',{name:'Delete this workout?'})
  await expect(dialog).toBeVisible()
  await page.getByRole('button',{name:'Keep workout'}).click()
  await expect(dialog).toHaveCount(0)
  expect(wasDeleted()).toBe(false)
  await page.getByRole('button',{name:'Delete',exact:true}).click()
  await page.getByRole('button',{name:'Delete workout',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Workout deleted.')
  expect(requests).toContain('DELETE')
  expect(wasDeleted()).toBe(true)
})

test('History back, list, filters, search, calendar and month navigation all respond',async({page})=>{
  await openHistory(page)
  await page.getByRole('button',{name:'← All workouts'}).click()
  await expect(page.getByRole('button',{name:'Calendar',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'List & search'}).click()
  await expect(page.getByRole('button',{name:/Walk.*View details/s})).toBeVisible()
  await page.getByRole('searchbox').fill('zz-no-match')
  await expect(page.getByRole('text',{name:'No matching workouts in the loaded history.'})).toBeVisible()
  await page.getByRole('searchbox').fill('Walk')
  await expect(page.getByRole('button',{name:/Walk.*View details/s})).toBeVisible()
  await page.getByLabel('Activity').selectOption('Strength')
  await expect(page.getByRole('text',{name:'No matching workouts in the loaded history.'})).toBeVisible()
  await page.getByLabel('Activity').selectOption('Cardio')
  await expect(page.getByRole('button',{name:/Walk.*View details/s})).toBeVisible()
  await page.getByRole('button',{name:'Calendar',exact:true}).click()
  const initial=await page.locator('.history-month h3').innerText()
  await page.getByRole('button',{name:'Previous month'}).click()
  expect(await page.locator('.history-month h3').innerText()).not.toBe(initial)
  await page.getByRole('button',{name:'Next month'}).click()
  expect(await page.locator('.history-month h3').innerText()).toBe(initial)
})

test('Every visible History control has a reachable center and a usable tap area',async({page})=>{
  await openHistory(page)
  const buttons=page.locator('.workset-history button:visible')
  const count=await buttons.count()
  expect(count).toBeGreaterThanOrEqual(3)
  for(let i=0;i<count;i++){
    const item=buttons.nth(i)
    await item.scrollIntoViewIfNeeded()
    const hit=await item.evaluate(node=>{
      const r=node.getBoundingClientRect()
      const x=r.left+r.width/2,y=r.top+r.height/2
      const top=document.elementFromPoint(x,y)
      return {height:r.height,width:r.width,inside:r.left>=-1&&r.right<=innerWidth+1,
        hit:node===top||node.contains(top)}
    })
    expect(hit.height).toBeGreaterThanOrEqual(40)
    expect(hit.inside).toBe(true)
    expect(hit.hit).toBe(true)
  }
})
