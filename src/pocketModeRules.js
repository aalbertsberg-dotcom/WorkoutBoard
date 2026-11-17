export const POCKET_HOLD_UNLOCK_MS=3000
export const POCKET_SWIPE_RATIO=0.88
export const POCKET_MIN_SWIPE_PX=80

export function pocketSlideProgress(distancePx,travelPx){
  const distance=Math.max(0,Number(distancePx)||0)
  const travel=Math.max(1,Number(travelPx)||1)
  return Math.min(1,distance/travel)
}
export function pocketSlideUnlocked(distancePx,travelPx){
  const travel=Number(travelPx)
  if(!Number.isFinite(travel)||travel<POCKET_MIN_SWIPE_PX)return false
  return pocketSlideProgress(distancePx,travel)>=POCKET_SWIPE_RATIO
}
export function pocketHoldUnlocked(milliseconds){
  return Number(milliseconds)>=POCKET_HOLD_UNLOCK_MS
}
export function pocketModeStatus(status){
  switch(status){
    case 'active':return {label:'Screen staying awake',detail:'Wake lock active'}
    case 'native':return {label:'Native tracking active',detail:'Location service controls screen-off tracking'}
    case 'unsupported':return {label:'Screen wake lock unavailable',detail:'The display may sleep; GPS could pause'}
    case 'hidden':return {label:'Screen lock paused',detail:'Return to WorkSet to resume wake lock'}
    case 'error':return {label:'Could not keep screen awake',detail:'Check browser settings and keep the display on'}
    case 'released':return {label:'Screen lock released',detail:'The display may sleep; GPS could pause'}
    default:return {label:'Checking screen wake lock…',detail:'Tracking continues while WorkSet remains active'}
  }
}
