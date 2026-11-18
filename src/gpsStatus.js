// Shared GPS display rules for the workout timer, detailed tracking view,
// and Pocket Mode. A position fix never implies distance was recorded.
const ageMs=(at,now)=>{
  const t=Date.parse(String(at||''))
  return Number.isFinite(t)?Math.max(0,now-t):Infinity
}
const shownAccuracy=n=>{
  const a=Number(n)
  return n!=null&&Number.isFinite(a)&&a>0?' · ±'+Math.round(a)+' m':''
}
export function describeOutdoorGps({outdoor={},running=false,permission='prompt',now=Date.now(),elapsedSeconds=0}={}){
  const health=outdoor?.gps_health||{}
  const count=Math.max(0,Number(health.received||0))
  const accuracy=health.last_accuracy_m??outdoor?.last_accuracy_m??null
  const checkAccuracy=health.preflight_accuracy_m??accuracy
  const checkFresh=ageMs(health.preflight_at,now)<3*60000
  const latestFresh=ageMs(health.last_received_at,now)<30000
  const hadFix=count>0
  const points=Array.isArray(outdoor?.points)?outdoor.points:[]
  const routeRecording=points.length>=2&&Number(outdoor?.distance_m||0)>0
  if(permission==='denied'||health.error_code===1&&running){
    return {phase:'blocked',label:'Location blocked',detail:'Allow location access in Chrome, then retry.',tone:'error',
      gpsReady:false,stale:false,routeRecording:false}
  }
  if(!running){
    // Once the workout has received live fixes, a pause is not a fresh
    // preflight. Do not accidentally show "Ready" while tracking is paused.
    if(points.length||hadFix)return {phase:'paused',label:'GPS paused',detail:'Workout route recording is paused.',
      tone:'muted',gpsReady:false,stale:false,routeRecording:false}
    if(checkFresh&&health.preflight_error_code==null){
      const weak=Number(checkAccuracy)>35
      return {phase:weak?'weak-preflight':'acquired',label:(weak?'GPS weak':'GPS acquired')+shownAccuracy(checkAccuracy),
        detail:'Location fix confirmed. Route recording starts when you tap Start.',
        tone:weak?'warning':'success',gpsReady:true,stale:false,routeRecording:false}
    }
    if(health.preflight_error_code!=null)return {phase:'check-failed',label:'GPS check failed',
      detail:'Try the location check again before starting.',tone:'warning',
      gpsReady:false,stale:false,routeRecording:false}
    return {phase:'unchecked',label:'GPS not checked',detail:'Check GPS before starting your workout.',
      tone:'muted',gpsReady:false,stale:false,routeRecording:false}
  }
  const stale=hadFix?!latestFresh:Number(elapsedSeconds)>=25
  if(stale)return {phase:'stale',label:'GPS updates stopped',detail:'No recent location fix. Try Retry GPS.',
    tone:'warning',gpsReady:false,stale:true,routeRecording:false}
  if(!hadFix)return {phase:'waiting',label:'Waiting for GPS',detail:'Location requested; route not recording yet.',
    tone:'pending',gpsReady:false,stale:false,routeRecording:false}
  const weak=Number(accuracy)>35
  if(weak)return {phase:'weak',label:'GPS weak'+shownAccuracy(accuracy),
    detail:'Location updates are arriving, but GPS accuracy is poor.',
    tone:'warning',gpsReady:true,stale:false,routeRecording}
  if(routeRecording)return {phase:'recording',label:'Recording route'+shownAccuracy(accuracy),
    detail:'GPS movement has been confirmed and added to your route.',
    tone:'success',gpsReady:true,stale:false,routeRecording:true}
  return {phase:'fix-only',label:'GPS acquired'+shownAccuracy(accuracy),
    detail:'Location updates are arriving; waiting for confirmed movement before recording distance.',
    tone:'success',gpsReady:true,stale:false,routeRecording:false}
}
