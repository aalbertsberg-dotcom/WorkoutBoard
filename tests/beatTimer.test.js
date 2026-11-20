import test from 'node:test'
import assert from 'node:assert/strict'
import {MIN_BEAT_BPM,MAX_BEAT_BPM,clampBeatBpm,beatIntervalMs,beatIsAccent,tappedBpm} from '../src/beatTimer.js'

test('BPM accepts valid values and safely clamps malformed or extreme entries',()=>{
  assert.equal(MIN_BEAT_BPM,40)
  assert.equal(MAX_BEAT_BPM,220)
  assert.equal(clampBeatBpm(120),120)
  assert.equal(clampBeatBpm(0),40)
  assert.equal(clampBeatBpm(999),220)
  assert.equal(clampBeatBpm(''),120)
  assert.equal(clampBeatBpm('invalid'),120)
  assert.equal(clampBeatBpm('93.6'),94)
})
test('BPM produces precise beat intervals',()=>{
  assert.equal(beatIntervalMs(60),1000)
  assert.equal(beatIntervalMs(120),500)
  assert.equal(beatIntervalMs(150),400)
})
test('every fourth beat receives the accented click',()=>{
  assert.deepEqual(Array.from({length:8},(_,i)=>beatIsAccent(i+1)),[true,false,false,false,true,false,false,false])
})
test('tap tempo derives cadence without using an unreliable old interval',()=>{
  assert.equal(tappedBpm([1000]),null)
  assert.equal(tappedBpm([1000,1500,2000,2500]),120)
  assert.equal(tappedBpm([1000,1400,1800,2200]),150)
  assert.equal(tappedBpm([1000,1100]),null)
  assert.equal(tappedBpm([1000,3000]),null)
})
