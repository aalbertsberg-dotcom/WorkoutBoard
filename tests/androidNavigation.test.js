import test from 'node:test'
import assert from 'node:assert/strict'
import {androidBackAction} from '../src/androidNavigation.js'

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
test('Android Back returns through WorkSet and minimizes at Today root',()=>{
  assert.equal(androidBackAction({depth:2,tab:'history'}), 'history-back')
  assert.equal(androidBackAction({tab:'together'}), 'go-today')
  assert.equal(androidBackAction({tab:'today'}), 'minimize-app')
})
