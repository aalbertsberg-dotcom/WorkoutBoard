import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
const platform=readFileSync(new URL('../src/platform.jsx',import.meta.url),'utf8')
test('an existing run freezes current saved 1RMs exactly once in its existing program version',()=>{
  assert.match(app,/const recovered=originalChallengeStartingMaxes\(oneRepMaxes\)/)
  assert.match(app,/starting_one_rms:recovered/)
  assert.match(app,/\.eq\('id',track.program_version_id\)\.eq\('user_id',session.user.id\)/)
  assert.match(app,/if\(stored&&Object.keys\(stored\)\.length===4\)/)
  assert.match(platform,/const recovered=originalChallengeStartingMaxes\(oneRepMaxes\)/)
  assert.match(platform,/\.eq\('user_id',session.user.id\)\.eq\('id',activeTrack.program_version_id\)/)
  assert.match(platform,/starting_one_rms:recovered/)
  assert.match(platform,/if\(stored&&Object.keys\(stored\)\.length===4\)/)
})
test('incomplete starting baseline never silently proceeds as a correct 531 program',()=>{
  assert.match(app,/if\(Object.keys\(recovered\).length!==4\)/)
  assert.match(platform,/if\(Object.keys\(recovered\).length!==4\)/)
  assert.match(app,/if\(saveError\)/)
  assert.match(platform,/if\(saveError\)/)
})
