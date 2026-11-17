import { Capacitor,registerPlugin } from '@capacitor/core'

// Native Android only. Chrome/PWA continues using the existing geolocation API.
// A foreground location notification remains visible during a workout.
const BackgroundGeolocation=registerPlugin('BackgroundGeolocation')
export function canTrackInBackground(){
  return Capacitor.isNativePlatform() && Capacitor.getPlatform()==='android'
}

export async function startNativeLocationWatch(onPosition,onError){
  if(!canTrackInBackground())return null
  const id=await BackgroundGeolocation.addWatcher({
    backgroundTitle:'WorkSet activity in progress',
    backgroundMessage:'Location is being recorded. Open WorkSet to pause or finish.',
    requestPermissions:true,
    stale:false,
    distanceFilter:3,
  },(loc,error)=>{
    if(error){onError?.(error);return}
    if(!loc||!Number.isFinite(Number(loc.latitude))||!Number.isFinite(Number(loc.longitude)))return
    onPosition?.({
      coords:{
        latitude:loc.latitude,longitude:loc.longitude,
        accuracy:loc.accuracy,altitude:loc.altitude,
        altitudeAccuracy:loc.altitudeAccuracy,
        speed:loc.speed,heading:loc.bearing,
      },
      timestamp:Number(loc.time||Date.now()),
    })
  })
  return id
}
export async function stopNativeLocationWatch(id){
  if(id!=null)await BackgroundGeolocation.removeWatcher({id})
}
