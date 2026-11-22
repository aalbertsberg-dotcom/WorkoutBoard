import test from 'node:test'
import assert from 'node:assert/strict'
import {keepTimerPanelVisible,canSwitchTimerMode,timerIsActive} from '../src/timerPolicies.js'

test('AMRAP, EMOM, Metcon, Intervals and Stopwatch keep controls visible',()=>{
  for(const mode of ['AMRAP','EMOM','Metcon','Intervals','Stopwatch','Beats'])
    assert.equal(keepTimerPanelVisible(mode),true,mode)
  assert.equal(keepTimerPanelVisible('Rest'),false)
})
test('running or paused nonzero timer cannot be accidentally cleared by mode switching',()=>{
  assert.equal(canSwitchTimerMode({running:true,elapsed:10}),false)
  assert.equal(canSwitchTimerMode({running:false,elapsed:10}),false)
  assert.equal(canSwitchTimerMode({beatsRunning:true}),false)
  assert.equal(canSwitchTimerMode({running:false,elapsed:0,beatsRunning:false}),true)
})
test('timer active state includes Beats and timed modes only',()=>{
  assert.equal(timerIsActive({running:true,mode:'EMOM'}),true)
  assert.equal(timerIsActive({beatsRunning:true,mode:'Beats'}),true)
  assert.equal(timerIsActive({beatsRunning:true,mode:'Rest'}),false)
})
