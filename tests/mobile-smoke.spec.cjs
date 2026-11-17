const {test,expect}=require('@playwright/test')

test('WorkSet entry screen renders without a fatal JavaScript error',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#root')).not.toBeEmpty()
  await page.waitForTimeout(250)
  expect(errors).toEqual([])
})

test('Confirmation opens within viewport after scrolling far down',async({page})=>{
  await page.goto('/tests/fixtures/smoke.html')
  await page.getByRole('button',{name:'Delete workout',exact:true}).click()
  const dialog=page.getByRole('alertdialog',{name:'Delete this workout?'})
  await expect(dialog).toBeVisible()
  const rect=await dialog.boundingBox()
  const viewport=page.viewportSize()
  expect(rect.y).toBeGreaterThanOrEqual(0)
  expect(rect.y+rect.height).toBeLessThanOrEqual(viewport.height+2)
  await page.getByRole('button',{name:'Keep workout'}).click()
  await expect(dialog).toHaveCount(0)
})

test('Pocket Mode unlocks after a deliberate three-second hold',async({page})=>{
  await page.goto('/tests/fixtures/smoke.html')
  await page.getByRole('button',{name:'Open Pocket Mode'}).click()
  const pocket=page.getByRole('dialog',{name:'Pocket Mode touch lock'})
  await expect(pocket).toBeVisible()
  await expect(pocket).toContainText('12:34')
  await page.getByRole('button',{name:'Press and hold for three seconds to unlock'})
    .dispatchEvent('pointerdown',{isPrimary:true,pointerType:'touch',pointerId:1})
  await expect(pocket).toHaveCount(0,{timeout:6000})
})


test('Shared destructive buttons have rounded borders, safe tap targets and respond to touch',async({page})=>{
  await page.goto('/tests/fixtures/smoke.html')
  const button=page.getByRole('button',{name:'Remove template'})
  const box=await button.boundingBox()
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(await button.evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe('solid')
  expect(await button.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThanOrEqual(9)
  await button.click()
  await expect(page.getByRole('status')).toContainText('Template removal action reached')
})
