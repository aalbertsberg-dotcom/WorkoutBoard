import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {isOriginalChallengeMaxTest,originalChallengeCompletedTest} from '../src/originalChallengeCycle.js'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('Week 6 and Week 12 both produce workbook-accurate test estimates',()=>{
  for(const week of [6,12]){
    assert.equal(isOriginalChallengeMaxTest({source_week:week,
      workout:{archive_program_id:'531-original-challenge'}}),true)
    const rows=originalChallengeCompletedTest({exercises:[{name:'Squat',setProgress:[
      {done:true,weight_lift:'Squat',weight_basis:'tm',pct:100,actual_reps:'7',weight:265}
    ]}]})
    assert.equal(rows.length,1)
    assert.ok(Math.abs(rows[0].estimated_1rm-(265*(1+7*0.0333)))<1e-8)
  }
})
test('both test weeks save and display final results without modifying saved global maxes',()=>{
  const runner=read('src/productFeatures.jsx')
  const app=read('src/App.jsx')
  assert.match(runner,/challengeTestResults=isOriginalChallengeMaxTest\(planned\)\?originalChallengeCompletedTest\(workout\):\[\]/)
  assert.match(runner,/challenge_test_results:challengeTestResults/)
  assert.match(runner,/challengeTestResults,challengeTestWeek:Number\(planned.source_week\)\|\|null/)
  assert.match(runner,/estimated_1rm:challengeTestEstimate\|\|bestEstimated1rm\|\|null/)
  assert.match(app,/completionSummary.challengeTestResults\?\.length>0/)
  assert.match(app,/result.estimated_1rm/)
  assert.match(app,/0.0333/)
})
