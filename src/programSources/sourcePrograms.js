import {ex,day,sourceProgram} from './helpers'
import {manualTranscribedPrograms} from './manualPrograms'
import {PUMP_1_4} from './pump1'
import {PUMP_5_8} from './pump2'
import {LOWER_BEGINNER} from './lowerBeginner'
import {ZACH_VAUGHN} from './zachVaughn'
import {RANGER_DATA} from './rangerData'
import {RAIDER_1_4} from './raider1'
import {RAIDER_5_12} from './raider2'
import {VON_DATA} from './vonData'
import {COLORADO_DATA} from './coloradoData'
import {TRAIN12_DATA} from './training12Data'

const wrap=(meta,data)=>sourceProgram(meta,data)

const pump=wrap({
  id:'pump-dragon',name:'Pump Dragon',category:'Bodybuilding',difficulty:'Advanced',weeksCount:8,daysPerWeek:4,
  source:'Pump Dragon .pdf',description:'Eight-week high-volume bodybuilding and strength program.'
},{...PUMP_1_4,...PUMP_5_8})

const lower=wrap({
  id:'lower-body',name:'Lower Body Program',category:'Specialization',difficulty:'Intermediate',weeksCount:6,daysPerWeek:3,
  source:'Lower Body Program.docx',description:'Six-week lower-body strength, kettlebell, core, and mobility plan.'
},LOWER_BEGINNER['lower-body'])

const beginnerOly=wrap({
  id:'beginner-oly',name:'Beginner Olympic Lifting',category:'Olympic + Strength',difficulty:'Beginner',weeksCount:4,daysPerWeek:5,
  source:'Beginner Oly Program.docx',description:'Four-week beginner Olympic-lifting progression.'
},LOWER_BEGINNER['beginner-oly'])

const zach=wrap({
  id:'zach-even-esh',name:'Zach Even-Esh Strength & Conditioning',category:'Strength + Conditioning',difficulty:'Intermediate',weeksCount:4,daysPerWeek:3,
  source:'Zach Even-Esh Strength & Conditioning.pdf',description:'Four-week full-body, upper/lower, sprint, carry, sled, and bodyweight plan.'
},ZACH_VAUGHN['zach-even-esh'])

const vaughn=wrap({
  id:'vaughn-weightlifting',name:'Vaughn Weightlifting',category:'Olympic + Strength',difficulty:'Advanced',weeksCount:4,daysPerWeek:5,
  source:'week1-4vaughn.pdf',description:'Four-week Olympic lifting block with squat, pull, jerk, clean and snatch progression.'
},ZACH_VAUGHN['vaughn-weightlifting'])

const ranger=wrap({
  id:'ranger-selection-12',name:'12 Week Ranger Assessment & Selection',category:'Tactical',difficulty:'Advanced',weeksCount:12,daysPerWeek:5,
  source:'12 Week Ranger Assessment and Selection Program Training Plan2.pdf',description:'Twelve-week run, ruck, pull-up, push-up, sit-up and assessment preparation plan.'
},RANGER_DATA)

const raider=wrap({
  id:'raider',name:'Raider',category:'Tactical',difficulty:'Advanced',weeksCount:12,daysPerWeek:6,
  source:'Raider.docx',description:'Twelve-week tactical strength, sprint, run/swim, stamina and loaded-carry program.'
},{...RAIDER_1_4,...RAIDER_5_12})

const von=wrap({
  id:'von-moger',name:'Von Moger Mass',category:'Bodybuilding',difficulty:'Intermediate',weeksCount:6,daysPerWeek:6,
  source:"Andy's Von Moger Mass.xlsx",description:'Six-week high-volume bodybuilding split from the original workbook.'
},VON_DATA)

const colorado=wrap({
  id:'colorado',name:'Colorado Experiment',category:'Bodybuilding',difficulty:'Advanced',weeksCount:4,daysPerWeek:4,
  source:'Colorado Experiment.xlsx',description:'Fourteen sequential high-intensity workouts preserved from the archive workbook.'
},COLORADO_DATA)

const training12=wrap({
  id:'training12',name:'12 Week Training Program',category:'Bodybuilding',difficulty:'Intermediate',weeksCount:12,daysPerWeek:5,
  source:'12 Week Training Program.xlsx',description:'Twelve-week mixed-method plan using Burst, Y3T, FST-7 and negative-training phases.'
},TRAIN12_DATA)

const revisedDLData={
  1:[day('Rep Week',[ex('Deficit Deadlift','80% x3 x3'),ex('Knee Pull','90% x2 x4'),ex('Back Squat','60% x6 x3'),ex('Wide-Grip Pullup','3x10'),ex('Back Raise','5x10')])],
  2:[day('Speed Week',[ex('Deadlift','70% x2 x5'),ex('4-inch Block Snatch-Grip Deadlift','60% x12 x3'),ex('Knee Pull','80% x5 x5'),ex('Shrug','3x15'),ex('Kipping Pullup','5x12'),ex('Band Good Morning','50 reps')])],
  3:[day('Heavy Week',[ex('Deficit Deadlift','30x8,35x5,45x3,55x3,65x2,70x2,80x2,85x2,90%x1x2'),ex('Knee Pull','100%x1,110%x1x3'),ex('Barbell Row','3x12'),ex('Good Morning','3x10 moderate'),ex('Plank','3x30 sec')])],
  4:[day('Rep Week',[ex('Deficit Deadlift','30x8,35x5,45x3,55x3,65x3,75x3,80x3,85%x3x3'),ex('Knee Pull','90%x1x5'),ex('4-inch Block Snatch-Grip Deadlift','55%x8x3'),ex('Back Squat','60%x8x3'),ex('Wide-Grip Pullup','4x10'),ex('Back Raise','5x10')])],
  5:[day('Speed Week',[ex('Deadlift','75%x2x5'),ex('4-inch Block Snatch-Grip Deadlift','60%x8x3'),ex('Knee Pull','85%x3x3'),ex('Back Squat','60%x8x2'),ex('Barbell Row','3x15'),ex('Kipping Pullup','5x15'),ex('Band Good Morning','50 reps')])],
  6:[day('Heavy Week',[ex('Deficit Deadlift','30x8,35x5,45x3,55x3,65x2,75x2,80x2,85x2,90%x1x2,95%x1'),ex('Knee Pull','105%x1x2,110%x1'),ex('Barbell Row','3x12'),ex('Good Morning','3x10 moderate')])],
  7:[day('Rep Week',[ex('Deficit Deadlift','30x8,35x5,45x3,55x3,65x3,75x3,80x3,85x3,90%x2'),ex('Knee Pull','75%x5x3'),ex('4-inch Block Snatch-Grip Deadlift','65%x10x3'),ex('Back Squat','70%x8x3'),ex('Wide-Grip Pullup','4x10')])],
  8:[day('Speed Week',[ex('Deadlift','80%x2x5'),ex('Knee Pull','75%x6x3'),ex('Back Squat','80%x5x3'),ex('Shrug','3x15'),ex('Kipping Pullup','5x12'),ex('Band Good Morning','50 reps')])],
  9:[day('Heavy Week',[ex('Deficit Deadlift','30x8,35x5,45x3,55x3,65x2,75x2,80x2,85x2,90%x1,95%x1'),ex('Knee Pull','105%x1x3'),ex('Wide-Grip Pullup','3x12'),ex('Good Morning','3x10 moderate')])],
}
const revisedDeadlift={id:'revised-deadlift',name:'Deadlift Cycle for Maximum Floor Speed',category:'Specialization',difficulty:'Intermediate',weeksCount:9,daysPerWeek:1,source:'Revised Deadlift Cycle.docx',description:'Nine-week deficit, speed, knee-pull and heavy deadlift progression.',transcriptionStatus:'full',getWeek:w=>revisedDLData[Math.max(1,Math.min(9,w))]}

const wendlerPct={1:70,2:65,3:75}
const wendlerChallenge={
  id:'wendler-challenge',name:'Wendler Challenge',category:'Strength',difficulty:'Intermediate',weeksCount:3,daysPerWeek:1,
  source:'Wendler challenge.docx',description:'Three-week Friday hang-clean, high-rep squat and press challenge from the archive.',transcriptionStatus:'full',
  getWeek:w=>{
    const p=wendlerPct[Math.max(1,Math.min(3,w))]
    return [day('Friday',[ex('Hang Clean','10%x5,20%x5,30%x5,40%x5,50%x3,60%x3,70%x1,80%x1,90%x1,100% max reps, then 85% 3x5'),ex('Squat',`${p}% x max reps · target 15+`),ex('Shoulder Press','Use the corresponding source-week press prescription')])]
  }
}

const heavyExplosive={
  id:'heavy-explosive8',name:'8 Week Heavy / Explosive Program',category:'Strength + Power',difficulty:'Intermediate',weeksCount:8,daysPerWeek:4,
  source:'New Program.docx',description:'Eight-week bench, squat, deadlift and power-clean plan pairing heavy and explosive work.',transcriptionStatus:'full',
  getWeek:w=>{
    const week=Math.max(1,Math.min(8,w))
    const bench=[[4,5,75],[5,5,75],[6,5,75],[2,3,80],[3,3,80],[3,3,85],[2,3,90],[2,3,95]][week-1]
    const clean=[[2,5,75],[3,5,75],[4,5,75],[5,5,75],[2,5,80],[3,5,80],[2,3,85],[3,3,85]][week-1]
    return [
      day('Monday',[ex('Bench Press',`Heavy ${bench[0]} reps x ${bench[1]} @ ${bench[2]}%`),ex('Back Squat','Explosive 2x5 @75%')]),
      day('Tuesday',[ex('Deadlift',`Heavy ${bench[0]} reps x ${bench[1]} @ ${bench[2]}%`)]),
      day('Wednesday',[ex('Back Squat',`Heavy ${bench[0]} reps x ${bench[1]} @ ${bench[2]}%`),ex('Bench Press','Explosive 2x5 @75%')]),
      day('Thursday',[ex('Power Clean',`${clean[0]} reps x ${clean[1]} @ ${clean[2]}%`)]),
    ]
  }
}

const hiitWeek=[
  day('Monday - Heavy Lower',[ex('Squat','5x5 · 3 min'),ex('Narrow Goblet Squat','3x10 · 1 min'),ex('Leg Press','2x20 · 1 min'),ex('Deadlift','5x5 · 3 min'),ex('Straight-Leg Deadlift','3x10 · 1 min'),ex('Leg Curl','3x15 + drop to failure'),ex('Calf Raise','7x12 · 30 sec')]),
  day('Tuesday - Explosive Upper',[ex('Bench Press','3x12'),ex('Pushup','3x5 superset'),ex('Incline DB Bench','3x10'),ex('DB Shoulder Press','3x15'),ex('Burpee','3x5 superset'),ex('Upright Row','2x25'),ex('Inverted Row','3xAMAP'),ex('DB Bent-Over Row','3x10')]),
  day('Wednesday - Core / Arms / HIIT',[ex('Overhead Bench Stepup','3x10'),ex('One-Arm Incline Bench Press','3x10 each'),ex('Crunch','3x15'),ex('Lying Leg Raise','3x15'),ex('EZ-Bar Curl','3x20'),ex('EZ-Bar Overhead Triceps Extension','3x12'),ex('Incline DB Curl','3x15'),ex('Dip','3xAMAP'),ex('Stationary Bike HIIT','10 rounds: 15 sec max + 60 sec sustainable')]),
  day('Thursday - Explosive Lower',[ex('Squat','3x10'),ex('Jump Squat','3x5 superset'),ex('Reverse Lunge','8x4 each'),ex('Jumping Lunge','8x4 each'),ex('Wide-Foot Leg Press','1x50'),ex('Leg Curl','1x50'),ex('Deadlift','3x10'),ex('DB Straight-Leg Deadlift','3x5'),ex('Sumo Deadlift','2x25'),ex('Back Extension','1x50')]),
  day('Friday - Heavy Upper',[ex('Incline DB Bench','2x10 warmup; 5 work sets 10/8/6/4 to failure'),ex('Pause Bench','8x3'),ex('Close-Grip Bench','5x5'),ex('Bench Dip','3x10'),ex('DB Shoulder Press','5/4/3/2/1 ramp'),ex('DB Lateral Raise','2x10'),ex('DB Front Raise','2x10'),ex('Pullup','5x failure'),ex('One-Arm DB Row','5x10 each'),ex('Chest-Supported DB Row','2x25')]),
]
const hiit={id:'hiit-strength-trainer',name:'HIIT Strength Trainer',category:'Strength + Conditioning',difficulty:'Intermediate',weeksCount:1,daysPerWeek:5,source:'HIIT_Strength Trainer.docx',description:'The source contains one fully detailed training week; later headings were blank, so WorkoutBoard exposes only the verified week.',transcriptionStatus:'full',getWeek:()=>hiitWeek}

const osbcData={
  1:[day('Sunday',[ex('Bench Press','60%x5,70%x5,80%x3,90%x1,100%x1,85% 3x5'),ex('Back Squat','1x20 @15RM'),ex('Weighted Pullup','5x5')]),day('Wednesday',[ex('Deadlift','70/80/90%x5'),ex('Clean and Jerk','60%x5,80%x3,90%x1,100%x1,95%x5')]),day('Friday',[ex('Shoulder Press','3 sets @70% max reps'),ex('OH or Front Squat','60/70/80%x5'),ex('Strict Pullup','3x10 + 4x5 towel pullups')])],
  2:[day('Sunday',[ex('Bench Press','60%x5,70%x5,80%x3,90%x1,100%x1,75% 3x5'),ex('Back Squat','1x20 · add 5-10 lb'),ex('Weighted Pullup','5x5')]),day('Wednesday',[ex('Deadlift','65/75/85%x5'),ex('Clean and Jerk','60%x5,70%x5,80%x3,90%x1,100%x1')]),day('Friday',[ex('Shoulder Press','3 sets @65% max reps'),ex('OH or Front Squat','55/65/75%x5'),ex('Strict Pullup','5x10')])],
  3:[day('Sunday',[ex('Bench Press','60%x5,70%x5,80%x3,90%x1,100%x1,95% 3x5'),ex('Back Squat','1x20 · add 5-10 lb'),ex('Weighted Pullup','5x5')]),day('Wednesday',[ex('Deadlift','75/85/95%x5'),ex('Clean and Jerk','60%x5,70%x5,80%x3,90%x1,100%x1,105%x3-5')]),day('Friday',[ex('Shoulder Press','3 sets @75% max reps'),ex('OH or Front Squat','65/75/85%x5'),ex('Strict Pullup','5x10')])],
}
const osbc={id:'osbc-new',name:'OSBC New Program',category:'Strength + Conditioning',difficulty:'Intermediate',weeksCount:3,daysPerWeek:3,source:'OSBC New program.docx',description:'Three-week bench, squat, deadlift, Olympic lift and pull-up plan.',transcriptionStatus:'full',getWeek:w=>osbcData[Math.max(1,Math.min(3,w))]}

const ppsa21Data={
  1:[
    day('Day 1',[ex('Squat','3x7 @70%'),ex('Bench','4x3 @83%, then 1x4 and 1x5 @83%'),ex('Pullup','7x3 BW · superset bench')]),
    day('Day 2',[ex('Squat','3 reps @60,65,70,75,80,80,80%'),ex('Bench','7 reps @72.5,75,75%'),ex('Row','3x7')]),
    day('Day 3',[ex('Squat','7x5 @60%, 7x3 @70%, 7x1 @80%'),ex('Barbell Press','7x3 heavy')]),
    day('Day 4',[ex('Squat','7 reps @72,73,74%'),ex('Deadlift','3x7 @75%'),ex('BB Curl 21s','5 sets'),ex('Pullup','5x4')]),
    day('Day 5',[ex('Bench','7x7 @65%, 7x5 @75%, 7x3 @80%'),ex('RDL','3x7'),ex('Single-Arm DB Row','3x7 each')]),
  ],
  2:[
    day('Day 6',[ex('Squat','3,3,3,3,4,5 reps @83%'),ex('Bench','7 reps @73,76,78%'),ex('Pullup','7x3'),ex('Banded Triceps Pulldown','7x21')]),
    day('Day 7',[ex('Squat','3 reps @60,65,70,75,80,82,85%'),ex('Bench','4,4,4,4,5 reps @83%'),ex('DB Press','3x21'),ex('BB Row','3x21')]),
    day('Day 8',[ex('Squat','7 reps @65,70,73%'),ex('Bench','3 reps @60,65,70,75,80,80,80%'),ex('BB Curl','4x21'),ex('Pushup','3x21')]),
    day('Day 9',[ex('Squat','4,4,4,4,5 reps @83%'),ex('Pullup','7x3'),ex('DB Curl to Press','3x7')]),
    day('Day 10',[ex('Bench','5,5,5,6 reps @83%'),ex('Deadlift','7x3 · increase each set'),ex('Single-Arm DB Row','3x7 each')]),
  ],
}
const ppsa21={id:'ppsa-21-party',name:'PPSA 21 to Party',category:'Strength + Conditioning',difficulty:'Advanced',weeksCount:2,daysPerWeek:5,source:'PPSA 21 to Party Condensed.docx',description:'Ten-session squat/bench/deadlift and 21-rep accessory cycle.',transcriptionStatus:'full',getWeek:w=>ppsa21Data[Math.max(1,Math.min(2,w))]}

const meatData={
  1:[day('Day 1',[ex('Bench','5 reps @70,75,80,80%; 10 @65%'),ex('Squat','3 reps @70,75,80%; 8 @65%'),ex('DB Incline Bench','3x5'),ex('BB RDL','3x5')]),day('Day 2',[ex('Deadlift','5 reps @70,75,75,75%'),ex('Face Pull','4x15'),ex('Single-Arm DB Row','4x5'),ex('Pullup','4x3')]),day('Day 3',[ex('Front Squat','5 reps @45,50,55,60% of back squat'),ex('BB Press','5 reps @35,37,40,40% of bench'),ex('Close-Grip Bench','5x5'),ex('DB RDL','5x10')]),day('Day 4',[ex('Sumo Deadlift','3 reps @75,80,80,80%'),ex('DB Pullover','5x5'),ex('Bent-Over Row','4x8'),ex('Chest-Supported DB Row','3x20')])],
  2:[day('Day 5',[ex('Bench','5 reps @75,80,80,80%; 10 @70%'),ex('Squat','2 reps @75,80,80,80%; 5 @70%'),ex('DB Incline Bench','3x5 heavier'),ex('BB RDL','3x5 heavier')]),day('Day 6',[ex('Deadlift','3 reps @75,80,80,80%'),ex('Face Pull','4x15'),ex('Single-Arm DB Row','4x5 heavier'),ex('Pullup','4x3')]),day('Day 7',[ex('Front Squat','5 reps @50,55,60,60%'),ex('BB Press','5 reps @37,40,40,45%'),ex('Close-Grip Bench','5x6'),ex('DB RDL','5x10')]),day('Day 8',[ex('Sumo Deadlift','4 reps @75,80,80,80%'),ex('DB Pullover','4x8'),ex('Bent-Over Row','5x5'),ex('Chest-Supported DB Row','3x25')])],
  3:[day('Day 9',[ex('Bench','4 reps @75,80,85,85%; 8 @75%'),ex('Squat','5x5 @70%'),ex('DB Incline Bench','3x5'),ex('BB RDL','3x10')]),day('Day 10',[ex('Deadlift','2 reps @75,80,85,85%'),ex('Face Pull','4x20'),ex('Single-Arm DB Row','4x5'),ex('Pullup','4x3')]),day('Day 11',[ex('Squat','2 reps @75,80,85,90%; 5 @70%'),ex('Bench','5 reps @70,75,80,80%; 10 @70%'),ex('DB Arnold Press','4x5'),ex('Banded Triceps Pulldown','4x20')]),day('Day 12',[ex('Deficit Deadlift','5 reps @50,55,60,65%'),ex('BB Row','4x5'),ex('DB Pullover','4x5'),ex('Chest-Supported DB Row','4x10')])],
  4:[day('Day 13',[ex('Bench','4 reps @75,80,85,85,85%; 6 @80%'),ex('Squat','3 reps @70,75,80,80,80%'),ex('DB Incline Bench','3x5'),ex('BB RDL','3x5')]),day('Day 14',[ex('Deadlift','3x5 @75%'),ex('Face Pull','3x25'),ex('Pullup','4x3'),ex('Single-Arm DB Row','4x5')]),day('Day 15',[ex('Squat','5x4 @70%'),ex('Bench','10 reps @60,65,70%'),ex('DB Arnold Press','4x5'),ex('Ring Dip','4x10')]),day('Day 16',[ex('Deficit Deadlift','4 reps @55,60,65,70%'),ex('DB Pullover','6x4'),ex('BB Row','4x5 + 2x10'),ex('Chest-Supported DB Row','2x5 + 2x10 + 2x20')])],
}
const meat={id:'ppsa-meat-wagon',name:'PPSA Meat Wagon',category:'Strength + Conditioning',difficulty:'Advanced',weeksCount:4,daysPerWeek:4,source:'PPSA Meat Wagon Condensed.docx',description:'Four-week bench/squat/deadlift and assistance progression.',transcriptionStatus:'full',getWeek:w=>meatData[Math.max(1,Math.min(4,w))]}

const pauseRx=[
  ['5-count pause squat:45/55/65%x8','Dead squat:6x1 @55% · 30 sec'],
  ['5-count pause squat:50/60/70%x5','Dead squat:8x1 @55% · 30 sec'],
  ['5-count pause squat:work to 5RM','Dead squat:10x1 @55% · 30 sec'],
  ['Off','Off'],
  ['3-count pause squat:55/65/75%x5','Dead squat:7x1 @60% ·45 sec'],
  ['3-count pause squat:60/70/80%x3','Dead squat:6x1 @65% ·45 sec'],
  ['3-count pause squat:work to 3RM','Dead squat:5x1 @70% ·45 sec'],
  ['Off','Off'],
  ['2-count pause squat:65/75/85%x3','Dead squat:4x1 building65-80% ·60 sec'],
  ['2-count pause squat:70/80/90%x2','Dead squat:3x1 building70-85% ·90 sec'],
  ['2-count pause squat:work to 1RM','Dead squat:3x1 building75-90% ·120 sec'],
  ['Off','Off'],
]
const pauseCycles={id:'pause-dead-squat-cycles',name:'Pause + Dead Squat Cycles',category:'Specialization',difficulty:'Intermediate',weeksCount:12,daysPerWeek:2,source:'pause and dead squat cycles.docx',description:'Twelve-week pause-squat and dead-squat specialty progression.',transcriptionStatus:'full',getWeek:w=>{const x=pauseRx[Math.max(1,Math.min(12,w))-1];return[day('Pause Squat',[ex('Pause Squat',x[0])]),day('Dead Squat',[ex('Dead Squat',x[1])])]}}

const massBuilder={
  id:'massbuilder',name:'MASSbuilder',category:'Strength + Conditioning',difficulty:'Advanced',weeksCount:12,daysPerWeek:4,source:'MASSbuilder.pdf',
  description:'Twelve-week giant-set strength/hypertrophy/conditioning progression.',transcriptionStatus:'full',
  getWeek:w=>{
    const week=Math.max(1,Math.min(12,w)),block=Math.floor((week-1)/3),slot=(week-1)%3
    const technique=[55,60,65,70][block]
    if(slot===0)return[
      day('Day 1 - Squat Hypertrophy',[ex('Front or Zercher Squat',`${10-block} reps @ ${60+5*block}%, ${8-2*Math.max(0,block-2)} reps @ ${70+5*block}%, then AMRAP @ ${80+5*block}%`),ex('Squat Jump','10 after each strength set'),ex('Competition Deadlift',`EMOM 10 min: 3 reps @ ${technique}%`),ex('Assistance Finisher','Source MASSbuilder assistance circuit')]),
      day('Day 2 - Press Hypertrophy',[ex('Press Strength Giant Set','Three escalating work sets with pull/chin and conditioning pairings'),ex('Competition Bench','Technique giant set'),ex('Assistance Finisher','Timed shoulder/upper-back circuit')]),
      day('Day 3 - Deadlift Speed / Endurance',[ex('Explosive KB/DB Swing','15 sec before each pull set'),ex('Block/Rack Deadlift','Three escalating strength sets'),ex('Competition Squat',`4 rounds / technique work @ ${70+5*block}%`)]),
      day('Day 4 - Bench Hypertrophy',[ex('Heavy DB Row','10/8/6 with bench giant set'),ex('Close-Grip / Bench Variation','Three escalating strength sets'),ex('Strict Press',`EMOM 10 min:3 reps @ ${technique}%`)]),
    ]
    if(slot===1)return[
      day('Day 1 - Squat Speed / Endurance',[ex('Box Jump / Step-Up','4 before each strength set'),ex('Pin or Pause Squat','Three escalating strength sets'),ex('Competition Deadlift',`4 rounds @ ${60+5*block}%`)]),
      day('Day 2 - Press Speed / Endurance',[ex('Press Variation','Three escalating strength sets'),ex('Competition Bench','5-round technique giant set'),ex('Assistance Finisher','Three-round press/upper-back circuit')]),
      day('Day 3 - Deadlift Power',[ex('Deadlift Variation','Power-focused giant set'),ex('Competition Squat',`EMOM 10 min:3 reps @ ${55+5*block}%`)]),
      day('Day 4 - Bench Speed / Endurance',[ex('Bench Variation','Three escalating strength sets'),ex('Strict Press / Chinup','4-round technique giant set'),ex('Assistance Finisher','Timed circuit')]),
    ]
    return[
      day('Day 1 - Squat Power',[ex('Burpee Broad Jump','5 before each squat set'),ex('Box / High-Bar Squat','Three escalating power sets'),ex('Competition Deadlift',`5 rounds:5 reps @ ${70+5*block}%`)]),
      day('Day 2 - Press Power',[ex('Chinup / Inverted Row','Max reps paired with press'),ex('Press Variation','Three escalating power sets'),ex('Competition Bench',`EMOM 10 min:3 reps @ ${55+5*block}%`)]),
      day('Day 3 - Deadlift Hypertrophy',[ex('Straight-Arm Pulldown','10 before each pull set'),ex('Deficit Deadlift','Three escalating strength sets'),ex('Competition Squat',`4 rounds @ ${60+5*block}%`)]),
      day('Day 4 - Bench Power',[ex('Heavy Supported Row','8 before each bench set'),ex('Pin/Pause Bench','Three escalating power sets'),ex('Strict Press',`5 rounds:5 reps @ ${70+5*block}%`)]),
    ]
  }
}

const upperSplits={
  1:[ex('DB Incline Press','Primary 10-set phase'),ex('Weighted Wide-Grip Pullup','Primary 10-set phase'),ex('Weighted Dip','3x8 @30X0'),ex('Kroc Row','3x8 @30X0'),ex('Russian Bear Situp','5x10')],
  2:[ex('Bench Press','Primary 10-set phase'),ex('Hang Clean High Pull','Primary 10-set phase · heavy'),ex('HSPU','3x8'),ex('Bar Muscle-Up','3x8')],
  3:[ex('Shoulder Press','Primary 10-set phase'),ex('Hang Snatch High Pull','Primary 10-set phase · heavy'),ex('Weighted Dip','3x8 @30X0'),ex('Kroc Row','3x8 @30X0'),ex('Russian Bear Situp','5x10')],
}
const lowerSplits={
  1:[ex('Back Squat','Primary 10-set phase'),ex('Bulgarian Split Squat','Primary 10-set phase each leg'),ex('Ring Muscle-Up','10 sets x1-5')],
  2:[ex('Overhead Squat','Primary 10-set phase'),ex('Deadlift','Primary 10-set phase · straps allowed')],
  3:[ex('Front Squat','Primary 10-set phase'),ex('GHR','Primary 10-set phase · weighted'),ex('Stiff-Leg Deadlift','3x8'),ex('Front-Rack Step-Up','3x8')],
}
const summerSchedule={
  1:[1,1,2,2],2:[3,3,1,1],3:[2,2,3,3],4:[1,1,2,2],
  7:[2,2,3,3],8:[1,1,2,2],9:[3,3,1,1],10:[2,2,3,3],
}
const cleanVariant={1:'2 hi-hang cleans +2 push jerks · find max',2:'2 hang cleans +2 split jerks · find max',3:'Power clean + hang clean + jerk · find max',4:'Shankle complex · find 1RM',7:'Hang clean +2 jerks · find max',8:'Power clean +3 push jerks · find max',9:'Power clean + push jerk +2 split jerks · find max',10:'Clean & Jerk 3x1 @72%'}
const snatchVariant={1:'Hi-hang snatch · find 3RM',2:'Hang snatch · find 3RM',3:'Snatch pull + snatch · find 1RM',4:'Snatch from blocks · find 2RM',7:'Power snatch + hang snatch · find max',8:'Heavy snatch double',9:'Muscle snatch max + power snatch 4x1 @82%',10:'Muscle snatch max + power snatch 3x2 @75%'}
const jerkVariant={1:'Behind-neck jerk · find 1RM',2:'Push jerk · find 2RM',3:'Heavy jerk from blocks/rack',4:'Behind-neck jerk · find 1RM',7:'Jerk 5x3 @75-80%',8:'Behind-neck jerk · find 1RM',9:'Jerk max then 3x2 @80%',10:'Jerk 4x2 @80% +2x2 @85%'}
function phaseRx(week){
  if(week<=2)return week===1?'10x5 @75% / initial load':'10x5 early week; shift to 10x4 @ previous 10x5 load +7%'
  if(week===3)return'10x4 @ previous 10x5 load +7%'
  if(week===4)return'10x3 @ previous 10x4 load +7%'
  if(week===7)return'10x5 @ prior phase 10x4 load'
  if(week===8)return'10x4 @ prior phase 10x3 load'
  if(week===9)return'10x4 early week; shift to 10x3 @ +7% nut-crushing load'
  return'10x3 @ nut-crushing load'
}
const summer={
  id:'summer-swolstice',name:'Summer Swolstice',category:'Olympic + Conditioning',difficulty:'Advanced',weeksCount:10,daysPerWeek:7,source:'Summer Swolstice Template.docx',
  description:'Ten-week Olympic lifting, 10-set strength progression, CrossFit/strongman conditioning and recovery template.',transcriptionStatus:'full',
  getWeek:w=>{
    const week=Math.max(1,Math.min(10,w))
    if(week===5)return[
      day('Monday',[ex('Power Clean','Find 1RM'),ex('Recovery Conditioning','Class/partner work optional')]),
      day('Tuesday',[ex('Snatch First Pull + Snatch','Find 1RM complex'),ex('Recovery / Mobility','Deload')]),
      day('Wednesday',[ex('Recovery + Mobility','25 min conversational row/airdyne + shoulder/T-spine mobility')]),
      day('Thursday',[ex('Conditioning','Deload: class, partner workout, or full rest')]),
      day('Friday',[ex('Push Jerk','Heavy single for technique'),ex('Recovery + Mobility','Deload')]),
      day('Saturday',[ex('Fun Work','Something light, not a beat-down')]),day('Sunday',[ex('Rest','Full rest')])
    ]
    if(week===6)return[
      day('Monday',[ex('Snatch','Heavy single'),ex('Front Squat','Find 1RM'),ex('Conditioning','Optional deload/class work')]),
      day('Tuesday',[ex('Clean and Jerk','Heavy single'),ex('Bench Press','Find 1RM'),ex('Conditioning','Optional deload/class work')]),
      day('Wednesday',[ex('Conditioning','CrossFit workout <=12 min')]),
      day('Thursday',[ex('Conditioning','15-30 min partner/interval/strongman'),...upperSplits[1]]),
      day('Friday',[ex('Split Jerk','Find 3RM'),...lowerSplits[1]]),day('Saturday',[ex('Fun Work','Light / mental break')]),day('Sunday',[ex('Rest','Full rest')])
    ]
    const [monSplit,tueSplit,thuSplit,friSplit]=summerSchedule[week]
    const rx=phaseRx(week)
    const adapt=list=>list.map(x=>({...x,prescription:x.prescription.replace('Primary 10-set phase',rx)}))
    return[
      day('Monday',[ex('Clean / Jerk Variant',cleanVariant[week]),...adapt(upperSplits[monSplit]),ex('Conditioning','Sprint-focused · at least 1:5 work:rest')]),
      day('Tuesday',[ex('Snatch Variant',snatchVariant[week]),...adapt(lowerSplits[tueSplit])]),
      day('Wednesday',[ex('Conditioning','CrossFit workout <=12 min · glycolytic focus')]),
      day('Thursday',[ex('Conditioning','15-30 min intervals/partner/strongman'),...adapt(upperSplits[thuSplit])]),
      day('Friday',[ex('Jerk Variant',jerkVariant[week]),...adapt(lowerSplits[friSplit])]),
      day('Saturday',[ex('Fun Work','Light work that is not a beat-down')]),day('Sunday',[ex('Rest','Full rest')])
    ]
  }
}

export const verifiedSourcePrograms=[
  ...manualTranscribedPrograms,
  pump,lower,beginnerOly,zach,vaughn,ranger,raider,von,colorado,training12,
  revisedDeadlift,wendlerChallenge,heavyExplosive,hiit,osbc,ppsa21,meat,pauseCycles,massBuilder,summer
]
