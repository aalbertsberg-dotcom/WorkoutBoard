import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('WorkSet sign-in describes username and current password to password managers',()=>{
 const app=source('src/App.jsx')
 assert.match(app,/name="username"/)
 assert.match(app,/autoComplete="username"/)
 assert.match(app,/name=\{mode === 'signin' \? 'password' : 'new-password'\}/)
 assert.match(app,/autoComplete=\{mode === 'signin' \? 'current-password' : 'new-password'\}/)
 assert.match(app,/name="new-password" autoComplete="new-password"/)
})
test('Android password save context is finalized only after successful login',()=>{
 const app=source('src/App.jsx')
 assert.match(app,/if \(error\) setMessage\(error.message\)\s*else void notifyNativePasswordLoginSuccess\(\)/)
 const bridge=source('src/nativeAutofill.js')
 assert.match(bridge,/Capacitor\.getPlatform\(\)!=='android'/)
 assert.match(bridge,/AndroidAutofill\.commitLogin\(\)/)
 assert.doesNotMatch(bridge,/localStorage/)
 const plugin=source('assets/native/android/WorkSetAutofillPlugin.java')
 assert.match(plugin,/manager\.commit\(\)/)
 assert.doesNotMatch(plugin,/call\.getString\(["']password/)
 assert.match(source('assets/native/android/MainActivity.java'),/registerPlugin\(WorkSetAutofillPlugin.class\)/)
 assert.match(source('assets/native/android/MainActivity.java'),/IMPORTANT_FOR_AUTOFILL_YES/)
 assert.match(source('scripts/configure-android-safe-area.mjs'),/WorkSetAutofillPlugin\.java/)
})
test('Supabase session restoration remains enabled',()=>{
 assert.match(source('src/App.jsx'),/supabase\.auth\.getSession\(\)/)
 assert.match(source('src/App.jsx'),/supabase\.auth\.onAuthStateChange/)
})
