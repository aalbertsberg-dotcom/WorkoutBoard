// Copy the reviewable native Android WindowInsets activity after cap add/sync.
// The generated plugin wrapper stays current; only MainActivity is replaced.
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
const cfg=JSON.parse(await readFile('capacitor.config.json','utf8'))
const dest=path.join('android/app/src/main/java',...cfg.appId.split('.'),'MainActivity.java')
const existing=await readFile(dest,'utf8')
const source=await readFile('assets/native/android/MainActivity.java','utf8')
if(!existing.includes('extends BridgeActivity')||!existing.includes('package '+cfg.appId+';'))
  throw Error('Unexpected Capacitor Android MainActivity: '+dest)
if(!source.includes('package '+cfg.appId+';')||!source.includes('WindowInsetsCompat.Type.navigationBars()'))
  throw Error('Invalid WorkSet native MainActivity template')
await writeFile(dest,source)
const pluginSource=await readFile('assets/native/android/WorkSetAutofillPlugin.java','utf8')
if(!source.includes('registerPlugin(WorkSetAutofillPlugin.class)')||
   !pluginSource.includes('@CapacitorPlugin(name = "WorkSetAutofill")'))
  throw Error('WorkSet Android autofill registration is missing')
await writeFile(path.join(path.dirname(dest),'WorkSetAutofillPlugin.java'),pluginSource)
console.log('WorkSet native Android safe-area and autofill bridge applied')
