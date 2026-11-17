import test from 'node:test'
import assert from 'node:assert/strict'
import { AGILE_8,COOL_DOWN } from '../src/mobilityRoutines.js'

test('Agile 8 has eight ordered mobility movements',()=>{
  assert.equal(AGILE_8.length,8)
  assert.match(AGILE_8[0].title,/IT band/)
  assert.match(AGILE_8[1].title,/Adductor/)
  assert.match(AGILE_8[2].title,/Glute/)
  assert.match(AGILE_8[3].title,/Rollovers/)
  assert.match(AGILE_8[4].title,/Fire hydrant/)
  assert.match(AGILE_8[5].title,/Mountain climbers/)
  assert.match(AGILE_8[6].title,/Groiners/)
  assert.match(AGILE_8[7].title,/hip flexor/)
  for(const item of AGILE_8)assert.ok(item.title&&item.detail&&item.target)
})

test('cool-down remains independently selectable and reusable',()=>{
  assert.ok(COOL_DOWN.length>=5)
  assert.equal(new Set(COOL_DOWN.map(item=>item.title)).size,COOL_DOWN.length)
  for(const item of COOL_DOWN)assert.ok(item.title&&item.detail&&item.target)
})
