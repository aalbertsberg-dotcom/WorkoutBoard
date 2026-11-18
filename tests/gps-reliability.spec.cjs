const {test,expect}=require('@playwright/test')

async function openGps(page){
  await page.addInitScript(()=>{
    const gps={startCount:0,cleared:0,preflightCount:0,success:null,error:null}
    window.__gps=gps
    Object.defineProperty(navigator,'geolocation',{
      configurable:true,
      value:{
        watchPosition(success,error){
          gps.startCount++
          gps.success=success
          gps.error=error
          return gps.startCount
        },
        clearWatch(){gps.cleared++},
        getCurrentPosition(success){
          gps.preflightCount++
          success({coords:{
            latitude:30.4,longitude:-88.9,accuracy:12,
            speed:0,altitude:null,altitudeAccuracy:null
          },timestamp:Date.now()})
        }
      }
    })
    // An unresolved wake lock must never prevent starting the GPS watcher.
    Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{
      request:()=>new Promise(()=>{})
    }})
    gps.emit=(lat,accuracy=40,speed=0,time=Date.now())=>{
      gps.success?.({
        coords:{
          latitude:lat,longitude:-88.9,
          accuracy,speed,altitude:null,altitudeAccuracy:null
        },timestamp:time
      })
    }
    gps.fail=code=>gps.error?.({code})
  })
  await page.goto('/tests/fixtures/gps.html')
  await expect(page.locator('#workset-gps-panel')).toBeVisible()
}
test('Preflight Check GPS is available before timer starts',async({page})=>{
  await openGps(page)
  await expect(page.getByRole('button',{name:'Check GPS before starting'})).toBeVisible()
  await page.getByRole('button',{name:'Check GPS before starting'}).click()
  await expect(page.getByText('Location available · ±12 m')).toBeVisible()
  const stats=await page.evaluate(()=>({checks:window.__gps.preflightCount,starts:window.__gps.startCount}))
  expect(stats.checks).toBe(1)
  expect(stats.starts).toBe(0)
})
test('GPS watch starts even when screen wake-lock never resolves',async({page})=>{
  await openGps(page)
  await page.getByRole('button',{name:'Start mock walk'}).click()
  await expect.poll(async()=>page.evaluate(()=>window.__gps.startCount)).toBe(1)
  await expect(page.getByText('Waiting for GPS location')).toBeVisible()
  await expect(page.getByRole('button',{name:'Retry GPS'})).toBeVisible()
})
test('Poor 90m GPS signal does not invent distance but clearly reports weakness',async({page})=>{
  await openGps(page)
  await page.getByRole('button',{name:'Start mock walk'}).click()
  await expect.poll(async()=>page.evaluate(()=>window.__gps.startCount)).toBe(1)
  await page.evaluate(()=>window.__gps.emit(30.4,90,0,Date.now()))
  await expect(page.getByText('GPS weak · ±90 m')).toBeVisible()
  await expect(page.locator('#gps-distance')).toContainText('0')
  const snapshot=await page.locator('#gps-health').textContent()
  expect(JSON.parse(snapshot).received).toBeGreaterThanOrEqual(1)
})
test('Coherent walking positions are recorded despite browser-reported speed zero',async({page})=>{
  await openGps(page)
  await page.getByRole('button',{name:'Start mock walk'}).click()
  await expect.poll(async()=>page.evaluate(()=>window.__gps.startCount)).toBe(1)
  await page.evaluate(()=>{
    const start=Date.now()-135000
    for(let i=0;i<=12;i++)
      window.__gps.emit(30.4+i*0.0001,40,0,start+i*10000)
  })
  await expect.poll(async()=>{
    const s=await page.locator('#gps-distance').textContent()
    return Number(s)
  }).toBeGreaterThan(45)
  const telemetry=JSON.parse(await page.locator('#gps-health').textContent())
  expect(telemetry.received).toBeGreaterThanOrEqual(13)
  await expect(page.getByText(/13 location updates received/)).toBeVisible()
})
test('GPS error displays permission guidance and Retry restarts one watch',async({page})=>{
  await openGps(page)
  await page.getByRole('button',{name:'Start mock walk'}).click()
  await expect.poll(async()=>page.evaluate(()=>window.__gps.startCount)).toBe(1)
  await page.evaluate(()=>window.__gps.fail(1))
  await expect(page.getByText('Location permission blocked')).toBeVisible()
  await page.getByRole('button',{name:'Retry GPS'}).click()
  await expect.poll(async()=>page.evaluate(()=>window.__gps.startCount)).toBe(2)
  expect(await page.evaluate(()=>window.__gps.cleared)).toBeGreaterThanOrEqual(1)
})
