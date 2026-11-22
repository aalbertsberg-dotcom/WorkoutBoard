import test from 'node:test'
import assert from 'node:assert/strict'
import {validFriendEmail,friendInviteMailto} from '../src/inviteLinks.js'

test('requires a plausible email before querying friend accounts',()=>{
  assert.equal(validFriendEmail('person@example.com'),true)
  assert.equal(validFriendEmail(' person@example.com '),true)
  assert.equal(validFriendEmail('not-an-email'),false)
  assert.equal(validFriendEmail('anything@'),false)
  assert.equal(validFriendEmail('bad@example.com\r\nBcc:attacker'),false)
})
test('unknown-account invite creates a safe mailto link without sending messages',()=>{
  const link=friendInviteMailto('friend@example.com','https://example.test/workset/?join=ABC123')
  assert.ok(link.startsWith('mailto:friend%40example.com?'))
  assert.ok(link.includes('subject=Join%20me%20on%20WorkSet'))
  assert.ok(link.includes('join%3DABC123'))
  assert.equal(friendInviteMailto('invalid','https://example.test/'),'')
})
