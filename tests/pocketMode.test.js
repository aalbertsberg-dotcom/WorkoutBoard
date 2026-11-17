import test from 'node:test'
import assert from 'node:assert/strict'
import {pocketSlideProgress,pocketSlideUnlocked,pocketHoldUnlocked,POCKET_HOLD_UNLOCK_MS,pocketModeStatus} from '../src/pocketModeRules.js'

test('Pocket Mode ignores taps and incomplete swipes',()=>{
  assert.equal(pocketSlideUnlocked(0,220),false)
  assert.equal(pocketSlideUnlocked(100,220),false)
  assert.equal(pocketSlideUnlocked(-10,220),false)
  assert.equal(pocketSlideUnlocked(60,70),false)
  assert.equal(pocketSlideProgress(100,200),.5)
  assert.equal(pocketSlideProgress(500,200),1)
})
test('Pocket Mode unlock requires deliberate full slide',()=>{
  assert.equal(pocketSlideUnlocked(194,220),true)
  assert.equal(pocketSlideUnlocked(180,220),false)
  assert.equal(pocketSlideUnlocked(220,220),true)
})
test('Pocket Mode alternative requires a full three-second hold',()=>{
  assert.equal(POCKET_HOLD_UNLOCK_MS,3000)
  assert.equal(pocketHoldUnlocked(2999),false)
  assert.equal(pocketHoldUnlocked(3000),true)
})
test('Pocket Mode reports wake-lock failures instead of promising background GPS',()=>{
  assert.match(pocketModeStatus('active').label,/awake/)
  assert.match(pocketModeStatus('unsupported').detail,/GPS could pause/)
  assert.match(pocketModeStatus('released').detail,/GPS could pause/)
  assert.match(pocketModeStatus('error').label,/Could not/)
  assert.match(pocketModeStatus('native').label,/Native/)
})
