// Shared, dependency-free rules for editable strength sets and outdoor sessions.
// Keep these independently testable so a default cannot overwrite an explicit edit.
export const MIN_RELIABLE_ROUTE_METERS = 30
export const MIN_PACE_SECONDS = 15
export const MIN_MOVING_SPEED_MPS = 0.45

// Live preview is deliberately separate from the stricter persisted-route quality gate.
// One GPS fix can locate the user; a longer, credible track is needed for saved routes.
export function hasLiveGpsFix(outdoor) {
  return Array.isArray(outdoor?.points) && outdoor.points.some(p=>
    Number.isFinite(p?.lat) && Number.isFinite(p?.lng) &&
    Math.abs(p.lat)<=90 && Math.abs(p.lng)<=180
  )
}

// Use smaller adaptive noise filtering for short walks without trusting large jumps.
export function gpsJitterFloorMeters(currentAccuracy,lastAccuracy) {
  const current=Number.isFinite(Number(currentAccuracy))?Math.max(0,Number(currentAccuracy)):12
  const previous=Number.isFinite(Number(lastAccuracy))?Math.max(0,Number(lastAccuracy)):12
  return Math.max(2.5,Math.min(8,(current+previous)*0.15))
}

export function validWeightDraft(value) {
  return /^\d*(?:\.\d*)?$/.test(String(value))
}

export function validRepsDraft(value) {
  return /^\d*$/.test(String(value))
}

export function displayedSetWeight(set, defaults=[]) {
  const value=set?.weight
  // Explicitly cleared or partially typed values must win over suggestions.
  if(set?.weight_edited)return String(value??'')
  if(value!==undefined&&value!==null&&value!=='')return String(value)
  const suggested=defaults.find(v=>Number.isFinite(Number(v))&&Number(v)>0)
  return suggested===undefined?'':String(suggested)
}

export function recordedWeightValue(set, legacy=0) {
  if(set?.weight_edited)return Number(set.weight)||0
  if(set?.weight!==undefined&&set?.weight!==null&&set?.weight!=='')return Number(set.weight)||0
  return Number(legacy)||0
}

export function canFinishQuickCardio(elapsedSeconds, manualDuration='') {
  // The timer must have actually run; alternatively a real manual duration was entered.
  return Number(elapsedSeconds)>=5 || /[1-9]/.test(String(manualDuration||''))
}

export function hasReliableOutdoorRoute(outdoor) {
  return Number(outdoor?.distance_m||0)>=MIN_RELIABLE_ROUTE_METERS &&
    Array.isArray(outdoor?.points) && outdoor.points.length>=2
}

export function paceIsMeaningful(distanceMeters,seconds) {
  return Number(distanceMeters)>=MIN_RELIABLE_ROUTE_METERS &&
    Number(seconds)>=MIN_PACE_SECONDS &&
    Number(distanceMeters)/Number(seconds)>=MIN_MOVING_SPEED_MPS
}

export function withoutUnreliableRoute(outdoor) {
  if(hasReliableOutdoorRoute(outdoor))return outdoor
  return {...outdoor,points:[],distance_m:0,elevation_gain_m:0,splits:[],last_accuracy_m:null}
}
