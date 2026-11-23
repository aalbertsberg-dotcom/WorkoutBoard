import test from 'node:test'
import assert from 'node:assert/strict'
import {androidBackAction} from '../src/androidNavigation.js'
import {readFileSync} from 'node:fs'

test('Android Back protects an active workout instead of exiting',()=>{
  assert.equal(androidBackAction({activeWorkout:true,depth:4}), 'confirm-workout-exit')
  assert.equal(androidBackAction({activeWorkout:true,tab:'today'}), 'confirm-workout-exit')
})
test('Android Back closes dialogs and drilldowns before navigating',()=>{
  assert.equal(androidBackAction({deleteDialog:true,depth:3}), 'close-delete-dialog')
  assert.equal(androidBackAction({historyDetail:true,depth:1}), 'close-history-detail')
  assert.equal(androidBackAction({completion:true}), 'close-completion')
  assert.equal(androidBackAction({overlay:true}), 'close-overlay')
  assert.equal(androidBackAction({preview:true}), 'close-preview')
})
test('Android Back returns through WorkSet and asks before exiting from Today root',()=>{
  assert.equal(androidBackAction({depth:2,tab:'history'}), 'history-back')
  assert.equal(androidBackAction({tab:'together'}), 'go-today')
  assert.equal(androidBackAction({tab:'today'}), 'confirm-app-exit')
})

test('native Android exit is confirmed, never triggered by an unconfirmed Back press',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/case 'confirm-app-exit':\s*void confirmAndroidExit\(\)/)
  assert.match(app,/await confirmWorkset\([\s\S]*?title:'Exit WorkSet\?'[\s\S]*?cancelLabel:'Stay'/)
  assert.match(app,/if\(exit\)await NativeApp\.exitApp\(\)/)
  assert.match(app,/androidExitConfirmingRef\.current=true/)
  assert.doesNotMatch(app,/NativeApp\.minimizeApp\(/)
})

test('top level root tabs navigate Today before asking to exit',()=>{
  for(const tab of ['together','program','whiteboard','me'])
    assert.equal(androidBackAction({tab}),'go-today')
  assert.equal(androidBackAction({tab:'history',depth:2}),'history-back')
  assert.equal(androidBackAction({tab:'today',preview:true}),'close-preview')
  assert.equal(androidBackAction({tab:'today',overlay:true}),'close-overlay')
  assert.equal(androidBackAction({tab:'today',activeWorkout:true}),'confirm-workout-exit')
  assert.equal(androidBackAction({tab:'today',completion:true}),'close-completion')
})
