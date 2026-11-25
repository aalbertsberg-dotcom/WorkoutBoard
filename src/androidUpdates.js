import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform()==='android';
export const WorksetUpdater = registerPlugin('WorksetUpdater');

export const ANDROID_RELEASE_API='https://api.github.com/repos/aalbertsberg-dotcom/WorkoutBoard/releases/latest';
const allowedAsset=/^https:\/\/github\.com\/aalbertsberg-dotcom\/WorkoutBoard\/releases\/download\/android-v([1-9]\d{0,8})\/WorkSet\.apk$/;

export function parseAndroidRelease(release){
  if(!release||release.draft||release.prerelease)return null;
  const code=/^android-v([1-9]\d{0,8})$/.exec(String(release.tag_name||''));
  if(!code)return null;
  const versionCode=Number(code[1]);
  const asset=(release.assets||[]).find(x=>x?.name==='WorkSet.apk'
    &&typeof x.browser_download_url==='string'
    &&allowedAsset.test(x.browser_download_url));
  if(!asset||Number(asset.size)<1000000)return null;
  if(allowedAsset.exec(asset.browser_download_url)?.[1]!==code[1])return null;
  const digest=/^sha256:([a-f0-9]{64})$/i.exec(String(asset.digest||''));
  return {
    versionCode,
    versionLabel:String(release.name||release.tag_name).slice(0,90),
    url:asset.browser_download_url,
    sha256:digest?.[1]?.toLowerCase()||null,
  };
}
export async function checkAndroidUpdate({fetchImpl=fetch,getInfo=()=>App.getInfo()}={}){
  const {build,version}=await getInfo();
  const installedCode=Number(build);
  if(!Number.isSafeInteger(installedCode)||installedCode<1)throw Error('Cannot read the installed Android build.');
  const response=await fetchImpl(ANDROID_RELEASE_API,{
    cache:'no-store',headers:{Accept:'application/vnd.github+json'}
  });
  if(response.status===404)return {state:'no-release',installedCode,version};
  if(!response.ok)throw Error('Android update check failed. Try again later.');
  const release=parseAndroidRelease(await response.json());
  if(!release)return {state:'no-release',installedCode,version};
  if(release.versionCode<=installedCode)return {state:'current',installedCode,version};
  return {state:release.sha256?'available':'missing-digest',installedCode,version,release};
}
export async function applyNativeNavigationInsets(){
  if(!isNativeAndroid())return 0;
  document.documentElement.classList.add('workset-native-android');
  try{
    const {bottom}=await WorksetUpdater.getSystemInsets();
    const safe=Math.max(0,Math.min(100,Number(bottom)||0));
    document.documentElement.style.setProperty('--workset-native-nav-inset',safe+'px');
    return safe;
  }catch{
    // Existing debug APKs do not contain the updater plugin. The new native
    // APK will report the real physical inset; never guess it in web builds.
    document.documentElement.style.setProperty('--workset-native-nav-inset','0px');
    return 0;
  }
}
