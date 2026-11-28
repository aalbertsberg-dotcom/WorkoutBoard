const {test,expect}=require('@playwright/test')
async function openMe(page){
  await page.goto('/tests/fixtures/me.html')
  await expect(page.locator('.me-page')).toBeVisible()
}
async function openTraining(page){
  await page.locator('.me-main-menu').getByRole('button',{name:/Training & Goals/}).click()
  await expect(page.locator('.me-view-training')).toBeVisible()
}
async function openSettings(page){
  await page.locator('.me-main-menu').getByRole('button',{name:/Settings & Account/}).click()
  await expect(page.locator('.me-view-settings')).toBeVisible()
}

test('Me starts organized and collapsed, with profile and History/Progress shortcuts',async({page})=>{
  await openMe(page)
  await expect(page.getByRole('heading',{name:'Test Athlete'})).toBeVisible()
  await expect(page.getByRole('button',{name:/Workout History/})).toBeVisible()
  await expect(page.getByRole('button',{name:/Progress & Analytics/})).toBeVisible()
  await expect(page.getByRole('button',{name:/Food & Water/})).toBeVisible()
  await expect(page.locator('.me-section-toggle')).toHaveCount(0)
  await expect(page.locator('.me-main-menu button')).toHaveCount(5)
  await expect(page.locator('.me-view-home .ws-inbox-panel')).toHaveCount(0)
  await expect(page.locator('.me-view-home .me-update-card')).toHaveCount(0)
  await expect(page.locator('.me-version-label')).toContainText('WorkSet v')
  await expect(page.getByText('Your current 1RMs')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Download training backup'})).toHaveCount(0)
  await page.getByRole('button',{name:/Workout History/}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('History opened')
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Progress opened')
})
test('Sections expand with Enter, retain focus, and unmount again when closed',async({page})=>{
  await openMe(page)
  await openTraining(page)
  const toggle=page.locator('[data-me-section="strength"] > .me-section-title > .me-section-toggle')
  await toggle.focus();await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded','true')
  await expect(page.getByText('Your current 1RMs')).toBeVisible()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded','false')
  await expect(page.getByText('Your current 1RMs')).toHaveCount(0)
  await expect(toggle).toBeFocused()
})
test('Profile Save is explicit, confirms changes and handles server rejection',async({page})=>{
  await openMe(page)
  await page.getByRole('button',{name:'Edit name'}).click()
  await page.getByRole('textbox',{name:'Display name'}).fill('New Athlete')
  await page.getByRole('button',{name:'Save name'}).click()
  await expect(page.getByRole('heading',{name:'New Athlete'})).toBeVisible()
  await expect(page.getByText('Display name saved.')).toBeVisible()
  await page.getByRole('button',{name:'Edit name'}).click()
  await page.getByRole('textbox',{name:'Display name'}).fill('Reject Name')
  await page.getByRole('button',{name:'Save name'}).click()
  await expect(page.getByText('Server rejected this name.')).toBeVisible()
  await expect(page.getByRole('heading',{name:'New Athlete'})).toBeVisible()
  await page.getByRole('button',{name:'Cancel'}).click()
  await expect(page.getByRole('textbox',{name:'Display name'})).toHaveCount(0)
  await expect(page.locator('#me-test-backend')).toContainText('Saves: 2')
})
test('1RM editing requires Save and preserves values across collapsing',async({page})=>{
  await openMe(page)
  await openTraining(page)
  const toggle=page.locator('[data-me-section="strength"] > .me-section-title > .me-section-toggle')
  await toggle.click()
  const input=page.getByRole('spinbutton',{name:'Bench'})
  await input.fill('215.5')
  await expect(page.locator('#me-test-backend')).toContainText('Saves: 0')
  const grid=page.locator('.me-max-grid')
  const before=await grid.boundingBox()
  await page.locator('.me-max-field').filter({has:page.getByText('Bench',{exact:true})})
    .getByRole('button',{name:'Save'}).click()
  await expect(page.locator('#me-test-backend')).toContainText('Saves: 1')
  await expect(page.locator('.me-max-field').filter({has:page.getByText('Bench',{exact:true})})
    .getByRole('status')).toContainText('✓ Bench 215.50 lb saved.')
  const after=await grid.boundingBox()
  expect(Math.abs(after.height-before.height)).toBeLessThanOrEqual(2)
  await toggle.click();await toggle.click()
  await expect(page.getByRole('spinbutton',{name:'Bench'})).toHaveValue('215.5')
})
test('Calculator, baseline, program action, and sign out remain connected',async({page})=>{
  await openMe(page)
  await openTraining(page)
  await page.locator('[data-me-section="strength"] > .me-section-title > .me-section-toggle').click()
  await page.locator('[data-me-section="strength-calculator"] > .me-section-title > .me-section-toggle').click()
  await page.getByRole('spinbutton',{name:'Weight lifted'}).fill('185')
  await page.getByRole('spinbutton',{name:'Reps'}).fill('3')
  await expect(page.getByText('203.5 lb',{exact:true}).first()).toBeVisible()
  await page.getByRole('combobox',{name:'Add estimate to'}).selectOption('Bench')
  await page.getByRole('button',{name:/Add 203.5 lb to Bench 1RM/}).click()
  await expect(page.locator('#me-test-backend')).toContainText('Saves: 1')
  await page.locator('[data-me-section="strength-baseline"] > .me-section-title > .me-section-toggle').click()
  await page.getByRole('combobox',{name:'Start a strength baseline'}).selectOption('upper')
  await page.getByRole('button',{name:'Start test'}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Baseline upper')
  // Programs are available from the persistent Plan navigation, not duplicated in Me.
  await page.getByRole('button',{name:'Back to Me'}).click()
  await openSettings(page)
  await page.getByRole('button',{name:'Sign out'}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Sign out clicked')
})
test('All collapsed navigation buttons are fully reachable on narrow and desktop screens',async({page})=>{
  await openMe(page)
  const buttons=page.locator('.me-page button:visible')
  expect(await buttons.count()).toBeGreaterThanOrEqual(6)
  for(let i=0;i<await buttons.count();i++){
    const btn=buttons.nth(i)
    await btn.scrollIntoViewIfNeeded()
    const box=await btn.evaluate(el=>{
      const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)
      return {x:r.left,right:r.right,height:r.height,reachable:top===el||el.contains(top)}
    })
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.right).toBeLessThanOrEqual(page.viewportSize().width+1)
    expect(box.height).toBeGreaterThanOrEqual(40)
    expect(box.reachable).toBe(true)
  }
})


test('Every training and settings disclosure refers to a hidden panel',async({page})=>{
  await openMe(page)
  for(const destination of ['training','settings']){
    if(destination==='training')await openTraining(page)
    else await openSettings(page)
    const buttons=page.locator('.me-section-toggle')
    for(let i=0;i<await buttons.count();i++){
      const id=await buttons.nth(i).getAttribute('aria-controls')
      await expect(page.locator('#'+id)).toHaveAttribute('hidden','')
    }
    await page.getByRole('button',{name:'Back to Me'}).click()
  }
})


test('Secondary tools stay collapsed inside their focused Me pages',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('https://example.supabase.co/**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:'[]'})
  })
  await openMe(page)
  await openTraining(page)
  const strength=page.locator('[data-me-section="strength"] > .me-section-title > .me-section-toggle')
  await strength.click()
  await expect(strength).toHaveAttribute('aria-expanded','true')
  await strength.click()
  await page.getByRole('button',{name:'Back to Me'}).click()
  await openSettings(page)
  for(const id of ['preferences','security','app-data','community']){
    const toggle=page.locator('[data-me-section="'+id+'"] .me-section-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded','true')
    if(id==='app-data')await expect(page.getByRole('button',{name:'Download training backup'})).toBeVisible()
    if(id==='community')await expect(page.getByRole('button',{name:'Share WorkSet'})).toBeVisible()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded','false')
  }
  expect(errors).toEqual([])
  await page.reload()
  await expect(page.locator('.me-main-menu button')).toHaveCount(5)
  await expect(page.locator('.me-section-toggle')).toHaveCount(0)
})


test('Updates stay discoverable inside Settings & Account',async({page})=>{
  await openMe(page)
  await expect(page.getByRole('region',{name:'App updates'})).toHaveCount(0)
  await openSettings(page)
  const card=page.getByRole('region',{name:'App updates'})
  await expect(card).toBeVisible()
  await expect(card).toContainText('WorkSet v')
  await expect(card.getByRole('button',{name:'Check for updates'})).toBeVisible()
  await expect(card.getByRole('button',{name:'Refresh WorkSet'})).toBeEnabled()
  await card.getByRole('button',{name:'Refresh WorkSet'}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Refreshed safely')
})
test('A new release is detected without clearing browser caches',async({page})=>{
  await page.route('**/version.json?**',async route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({buildId:'different-new-release'})
  }))
  await openMe(page)
  await openSettings(page)
  const card=page.getByRole('region',{name:'App updates'})
  await card.getByRole('button',{name:'Check for updates'}).click()
  await expect(card.getByText('New version available.')).toBeVisible()
  await expect(card.getByRole('button',{name:'Update now'})).toBeEnabled()
})
test('Strength tools remain compact until individually expanded',async({page})=>{
  await openMe(page)
  await openTraining(page)
  await page.locator('[data-me-section="strength"] > .me-section-title > .me-section-toggle').click()
  await expect(page.getByText('Your current 1RMs')).toBeVisible()
  for(const id of ['strength-calculator','strength-estimates','strength-baseline'])
    await expect(page.locator('[data-me-section="'+id+'"] > .me-section-title > .me-section-toggle')).toHaveAttribute('aria-expanded','false')
  await expect(page.getByRole('spinbutton',{name:'Weight lifted'})).toHaveCount(0)
  await page.locator('[data-me-section="strength-calculator"] > .me-section-title > .me-section-toggle').click()
  await expect(page.getByRole('spinbutton',{name:'Weight lifted'})).toBeVisible()
})


test('Rejected 1RM save keeps the previous stored value when section reopens',async({page})=>{
  await openMe(page)
  await openTraining(page)
  const strength=page.locator('[data-me-section="strength"] > .me-section-title > .me-section-toggle')
  await strength.click()
  const field=page.locator('.me-max-field').filter({has:page.getByText('Bench',{exact:true})})
  await expect(field.getByRole('spinbutton')).toHaveValue('200')
  await field.getByRole('spinbutton').fill('9999')
  await field.getByRole('button',{name:'Save'}).click()
  await expect(field.getByText('Simulated max save rejected.')).toBeVisible()
  await strength.click()
  await strength.click()
  await expect(page.locator('.me-max-field').filter({has:page.getByText('Bench',{exact:true})})
    .getByRole('spinbutton')).toHaveValue('200')
})

test('Account backup never reports success when a data table fails',async({page})=>{
  await page.route('https://example.supabase.co/**',async route=>{
    const url=route.request().url()
    if(route.request().method()==='OPTIONS'){
      await route.fulfill({status:204,headers:{
        'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,prefer,x-client-info',
        'Access-Control-Allow-Methods':'GET,OPTIONS'}})
      return
    }
    const failed=url.includes('/rest/v1/program_library')
    await route.fulfill({status:failed?500:200,
      contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*'},
      body:failed?JSON.stringify({message:'Simulated account backup failure'}):'[]'})
  })
  await openMe(page)
  await openSettings(page)
  await page.locator('[data-me-section="app-data"] > .me-section-title > .me-section-toggle').click()
  await page.getByRole('button',{name:'Download training backup'}).click()
  await expect(page.getByText(/Backup NOT downloaded.*program_library/)).toBeVisible()
  await expect(page.getByText('Training backup downloaded successfully.')).toHaveCount(0)
})

test('Inbox opens as an uncluttered Me page, not a duplicate card',async({page})=>{
  await page.route('https://example.supabase.co/**',async route=>route.fulfill({
    status:200,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:'[]'
  }))
  await openMe(page)
  await expect(page.locator('.me-view-home .ws-inbox-panel')).toHaveCount(0)
  await expect(page.locator('.me-main-menu button')).toHaveCount(5)
  await page.locator('#me-test-open-inbox').click()
  await expect(page.locator('.me-view-inbox')).toBeVisible()
  const panel=page.locator('.me-view-inbox .ws-inbox-inline')
  await expect(panel).toBeVisible()
  expect(await panel.evaluate(el=>getComputedStyle(el).position)).toBe('relative')
  await expect(page.locator('.ws-inbox-backdrop')).toHaveCount(0)
  const r=await panel.boundingBox(),viewport=page.viewportSize()
  expect(r.x).toBeGreaterThanOrEqual(-1)
  expect(r.x+r.width).toBeLessThanOrEqual(viewport.width+1)
  await page.getByRole('button',{name:'Back to Me'}).click()
  await expect(page.locator('.me-main-menu button')).toHaveCount(5)
  await expect(page.locator('.ws-inbox-panel')).toHaveCount(0)
})
test('Exercise names can be managed later from Me without opening a workout',async({page})=>{
  await page.route('https://example.supabase.co/**',async route=>route.fulfill({
    status:200,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:'[]'
  }))
  await openMe(page)
  await openTraining(page)
  const section=page.locator('[data-me-section="exercise-names"]')
  await expect(section.locator('.me-section-toggle')).toHaveAttribute('aria-expanded','false')
  await section.locator('.me-section-toggle').click()
  await expect(section.locator('.me-section-toggle')).toHaveAttribute('aria-expanded','true')
  await expect(section.getByRole('textbox',{name:'Exercise to match'})).toBeVisible()
  await expect(section.getByRole('textbox',{name:'Preferred exercise name'})).toBeVisible()
  await expect(section.getByRole('button',{name:'Link exercise history'})).toBeDisabled()
})
