import test from 'node:test'
import assert from 'node:assert/strict'
import {supportsNativeBackgroundGps,nativeGpsPlatformLabel} from '../src/nativePlatforms.js'

test('iOS and Android share the native GPS bridge',()=>{
 assert.equal(supportsNativeBackgroundGps(true,'ios'),true)
 assert.equal(supportsNativeBackgroundGps(true,'android'),true)
 assert.equal(supportsNativeBackgroundGps(false,'ios'),false)
 assert.equal(supportsNativeBackgroundGps(false,'android'),false)
 assert.equal(supportsNativeBackgroundGps(true,'web'),false)
})
test('platform status text accurately distinguishes native from Chrome',()=>{
 assert.equal(nativeGpsPlatformLabel(true,'ios'),'iPhone')
 assert.equal(nativeGpsPlatformLabel(true,'android'),'Android')
 assert.equal(nativeGpsPlatformLabel(false,'ios'),'Browser')
})
