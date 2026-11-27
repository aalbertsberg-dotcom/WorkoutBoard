// Faithful transcription of "531 Original Challenge.xlsx" (8 cycle tabs, 12 weeks).
// Every percentage is of the training max, not the full estimated 1RM.
// The user's latest tracked 1RM supplies the formula input; the two second
// cycles add +10 lb to squat/deadlift and +5 lb to bench/press.
import {ex,day} from './helpers.js';

const SCHEMES={
  five: {percent:[35,45,55,65,75,85],reps:[5,5,5,5,5,'5+']},
  three: {percent:[40,50,60,70,80,90],reps:[5,5,5,3,3,'3+']},
  // Intentionally preserve the source's 35/45/55 bench Day 3 ramp,
  // rather than changing it to 40/50/60 to match the squat.
  benchThree: {percent:[35,45,55,70,80,90],reps:[5,5,5,3,3,'3+']},
  one: {percent:[45,55,65,75,85,95],reps:[5,5,5,5,3,'1+']},
  protocolDeload: {percent:[50,60,70,80,90,100],reps:[5,5,5,3,1,1]},
  rmTest: {percent:[50,60,70,80,90,100],reps:[5,5,5,3,1,'3+']},
};
export const ORIGINAL_CHALLENGE_SOURCE_SCHEMES=SCHEMES;

const phase=week=>week<=3?'Leader Cycle 1':week<=6?'Leader Cycle 2':
  week<=9?'Anchor Cycle 1':'Anchor Cycle 2';
const optionalAssistance=[
  ex('Pushups or Dips','50 total reps','Choose one of the two movements'),
  ex('Chinups or Pullups','50 total reps','Choose one of the two movements'),
  ex('Situps or Back Extensions','50 total reps','Choose one of the two movements'),
];
const warmup=[
  ex('Jumps','10 reps','Warmup before lifting'),
  ex('Throws','10 reps','Warmup before lifting'),
];

export function originalChallengePrescription(schemeName){
  const s=SCHEMES[schemeName];
  if(!s)throw Error('Unknown Original Challenge scheme');
  return s.percent.map((pct,i)=>String(s.reps[i])+' @ '+pct+'% TM').join('; ');
}
const lift=(name,scheme)=>ex(name,originalChallengePrescription(scheme),
  'Each set percentage is calculated from the 85% training max, not directly from 1RM.');
const doubleDay=(week,index,first,firstScheme,second,secondScheme)=>day(
  'Day '+index+' - '+first+' / '+second,
  [...warmup,lift(first,firstScheme),lift(second,secondScheme),...optionalAssistance],
  phase(week)+' · Week '+week+' · 10 jumps and 10 throws before lifting; 50 repetitions each from the three assistance pairs.'
);
const mainDays=week=>(week===1||week===4||week===7||week===10)
  ?[
    doubleDay(week,1,'Squat','five','Bench','five'),
    doubleDay(week,2,'Deadlift','five','Press','five'),
    doubleDay(week,3,'Squat','three','Bench','benchThree'),
  ]:[
    doubleDay(week,1,'Deadlift','three','Press','three'),
    doubleDay(week,2,'Squat','one','Bench','one'),
    doubleDay(week,3,'Deadlift','one','Press','one'),
  ];
const testDays=week=>{
  const scheme=(week===6||week===12)?'rmTest':'protocolDeload';
  const label=(week===6||week===12)?'1RM Test':'Protocol Deload';
  return [['Monday','Squat'],['Tuesday','Bench'],['Thursday','Deadlift'],['Friday','Press']]
    .map(([weekday,name])=>day(weekday+' - '+name,[lift(name,scheme)],
      'Week '+week+' · '+label+' · Exact 50/60/70/80/90/100% workbook ramp. Blank assistance placeholders were not filled in.'));
};

export const originalChallengeProgram={
  id:'531-original-challenge',
  name:'531 Original Challenge',
  category:'Strength',
  difficulty:'Intermediate',
  weeksCount:12,
  daysPerWeek:4,
  durationLabel:'12 weeks · 3–4 days/week',
  source:'531 Original Challenge.xlsx',
  description:'Original 12-week leader/anchor progression. Weeks 1–2, 4–5, 7–8 and 10–11 pair two lifts on three days; protocol deloads in Weeks 3/9 and 1RM tests in Weeks 6/12 are four-day weeks. Preserves source percentages, AMRAPs, warmups, assistance options and training-max increases.',
  transcriptionStatus:'full',
  structuredPercentSets:true,
  trainingMaxFactor:0.85,
  getTrainingMaxOffset:(week,lift)=>
    [4,5,6,10,11,12].includes(Number(week))
      ?(['Squat','Deadlift'].includes(lift)?10:5):0,
  getWeek:week=>{
    const w=Math.max(1,Math.min(12,Math.floor(Number(week)||1)));
    return [3,6,9,12].includes(w)?testDays(w):mainDays(w);
  }
};
