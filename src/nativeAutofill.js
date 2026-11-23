import {Capacitor,registerPlugin} from '@capacitor/core'
// No password is passed to the native bridge or saved in WorkSet.
const AndroidAutofill=registerPlugin('WorkSetAutofill')
export async function notifyNativePasswordLoginSuccess(){
  if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='android')return false
  try {await AndroidAutofill.commitLogin();return true}
  catch(error){console.warn('Android autofill save unavailable:',error);return false}
}
