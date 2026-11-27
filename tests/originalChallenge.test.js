import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {originalChallengeProgram,originalChallengePrescription,
  ORIGINAL_CHALLENGE_SOURCE_SCHEMES} from '../src/programSources/originalChallenge.js';

const p=originalChallengeProgram;
test('531 Original Challenge retains exact workbook name and complete 12-week timeline',()=>{
  assert.equal(p.name,'531 Original Challenge');
  assert.equal(p.source,'531 Original Challenge.xlsx');
  assert.equal(p.weeksCount,12);
  assert.equal(Array.from({length:12},(_,i)=>p.getWeek(i+1).length).reduce((a,b)=>a+b),40);
  for(const week of [3,6,9,12])assert.equal(p.getWeek(week).length,4);
  for(const week of [1,2,4,5,7,8,10,11])assert.equal(p.getWeek(week).length,3);
});
test('source workout order and 1RM/deload days are transcribed, not inferred',()=>{
  assert.deepEqual(p.getWeek(1).map(d=>d.title),[
    'Day 1 - Squat / Bench','Day 2 - Deadlift / Press','Day 3 - Squat / Bench'
  ]);
  assert.deepEqual(p.getWeek(2).map(d=>d.title),[
    'Day 1 - Deadlift / Press','Day 2 - Squat / Bench','Day 3 - Deadlift / Press'
  ]);
  assert.deepEqual(p.getWeek(6).map(d=>d.title),[
    'Monday - Squat','Tuesday - Bench','Thursday - Deadlift','Friday - Press'
  ]);
  for(const week of [3,9]){
    for(const day of p.getWeek(week))assert.match(day.exercises[0].prescription,/1 @ 100% TM/);
  }
  for(const week of [6,12]){
    for(const day of p.getWeek(week))assert.match(day.exercises[0].prescription,/3\+ @ 100% TM/);
  }
});
test('source leader/anchor AMRAP and bench day 3 exception are exact',()=>{
  assert.equal(originalChallengePrescription('five'),
    '5 @ 35% TM; 5 @ 45% TM; 5 @ 55% TM; 5 @ 65% TM; 5 @ 75% TM; 5+ @ 85% TM');
  assert.equal(originalChallengePrescription('benchThree'),
    '5 @ 35% TM; 5 @ 45% TM; 5 @ 55% TM; 3 @ 70% TM; 3 @ 80% TM; 3+ @ 90% TM');
  assert.deepEqual(ORIGINAL_CHALLENGE_SOURCE_SCHEMES.one.percent,[45,55,65,75,85,95]);
  const bench=p.getWeek(1)[2].exercises.find(x=>x.name==='Bench');
  assert.equal(bench.prescription,originalChallengePrescription('benchThree'));
  const dead=p.getWeek(2)[2].exercises.find(x=>x.name==='Deadlift');
  assert.equal(dead.prescription,originalChallengePrescription('one'));
});
test('warmup, assistance choices, and 3/4-day differences match original tabs',()=>{
  const w=p.getWeek(1)[0];
  assert.deepEqual(w.exercises.map(x=>x.name),[
    'Jumps','Throws','Squat','Bench','Pushups or Dips',
    'Chinups or Pullups','Situps or Back Extensions',
  ]);
  assert.deepEqual(w.exercises.slice(-3).map(x=>x.prescription),Array(3).fill('50 total reps'));
  assert.equal(p.getWeek(3)[0].exercises.length,1);
});
test('original 85% training max and 5/10 lb increases remain per-cycle formulas',()=>{
  assert.equal(p.trainingMaxFactor,0.85);
  assert.equal(p.getTrainingMaxOffset(1,'Squat'),0);
  assert.equal(p.getTrainingMaxOffset(2,'Bench'),0);
  assert.equal(p.getTrainingMaxOffset(4,'Squat'),10);
  assert.equal(p.getTrainingMaxOffset(6,'Press'),5);
  assert.equal(p.getTrainingMaxOffset(7,'Deadlift'),0);
  assert.equal(p.getTrainingMaxOffset(10,'Deadlift'),10);
  assert.equal(p.getTrainingMaxOffset(12,'Bench'),5);
  const target=(max,offset,pct)=>Math.round(((max*.85+offset)*pct/100)/5)*5;
  assert.equal(target(200,p.getTrainingMaxOffset(4,'Bench'),85),150);
});
test('source program is wired into Programs and calculated loads survive re-targeting',()=>{
  const get=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
  const catalog=get('src/programSources/sourcePrograms.js');
  const archive=get('src/archivePrograms.js');
  const app=get('src/App.jsx');
  const runner=get('src/productFeatures.jsx');
  assert.match(catalog,/originalChallengeProgram,/);
  assert.match(archive,/structuredPercentSets/);
  assert.match(archive,/getTrainingMaxOffset/);
  assert.match(archive,/archiveSetProgressWithLoads\(program,item,oneRms,week\)/);
  assert.match(app,/set\.tm_offset/);
  assert.match(read('src/programSetTargets.js'),/set\.tm_offset/)
  assert.match(runner,/partnerSetTarget/);
});
