import test from 'node:test'
import assert from 'node:assert/strict'
import {createMotionStepCounter,effectiveSteps,readMotionMagnitude} from '../src/stepTracking.js'

const gravityPulse=m=>({accelerationIncludingGravity:{x:0,y:0,z:m}})
test('motion steps are not inferred without sensor samples',()=>{
  const counter=createMotionStepCounter()
  assert.equal(counter.sample({},1000),0)
  assert.equal(readMotionMagnitude({}),null)
})
test('repeated walking-like motion counts steps with cadence gating',()=>{
  const c=createMotionStepCounter()
  let steps=0
  for(let t=0;t<12000;t+=25){
    const pulse=9.81+3*Math.sin((2*Math.PI*t)/600)
    steps+=c.sample(gravityPulse(pulse),t+1000)
  }
  assert.ok(steps>=10 && steps<=27,`expected plausible steps, got ${steps}`)
})
test('one bump does not claim a walking session',()=>{
  const c=createMotionStepCounter()
  let counted=0
  for(let t=0;t<1800;t+=25){
    counted+=c.sample(gravityPulse(t>500&&t<625?14:9.81),t+1000)
  }
  assert.equal(counted,0)
})
test('paused or unsupported motion can be entered manually',()=>{
  const o={step_tracking:{sensor_steps:18,manual_steps:'42'}}
  assert.equal(effectiveSteps(o),42)
  assert.equal(effectiveSteps({step_tracking:{sensor_steps:18,manual_steps:''}}),18)
  assert.equal(effectiveSteps({}),0)
})
