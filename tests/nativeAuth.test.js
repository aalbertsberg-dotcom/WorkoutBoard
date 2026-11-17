import test from 'node:test'
import assert from 'node:assert/strict'
import {emailRedirectUrl} from '../src/nativeAuth.js'

test('native signup and password reset use an https hosted redirect',()=>{
  assert.equal(emailRedirectUrl({native:true,publicWebUrl:'https://example.org/workset/'}),'https://example.org/workset/')
  assert.equal(emailRedirectUrl({native:true,publicWebUrl:'capacitor://localhost'}),undefined)
  assert.equal(emailRedirectUrl({native:true,publicWebUrl:''}),undefined)
})
test('web signups retain existing hosted origin/path redirects',()=>{
  assert.equal(emailRedirectUrl({native:false,origin:'https://example.org',baseUrl:'/WorkoutBoard/'}),'https://example.org/WorkoutBoard/')
})
