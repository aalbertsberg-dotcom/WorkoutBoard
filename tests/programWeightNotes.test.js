import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {explainProgramSetWeight,adjustedManualSetWeight,programWeightNotes} from '../src/programWeightNotes.js'
import {partnerSetTarget} from '../src/programSetTargets.js'

const tm={weight_lift:'Squat',weight_basis:'tm',pct:35,tm_offset:10}
const et={weight_lift:'Squat',weight_basis:'e1rm',pct:35}
const model={Squat:300,Bench:185,Deadlift:325,Press:135}

test('required 531 5/10 lb increases are already included, never automatically added twice',()=>{
  const info=explainProgramSetWeight(model,tm,{programId:'531-original-challenge',week:4})
  assert.equal(info.basisLabel,'85% training max (TM)')
  assert.equal(info.offsetLabel,'+10 lb already added to training max')
  assert.equal(info.target,'95 lb')
  assert.equal(info.formula,'(300 lb saved 1RM × 85% + 10 lb) × 35% = 95 lb')
  assert.equal(info.target,partnerSetTarget(model,tm))
  assert.notEqual(300*.85+10,(300+10)*.85)
})

test('Week 7 bases percentages on program-specific Week 6 estimated 1RM',()=>{
  const info=explainProgramSetWeight({Squat:326.7715},{...tm,tm_offset:0},
    {programId:'531-original-challenge',week:7})
  assert.match(info.formula,/Week 6 estimated 1RM × 85%/)
  assert.equal(info.isProgramIncrease,false)
  assert.equal(info.target,partnerSetTarget({Squat:326.7715},{...tm,tm_offset:0}))
})

test('other programs with e1rm basis do not imply an 85% training max',()=>{
  const info=explainProgramSetWeight(model,et,{programId:'custom',week:4})
  assert.equal(info.basisLabel,'100% of 1RM')
  assert.equal(info.target,'105 lb')
  assert.equal(info.formula,'300 lb saved 1RM × 35% = 105 lb')
  assert.equal(info.isProgramIncrease,false)
})

test('no calculation shown when a program does not specify a percent, lift or basis',()=>{
  assert.equal(explainProgramSetWeight(model,{weight_basis:'tm',pct:65}),null)
  assert.equal(explainProgramSetWeight(model,{weight_lift:'Bench',weight_basis:'manual',pct:65}),null)
  const m=explainProgramSetWeight({},tm,{programId:'531-original-challenge',week:10})
  assert.equal(m.formula,'')
  assert.equal(m.target,'')
  assert.equal(m.offset,10)
})

test('manual +5/+10 adds to the selected set weight, not the training max',()=>{
  assert.equal(adjustedManualSetWeight('95',5),'100')
  assert.equal(adjustedManualSetWeight('95',10),'105')
  assert.equal(adjustedManualSetWeight('100.5',10),'110.5')
  assert.equal(adjustedManualSetWeight('',5),null)
  assert.equal(adjustedManualSetWeight('0',10),null)
  assert.equal(adjustedManualSetWeight('95',15),null)
})

test('program previews distinguish formula basis and accurately identify automatic increments',()=>{
  const original=programWeightNotes({id:'531-original-challenge',kind:'archive'})
  assert.match(original.summary,/\+5\/\+10 lb increases are calculated automatically/)
  assert.doesNotMatch(original.detail,/1RM is NOT increased/)
  assert.match(original.detail,/These required increases are already applied/)
  assert.match(original.detail,/do not tap \+5\/\+10 again unless adding extra weight/)
  assert.match(programWeightNotes({id:'classic1',kind:'classic',weightBasis:'tm'}).summary,/85%/)
  assert.match(programWeightNotes({id:'classic2',kind:'classic',weightBasis:'e1rm'}).summary,/not an 85%/)
  assert.equal(programWeightNotes({id:'manual',kind:'archive'}),null)
})

test('Today notes, optional set-only controls and reset are wired without changing the program formulas',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
  const runner=read('src/productFeatures.jsx')
  const platform=read('src/platform.jsx')
  assert.match(runner,/weightNote=explainProgramSetWeight/)
  assert.match(runner,/program-increment-indicator/)
  assert.match(runner,/weightNote.isProgramIncrease/)
  assert.match(runner,/Optional: adjust this set only/)
  assert.match(runner,/adjustedManualSetWeight\(shownWeight,increment\)/)
  assert.match(runner,/weight_edited:true/)
  assert.match(runner,/Use programmed weight/)
  assert.match(runner,/weight_edited:false/)
  assert.match(platform,/programWeightNotes\(preview\)/)
  assert.match(platform,/weightBasis:p.basis/)
})
