import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('WorkSet confirmation entrypoints use the universal dialog instead of browser confirms',()=>{
  const files=['src/App.jsx','src/platform.jsx','src/advancedFeatures.jsx','src/whiteboard.jsx','src/mobilitySession.jsx','src/drawWhiteboard.jsx']
  for(const file of files){
    assert.doesNotMatch(source(file),/window\.(?:confirm|prompt)\s*\(/,file)
    assert.match(source(file),/(?:confirmWorkset|promptWorkset)/,file)
  }
})
test('Previously hidden confirmation cards are rendered in the modal portal',()=>{
  const history=source('src/workoutHistory.jsx')
  const community=source('src/platform.jsx')
  const classic=source('src/App.jsx')
  assert.match(history,/deleting&&<DialogPortal/)
  assert.match(community,/communityDeleteId&&<DialogPortal/)
  assert.match(classic,/classicCancelConfirm&&<DialogPortal/)
})
test('Original Pocket Mode and outdoor GPS modules are unmodified by dialog release',()=>{
  assert.match(source('src/outdoorTracking.jsx'),/import PocketMode from/)
  assert.match(source('src/PocketMode.jsx'),/Slide to unlock/)
})
test('In-viewport modal layout overrides legacy bottom sheets',()=>{
  const css=source('src/styles.css')
  assert.match(css,/\.same-day-sheet-backdrop,\s*\.program-choice-backdrop\s*\{/)
  assert.match(css,/align-items:center !important/)
  assert.match(css,/max-height:calc\(100dvh - 48px\) !important/)
})
