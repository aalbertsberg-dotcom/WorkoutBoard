const {test,expect}=require('@playwright/test')
async function openMe(page){
  await page.goto('/tests/fixtures/me.html')
  await expect(page.locator('.me-page')).toBeVisible()
}
test('Me starts organized and collapsed, with profile and History/Progress shortcuts',async({page})=>{
  await openMe(page)
  await expect(page.getByRole('heading',{name:'Test Athlete'})).toBeVisible()
  await expect(page.getByRole('button',{name:/Workout History/})).toBeVisible()
  await expect(page.getByRole('button',{name:/Progress & Analytics/})).toBeVisible()
  const sections=page.locator('.me-section-toggle')
  await expect(sections).toHaveCount(7)
  for(let i=0;i<await sections.count();i++)
    await expect(sections.nth(i)).toHaveAttribute('aria-expanded','false')
  await expect(page.getByText('Your current 1RMs')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Download full backup'})).toHaveCount(0)
  await page.getByRole('button',{name:/Workout History/}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('History opened')
  await page.getByRole('button',{name:/Progress & Analytics/}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Progress opened')
})
test('Sections expand with Enter, retain focus, and unmount again when closed',async({page})=>{
  await openMe(page)
  const toggle=page.locator('[data-me-section="strength"] .me-section-toggle')
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
  const toggle=page.locator('[data-me-section="strength"] .me-section-toggle')
  await toggle.click()
  const input=page.getByRole('spinbutton',{name:'Bench'})
  await input.fill('215.5')
  await expect(page.locator('#me-test-backend')).toContainText('Saves: 0')
  await page.locator('.me-max-field').filter({has:page.getByText('Bench',{exact:true})})
    .getByRole('button',{name:'Save'}).click()
  await expect(page.locator('#me-test-backend')).toContainText('Saves: 1')
  await toggle.click();await toggle.click()
  await expect(page.getByRole('spinbutton',{name:'Bench'})).toHaveValue('215.5')
})
test('Calculator, baseline, program action, and sign out remain connected',async({page})=>{
  await openMe(page)
  await page.locator('[data-me-section="strength"] .me-section-toggle').click()
  await page.getByRole('spinbutton',{name:'Weight lifted'}).fill('185')
  await page.getByRole('spinbutton',{name:'Reps'}).fill('3')
  await expect(page.getByText('203.5 lb',{exact:true}).first()).toBeVisible()
  await page.getByRole('combobox',{name:'Add estimate to'}).selectOption('Bench')
  await page.getByRole('button',{name:/Add 203.5 lb to Bench 1RM/}).click()
  await expect(page.locator('#me-test-backend')).toContainText('Saves: 1')
  await page.getByRole('combobox',{name:'Start a strength baseline'}).selectOption('upper')
  await page.getByRole('button',{name:'Start test'}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Baseline upper')
  await page.locator('[data-me-section="programs"] .me-section-toggle').click()
  await page.getByRole('button',{name:'Plan & programs'}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Plan opened')
  await page.getByRole('button',{name:'Sign out'}).click()
  await expect(page.locator('#me-test-navigation')).toContainText('Sign out clicked')
})
test('All collapsed navigation buttons are fully reachable on narrow and desktop screens',async({page})=>{
  await openMe(page)
  const buttons=page.locator('.me-page button:visible')
  expect(await buttons.count()).toBeGreaterThanOrEqual(11)
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


test('Every collapsed disclosure refers to an existing hidden panel',async({page})=>{
  await openMe(page)
  const buttons=page.locator('.me-section-toggle')
  for(let i=0;i<await buttons.count();i++){
    const id=await buttons.nth(i).getAttribute('aria-controls')
    await expect(page.locator('#'+id)).toHaveAttribute('hidden','')
  }
})


test('Secondary tools open safely, then return to their minimized state',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('https://example.supabase.co/**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},
      body:'[]'})
  })
  await openMe(page)
  for(const id of ['overview','preferences','security','app-data','community']){
    const toggle=page.locator('[data-me-section="'+id+'"] .me-section-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded','true')
    if(id==='app-data')await expect(page.getByRole('button',{name:'Download full backup'})).toBeVisible()
    if(id==='community')await expect(page.getByRole('button',{name:'Share WorkSet'})).toBeVisible()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded','false')
  }
  expect(errors).toEqual([])
  await page.reload()
  await expect(page.locator('.me-section-toggle[aria-expanded="true"]')).toHaveCount(0)
})
