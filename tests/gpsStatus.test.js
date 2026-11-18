import test from 'node:test'
import assert from 'node:assert/strict'
import {describeOutdoorGps} from '../src/gpsStatus.js'
const now=Date.parse('2026-11-18T15:00:00Z')
test('Preflight displays GPS acquired and explicitly says no route recording yet',()=>{
  const result=describeOutdoorGps({outdoor:{gps_health:{
    preflight_at:new Date(now-2000).toISOString(),preflight_accuracy_m:21,
    received:0
  }},now})
  assert.equal(result.phase,'acquired')
  assert.equal(result.label,'GPS acquired · ±21 m')
  assert.match(result.detail,/Route recording starts/)
  assert.equal(result.routeRecording,false)
})
test('Without any location verification, app never claims GPS active',()=>{
  assert.equal(describeOutdoorGps({now}).phase,'unchecked')
  assert.equal(describeOutdoorGps({running:true,now,elapsedSeconds:1}).phase,'waiting')
  assert.equal(describeOutdoorGps({running:true,now,elapsedSeconds:30}).phase,'stale')
})
test('A location fix is not a recorded route, even if the watch is running',()=>{
  const result=describeOutdoorGps({running:true,now,outdoor:{gps_health:{
    received:16,last_received_at:new Date(now-1000).toISOString(),last_accuracy_m:14
  },distance_m:0,points:[{lat:30,lng:-89}]}})
  assert.equal(result.phase,'fix-only')
  assert.match(result.detail,/waiting for confirmed movement/)
  assert.equal(result.routeRecording,false)
})
test('Confirmed route, GPS weakness, stale watch and permission denial are distinct',()=>{
  const route={distance_m:150,points:[{lat:30,lng:-89},{lat:30.001,lng:-89}],
    gps_health:{received:8,last_received_at:new Date(now-1000).toISOString(),last_accuracy_m:12}}
  assert.equal(describeOutdoorGps({running:true,now,outdoor:route}).phase,'recording')
  assert.equal(describeOutdoorGps({running:true,now,outdoor:{...route,gps_health:{...route.gps_health,last_accuracy_m:48}}}).phase,'weak')
  assert.equal(describeOutdoorGps({running:true,now,outdoor:{...route,gps_health:{...route.gps_health,last_received_at:new Date(now-35000).toISOString()}}}).phase,'stale')
  assert.equal(describeOutdoorGps({running:true,now,permission:'denied',outdoor:route}).phase,'blocked')
})
test('Failed or expired preflight check does not look like a good fix',()=>{
  const failure=describeOutdoorGps({now,outdoor:{gps_health:{preflight_error_code:1}}})
  assert.equal(failure.phase,'check-failed')
  const expired=describeOutdoorGps({now,outdoor:{gps_health:{preflight_at:new Date(now-300001).toISOString(),preflight_accuracy_m:10}}})
  assert.equal(expired.phase,'unchecked')
})

test('Pausing a workout never advertises preflight readiness after actual GPS fixes',()=>{
  const state=describeOutdoorGps({now,running:false,outdoor:{
    distance_m:35,points:[{lat:30,lng:-89},{lat:30.0003,lng:-89}],
    gps_health:{preflight_at:new Date(now-40000).toISOString(),
      preflight_accuracy_m:10,received:4,last_received_at:new Date(now-1000).toISOString()}
  }})
  assert.equal(state.phase,'paused')
  assert.match(state.label,/paused/)
})
