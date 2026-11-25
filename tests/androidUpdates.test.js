import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAndroidRelease,checkAndroidUpdate,ANDROID_RELEASE_API} from '../src/androidUpdates.js';

const makeRelease=(build=100001)=>({
  tag_name:'android-v'+build,name:'WorkSet Android v2.11.1',draft:false,prerelease:false,
  assets:[{name:'WorkSet.apk',
    browser_download_url:'https://github.com/aalbertsberg-dotcom/WorkoutBoard/releases/download/android-v'+build+'/WorkSet.apk',
    digest:'sha256:'+'a'.repeat(64),size:4567890}]
});
test('Accepts only an official WorkSet signed APK release with SHA-256 metadata',()=>{
 const value=parseAndroidRelease(makeRelease());
 assert.equal(value.versionCode,100001);
 assert.equal(value.sha256,'a'.repeat(64));
 assert.equal(value.url.endsWith('/WorkSet.apk'),true);
});
test('Rejects foreign hosts, changed asset name, tag mismatch, and prerelease',()=>{
 const r=makeRelease();
 assert.equal(parseAndroidRelease({...r,prerelease:true}),null);
 assert.equal(parseAndroidRelease({...r,assets:[{...r.assets[0],name:'WorkSet-2.apk'}]}),null);
 assert.equal(parseAndroidRelease({...r,assets:[{...r.assets[0],
   browser_download_url:r.assets[0].browser_download_url.replace('github.com','another.example')}]}),null);
 assert.equal(parseAndroidRelease({...r,assets:[{...r.assets[0],
   browser_download_url:r.assets[0].browser_download_url.replace('android-v100001','android-v100002')}]}),null);
});
test('Missing checksum does not allow an automatic APK install',()=>{
 const r=makeRelease();
 const actual=parseAndroidRelease({...r,assets:[{...r.assets[0],digest:null}]});
 assert.equal(actual.sha256,null);
});
test('Compares installed Android versionCode, not web app build hash',async()=>{
 const response={ok:true,json:async()=>makeRelease()};
 const fetched=[];
 const network=async(url)=>{fetched.push(url);return response;};
 const available=await checkAndroidUpdate({fetchImpl:network,getInfo:async()=>({build:'1',version:'2.7.19'})});
 assert.equal(available.state,'available');
 assert.equal(available.release.versionCode,100001);
 const current=await checkAndroidUpdate({fetchImpl:network,getInfo:async()=>({build:'100001',version:'2.11.1'})});
 assert.equal(current.state,'current');
 assert.deepEqual(fetched,[ANDROID_RELEASE_API,ANDROID_RELEASE_API]);
});
test('No published Android release leaves web/PWA unaffected',async()=>{
 const result=await checkAndroidUpdate({
   fetchImpl:async()=>({status:404,ok:false}),
   getInfo:async()=>({build:'1',version:'2.7.19'})
 });
 assert.equal(result.state,'no-release');
});
