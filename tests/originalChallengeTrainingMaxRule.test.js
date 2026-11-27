import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {originalChallengeProgram} from '../src/programSources/originalChallenge.js'
import {partnerSetTarget} from '../src/programSetTargets.js'
import {explainProgramSetWeight} from '../src/programWeightNotes.js'
import {originalChallengeTrainingMax,originalChallengeTrainingMaxOffset,
  originalChallengeCompletedTest} from '../src/originalChallengeCycle.js'

const start={Squat:300,Bench:200,Deadlift:350,Press:150}
const postTest={Squat:325,Bench:225,Deadlift:375,Press:175}
const round5=value=>Math.round(value/5)*5
const cycleWeeks=new Set([4,5,6,10,11,12])
const lower=new Set(['Squat','Deadlift'])
const lifts=['Squat','Bench','Deadlift','Press']

test('Nathan 5/3/1: 12 weeks, four lifts, prescribed cycle increase affects TM only',()=>{
  for(let week=1;week<=12;week++){
    const maxes=week<=6?start:postTest
    for(const lift of lifts){
      const extra=cycleWeeks.has(week)?lower.has(lift)?10:5:0
      assert.equal(originalChallengeTrainingMaxOffset(week,lift),extra,
        'week '+week+' '+lift+' offset')
      assert.equal(originalChallengeProgram.getTrainingMaxOffset(week,lift),extra)
      assert.equal(originalChallengeTrainingMax(maxes[lift],week,lift),maxes[lift]*.85+extra)
      // Wrong calculation would increase 1RM before applying 85%.
      if(extra>0)assert.notEqual(originalChallengeTrainingMax(maxes[lift],week,lift),
        (maxes[lift]+extra)*.85)
    }
    for(const day of originalChallengeProgram.getWeek(week)){
      for(const item of day.exercises){
        if(!lifts.includes(item.name))continue
        const matches=[...item.prescription.matchAll(/(\d+)(\+?)\s*@\s*(\d+(?:\.\d+)?)\s*%\s*TM/gi)]
        assert.equal(matches.length,6,'six prescribed sets '+week+' '+item.name)
        for(const match of matches){
          const pct=Number(match[3])
          const plus=cycleWeeks.has(week)?lower.has(item.name)?10:5:0
          const set={weight_lift:item.name,weight_basis:'tm',pct,tm_offset:plus}
          const expected=round5((maxes[item.name]*.85+plus)*pct/100)
          assert.equal(partnerSetTarget(maxes,set),expected+' lb',
            'week '+week+' '+item.name+' '+pct+'%')
          const explanation=explainProgramSetWeight(maxes,set,
            {programId:originalChallengeProgram.id,week})
          assert.equal(explanation.target,expected+' lb')
          assert.equal(explanation.offset,plus)
          if(plus>0)assert.match(explanation.offsetLabel,/already added to training max/)
        }
      }
    }
  }
  // Program generation must never mutate the global 1RM record.
  assert.deepEqual(start,{Squat:300,Bench:200,Deadlift:350,Press:150})
  assert.deepEqual(postTest,{Squat:325,Bench:225,Deadlift:375,Press:175})
  // Assert the browser's real archive generator applies its offset to TM.
  const generator=readFileSync(new URL('../src/archivePrograms.js',import.meta.url),'utf8')
  assert.match(generator,/const tm=oneRm>0\?oneRm\*Number\(program.trainingMaxFactor\|\|0\.85\)\+offset:0/)
  assert.match(generator,/weight_basis:'tm',tm_offset:offset/)
})

test('example: original 300 squat -> 255 TM then 265 TM; new 325 squat -> 276.25 then 286.25 TM',()=>{
  assert.equal(originalChallengeTrainingMax(300,1,'Squat'),255)
  assert.equal(originalChallengeTrainingMax(300,4,'Squat'),265)
  assert.equal(originalChallengeTrainingMax(325,7,'Squat'),276.25)
  assert.equal(originalChallengeTrainingMax(325,10,'Squat'),286.25)
  assert.equal(originalChallengeTrainingMax(200,4,'Bench'),175)
  assert.equal(originalChallengeTrainingMax(225,10,'Bench'),196.25)
  assert.equal(originalChallengeTrainingMax(300,4,'Unknown'),0)
  assert.equal(originalChallengeTrainingMax(0,4,'Squat'),0)
  assert.equal(originalChallengeTrainingMaxOffset(4,'Unknown'),0)
})

test('Week 6 test determines NEW 1RM without adding 10 lb to the 1RM result',()=>{
  const top={
    name:'Squat',
    setProgress:[{
      weight_lift:'Squat',weight_basis:'tm',pct:100,done:true,
      weight:265,actual_reps:7,
    }]
  }
  const result=originalChallengeCompletedTest({exercises:[top]})[0]
  const expected=265*(1+7*.0333)
  assert.ok(Math.abs(result.estimated_1rm-expected)<1e-9)
  assert.equal(originalChallengeTrainingMax(expected,7,'Squat'),expected*.85)
  assert.equal(originalChallengeTrainingMax(expected,10,'Squat'),expected*.85+10)
})

test('active 531 workout prominently explains that the increase goes to TM, not 1RM',()=>{
  const runner=readFileSync(new URL('../src/productFeatures.jsx',import.meta.url),'utf8')
  assert.match(runner,/Week \{planned.source_week\} · 5\/3\/1 weight rule/)
  assert.match(runner,/The increase is NOT added to the 1RM/)
  assert.match(runner,/originalChallengeTrainingMaxOffset\(planned.source_week,'Squat'\)/)
})
