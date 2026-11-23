import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Android native build wires real OS navigation insets after Capacitor sync',()=>{
  const ci=read('.github/workflows/android-debug.yml')
  assert.match(ci,/Apply Option B native android artwork[\s\S]*?Configure Android navigation safe-area bridge/)
  const java=read('assets/native/android/MainActivity.java')
  assert.match(java,/WindowInsetsCompat.Type.navigationBars/)
  assert.match(java,/WindowInsetsCompat.Type.mandatorySystemGestures/)
  assert.match(java,/--workset-native-bottom-inset/)
  assert.match(java,/Build.VERSION.SDK_INT >= 35/)
})
test('Native-only CSS reserves space for Android system controls and iPhone Duo asymmetric side rails',()=>{
  const source=read('src/styles.css')
  const native=source.slice(source.indexOf('WorkSet native safe areas:'))
  assert.match(native,/html.workset-native .app-level-mobile-nav/)
  assert.match(native,/bottom:var\(--workset-safe-bottom\) !important/)
  assert.match(native,/padding-bottom:calc\(104px \+ var\(--workset-safe-bottom\)\)/)
  assert.match(native,/--workset-native-left-inset/)
  assert.match(native,/--workset-native-right-inset/)
  assert.match(read('src/main.jsx'),/Capacitor.isNativePlatform\(\)/)
  assert.equal(JSON.parse(read('capacitor.config.json')).ios.contentInset,'never')
})
