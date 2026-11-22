import test from 'node:test'
import assert from 'node:assert/strict'
import {navigationTransition} from '../src/navigationHistory.js'

test('switching Progress sections replaces history instead of stacking',()=>{
  for(const targetSection of ['Strength','Cardio','Weight & Measurements','History','Overview']){
    assert.deepEqual(navigationTransition({
      fromTab:'progress',toTab:'progress',currentSection:'Overview',targetSection,depth:1,
    }),targetSection==='Overview'?{action:'none',depth:1}:{action:'replace',depth:1})
  }
})
test('opening Progress from Me gives exactly one Back step',()=>{
  assert.deepEqual(navigationTransition({fromTab:'me',toTab:'progress',depth:0}),{action:'push',depth:1})
})
test('switching bottom navigation does not add back entries',()=>{
  for(const toTab of ['today','together','program','whiteboard','me']){
    assert.deepEqual(navigationTransition({fromTab:'progress',toTab,depth:6}),{action:'replace',depth:0})
  }
})
test('opening History from Progress preserves one drill-in Back step',()=>{
  assert.deepEqual(navigationTransition({fromTab:'progress',toTab:'history',depth:1}),{action:'push',depth:2})
})
test('revisiting the same destination does not change history',()=>{
  assert.deepEqual(navigationTransition({fromTab:'today',toTab:'today',depth:0}),{action:'none',depth:0})
})
test('forced replacements reset to root for back navigation',()=>{
  assert.deepEqual(navigationTransition({fromTab:'history',toTab:'today',depth:3,replace:true}),{action:'replace',depth:0})
})
