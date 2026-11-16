import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validWeightDraft,validRepsDraft,displayedSetWeight,recordedWeightValue,
  canFinishQuickCardio,hasReliableOutdoorRoute,paceIsMeaningful,withoutUnreliableRoute,
  hasLiveGpsFix,gpsJitterFloorMeters
} from '../src/trackingRules.js'

test('erasing 135 stays erased even when a previous set offers 135',()=>{
  assert.equal(displayedSetWeight({weight:'',weight_edited:true},[135,125]),'')
  assert.equal(displayedSetWeight({weight:'1',weight_edited:true},[135]),'1')
  assert.equal(displayedSetWeight({weight:'13',weight_edited:true},[135]),'13')
  assert.equal(recordedWeightValue({weight:'',weight_edited:true},135),0)
})

test('untouched sets still inherit programmed or previous weights',()=>{
  assert.equal(displayedSetWeight({weight:''},[0,135,125]),'135')
  assert.equal(displayedSetWeight({weight:'0',weight_edited:true},[135]),'0')
  assert.equal(displayedSetWeight({weight:95},[135]),'95')
  assert.equal(recordedWeightValue({weight:''},135),135)
})

test('numeric drafts permit clearing and intermediate decimal input',()=>{
  for(const draft of ['', '1','13','135','0','135.','135.5','.5'])assert.equal(validWeightDraft(draft),true,draft)
  for(const draft of ['-4','10..2','12a'])assert.equal(validWeightDraft(draft),false,draft)
  for(const draft of ['', '0','8','12'])assert.equal(validRepsDraft(draft),true,draft)
  for(const draft of ['2.5','-1','abc'])assert.equal(validRepsDraft(draft),false,draft)
})

test('finish requires tracked time or an entered manual duration',()=>{
  assert.equal(canFinishQuickCardio(0,''),false)
  assert.equal(canFinishQuickCardio(4,''),false)
  assert.equal(canFinishQuickCardio(5,''),true)
  assert.equal(canFinishQuickCardio(0,'30 min'),true)
  assert.equal(canFinishQuickCardio(0,'0'),false)
})

test('tiny GPS drift is not a credible route or pace',()=>{
  const tiny={distance_m:12,points:[{lat:1,lng:2},{lat:1.0001,lng:2}]}
  assert.equal(hasReliableOutdoorRoute(tiny),false)
  assert.equal(paceIsMeaningful(12,60),false)
  assert.deepEqual(withoutUnreliableRoute(tiny).points,[])
  assert.equal(hasReliableOutdoorRoute({distance_m:100,points:[]}),false)
})

test('plausible movement is retained but stationary pseudo-pace is hidden',()=>{
  const route={distance_m:120,points:[{lat:1,lng:2},{lat:1.001,lng:2}]}
  assert.equal(hasReliableOutdoorRoute(route),true)
  assert.deepEqual(withoutUnreliableRoute(route),route)
  assert.equal(paceIsMeaningful(120,90),true)
  assert.equal(paceIsMeaningful(30,600),false)
})

test('GPS position appears immediately, but a tiny path is not saved as a credible route',()=>{
  const one={distance_m:0,points:[{lat:30.4,lng:-88.9}]}
  const short={distance_m:16,points:[{lat:30.4,lng:-88.9},{lat:30.4001,lng:-88.9}]}
  assert.equal(hasLiveGpsFix(one),true)
  assert.equal(hasReliableOutdoorRoute(one),false)
  assert.equal(hasLiveGpsFix(short),true)
  assert.equal(hasReliableOutdoorRoute(short),false)
  assert.equal(hasLiveGpsFix({points:[]}),false)
  assert.equal(hasLiveGpsFix({points:[{lat:1000,lng:2000}]}),false)
})

test('short movement uses adaptive GPS noise filter instead of a fixed 4–16 meter floor',()=>{
  assert.equal(gpsJitterFloorMeters(5,5),2.5)
  assert.equal(gpsJitterFloorMeters(15,15),4.5)
  assert.equal(gpsJitterFloorMeters(40,40),8)
})
