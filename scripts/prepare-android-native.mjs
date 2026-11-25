#!/usr/bin/env node
// Reapply native customizations to CI-generated Capacitor Android project.
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const android=path.join(root,'android','app');
const manifestPath=path.join(android,'src','main','AndroidManifest.xml');
const gradlePath=path.join(android,'build.gradle');
const mainPath=path.join(android,'src','main','java','com','workset','mobile','MainActivity.java');
const pluginPath=path.join(root,'native','android','WorksetUpdaterPlugin.java');
const xmlPath=path.join(android,'src','main','res','xml','workset_update_paths.xml');
const release=process.argv.includes('--release');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const versionName=String(process.env.WORKSET_ANDROID_VERSION_NAME||pkg.version);
const versionCode=release?Number(process.env.WORKSET_ANDROID_VERSION_CODE):1;
if(!Number.isSafeInteger(versionCode)||versionCode<1||versionCode>2100000000)throw Error('Invalid Android version code');
if(!/^\d+\.\d+\.\d+$/.test(versionName))throw Error('Invalid Android version name');
if(!fs.existsSync(manifestPath)||!fs.existsSync(gradlePath)||!fs.existsSync(pluginPath))
  throw Error('Run npx cap add android and cap sync before preparing Android native source.');

fs.mkdirSync(path.dirname(mainPath),{recursive:true});
fs.writeFileSync(mainPath,[
 'package com.workset.mobile;',
 'import android.graphics.Color;',
 'import android.os.Build;',
 'import android.os.Bundle;',
 'import androidx.core.view.WindowCompat;',
 'import com.getcapacitor.BridgeActivity;',
 'public class MainActivity extends BridgeActivity {',
 '    @Override public void onCreate(Bundle savedInstanceState) {',
 '        registerPlugin(WorksetUpdaterPlugin.class);',
 '        super.onCreate(savedInstanceState);',
 '        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);',
 '        getWindow().setNavigationBarColor(Color.rgb(9,16,29));',
 '        getWindow().setStatusBarColor(Color.rgb(11,18,32));',
 '        if (Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q)',
 '            getWindow().setNavigationBarContrastEnforced(false);',
 '        getWindow().getDecorView().setSystemUiVisibility(0);',
 '    }',
 '}'
].join('\n')+'\n');
fs.copyFileSync(pluginPath,path.join(path.dirname(mainPath),'WorksetUpdaterPlugin.java'));

let manifest=fs.readFileSync(manifestPath,'utf8');
const permission='<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />';
if(!manifest.includes(permission))manifest=manifest.replace('<application',permission+'\n    <application');
const provider=[
 '<provider android:name="androidx.core.content.FileProvider"',
 '    android:authorities="$'+'{applicationId}.worksetupdates"',
 '    android:exported="false" android:grantUriPermissions="true">',
 '  <meta-data android:name="android.support.FILE_PROVIDER_PATHS"',
 '      android:resource="@xml/workset_update_paths" />',
 '</provider>'
].join('\n');
if(!manifest.includes('worksetupdates'))manifest=manifest.replace('</application>',provider+'\n    </application>');
if(!manifest.includes('REQUEST_INSTALL_PACKAGES')||!manifest.includes('worksetupdates'))
  throw Error('Native manifest preparation failed.');
fs.writeFileSync(manifestPath,manifest);
fs.mkdirSync(path.dirname(xmlPath),{recursive:true});
fs.writeFileSync(xmlPath,'<?xml version="1.0" encoding="utf-8"?>\n'+
 '<paths xmlns:android="http://schemas.android.com/apk/res/android">\n'+
 '  <external-files-path name="workset_updates" path="Download/" />\n</paths>\n');

let gradle=fs.readFileSync(gradlePath,'utf8');
if(!/versionCode\s+\d+/.test(gradle)||!/versionName\s+['"][^'"]+['"]/.test(gradle))
  throw Error('Unexpected Capacitor Gradle version format');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode '+versionCode)
  .replace(/versionName\s+['"][^'"]+['"]/,'versionName "'+versionName+'"');
if(release){
  const required=['WORKSET_ANDROID_KEYSTORE_PATH','WORKSET_ANDROID_KEYSTORE_PASSWORD',
    'WORKSET_ANDROID_KEY_ALIAS','WORKSET_ANDROID_KEY_PASSWORD'];
  for(const name of required)if(!process.env[name])throw Error('Missing release signing setting: '+name);
  gradle+='\nandroid {\n  signingConfigs {\n    worksetRelease {\n'+
    '      storeFile file(System.getenv("WORKSET_ANDROID_KEYSTORE_PATH"))\n'+
    '      storePassword System.getenv("WORKSET_ANDROID_KEYSTORE_PASSWORD")\n'+
    '      keyAlias System.getenv("WORKSET_ANDROID_KEY_ALIAS")\n'+
    '      keyPassword System.getenv("WORKSET_ANDROID_KEY_PASSWORD")\n'+
    '    }\n  }\n  buildTypes { release { signingConfig signingConfigs.worksetRelease } }\n}\n';
}
fs.writeFileSync(gradlePath,gradle);
console.log('Prepared Android '+(release?'signed release':'debug test')+
  ': com.workset.mobile v'+versionName+' ('+versionCode+')');
