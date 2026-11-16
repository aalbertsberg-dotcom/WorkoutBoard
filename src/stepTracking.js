// Browser motion step estimator. No background/OS pedometer access is implied.
// Uses a low-pass gravity estimate, peak re-arming, and walking cadence checks.
export function readMotionMagnitude(event){
  const incl=event?.accelerationIncludingGravity
  const bare=event?.acceleration
  const vector=incl&&[incl.x,incl.y,incl.z].every(v=>v!=null&&Number.isFinite(Number(v)))?incl:
    bare&&[bare.x,bare.y,bare.z].every(v=>v!=null&&Number.isFinite(Number(v)))?bare:null
  if(!vector)return null
  return {magnitude:Math.hypot(Number(vector.x),Number(vector.y),Number(vector.z)),hasGravity:vector===incl}
}

export function createMotionStepCounter() {
  let baseline=null, smooth=0, armed=true, lastPeakAt=0, cadenceStreak=0, lastSampleAt=0
  const sample=(event,now=Date.now())=>{
    const motion=readMotionMagnitude(event)
    if(!motion||!Number.isFinite(now))return 0
    if(lastSampleAt && (now<lastSampleAt||now-lastSampleAt>2200)){
      baseline=null;smooth=0;armed=true;lastPeakAt=0;cadenceStreak=0
    }
    lastSampleAt=now
    if(baseline==null)baseline=motion.hasGravity?motion.magnitude:0
    if(motion.hasGravity)baseline=baseline*.93+motion.magnitude*.07
    const verticalPulse=motion.magnitude-baseline
    smooth=smooth*.60+verticalPulse*.40
    // Require a valley between peaks; a motion event stream cannot count
    // hundreds of steps from one sustained acceleration.
    if(smooth<0.10)armed=true
    if(!armed||smooth<0.9)return 0
    armed=false
    const dt=lastPeakAt?now-lastPeakAt:0
    lastPeakAt=now
    if(dt>=300&&dt<=1400){
      const delta=cadenceStreak===0?2:1
      cadenceStreak++
      return delta
    }
    cadenceStreak=0
    return 0
  }
  const reset=()=>{baseline=null;smooth=0;armed=true;lastPeakAt=0;cadenceStreak=0;lastSampleAt=0}
  return {sample,reset}
}

export function effectiveSteps(outdoor={}){
  const manual=outdoor?.step_tracking?.manual_steps
  if(manual!==undefined&&manual!==null&&manual!==''){
    return Math.max(0,Math.floor(Number(manual)||0))
  }
  return Math.max(0,Math.floor(Number(outdoor?.step_tracking?.sensor_steps||0)))
}

/** A browser may remember motion permission across a reload, but not all
 * browsers do. Try the previously granted sensor stream without a new click;
 * if events do not arrive, require a fresh user gesture instead. */
export function initialMotionAccess({supported=false,requiresPermission=false,previouslyGranted=false}={}) {
  if(!supported)return 'unavailable'
  if(!requiresPermission)return 'automatic'
  return previouslyGranted?'remembered':'required'
}

/** Live provisional GPS has only one location marker. Start and Current
 * markers are separate only once a route has passed the quality threshold. */
export function gpsMarkerCount(pointCount,provisional=false) {
  if(pointCount<=0)return 0
  return provisional||pointCount===1?1:2
}
