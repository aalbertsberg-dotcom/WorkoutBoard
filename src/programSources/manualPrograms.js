import {ex,day,repeatProgram} from './helpers'

const repRange=(name,sets,reps,note='')=>ex(name,`${sets}x${reps}`,note)

const sixtyLightReps=[8,9,10,11,12]
const sixtyHeavyReps=[4,5,6,7,8]
const sixtyLight={
  A:[
    ['DB Lateral Raise','3 sets'],['Single-Arm DB Overhead Press','3 sets · superset'],['DB Rear-Delt Fly','3 sets'],
    ['Rope High Pull','3 sets · superset'],['Scott Press','3 sets'],['Cable Shrug','3 sets'],
    ['DB Upright Row','3 sets · superset']
  ],
  B:[
    ['Pullup','3 sets to failure'],['Standing Single-Arm Cable Row','3 sets'],['Single-Arm DB Row','3 sets · superset'],
    ['Straight-Arm Pushdown','3 sets'],['Low Cable Pull','3 sets · superset'],['Straight-Bar Curl','3 sets'],
    ['DB Spider Curl','3 sets'],['Reverse Curl','3 sets']
  ],
  C:[
    ['Pushup','2 sets'],['Cable Crossover','3 sets'],['Bench Press','3 sets · superset'],['Incline DB Fly','3 sets'],
    ['Incline DB Press','3 sets · superset'],['Incline French Press','3 sets'],['Rope Pushdown','3 sets'],
    ['DB Overhead Extension','3 sets · superset'],['DB Kickback','3 sets']
  ],
  D:[
    ['Leg Extension','3 sets'],['Leg Press','3 sets · superset'],['Leg Curl','3 sets'],['Walking Lunge','3 sets · superset'],
    ['Deadlift','3 sets'],['Standing Calf Raise','3 sets'],['Seated Calf Raise','3 sets · superset']
  ],
}
const sixtyHeavy={
  A:[['Barbell Clean and Press','3 sets'],['DB Lateral Raise','3 sets'],['DB Rear-Delt Fly','3 sets'],['DB Shrug','3 sets']],
  B:[['Pullup','2 sets to failure'],['Lat Pulldown','5 sets'],['Barbell Bent-Over Row','3 sets'],['Seated DB Curl','3 sets'],['Standing Straight-Bar Cable Curl','3 sets']],
  C:[['Pushup','2 sets'],['Flat DB Press','5 sets'],['DB Incline Press','5 sets'],['Close-Grip Bench','5 sets'],['Incline French Press','5 sets']],
  D:[['Squat','5 sets'],['Deadlift','5 sets'],['Standing Calf Raise','5 sets'],['Seated Calf Raise','5 sets']],
}
const sixtyDay=(letter,kind,cycle,calendarDay)=>{
  const reps=(kind==='Light'?sixtyLightReps:sixtyHeavyReps)[cycle-1]
  const src=kind==='Light'?sixtyLight[letter]:sixtyHeavy[letter]
  const label={A:'Shoulders + Traps',B:'Back + Biceps + Forearms',C:'Chest + Triceps',D:'Legs'}[letter]
  return day(`Day ${calendarDay} · ${label} · ${kind}`,src.map(([name,sets])=>ex(name,`${sets} · ${name==='Pullup'&&/failure/.test(sets)?'to failure':reps+' reps'}`,kind==='Light'?'1 min between sets; no rest inside supersets':'3-4 min between sets')),kind==='Light'?'Light day from the 60-day source calendar.':'Heavy day from the 60-day source calendar.')
}
const sixtyDaysProgram={
  id:'60-days-fit',name:'60 Days to Fit',category:'General',difficulty:'Intermediate',weeksCount:5,daysPerWeek:8,durationLabel:'60 days',
  source:'60-days-to-fit-program.pdf',description:'Five 12-day cycles alternating light and heavy A/B/C/D sessions with progressive rep targets.',transcriptionStatus:'full',
  getWeek:cycle=>{
    const c=Math.max(1,Math.min(5,Number(cycle)||1))
    return [
      sixtyDay('A','Light',c,1),sixtyDay('B','Heavy',c,2),sixtyDay('C','Light',c,4),sixtyDay('D','Heavy',c,5),
      sixtyDay('A','Heavy',c,7),sixtyDay('B','Light',c,8),sixtyDay('C','Heavy',c,10),sixtyDay('D','Light',c,11),
    ]
  }
}

const jugWaves=[
  {name:'10s',acc:'5x10 @ 60%',int:'55%x5, 62.5%x5, then 3x10 @ 67.5%',real:'50%x5, 60%x3, 70%x1, 75% AMRAP'},
  {name:'5s',acc:'6x5 @ 70%',int:'65%x2, 72.5%x2, then 4x5 @ 77.5%',real:'50%x5, 60%x3, 70%x2, 75%x1, 80%x1, 85% AMRAP'},
  {name:'8s',acc:'5x8 @ 65%',int:'60%x3, 67.5%x3, then 3x8 @ 72.5%',real:'50%x5, 60%x3, 70%x2, 75%x1, 80% AMRAP'},
  {name:'3s',acc:'7x3 @ 75%',int:'70%x1, 77.5%x1, then 5x3 @ 82.5%',real:'50%x5, 60%x3, 70%x2, 75%x1, 80%x1, 85%x1, 90% AMRAP'},
]
const juggernaut={
  id:'juggernaut2',name:'Juggernaut Method 2.0',category:'Strength',difficulty:'Intermediate',weeksCount:16,daysPerWeek:4,
  source:'The_Juggernaut_Method_2.0 .pdf',description:'16-week undulating Juggernaut sequence: 10s, 5s, 8s, then 3s waves.',transcriptionStatus:'full',
  getWeek:week=>{
    const w=Math.max(1,Math.min(16,Number(week)||1)),wave=jugWaves[Math.floor((w-1)/4)],phase=(w-1)%4
    const prescription=phase===0?wave.acc:phase===1?wave.int:phase===2?wave.real:'40%x5, 50%x5, 60%x5 · accessory volume 50%'
    const phaseName=['Accumulation','Intensification','Realization','Deload'][phase]
    return ['Bench Press','Squat','Military Press','Deadlift'].map(lift=>day(`${lift} · ${wave.name} ${phaseName}`,[ex(lift,prescription,phase===2?'AMRAP performance updates the next wave training max.':'Use the Juggernaut source progression.')]))
  }
}

const lifestyleBase={
  A:[
    ['Squat',['3x3 @ 85%','3x4 @ 85%','4x5 @ 85%','4x5 @ 85% + fifth-set AMRAP']],
    ['Deadlift',['4x3 @ 80%','4x4 @ 80%','5x4 @ 80%','5x5 @ 80%']],
    ['Paused Squat',['3x5 RPE 8','3x5 RPE 9','4x5 RPE 8','4x5 RPE 9']],
    ['Lunge',['3x8 each RPE 8','3x8 each RPE 8','3x8 each RPE 8','Omit']],
    ['Calf Raise',['3x6 RPE 9','3x6 RPE 9','3x6 RPE 9','Omit']],
  ],
  B:[
    ['Bench Press',['3x3 @ 85%','3x4 @ 85%','4x5 @ 85%','4x5 @ 85% + fifth-set AMRAP']],
    ['Pullup',['2 sets max','3 sets max','4 sets max','5 sets max']],
    ['Close-Grip Bench',['3x5 RPE 8','3x5 RPE 9','4x5 RPE 8','4x5 RPE 9']],
    ['Incline Bench',['3x8 RPE 8','3x8 RPE 8','3x8 RPE 8','Omit']],
    ['DB Shoulder Press',['3x6 RPE 9','3x6 RPE 9','3x6 RPE 9','Omit']],
    ['DB Row',['3x12 RPE 9','3x12 RPE 9','3x12 RPE 9','3x12 RPE 7']],
  ],
  C:[
    ['Deadlift',['3x3 @ 85%','3x4 @ 85%','4x5 @ 85%','4x5 @ 85% + fifth-set AMRAP']],
    ['Rack Pull',['4x3 @ 80%','4x4 @ 80%','5x4 @ 80%','5x5 @ 80%']],
    ['Squat',['4x6 RPE 8','4x6 RPE 8','4x6 RPE 8','4x6 RPE 6']],
    ['Glute-Ham Raise',['3x8 RPE 8','3x8 RPE 8','3x8 RPE 8','Omit']],
    ['Calf Raise',['3x10 RPE 9','3x10 RPE 9','3x10 RPE 9','Omit']],
  ],
  D:[
    ['Barbell Row',['4x6-8 RPE 8','4x6-8 RPE 8','4x6-8 RPE 8','4x6-8 RPE 6']],
    ['Lat Pulldown',['3x10-12 RPE 9','3x10-12 RPE 9','3x10-12 RPE 9','3x10-12 RPE 6']],
    ['Incline DB Press',['3x6-8 RPE 9','3x6-8 RPE 9','3x6-8 RPE 9','3x6-8 RPE 6']],
    ['Military Press',['3x8 RPE 8','3x8 RPE 8','3x8 RPE 8','3x8 RPE 6']],
    ['DB Curl',['3x10-12 RPE 9','3x10-12 RPE 9','3x10-12 RPE 9','3x10-12 RPE 6']],
    ['DB Skullcrusher',['3x10-12 RPE 9','3x10-12 RPE 9','3x10-12 RPE 9','3x10-12 RPE 6']],
  ],
}
const lifestyle={
  id:'lifestyle-powerbuilding',name:'Lifestyle Powerbuilding',category:'Powerbuilding',difficulty:'Intermediate',weeksCount:8,daysPerWeek:4,
  source:'Nick_Cheadles_Lifestyle_Powerbuilding.pdf',description:'Four-session powerbuilding progression with a four-week build, heavier repeat, and week-eight taper.',transcriptionStatus:'full',
  getWeek:week=>{
    const w=Math.max(1,Math.min(8,Number(week)||1))
    if(w===8)return [
      day('6 Days Out',[ex('Squat','5x6 @ 60%'),ex('Bench Press','5x6 @ 60%'),ex('Deadlift','5x6 @ 60%')]),
      day('4 Days Out',[ex('Squat','3x3 @ 70%'),ex('Bench Press','3x3 @ 70%'),ex('Deadlift','3x3 @ 70%')]),
      day('2 Days Out',[ex('Squat','1x1 @ 80%'),ex('Bench Press','1x1 @ 80%'),ex('Deadlift','1x1 @ 80%')]),
    ]
    const index=w<=4?w-1:w-5
    const note=w>=5?'Repeat the corresponding first-block prescription after adding 5-10 lb to bench max and 10-20 lb to squat/deadlift max.':''
    return Object.entries(lifestyleBase).map(([name,rows])=>day(`Session ${name}`,rows.filter(x=>x[1][index]!=='Omit').map(([lift,p])=>ex(lift,p[index])),note))
  }
}

const occam=repeatProgram({
  id:'occam',name:"Occam's Protocol",category:'Minimalist',difficulty:'Beginner',source:"4HBC-Cheat-Sheet-Occams-Protocol.pdf + Occam's Protocol Tracking.xlsx",
  description:'Minimalist alternating A/B slow-cadence strength protocol. Start with two days between sessions and increase recovery as needed.'
},[
  day('Workout A - Machine option',[ex('Pulldown - palms facing you','1 set to failure around 7 reps · 5/5 cadence'),ex('Shoulder Press','1 set to failure around 7 reps · 5/5 cadence'),ex('Myotatic Crunch','Optional x10'),ex('Cat Vomit','Optional x10')],'Rest exactly 3 minutes between primary exercises.'),
  day('Workout B - Machine option',[ex('Slight Incline/Decline Bench Press','1 set to failure around 7 reps · 5/5 cadence; pause bottom'),ex('Leg Press','1 set to failure around 10 reps · 5/5 cadence'),ex('Kettlebell Swing','Optional x50'),ex('Stationary Bike','Optional 3 minutes')],'Increase by 10 lb next workout when both targets are hit. Free-weight substitutions in source: Yates row/OHP and incline bench/squat.')
],4)

const ndp531={
  id:'ndp-531',name:'NDP 5/3/1',category:'Strength',difficulty:'Intermediate',weeksCount:4,daysPerWeek:4,
  source:'NDP-5.3.1.spreadsheet used for BB.xlsx',description:'Archive 5/3/1 wave represented by percentages rather than the historical user-specific weights in the sheet.',transcriptionStatus:'full',
  getWeek:w=>{
    const p={1:'65%x5, 75%x5, 85%x5+',2:'70%x3, 80%x3, 90%x3+',3:'75%x5, 85%x3, 95%x1+',4:'40%x5, 50%x5, 60%x5'}[Math.max(1,Math.min(4,Number(w)||1))]
    return ['Bench Press','Deadlift','Squat','Military Press'].map(x=>day(x,[ex(x,p,w===4?'Deload week':'Use 90% training max as shown in source.')]))
  }
}

const nineByFive={
  id:'9-by-5',name:'9 by 5 / 915 Cycle',category:'Strength + Conditioning',difficulty:'Advanced',weeksCount:9,daysPerWeek:4,
  source:'9 by 5.docx + 915 Complete.xlsx',description:'Canonical nine-week bench/deadlift/squat/power-clean cycle found in both the 9-by-5 and 915 archive files.',transcriptionStatus:'full',
  getWeek:w=>{
    const week=Math.max(1,Math.min(9,Number(w)||1))
    const plan={
      1:['5x4 @ 80%','5x4 @ 80%','5x4 @ 80%','5x2 @ 80%'],
      2:['5x5 @ 80%','5x5 @ 80%','5x5 @ 80%','5x3 @ 80%'],
      3:['5x6 @ 80%','5x6 @ 80%','5x6 @ 80%','5x4 @ 80%'],
      4:['3x2 @ 90%','3x2 @ 90%','3x2 @ 90%','5x4 @ 80%'],
      5:['3x3 @ 90%','3x3 @ 90%','3x3 @ 90%','5x2 @ 90%'],
      6:['3x3 @ 95%','3x3 @ 95%','3x3 @ 95%','5x3 @ 90%'],
      7:['3x2 @ 100%','3x2 @ 100%','3x2 @ 100%','3x2 @ 95%'],
      8:['3x2 @ 105%','3x2 @ 105%','3x2 @ 105%','3x3 @ 95%'],
    }[week]
    if(week===9)return [
      day('Sunday - All Four',[ex('Bench / Deadlift / Squat / Power Clean','2x1 @ 95%')]),
      day('Wednesday - Squat Test',[ex('Squat','1 rep @ 105%, 110%, 115%')]),
      day('Thursday - Bench Test',[ex('Bench Press','1 rep @ 105%, 110%, 115%')]),
      day('Saturday - Pull + Clean Test',[ex('Deadlift','1 rep @ 105%, 110%, 115%'),ex('Power Clean','1 rep @ 105%, 110%, 115%')]),
    ]
    return [
      day('Sunday - Bench',[ex('Bench Press',plan[0])]),
      day('Monday - Deadlift',[ex('Deadlift',plan[1])]),
      day('Wednesday - Squat',[ex('Squat',plan[2])]),
      day('Friday - Power Clean',[ex('Power Clean',plan[3])]),
    ]
  }
}
const nineByFiveAlias={...nineByFive,id:'915-program',name:'915 Program',source:'915 Complete.xlsx',description:'The same canonical nine-week cycle as the 9-by-5 archive source; retained as an archive alias.'}

const primer4={
  id:'primer4',name:'Primer 4 Program',category:'General',difficulty:'Intermediate',weeksCount:4,daysPerWeek:4,
  source:'Primer 4 Program.xlsx',description:'Four-week primer with paired bench/row, squat/deadlift, press/pullup, and front-squat/RDL sessions.',transcriptionStatus:'full',
  getWeek:w=>{
    const wk=Math.max(1,Math.min(4,Number(w)||1)),scheme=['3x4 + 1x4+ with 2 reps in tank','3x4 + 1x4+ with 1 rep in tank','3x4 + 1xAMRAP','3x4 + 1xAMRAP · beat last week'][wk-1]
    return [
      day('Bench + Row',[ex('Bench Press',scheme),ex('Barbell Row',scheme)]),
      day('Back Squat + Deadlift',[ex('Back Squat',scheme),ex('Deadlift',scheme)]),
      day('Shoulder Press + Pullup',[ex('Shoulder Press',scheme),ex('Pullup',scheme)]),
      day('Front Squat + RDL',[ex('Front Squat',scheme),ex('Romanian Deadlift',scheme)]),
    ]
  }
}

const buildMuscle=repeatProgram({
  id:'build-muscle',name:'Build Muscle',category:'Bodybuilding',difficulty:'Intermediate',source:'Build Muscle.xlsx',
  description:'Five-day body-part hypertrophy split from the archive workbook.'
},[
  day('Day 1 - Back',[ex('Machine Row','4x10-15'),ex('Cable Pullover','4x10-15'),ex('Machine High Row','3x10-12'),ex('Machine Low Row','3x10-12')]),
  day('Day 2 - Chest + Abs',[ex('Butterfly','3x10-15'),ex('Machine Incline Chest Press','3x10-12'),ex('Machine Chest Press','3x10-12'),ex('Abs','Source accessory work')]),
  day('Day 3 - Quads + Shoulders',[ex('Leg Extension','4x10-15'),ex('45-Degree Leg Press','4x10-15'),ex('Squat','3x10-15'),ex('Shoulder work','Source hypertrophy sets')]),
  day('Day 4 - Hamstrings + Calves + Abs',[ex('Lying Leg Curl','4x10-15'),ex('Stiff-Leg DB Deadlift','3x10-15'),ex('Smith Machine Deadlift','3x10-15'),ex('Calves + Abs','Source accessory work')]),
  day('Day 5 - Arms + Shoulders',[ex('Standing EZ-Bar Curl','4x10-15'),ex('Preacher Curl','3x10-15'),ex('Overhead DB Press','3x10-15'),ex('Arm/shoulder accessories','Source hypertrophy sets')]),
],1)

const criticalMass=repeatProgram({
  id:'critical-mass',name:'Critical Mass',category:'Minimalist',difficulty:'Beginner',source:'Critical (M)Ass.xlsx',
  description:'Two-workout minimalist alternating routine from the archive tracking sheet.'
},[
  day('Workout A',[ex('Glute Bridge','20 reps'),ex('DB Front Squat to Press','Goal 10 reps'),ex('1-Arm 1-Leg DB Row','Goal 10 reps'),ex('Walking Lunge','10 reps'),ex('Wide-Grip Pushup','10 reps'),ex('2-Arm Kettlebell Swing','20-25 reps')]),
  day('Workout B',[ex('1-Leg Romanian Deadlift','Goal 10 reps'),ex('Chinup','10 reps'),ex('1-Leg Hamstring Curl','6-12 reps'),ex('Plank','30 sec'),ex('Reverse Hyper','15-25 reps')]),
],1)

const beginnerDays=[
  ['Squat / Ring Row / Pushup','200m run; 15-12-9 squat, pushup, ring row; 200m run'],
  ['Deadlift / Standing Press / Push Press','10! wallball deadlift, push press, squat'],
  ['Rower / Kettlebell Swing','Row 200m + 10 KB swings; 3 intervals each'],
  ['Jumping Pullup / Walking Lunge / Kipping','3 rounds: 200m run, 10 lunges each leg, 10 jumping pullups or ring rows'],
  ['K2E/T2B / Thruster','3 rounds: 300m row, 5 K2E, 10 thrusters'],
  ['Front Rack / Landmine Squat / Wall Ball','5 rounds: 7 wall ball, 7 pushups, 7 pullups/ring rows'],
  ['Review Days 1-6','400m run, 15 lunges each leg, 15 jumping pullups, 15 thrusters, 15 K2E, 400m row'],
  ['Burgener Warmup / Cleans / Abmat','10! descending ladder hang cleans + situps'],
  ['KB Snatch to Barbell Snatch','3 rounds: 400m run, 5 hang snatch, 5 pushups, 5 K2E'],
  ['Front Squat / OHS / Jerk','3 quality rounds: 5 hang cleans, 5 jerks, 5 snatch, 5 OHS, 200m run'],
  ['Burpee / Box Jump / Jump Rope','50 singles buy-in; 15-10-5 burpees + box jumps; 50 singles buy-out'],
  ["Athlete's Choice / Back Squat / Rope Climb",'Repeat Day 1 WOD: 200m run; 15-12-9 squat, pushup, row; 200m run'],
]
const beginners={
  id:'beginners-jan-2016',name:'Beginners Program - Jan 2016',category:'General',difficulty:'Beginner',weeksCount:3,daysPerWeek:4,
  source:'BEGINNERS PROGRAM JAN2016.docx + BEGINNERS PROGRAM.xlsx',description:'Twelve-session beginner skill-and-WOD progression.',transcriptionStatus:'full',
  getWeek:w=>beginnerDays.slice((Math.max(1,Math.min(3,w))-1)*4,Math.max(1,Math.min(3,w))*4).map((x,i)=>day(`Session ${(Math.max(1,Math.min(3,w))-1)*4+i+1} · ${x[0]}`,[ex('Skill / WOD',x[1])]))
}

const powerbuild={
  id:'powerbuild',name:'Powerbuild',category:'Powerbuilding',difficulty:'Intermediate',weeksCount:4,daysPerWeek:5,
  source:'Powerbuild.xlsx',description:'Four-week five-day powerbuilding block; Month 2/3 sheets in the archive are blank, so only the populated Month 1 is treated as runnable.',transcriptionStatus:'full',
  getWeek:w=>{
    const wk=Math.max(1,Math.min(4,Number(w)||1))
    const main={
      squat:[[5,5,175],[5,4,185],[5,3,200],[5,2,215]][wk-1],
      bench:[[5,5,155],[5,4,170],[5,3,180],[5,2,190]][wk-1],
      press:[[5,5,105],[5,4,115],[5,3,125],[5,2,135]][wk-1],
      dead:[[5,5,220],[5,4,235],[5,3,250],[5,2,265]][wk-1],
    }
    const slow=wk%2===1?'4x10 slow':'2x10 explosive'
    return [
      day('Monday',[ex('Squat',`${main.squat[0]}x${main.squat[1]} @ ${main.squat[2]} lb`),ex('Shoulder Press',slow),ex('Pause Squat','3x10'),ex('DB Step Up',wk<3?'4x8':'4x10'),ex('Plank','4 sets')]),
      day('Tuesday',[ex('Bench Press',`${main.bench[0]}x${main.bench[1]} @ ${main.bench[2]} lb`),ex('Deadlift',slow),ex('DB Incline Bench','3x10'),ex('Pullup',wk<3?'4xAMAP':'5xAMAP'),ex('Pushup',wk<3?'4x20':'5x20')]),
      day('Wednesday',[ex('Inverted Row','3x10'),ex('Pushup','3x10 slow'),ex('Front Squat','3x10'),ex('Dip','3xAMAP'),ex('Lat Pulldown','3x10'),ex('DB Lunge','3x10'),ex('Burpee','3x15'),ex('Farmer Carry','3x25 yd'),ex('Plank','3x30 sec')]),
      day('Thursday',[ex('BB Shoulder Press',`${main.press[0]}x${main.press[1]} @ ${main.press[2]} lb`),ex('Bench Press',slow),ex('DB Shoulder Press','3x10'),ex('Cable Triceps Pushdown','4x10'),ex('Cable Biceps Curl','4x10')]),
      day('Friday',[ex('Deadlift',`${main.dead[0]}x${main.dead[1]} @ ${main.dead[2]} lb`),ex('Squat',slow),ex('Deficit Deadlift','2x10'),ex('Pullup',wk<3?'4xAMAP':'5xAMAP'),ex('Bodyweight Jump Squat',wk<3?'4x10':'5x10'),ex('Plank','3x30 sec')]),
    ]
  }
}

const pause797={
  id:'pause-squat-deadlift',name:'Pause Squat / Deadlift Cycle',category:'Specialization',difficulty:'Intermediate',weeksCount:12,daysPerWeek:4,
  source:'797M_Pause Squat_DL Cycle 2016.xlsx',description:'12-week combined bench, deadlift, and pause-squat calendar from the 797M archive sheet.',transcriptionStatus:'full',
  getWeek:w=>{
    const wk=Math.max(1,Math.min(12,Number(w)||1))
    const dead=['5x5 @ 75%','5x3 @ 80%','5x1 @ 85%','Accessory / no primary deadlift','4x5 @ 80%','4x3 @ 85%','4x1 @ 90%','Accessory / no primary deadlift','3x5 @ 85%','3x3 @ 90%','3x1 @ 95%','Accessory / no primary deadlift'][wk-1]
    const pause=['5-count: 45/55/65% x8','50/60/70% x5','Work to 5RM','Off','3-count: 55/65/75% x5','60/70/80% x3','Work to 3RM','Off','2-count: 65/75/85% x3','70/80/90% x2','Work to 1RM','Off'][wk-1]
    return [
      day('Bench A',[ex('Bench Press','Ramp 3x2, then 3x3 @ RPE 7')]),
      day('Deadlift',[ex('Deadlift',dead)]),
      day('Bench B',[ex('Bench Press',wk%2===0?'New 1RM / test-focused slot':'Ramp 4x2, then 2x2 @ RPE 9')]),
      day('Pause Squat',[ex('Pause Squat',pause)]),
    ]
  }
}

const adab={
  id:'adab-cycle-1',name:'ADAB Cycle 1',category:'Strength',difficulty:'Intermediate',weeksCount:12,daysPerWeek:5,
  source:'ADAB Cycle 1.xlsx',description:'Combined Lilly deadlift, OSBC bench, and Rippetoe squat work from the archive workbook.',transcriptionStatus:'full',
  getWeek:w=>{
    const wk=Math.max(1,Math.min(12,Number(w)||1))
    const dl=['8x3 speed','5x5 rep','5x1 heavy','8x3 speed','6x4 rep','5x1 heavy','6x1 speed','4x3 rep','3x1 heavy','1x2 + 2x1','Rest / accessories only','New 1RM'][wk-1]
    const benchTop=[85,75,95,85,75,95,85,75,95,85,75,95][wk-1]
    const squat5=[70,73,75,77,79,81,83,85,87,88,null,null][wk-1]
    const out=[
      day('Bench',[ex('Bench Press',`Ramp 60%x5, 70%x5, 80%x3, 90%x1, 100%x1 of training max; then 3x5 @ ${benchTop}% TM`)]),
      day('Deadlift',[ex('Deadlift',dl)],'Use the Lilly deadlift assistance list in the source: deficit pulls, RDL, face pulls, shrugs, rows, ham curls, pulldowns/rear delts/power cleans as appropriate.'),
    ]
    if(wk<=10){
      out.push(day('Back Squat Volume',[ex('Back Squat',`5x5 @ ~${squat5}% of original 1RM progression`)]))
      out.push(day('Front Squat',[ex('Front Squat','6x2-3 · progressive archive load')]))
      out.push(day('Back Squat Singles',[ex('Back Squat','6x1 · progressive heavy-single practice')]))
    }else{
      out.push(day('Squat Recovery / Test Prep',[ex('Squat','No additional Rippetoe squat rows were populated in the source sheet for this week.')]))
    }
    return out
  }
}

const rowingWeeks=[
  [
    ['Monday','4x15 min · SR 18-20-18 / 5 min · 3 min rest between sets'],
    ['Tuesday','10 min WU/CD · 3x2K (SR 22-24/1K) · 4 min rest · negative split'],
    ['Wednesday','10 min WU/CD · 2x3K, first SR24, second SR26 · 6 min rest'],
    ['Thursday','4x15 min · SR 18-20-18 / 5 min · 3 min rest OR 60 min cross-training'],
    ['Friday','15 min WU/CD · 6x10-stroke max-pressure blasters · 2 min paddle'],
    ['Saturday','15 min WU/CD · 5x500m AFAP @ SR 28,30,32,34,32 · 3 min rest'],
  ],
  [
    ['Monday','4x15 min · SR 18-20-18 / 5 min · 3 min rest'],
    ['Tuesday','10 min WU/CD · 3K@22, 2K@24, 1K@26 · 4 min rest'],
    ['Wednesday','10 min WU / 15 min CD · 1x5K AFAP · SR26'],
    ['Thursday','4x15 min or 60 min cross-training'],
    ['Friday','15 min WU/CD · 6x10-stroke max-pressure blasters'],
    ['Saturday','15 min WU/CD · 5x500m AFAP @ SR 28,30,32,34,34'],
  ],
  [
    ['Monday','3x20 min · SR20 · 3 min rest'],
    ['Tuesday','10 min WU/CD · 3x2K (SR22-24/1K) · 4 min rest'],
    ['Wednesday','10 min WU/CD · 2x3K, first SR24, second SR26 · 6 min rest'],
    ['Thursday','3x20 min SR20 or 60 min cross-training'],
    ['Friday','15 min WU/CD · 7x10-stroke blasters'],
    ['Saturday','15 min WU/CD · 6x500m AFAP @ SR 28,30,32,34,34,32'],
  ],
  [
    ['Monday','3x20 min · SR19-21 / 5 min · 3 min rest'],
    ['Tuesday','10 min WU/CD · 3K@22, 2K@24, 1K@26 · 4 min rest'],
    ['Wednesday','10 min WU / 15 min CD · 1x5K AFAP · SR26'],
    ['Thursday','3x20 min SR20 or 60 min cross-training'],
    ['Friday','15 min WU/CD · 4x250m @ 2K race pace · 2 min rest · SR32-34'],
    ['Saturday','15 min WU / 20 min CD · 2K TEST AFAP · suggested SR30'],
  ],
]
const rowing={
  id:'rowing-program',name:'Rowing Program',category:'Conditioning',difficulty:'Intermediate',weeksCount:4,daysPerWeek:6,
  source:'Rowing program.pdf',description:'Four-week Concept2 rowing progression ending in a 2K test.',transcriptionStatus:'full',
  getWeek:w=>rowingWeeks[Math.max(1,Math.min(4,w))-1].map(([name,rx])=>day(name,[ex('Concept2 Row',rx)]))
}

const edcDays=[
  day('Day 1 - Deadlift + Heavy Carry',[ex('Farmer Carry EMOM','10 min: 3 farmer deadlifts + 50 ft carry @ 75% carry 1RM'),ex('Strength Giant Set','4 rounds: 3 sandbag over shoulder, 6 conventional/paused deadlifts 70-80%+, 30s RKC plank, 90s rest'),ex('Deadlift Ladder','EMOM: 2,4,6,8... reps @ 60% until failure'),ex('Optional Conditioning','10-15 min EMOM: 5 burpees, 5 squats, 5 pushups, 15 mountain climbers, 15 jumping jacks')]),
  day('Day 2 - Press + Waiter Carry',[ex('Strength Giant Set','3 rounds: chinups/inverted rows, 8 strict/Z press 60-70%+, 8 plate halos each side, 90s rest'),ex('Waiter Walk Complex','3 rounds @ 50% press: 10/8/6 strict press with 6-step waiter walk after each block; 90s between rounds'),ex('Optional Conditioning','10-min escalating pullup/pushup/squat ladder')]),
  day('Day 3 - Squat + Sandbag Carry',[ex('Sandbag EMOM','10 min: 4 sandbag burpee ground-to-overhead + 50 ft bear-hug carry'),ex('Strength Giant Set','5 rounds: 3 box jumps, 5 squats/box squats 75-85%+, 20 situps, 90s rest'),ex('Assistance Giant Set','4 rounds: 1.5 front/Zercher squats @ 50%, sandbag squats, 45s wall sit; 2 min rest'),ex('Optional Conditioning','4 rounds: 20 squats, 20 lunges, 20 jumping lunges, 20 jumping squats')]),
  day('Day 4 - Bench + Loading',[ex('Sandbag Load EMOM','3 heavy sandbag loads each minute'),ex('Strength Giant Set','4 rounds: 8 one-arm rows/side, 6 bench or close-grip bench 70-80%+, 12 leg raises, 90s rest'),ex('Assistance Giant Set','4 rounds: 12 DB squeeze press, 12 pullovers, 30s max deficit pushups, 90s rest'),ex('Optional Conditioning','Every 30s for 10-15 min: 3 pullups, 7 pushups, 12 squats')]),
  day('Day 5 - Deadlift + Farmer Carry',[ex('Farmer Carry EMOM','10 min: optional 3 burpees + 100 ft farmer walk @70%'),ex('Strength Giant Set','3 rounds: 4 burpee broad jumps, 8 deadlifts 60-70%+, 12 V-ups, 90s rest'),ex('Assistance AMRAP','10 min: 5 heavy RDL, 20s max one-arm row left, 20s rest, 20s max row right'),ex('Optional Conditioning','Running-clock escalating pullup/burpee/pushup/squat ladder')]),
  day('Day 6 - Press + Mixed Carries',[ex('Strength Giant Set','5 rounds: pullups, 5 strict presses 75-85%+, 6 toes-to-bar, 90s rest'),ex('Press Assistance','12/10/8 pullups + pin presses with 24 pushups each block'),ex('Carry AMRAP','10 min alternating 100 ft waiter walk and farmer walk each side'),ex('Optional Conditioning','2:00/1:30/1:00 pushup max paired with same-duration plank holds')]),
  day('Day 7 - Heavy Sandbag Carry',[ex('Weighted Carry','10-min EMOM from source: heavy sandbag squat/carry emphasis'),ex('Strength Work','Follow the Day 7 giant-set prescription from EVERY.DAY.CARRY.First 8 Workouts.pdf')]),
  day('Day 8 - Final Intro Session',[ex('EVERY.DAY.CARRY Session','Complete the Day 8 source prescription from the First 8 Workouts document')]),
]
const everyDayCarry={
  id:'every-day-carry',name:'Every.Day.Carry - First 8 Workouts',category:'Strength + Conditioning',difficulty:'Intermediate',weeksCount:4,daysPerWeek:2,
  source:'EVERY.DAY.CARRY.First 8 Workouts.pdf + EVERY.DAY.CARRY.pdf',description:'The eight explicit starter workouts supplied with the Every.Day.Carry program.',transcriptionStatus:'full',
  getWeek:w=>edcDays.slice((Math.max(1,Math.min(4,w))-1)*2,Math.max(1,Math.min(4,w))*2)
}

const spdb=[
  [
    day('Session 1',[ex('Rear-Foot Elevated Split Squat','4 sets of 6-8 left + 6-8 right · slow continuous movement'),ex('Alternating Floor Press','4 sets of 16 total · 1 min rest'),ex('Burpee Squat Jump','5-min finisher · sets of 5 · 10-20s rest')]),
    day('Session 2',[ex('Sumo Two-Head-Touch DB Deadlift','5x7 · each set at least 1 min · 1 min rest'),ex('Bent-Over Row','5 sets: 7 left + 7 right with 3-sec hold'),ex('Double DB Snatch','5-min finisher · sets of 5 · 20-30s rest')])
  ],
  [
    day('Session 3',[ex('DB Squat','5x7 · slow 3-1-3-1 tempo'),ex('Slow DB Shoulder Press','5x7 with 3-sec pause at 90°'),ex('EMOM','10 min: odd wall sit, even plank')]),
    day('Session 4',[ex('Supported Single-Leg RDL','Every 3 min x4: 6 left + 6 right'),ex('DB Deadlift + Bent-Over Row','Every 3 min x4: 6 slow deadlifts + 12 alternating rows')])
  ],
  [
    day('Session 5',[ex('DB Squat EMOM','10 min: min1 6 DB squats; min2 rest'),ex('Cossack Squat','5 sets: 6 left + 6 right'),ex('Finisher','5-min AMRAP, max 5 rounds: 12 jumping lunges + 8 pushups')]),
    day('Session 6',[ex('Press/Squat Circuit','4 rounds: 6L/6R half-hold press, 15 slow goblet squat, 8 floor-seated shoulder press, 15 slow goblet squat, 12 alternating top-to-top press · 2 min rest')])
  ],
  [
    day('Session 7',[ex('RDL / Love Tap Circuit','4 rounds: 8 DB RDL, 12 single-leg love taps, 8 deficit sumo DB deadlift, 12 love taps · 1-2 min rest'),ex('Finisher','1 min on / 1 min off x3: max rounds 1 burpee + 3 air squats')]),
    day('Session 8',[ex('Squat + Floor Press','Every 3 min x4: 6-8 DB squat + 14-16 alternating single-arm floor press'),ex('Split Squat + Press','Every 3 min x4: 6 left + 6 right split squat with alternating press')])
  ],
  [
    day('Session 9',[ex('RFESS + Wall Sit','Every 5 min x4: 6-8 RFESS each leg + 60s wall sit with DB'),ex('Seated Arnold Press','Every 2 min x5: 6-8 reps'),ex('Tabata','8 rounds: 20s work / 10s rest alternating-leg supine toe touches')]),
    day('Session 10',[ex('DB Deadlift + Front Raise Press','7 rounds: 6-8 DB deadlifts + 6-8 single-DB bent-arm front raise + press · rest as needed; finish no faster than 24 min')])
  ],
  [
    day('Session 11',[ex('Squat + Lunge Complex','4 rounds: 4 complex reps'),ex('Slow Pushup + Pull Across','4 rounds x6')]),
    day('Session 12',[ex('Staggered-Stance Deadlift','4 sets: 8 left + 8 right · 1-2 min rest'),ex('DB Squat + Single-Arm Press','4 sets: 8 left + 8 right'),ex('Alternating Bent-Over Row','3x20')])
  ],
]
const streetParking={
  id:'street-parking-db',name:'Street Parking Dumbbell Strength',category:'Strength + Conditioning',difficulty:'Intermediate',weeksCount:6,daysPerWeek:2,
  source:'SP DB Strength Program.pdf',description:'Six-week, twelve-session dumbbell strength progression.',transcriptionStatus:'full',
  getWeek:w=>spdb[Math.max(1,Math.min(6,w))-1]
}

export const manualTranscribedPrograms=[
  sixtyDaysProgram,juggernaut,lifestyle,occam,ndp531,nineByFive,nineByFiveAlias,primer4,buildMuscle,criticalMass,beginners,powerbuild,pause797,adab,rowing,everyDayCarry,streetParking
]
