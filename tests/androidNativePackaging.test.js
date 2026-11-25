import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function tempAndroid(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'workset-android-'));
 const manifest=path.join(root,'android/app/src/main/AndroidManifest.xml');
 const gradle=path.join(root,'android/app/build.gradle');
 const plugin=path.join(root,'native/android/WorksetUpdaterPlugin.java');
 fs.mkdirSync(path.dirname(manifest),{recursive:true});
 fs.mkdirSync(path.dirname(plugin),{recursive:true});
 fs.writeFileSync(manifest,
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="WorkSet"></application></manifest>');
 fs.writeFileSync(gradle,
  'android { defaultConfig { applicationId "com.workset.mobile"\n versionCode 1\n versionName "1.0" } }\n');
 fs.writeFileSync(path.join(root,'package.json'),'{"version":"2.11.1"}');
 fs.copyFileSync(path.join(projectRoot,'native/android/WorksetUpdaterPlugin.java'),plugin);
 fs.mkdirSync(path.join(root,'public'),{recursive:true});
 fs.copyFileSync(path.join(projectRoot,'public/icon.svg'),path.join(root,'public/icon.svg'));
 return {root,manifest,gradle};
}
const prepare=path.join(projectRoot,'scripts/prepare-android-native.mjs');
test('Native preparation registers APK update plugin and supplies Android system bar settings',()=>{
 const fixture=tempAndroid();
 try{
   execFileSync(process.execPath,[prepare],{cwd:fixture.root});
   const main=fs.readFileSync(path.join(fixture.root,'android/app/src/main/java/com/workset/mobile/MainActivity.java'),'utf8');
   const manifest=fs.readFileSync(fixture.manifest,'utf8');
   const gradle=fs.readFileSync(fixture.gradle,'utf8');
   assert.match(main,/registerPlugin\(WorksetUpdaterPlugin.class\)/);
   assert.match(main,/setNavigationBarColor/);
   assert.match(manifest,/REQUEST_INSTALL_PACKAGES/);
   assert.match(manifest,/androidx\.core\.content\.FileProvider/);
   assert.match(manifest,/\$\{applicationId\}\.worksetupdates/);
   assert.match(gradle,/versionName "2\.11\.1"/);
   assert.match(gradle,/versionCode 1/);
   assert.ok(fs.existsSync(path.join(fixture.root,'android/app/src/main/res/xml/workset_update_paths.xml')));
   for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
     const icons=path.join(fixture.root,'android/app/src/main/res/mipmap-'+density);
     assert.ok(fs.statSync(path.join(icons,'ic_launcher.png')).size>300,'Missing launcher '+density);
     assert.ok(fs.statSync(path.join(icons,'ic_launcher_round.png')).size>300,'Missing round '+density);
     assert.ok(fs.statSync(path.join(icons,'ic_launcher_foreground.png')).size>300,'Missing adaptive '+density);
   }
   assert.ok(fs.existsSync(path.join(fixture.root,'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml')));
 }finally{fs.rmSync(fixture.root,{recursive:true,force:true});}
});
test('Release packaging demands persistent signing configuration',()=>{
 const fixture=tempAndroid();
 try{
  assert.throws(()=>execFileSync(process.execPath,[prepare,'--release'],{
    cwd:fixture.root,env:{...process.env,WORKSET_ANDROID_VERSION_CODE:'100005',
      WORKSET_ANDROID_KEYSTORE_PATH:'',WORKSET_ANDROID_KEYSTORE_PASSWORD:'',
      WORKSET_ANDROID_KEY_ALIAS:'',WORKSET_ANDROID_KEY_PASSWORD:''},stdio:'pipe'
  }),/Command failed/);
  execFileSync(process.execPath,[prepare,'--release'],{cwd:fixture.root,
    env:{...process.env,WORKSET_ANDROID_VERSION_CODE:'100005',
      WORKSET_ANDROID_KEYSTORE_PATH:'/tmp/secret-release.jks',
      WORKSET_ANDROID_KEYSTORE_PASSWORD:'test-only-password',
      WORKSET_ANDROID_KEY_ALIAS:'workset-test',
      WORKSET_ANDROID_KEY_PASSWORD:'test-only-key-password'}});
  const gradle=fs.readFileSync(fixture.gradle,'utf8');
  assert.match(gradle,/versionCode 100005/);
  assert.match(gradle,/signingConfig signingConfigs\.worksetRelease/);
  assert.doesNotMatch(gradle,/test-only-password/);
 }finally{fs.rmSync(fixture.root,{recursive:true,force:true});}
});
