import { Capacitor,registerPlugin } from '@capacitor/core'
import { supportsNativeBackgroundGps,nativeGpsPlatformLabel } from './nativePlatforms'

// Android foreground-service location and iOS background Core Location share
// the same watcher API. Chrome/PWA continues using foreground geolocation.
// Recording only runs during an explicitly started activity.
const BackgroundGeolocation=registerPlugin('BackgroundGeolocation')
export function canTrackInBackground(){
  return supportsNativeBackgroundGps(Capacitor.isNativePlatform(),Capacitor.getPlatform())
}

export function nativeGpsDeviceName(){
  return nativeGpsPlatformLabel(Capacitor.isNativePlatform(),Capacitor.getPlatform())
}

export async function startNativeLocationWatch(onPosition,onError){
  if(!canTrackInBackground())return null
  const id=await BackgroundGeolocation.addWatcher({
    // Required for location updates during an active workout on both iOS
    // and Android. iOS will show its location-use indicator; Android shows a
    // persistent foreground-service notification.
    backgroundTitle:'WorkSet activity in progress',
    backgroundMessage:'Workout GPS recording active. Open WorkSet to pause or finish.',
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
