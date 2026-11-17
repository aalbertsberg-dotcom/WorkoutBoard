import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validWeightDraft,validRepsDraft,displayedSetWeight,recordedWeightValue,
  canFinishQuickCardio,hasReliableOutdoorRoute,paceIsMeaningful,withoutUnreliableRoute,
  hasLiveGpsFix,gpsJitterFloorMeters,outdoorDistancePresentation,shouldSplitGpsTrack,hasRecordingGaps,hasVerifiedOutdoorRoute
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
  const kept=withoutUnreliableRoute(route)
  assert.equal(kept.distance_m,120)
  assert.equal(kept.distance_quality,'route')
  assert.deepEqual(kept.points,route.points)
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

test('short GPS walk keeps 74 ft estimate while discarding unsupported route and pace',()=>{
  const raw={distance_m:22.56,points:[{lat:30,lng:-88},{lat:30.0002,lng:-88}],step_tracking:{sensor_steps:57},elevation_gain_m:2,splits:[]}
  const saved=withoutUnreliableRoute(raw)
  assert.equal(saved.distance_m,22.56)
  assert.equal(saved.distance_quality,'estimated')
  assert.equal(saved.step_tracking.sensor_steps,57)
  assert.deepEqual(saved.points,[])
  assert.equal(saved.elevation_gain_m,0)
  assert.equal(hasReliableOutdoorRoute(saved),false)
  const display=outdoorDistancePresentation(saved)
  assert.equal(display.label,'≈74 ft')
  assert.equal(display.milesLabel,'≈0.01 mi')
  assert.equal(display.estimated,true)
  assert.equal(display.hasRoute,false)
})
test('no GPS points or distance does not become a phantom estimated walk',()=>{
  const saved=withoutUnreliableRoute({distance_m:0,points:[],step_tracking:{manual_steps:'57'}})
  assert.equal(saved.distance_quality,'none')
  assert.equal(saved.distance_m,0)
  assert.equal(saved.step_tracking.manual_steps,'57')
  assert.equal(outdoorDistancePresentation(saved).label,'0.00 mi')
  assert.equal(outdoorDistancePresentation(saved).estimated,false)
})
test('longer credible GPS track remains route-eligible',()=>{
  const route={distance_m:170,points:[{lat:30,lng:-88},{lat:30.001,lng:-88}]}
  const saved=withoutUnreliableRoute(route)
  assert.equal(saved.distance_quality,'route')
  assert.equal(hasReliableOutdoorRoute(saved),true)
  assert.equal(outdoorDistancePresentation(saved).estimated,false)
  assert.equal(outdoorDistancePresentation(saved).hasRoute,true)
})

test('each untouched set defaults to its own programmed 1RM percentage',()=>{
  const previousSet={weight:'155',weight_edited:true,done:true}
  const currentSet={weight:''}
  // Next set is independently prescribed 140 lb, even after a 155 lb override.
  assert.equal(displayedSetWeight(currentSet,[140,Number(previousSet.weight)]),'140')
  // When prescription changes to 160 lb, do not inherit 155 lb either.
  assert.equal(displayedSetWeight(currentSet,[160,Number(previousSet.weight)]),'160')
  // Intentionally entered weight still overrides this set's target.
  assert.equal(displayedSetWeight({weight:'150',weight_edited:true},[140,155]),'150')
  assert.equal(displayedSetWeight({weight:'',weight_edited:true},[140,155]),'')
  // Previous-set fallback remains available when there is no programmed target.
  assert.equal(displayedSetWeight(currentSet,[0,155]),'155')
})

test('screen-off GPS interruptions split the route and never claim verified mileage',()=>{
  const previous={lat:30,lng:-88,t:1000}
  assert.equal(shouldSplitGpsTrack(previous,{lat:30.001,lng:-88,t:5000}),false)
  assert.equal(shouldSplitGpsTrack(previous,{lat:30.01,lng:-88,t:50000}),true)
  assert.equal(shouldSplitGpsTrack(previous,{lat:30,lng:-88,t:500}),true)
  const partial={distance_m:180,points:[
    {lat:30,lng:-88,t:1000},
    {lat:30.0003,lng:-88,t:5000},
    {lat:30.01,lng:-88,t:50000,break_before:true,gap_reason:'no_updates'},
    {lat:30.0108,lng:-88,t:55000}
  ]}
  assert.equal(hasRecordingGaps(partial),true)
  assert.equal(hasVerifiedOutdoorRoute(partial),false)
  const saved=withoutUnreliableRoute(partial)
  assert.equal(saved.distance_quality,'partial')
  assert.equal(saved.points.length,4)
  const text=outdoorDistancePresentation(saved)
  assert.equal(text.hasRoute,true)
  assert.equal(text.estimated,true)
  assert.equal(text.partial,true)
  assert.equal(hasVerifiedOutdoorRoute({distance_m:180,points:[{lat:30,lng:-88},{lat:30.001,lng:-88}]}),true)
})
