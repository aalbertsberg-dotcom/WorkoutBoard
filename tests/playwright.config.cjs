const {defineConfig}=require('@playwright/test')

module.exports=defineConfig({
  testDir:'.',
  testMatch:'mobile-smoke.spec.cjs',
  timeout:25000,
  expect:{timeout:6000},
  retries:process.env.CI?1:0,
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure'
  },
  projects:[
    {name:'android-sized',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}},
    {name:'desktop',use:{browserName:'chromium',viewport:{width:1200,height:800}}}
  ],
  webServer:{
    command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    // GitHub Actions builds use /WorkoutBoard/, but the local Vite smoke
    // fixture must be served at root so the browser test can find it.
    env:{...process.env,GITHUB_ACTIONS:''},
    url:'http://127.0.0.1:4173/tests/fixtures/smoke.html',
    timeout:60000,
    reuseExistingServer:!process.env.CI
  }
})
