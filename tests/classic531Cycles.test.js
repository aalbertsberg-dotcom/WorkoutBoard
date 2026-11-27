import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {classic531TrainingMaxOffset,classic531CycleIndex,classic531ProgramIds} from '../src/classic531Cycles.js'
import {partnerSetTarget} from '../src/programSetTargets.js'
import {programWeightNotes} from '../src/programWeightNotes.js'

const programs=[
 ['andy-531-original-6',[0,0,0,1,1,1]],
 ['new-531-leader-anchor-11',[0,0,0,1,1,1,1,2,2,2,2]],
 ['andy-bbb-jokers-11',[0,0,0,1,1,1,1,2,2,2,2]],
 ['andy-hybrid-12',[0,0,0,1,1,1,1,2,2,2,2,2]]
]

test('every classic 531 program advances by 5 upper / 10 lower after each 3-week cycle',()=>{
  assert.deepEqual(new Set(classic531ProgramIds),new Set(programs.map(p=>p[0])))
  for(const [id,cycles] of programs){
    cycles.forEach((cycle,index)=>{
      const week=index+1
      assert.equal(classic531CycleIndex(id,week),cycle,id+' week '+week)
      assert.equal(classic531TrainingMaxOffset(id,week,'Squat'),cycle*10)
      assert.equal(classic531TrainingMaxOffset(id,week,'Deadlift'),cycle*10)
      assert.equal(classic531TrainingMaxOffset(id,week,'Bench'),cycle*5)
      assert.equal(classic531TrainingMaxOffset(id,week,'Press'),cycle*5)
    })
  }
  assert.equal(classic531TrainingMaxOffset('powerbuilding-8',7,'Squat'),0)
  assert.equal(classic531TrainingMaxOffset('reset-4',3,'Bench'),0)
  assert.equal(classic531TrainingMaxOffset('andy-531-original-6',4,'Curl'),0)
  assert.equal(classic531TrainingMaxOffset('andy-531-original-6',7,'Squat'),0)
})

test('cycle increase is added to 85% TM, never multiplied by 85% again',()=>{
  const base=300
  const f=(week,pct)=>partnerSetTarget({Squat:base},{
    weight_lift:'Squat',weight_basis:'tm',pct,
    tm_offset:classic531TrainingMaxOffset('andy-531-original-6',week,'Squat')
  })
  assert.equal(f(1,100),'255 lb')
  assert.equal(f(4,100),'265 lb')
  assert.equal(f(4,65),'170 lb')
  assert.notEqual((base+10)*.85,base*.85+10)
})

test('every classic 531 workout creation path uses cycle offset for main and supplemental sets',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/function targetWeight\(oneRm, pct, basis, tmOffset=0\)/)
  assert.match(app,/oneRm \* 0\.85 \+ Number\(tmOffset\|\|0\)/)
  assert.match(app,/const tmOffset=classic531TrainingMaxOffset\(programId,week,lift\)/)
  assert.match(app,/weight:set\.pct!=null \? \(targetWeight\(oneRm,set\.pct,program\.basis,tmOffset\)/)
  assert.match(app,/weight_basis:program\.basis,/)
  assert.match(app,/tm_offset:tmOffset/)
  assert.match(app,/const offset=classic531TrainingMaxOffset\(programId,week,textLift\)/)
  assert.match(app,/if\(program\.basis==='tm'\)set\.tm_offset=offset/)
  assert.match(app,/targetWeight\(tm,set\.pct,workoutProgram\.basis,classic531TrainingMaxOffset/)
})

test('5/3/1 previews explain the program increase without an unnecessary 1RM disclaimer',()=>{
  for(const [id] of programs){
    const note=programWeightNotes({kind:'classic',id})
    assert.match(note.summary,/\+5 lb upper \/ \+10 lb lower increases are applied automatically/)
    assert.doesNotMatch(note.summary,/never to the 1RM|NOT increased/)
  }
  const nathan=programWeightNotes({kind:'archive',id:'531-original-challenge'})
  assert.match(nathan.summary,/Programmed \+5\/\+10 lb increases are calculated automatically/)
  assert.doesNotMatch(nathan.detail,/saved 1RM is NOT increased/)
  const runner=readFileSync(new URL('../src/productFeatures.jsx',import.meta.url),'utf8')
  assert.doesNotMatch(runner,/original-challenge-tm-rule/)
  assert.match(runner,/program-increment-indicator/)
})

test('database audits future 1RM edits and Analytics displays history, not a program disclaimer',()=>{
  const migration=readFileSync(new URL('../supabase/migrations/20261127_saved_one_rep_max_history.sql',import.meta.url),'utf8')
  const progress=readFileSync(new URL('../src/platform.jsx',import.meta.url),'utf8')
  assert.match(migration,/after insert or update of squat,bench,deadlift,press/)
  assert.match(migration,/if old_weight is distinct from new_weight then/)
  assert.match(migration,/actor = new\.user_id then 'user'/)
  assert.match(migration,/else 'admin'/)
  assert.match(migration,/alter table public\.one_rep_max_history enable row level security/)
  assert.match(migration,/revoke all on public\.one_rep_max_history from anon, authenticated/)
  assert.match(migration,/grant select on public\.one_rep_max_history to authenticated/)
  assert.match(progress,/from\('one_rep_max_history'\)/)
  assert.match(progress,/Saved 1RM change history/)
  assert.match(progress,/row\.change_source==='admin'\?'Admin'/)
})
