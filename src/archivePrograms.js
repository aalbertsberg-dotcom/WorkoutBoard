import {verifiedSourcePrograms} from './programSources/sourcePrograms'

const ex = (name, prescription, note='') => ({name,prescription,note})
const day = (title, exercises, note='') => ({title,exercises,note})

const squatoberWeeks = {
  1:[
    day('Squatober - Day 1',[
      ex('Squat','5x8 @ 67.5%','Rest 3 min'),
      ex('Bench Press','4x10 @ 62.5%','Superset with slow strict pullups'),
      ex('Slow Strict Pullup','4x3 @ bodyweight'),
      ex('Deadlift','4x5 @ 70%','Superset with chest-supported DB rows'),
      ex('Chest-Supported DB Row','4x15','Record weight used'),
    ]),
    day('Squatober - Day 4',[
      ex('Squat','5x5 @ 73%','Rest 2.5 min'),
      ex('Bench Press','5x5 @ 73%','Rest 2.5 min'),
      ex('Barbell Press','5x5','Record weight used'),
      ex('Close-Grip Bench','5x5','Start around 50% of bench 1RM'),
    ]),
  ],
  2:[
    day('Squatober - Day 5',[
      ex('Squat','6@60%, 5@65%, 4@70%, 3@75%, 2@80%','Rest 2.5 min'),
      ex('Deadlift','4x4 @ 75%','Rest 2.5 min'),
      ex('DB Romanian Deadlift','3x10','Record weight used'),
      ex('Strict Pullup','3x4','Add weight if appropriate'),
    ]),
    day('Squatober - Day 6',[
      ex('Squat','5@60%, 5@70%, 6/7/8/9 reps @ 75%','Rest 3.5 min'),
      ex('Bench Press','5@60%, 5@70%, 6/7/8/9 reps @ 75%','Rest 3.5 min'),
    ]),
  ],
  3:[
    day('Squatober - Day 7',[
      ex('Squat','4@60%, 4@70%, 2x2 @ 73%','Rest 2 min'),
      ex('Strict Pullup','4x4 @ bodyweight'),
      ex('Trap Bar Deadlift','4x4 @ 60% of deadlift 1RM'),
      ex('Chest-Supported DB Row','4x15','Record weight used'),
      ex('Barbell Curl','4x15','Record weight used'),
    ]),
    day('Squatober - Day 8',[
      ex('Tempo Squat','3x3 @ 65%, then 3x2 @ 68%','5-second negative; rest 3 min'),
      ex('Bench Press','5x8 @ 70%','Rest 3 min'),
      ex('DB Front Raise','3x10','Light and controlled'),
      ex('DB Lateral Raise','3x10','Light and controlled'),
      ex('DB Curl to Press','3x10','Light and controlled'),
    ]),
  ],
}

const phatDays = [
  day('Upper Body Power',[
    ex('Bent-Over or Pendlay Row','3x3-5'),ex('Weighted Pullup','2x6-10'),ex('Rack Chin','2x6-10'),
    ex('Flat DB Press','3x3-5'),ex('Weighted Dip','2x6-10'),ex('Seated DB Shoulder Press','3x6-10'),
    ex('Cambered Bar Curl','3x6-10'),ex('Skull Crusher','3x6-10')]),
  day('Lower Body Power',[
    ex('Squat','3x3-5'),ex('Hack Squat','2x6-10'),ex('Leg Extension','2x6-10'),
    ex('Stiff-Leg Deadlift','3x5-8'),ex('Glute-Ham Raise / Lying Leg Curl','2x6-10'),
    ex('Standing Calf Raise','3x6-10'),ex('Seated Calf Raise','2x6-10')]),
  day('Back + Shoulders Hypertrophy',[
    ex('Bent-Over or Pendlay Row','4x8-10 @ ~85% of normal 3-5RM'),ex('Rack Chin','3x8-12'),
    ex('Seated Cable Row','3x8-12'),ex('Incline-Supported DB Row / Shrug','2x12-15'),
    ex('Close-Grip Pulldown','2x15-20'),ex('Seated DB Press','3x8-12'),ex('Upright Row','2x12-15'),ex('Lateral Raise','3x12-20')]),
  day('Lower Body Hypertrophy',[
    ex('Squat','4x8-10 @ ~85% of normal 3-5RM'),ex('Hack Squat','3x8-12'),ex('Leg Press','2x12-15'),
    ex('Leg Extension','3x15-20'),ex('Romanian Deadlift','3x8-12'),ex('Lying Leg Curl','2x12-15'),
    ex('Seated Leg Curl','2x15-20'),ex('Donkey Calf Raise','4x10-15'),ex('Seated Calf Raise','3x15-20')]),
  day('Chest + Arms Hypertrophy',[
    ex('Flat DB Press','4x8-10 @ ~85% of normal 3-5RM'),ex('Incline DB Press','3x8-12'),
    ex('Machine Chest Press','3x12-15'),ex('Incline Cable Fly','2x15-20'),ex('Preacher Curl','3x8-12'),
    ex('Concentration Curl','2x12-15'),ex('Spider Curl','2x15-20'),ex('Seated Triceps Extension','3x8-12'),
    ex('Rope Pressdown','2x12-15'),ex('Cable Kickback','2x15-20')]),
]

const wild20Days = [
  day('Chest + Triceps',[
    ex('Bench Press','7 sets - Wild 20 method'),ex('DB Incline Bench','3x8-12'),ex('Machine Chest Press','3x8-12'),
    ex('Pec Deck / Cable Crossover','3x10-15'),ex('Lying Triceps Extension','3-4x8-12'),ex('Rope Triceps Extension','3-4x10-15')]),
  day('Back + Biceps',[
    ex('Barbell Row or Deadlift','7 sets - Wild 20 method'),ex('Pullup / Inverted Row','3 sets AMAP'),
    ex('Machine Row','3x8-12'),ex('T-Bar / Seated Cable Row','3x8-12'),ex('DB Curl','3-4x8-12'),ex('Rope Cable Curl','3-4x10-15')]),
  day('Shoulders + Traps',[
    ex('Military Press','7 sets - Wild 20 method'),ex('Seated Arnold Press','3x8-12'),ex('Lateral Raise','3x10-15'),
    ex('Bent-Over Reverse Fly','3x10-15'),ex('Power Shrug','3-4x8-12'),ex('Machine Shrug','3-4x8-12')]),
  day('Quads + Hamstrings + Calves',[
    ex('Squat','7 sets - Wild 20 method'),ex('Hack Squat','3x8-12'),ex('Leg Extension','3x10-15'),
    ex('DB Stiff-Leg Deadlift','3x8-12'),ex('Leg Curl','3x10-15'),ex('Seated Calf Raise','3-4x10-15')]),
]

const startingStrengthDays = [
  day('Workout A',[
    ex('Squat','3x5','Add weight each session'),ex('Bench Press','3x5','Add weight each A session'),ex('Deadlift','1x5','Add weight each A session')]),
  day('Workout B',[
    ex('Squat','3x5','Add weight each session'),ex('Press','3x5','Add weight each B session'),ex('Power Clean','5x3','Add weight each B session')]),
]

const beach531 = {
  1:[
    day('Monday - Squat / Clean / Press',[ex('Squat','70/80/90% x5'),ex('Hang Clean','2 sets @ 70% - max reps short of failure'),ex('Shoulder Press','Ramp 10-100%; top set max reps'),ex('Strict Pullups','50 total reps')]),
    day('Wednesday - Squat / Deadlift',[ex('Squat','Ramp 10-100%; top set max reps'),ex('Deadlift','70/80/90% x5'),ex('Shoulder Press','70% x 50 total reps'),ex('Barbell Row','100 total reps')]),
    day('Friday - Clean / Squat / Press',[ex('Hang Clean','Ramp 10-100%; top set max reps; then 85% 3x5'),ex('Squat','70% x max reps (15+ target)'),ex('Shoulder Press','70/80/90% x5'),ex('Strict Pullups','50 total reps')]),
  ],
  2:[
    day('Monday - Squat / Clean / Press',[ex('Squat','65/75/85% x5'),ex('Hang Clean','2 sets @ 65% - max reps short of failure'),ex('Shoulder Press','Ramp 10-100%; top set max reps'),ex('Strict Pullups','50 total reps')]),
    day('Wednesday - Squat / Deadlift',[ex('Squat','Ramp 10-100%; top set max reps'),ex('Deadlift','65/75/85% x5'),ex('Shoulder Press','65% x 50 total reps'),ex('Barbell Row','100 total reps')]),
    day('Friday - Clean / Squat / Press',[ex('Hang Clean','Ramp 10-100%; top set max reps; then 85% 3x5'),ex('Squat','65% x max reps (15+ target)'),ex('Shoulder Press','65/75/85% x5'),ex('Strict Pullups','50 total reps')]),
  ],
  3:[
    day('Monday - Squat / Clean / Press',[ex('Squat','75/85/95% x5'),ex('Hang Clean','2 sets @ 75% - max reps short of failure'),ex('Shoulder Press','Ramp 10-100%; top set max reps'),ex('Strict Pullups','50 total reps')]),
    day('Wednesday - Squat / Deadlift',[ex('Squat','Ramp 10-100%; top set max reps'),ex('Deadlift','75/85/95% x5'),ex('Shoulder Press','75% x 50 total reps'),ex('Barbell Row','100 total reps')]),
    day('Friday - Clean / Squat / Press',[ex('Hang Clean','Ramp 10-100%; top set max reps; then 85% 3x5'),ex('Squat','75% x max reps (15+ target)'),ex('Shoulder Press','75/85/95% x5'),ex('Strict Pullups','50 total reps')]),
  ],
}

const monolithPct = [[70,80,90],[65,75,85],[75,85,95],[70,80,90],[65,75,85],[75,85,95]]
const monolithFriday = [45,55,55,50,65,70]
const monolithPressVolume = ['10x5 @ 70%','10x5 @ 50%','10x5 @ 75%','12x5 @ 60%','15x5 @ 65%','12x5 @ 75%']
const monolithDays = week => {
  const [a,b,c] = monolithPct[Math.max(1,Math.min(6,week))-1]
  const w=Math.max(1,Math.min(6,week))
  return [
    day('Monday - Squat + Press',[ex('Squat',`${a}%x5, ${b}%x5, ${c}%x5, then ${c}% 4x5`),ex('Press',`${a}%x5, ${b}%x5, ${c}%x5, then ${a}% AMRAP`),ex('Pullups','50 total reps')]),
    day('Wednesday - Deadlift + Bench',[ex('Deadlift',`${a}%x5, ${b}%x5, ${c}%x5, then ${c}% 2x5`),ex('Bench Press',`${a}%x5, ${b}%x5, ${c}%x5, then ${c}% 4x5`),ex('Barbell Row','5 sets of 10-20 reps')]),
    day('Friday - Squat + Press',[ex('Squat',`${a}%x5, ${b}%x5, ${c}%x5, then ${monolithFriday[w-1]}% x20`),ex('Press',monolithPressVolume[w-1]),ex('Weighted Pullups','5x5')],`Week ${w}: add KB/Prowler conditioning from the source plan as recovery allows.`),
  ]
}

const cowboy = {
  1:['10x5 @ 60%','55/60/65/70/75% x5','Work to 10RM'],
  2:['10x4 @ 67.5%','60/65/70/75/80% x3','Work to 8RM'],
  3:['10x3 @ 75%','65x5,70x4,75x3,80x2,85%x1+','Work to 5RM'],
  4:['5x3 @ 60%','3x3 @ 60%','Walkout/hold 95% goal max x10 sec'],
  5:['8x5 @ 65%','60/67.5/75/82.5% x4','Work to 8RM'],
  6:['8x4 @ 72.5%','65/72.5%x3,80/87.5%x2','Work to 5RM'],
  7:['8x3 @ 80%','70x4,77.5x3,85x2,92.5%x1+','Work to 3RM'],
  8:['5x3 @ 65%','3x3 @ 65%','Walkout/hold 100% goal max x10 sec'],
  9:['5x5 @ 70%','65/75/85% x3','Work to 5RM'],
  10:['5x4 @ 77.5%','70/80/90% x2','Work to 3RM'],
  11:['5x3 @ 85%','75x3,85x2,95%x1+','Work to 2RM'],
  12:['5x3 @ 70%','3x3 @ 70%','Walkout/hold 105% goal max x10 sec'],
  13:['Front squat - work to 1RM','Off','Back squat - work to 1RM'],
}
const cowboyDays = week => {
  const p=cowboy[Math.max(1,Math.min(13,week))]
  return [day('Monday - Back Squat',[ex('Back Squat',p[0])]),day('Wednesday - Front Squat',[ex('Front Squat',p[1])]),day('Friday - Back Squat',[ex('Back Squat',p[2])])]
}

const deadlift8 = {
  1:[ex('Deadlift','1x3 @ 75%'),ex('Speed Deadlift','6x3 @ 60%','60 sec rest'),ex('Trap Bar Deadlift','2x6 @ 65%'),ex('Neutral-Grip Pullup','3x5'),ex('Pull Through','3x12'),ex('Glute-Ham Raise','3x8'),ex('Suitcase Deadlift','3x3')],
  2:[ex('Deadlift','1x3 @ 80%'),ex('Speed Deadlift','8x3 @ 60%'),ex('Trap Bar Deadlift','2x5 @ 68%'),ex('Neutral-Grip Pullup','3x6'),ex('Pull Through','3x12'),ex('Glute-Ham Raise','3x7'),ex('Suitcase Deadlift','3x3')],
  3:[ex('Deadlift','1x3 @ 85%'),ex('Deadlift','6x3 @ 70%'),ex('Trap Bar Deadlift','3x3 @ 75%'),ex('Neutral-Grip Pullup','3x6'),ex('Pull Through','3x12'),ex('Glute-Ham Raise','3x6'),ex('Suitcase Deadlift','3x3')],
  4:[ex('Deadlift','6x1 @ 60%','Reload'),ex('Trap Bar Deadlift','2x2 @ 50%'),ex('Neutral-Grip Pullup','2x5'),ex('Pull Through','2x12'),ex('Glute-Ham Raise','2x6'),ex('Suitcase Deadlift','2x3')],
  5:[ex('Deadlift','1x2 @ 90%'),ex('Deadlift','4x2 @ 75%'),ex('Trap Bar Deadlift','3x3 @ 78%'),ex('Neutral-Grip Pullup','2x7'),ex('Pull Through','3x12'),ex('Glute-Ham Raise','3x5'),ex('Suitcase Deadlift','3x2')],
  6:[ex('Deadlift','1x1 @ 95%'),ex('Deadlift','3x2 @ 80%'),ex('Trap Bar Deadlift','3x3 @ 80%'),ex('Neutral-Grip Pullup','2x7'),ex('Pull Through','3x12'),ex('Glute-Ham Raise','3x5'),ex('Suitcase Deadlift','3x2')],
  7:[ex('Repeat Week 4','Reload exactly as Week 4')],
  8:[ex('Deadlift','Attempt new 1RM','Source plan test week')],
}

const crossfit8 = {
  1:[
    day('Press / Overhead',[ex('Push Press','7x5 heavy'),ex('Paused Incline Bench','4x8 moderate'),ex('Wide-Grip Pullup','4x12')]),
    day('Squat / Pull',[ex('Front Squat','7x5 heavy'),ex('Snatch-Grip Deadlift off Blocks','4x8 moderately heavy'),ex('GHD Situp','4x12')]),
    day('Barbell-Free Metcon',[ex('Metcon','20 minutes or less; no barbell')]),
    day('Olympic / Upper Back / Arms',[ex('Muscle Snatch','7x3 heavy'),ex('Hang Clean','5x3 moderately heavy'),ex('Axle Curl','10 minutes AMRAP')]),
    day('Short Metcon + Medley',[ex('Short Metcon','10 minutes or less'),ex('Car Push + Sprint','3 rounds: 100m + 100m','Rest 5 min')]),
  ],
  2:[
    day('Press / Overhead',[ex('Strict Press','6x3 heavy'),ex('Behind-Neck Push Press','4x8 moderate'),ex('DB Chest Fly','4x15'),ex('Pushups','75 total')]),
    day('Squat / Pull',[ex('Pause Deadlift','6x3 heavy'),ex('Back-Rack Walking Lunge','4x8 total'),ex('Toes-to-Bar','3x10 strict')]),
    day('Barbell-Free Metcon',[ex('Metcon','Barbell-free')]),
    day('Olympic / Upper Back / Arms',[ex('Power Clean + Split Jerk','6 sets: 1 clean + 3 jerks'),ex('Snatch High Pull','4x10 moderate'),ex('Rack Pull below knee','4x12 @ 80% deadlift max')]),
    day('Short Metcon + Medley',[ex('Short Metcon','Barbell-free'),ex('Zercher Carry + Sled Pull','4 heavy sets','100ft + 100ft; rest 5 min')]),
  ],
  3:[
    day('Press / Overhead',[ex('Push Jerk','7x2 heavy','1-sec pause in dip'),ex('Close-Grip Bench','4x8 heavy'),ex('Band Triceps Pushdown','100 total'),ex('Weighted Pushup','50 total')]),
    day('Squat / Pull',[ex('Back Squat','7x2 heavy'),ex('Clean-Grip Deadlift','4x4 heavy'),ex('Snatch-Grip RDL','4x8 moderate'),ex('Abmat Situp','2x50')]),
    day('Barbell-Free Metcon',[ex('Metcon','Barbell-free')]),
    day('Olympic / Upper Back / Arms',[ex('Power Snatch + Snatch Push Press + Snatch Balance','7 heavy sets'),ex('Power Clean + Front Squat + Push Press + 2 Jerks','7 sets'),ex('Barbell Curl','4x12 moderate')]),
    day('Short Metcon + Medley',[ex('Short Metcon','Barbell-free'),ex('Clean & Jerk','3 sets max reps in 60 sec','No touch-and-go'),ex('Sprint','4x100m')]),
  ],
  4:[
    day('Recovery Press',[ex('Strict Press','3x5 moderate'),ex('Bench Press','3x5 moderate'),ex('Pushups','50'),ex('Situps','100')]),
    day('Recovery Lower',[ex('Back Squat','3x7 moderate'),ex('Axle Deadlift','3x5 moderate'),ex('KB Sidebend','100 total')]),
    day('Low-Intensity Metcon',[ex('Metcon','Barbell-free; low intensity')]),
    day('Recovery Olympic',[ex('Snatch','4x2 moderate'),ex('Power Clean + 2 Push Press','4 sets moderate'),ex('Rack Pull','3x10 @ 75%')]),
    day('Short Metcon',[ex('Metcon','Short; barbell-free')]),
  ],
  5:[
    day('Press / Overhead',[ex('Clean + Strict Press','7 sets: 1 clean + 5 press'),ex('Wide-Grip Incline Bench','4x12 moderate'),ex('Seated DB Press','4x12 moderate'),ex('Pushups','100')]),
    day('Squat / Pull',[ex('1-1/4 Front Squat','7x5 heavy'),ex('Trap Bar / Farmer Deadlift','4x8 moderate'),ex('Pendlay Row','4x8 moderate'),ex('GHD Situp','3x15')]),
    day('Barbell-Free Metcon',[ex('Metcon','Barbell-free')]),
    day('Olympic / Upper Back / Arms',[ex('Hang Power Clean','7x5 heavy'),ex('Rack Pull at Knee','5x10 @ 110% deadlift'),ex('Sumo RDL','3x15 moderate'),ex('Wide-Grip Pullups','50 total')]),
    day('Short Metcon + Medley',[ex('Short Metcon','Barbell-free'),ex('Sprint + Sandbag Squat','5 rounds: 100m sprint + 10 squats + 100m sprint','Rest 3-5 min')]),
  ],
  6:[
    day('Press / Overhead',[ex('Pause Thruster','6x3 heavy'),ex('Behind-Neck Push Press','4x8 moderate'),ex('DB Chest Fly','4x15 moderate'),ex('Pushups','100')]),
    day('Squat / Pull',[ex('Deadlift','6x3 heavy'),ex('Front-Rack Lunge','4x8'),ex('Snatch-Grip RDL','5x7 moderate')]),
    day('Barbell-Free Metcon',[ex('Metcon','Barbell-free')]),
    day('Olympic / Upper Back / Arms',[ex('2 Snatch High Pull + Snatch + OH Squat','6 heavy sets'),ex('Hang Clean + 2 Split Jerks','5 moderate sets'),ex('Jumping Back Squat','4x6 heavy'),ex('DB Curl','4x15'),ex('Hammer Curl','4x10')]),
    day('Short Metcon + Medley',[ex('Short Metcon','Barbell-free'),ex('Car Push + Sled Pull','5 sets: 100m + 100ft','Rest 5 min')]),
  ],
  7:[
    day('Press / Overhead',[ex('Behind-Neck Snatch Push Press','7x2 heavy'),ex('Strict Press + Push Press','5 sets: 5 + 5'),ex('Close-Grip Bench','4x12 moderate'),ex('Triceps Pushdown','75'),ex('Parallette Pushup','30')]),
    day('Squat / Pull',[ex('Pause Back Squat','7x2 heavy'),ex('Block Deadlift','5x6 heavy'),ex('Barbell Row','4x8 moderate')]),
    day('Barbell-Free Metcon',[ex('Metcon','Barbell-free')]),
    day('Olympic / Upper Back / Arms',[ex('Muscle Snatch','Work to 3RM with 5-8% jumps'),ex('Axle Zercher Squat','4x5 heavy'),ex('Power Clean','5x3 heavy'),ex('Wide-Grip Pullup','50 total')]),
    day('Short Metcon + Medley',[ex('Short Metcon','Barbell-free'),ex('DB Walking Lunge + Sprint','4 sets: 100ft + 100m','Rest 5 min')]),
  ],
  8:[
    day('Recovery Press',[ex('Push Jerk','3x5 moderate'),ex('Bench Press','3x5 moderate'),ex('Pushups','100')]),
    day('Recovery Lower',[ex('Front Squat','3x7 moderate'),ex('Snatch-Grip Deadlift','4x5 moderate'),ex('Toes-to-Bar','40 total')]),
    day('Barbell-Free Metcon',[ex('Metcon','Barbell-free')]),
    day('Recovery Olympic',[ex('Snatch','4x3 moderate'),ex('Clean & Jerk','4x3 moderate'),ex('Split Jerk','5x2 moderate')]),
    day('Short Metcon',[ex('Metcon','Short; barbell-free')]),
  ],
}

const plOly6 = {
  1:[
    day('Monday - Olympic',[ex('Snatch','3x3 @70%, 3x3 @75%'),ex('Back Squat','4x5 @75%'),ex('Behind-Neck Push Press','3x5 @70%'),ex('Snatch Pull','4x5 @110% snatch 1RM'),ex('Pullup','3x8')]),
    day('Tuesday - Olympic',[ex('Clean & Jerk','3x3 @70%, 3x3 @75%'),ex('Snatch Balance','4x3 @70% snatch 1RM'),ex('Front Squat','4x5 @75%'),ex('Clean Pull','5x5 @115%'),ex('Abmat Situp','50')]),
    day('Thursday - Powerlifting',[ex('Box Squat','8x3 @70%'),ex('Bench Press','5x3 @70%'),ex('Sumo Deadlift','3x3 @70%')]),
    day('Friday - Powerlifting',[ex('DB Bench Press','4x8 heavy'),ex('Back Squat','3x5 @75%'),ex('Dip','3x7'),ex('Good Morning','3x7 moderate'),ex('Situp','50')]),
  ],
  2:[
    day('Monday - Olympic',[ex('Snatch','3x3 @75%, 3x3 @80%'),ex('Back Squat','3x5 @80%'),ex('Push Press','5x3 @80%'),ex('Snatch Deadlift','4x5 @100% snatch 1RM'),ex('Box Jump','5x5')]),
    day('Tuesday - Olympic',[ex('Clean & Jerk','3x3 @75%, 3x3 @80%'),ex('Snatch Balance','3x3 @80%'),ex('Front Squat','3x5 @80%'),ex('Behind-Neck Push Jerk','3x3 @80% jerk 1RM'),ex('Toes-to-Bar','3x12')]),
    day('Thursday - Powerlifting',[ex('Back Squat','5x4 @80%'),ex('Overhead Press','5x3 @80%'),ex('GHD','3x10'),ex('DB Row','3x10')]),
    day('Friday - Powerlifting',[ex('Barbell Lunge','3x3 each leg heavy'),ex('Pushup','3x15'),ex('Deadlift','5x3 @80%'),ex('Pullup','3x8')]),
  ],
  3:[
    day('Monday - Reload Olympic',[ex('Snatch','2x3 @60%, 2x3 @65%'),ex('Back Squat','3x5 @65%'),ex('Push Press','5x3 @65%'),ex('Snatch Deadlift','4x5 @70% snatch 1RM'),ex('Box Jump','5x5')]),
    day('Tuesday - Reload Olympic',[ex('Clean & Jerk','2x3 @60%, 2x3 @65%'),ex('Snatch Balance','3x3 @65%'),ex('Front Squat','3x5 @65%'),ex('Behind-Neck Push Jerk','3x3 @65% jerk 1RM'),ex('Toes-to-Bar','3x12')]),
    day('Thursday - Reload Powerlifting',[ex('Box Squat','8x3 @65%'),ex('Bench Press','5x3 @65%'),ex('Sumo Deadlift','3x3 @65%')]),
    day('Friday - Reload Powerlifting',[ex('DB Bench Press','4x8 heavy'),ex('Back Squat','3x5 @65%'),ex('Dip','3x7'),ex('Good Morning','3x7 moderate'),ex('Situp','50')]),
  ],
  4:[
    day('Monday - Olympic',[ex('Snatch','2x2 @90%'),ex('Back Squat','3x2 @85%'),ex('Behind-Neck Jerk','3x2 @90%'),ex('Snatch Pull','4x3 @115%')]),
    day('Tuesday - Olympic',[ex('Clean & Jerk','2x2 @90%'),ex('Snatch Balance','3x2 @90%'),ex('Front Squat','3x2 @90%'),ex('RDL','5x5 @85% clean')]),
    day('Thursday - Powerlifting',[ex('Back Squat','3x2 @90%'),ex('Bench Press','3x2 @90%'),ex('Sumo Deadlift','2x2 @90%'),ex('DB Bench Fly','4x8 heavy')]),
    day('Friday - Powerlifting',[ex('Row','1000m'),ex('DB Shoulder Press','4x7 heavy'),ex('Box Squat','4x1 @90%'),ex('Dip','4x8'),ex('Abmat Situp','55')]),
  ],
  5:[
    day('Monday - Olympic',[ex('Power Snatch + OH Squat','3x3 @80%, 3x3 @85%'),ex('Back Squat','3x5 @80%'),ex('Push Press','5x3 @80%'),ex('Snatch Deadlift','4x5 @110% snatch 1RM'),ex('Box Jump','5x5'),ex('Toes-to-Bar','3x12')]),
    day('Tuesday - Olympic',[ex('Hang Clean + Front Squat','3x3 @80%, 3x3 @85%'),ex('Snatch Balance','4x3 @75% snatch 1RM'),ex('Front Squat','4x5 @80%'),ex('Clean Pull','5x5 @120%'),ex('Abmat Situp','50')]),
    day('Thursday - Powerlifting',[ex('Back Squat','5x4 @80%'),ex('Overhead Press','5x4 @80%'),ex('Good Morning','5x5')]),
    day('Friday - Powerlifting',[ex('Pullup','3x12'),ex('Pushup','3x15'),ex('Deadlift','5x3 @80%')]),
  ],
  6:[
    day('Monday - Olympic',[ex('Snatch','3x3 @85%, 2x2 @87%'),ex('Behind-Neck Push Press','3x3 @85%'),ex('Barbell Lunge','5x3 each leg'),ex('Snatch Pull','5x5 @115%'),ex('Box Jump','5x5')]),
    day('Tuesday - Olympic',[ex('Clean & Jerk','3x3 @85%, 2x2 @87%'),ex('Push Jerk','3x3 @85%'),ex('Front Squat','5x3 @85%'),ex('Clean Pull','5x5 @115%')]),
    day('Thursday - Powerlifting',[ex('Box Squat','8x1 @85%'),ex('Bench Press','5x3 @85%'),ex('RDL','5x5 @85%'),ex('Biceps Curl','3x8')]),
    day('Friday - Powerlifting',[ex('Weighted Pullup','Find max'),ex('Back Squat','3x3 @85%'),ex('Deadlift','5x3 @85%'),ex('DB Chest Fly','3x8'),ex('Good Morning','3x5')]),
  ],
}


function andyHybridRebuildWeek(week) {
  const w=Math.max(1,Math.min(8,Number(week)||1))
  const mainByWeek={
    1:'4x6 @70% e1RM',
    2:'4x6 @72.5% e1RM',
    3:'4x6 @75% e1RM',
    4:'3x5 @60% e1RM',
    5:'5x5 @75% e1RM',
    6:'5x4 @80% e1RM',
    7:'6x3 @82.5-85% e1RM',
    8:'Top set 3-5 @RPE 8, then 2x5 @70% e1RM',
  }
  const main=mainByWeek[w]
  const deload=w===4
  const peak=w===8
  const lowerAssistance=deload?'2 sets each, easy':'3 sets each'
  const upperAssistance=deload?'2 sets each, easy':'3-4 sets each'
  const weekNote=deload
    ? 'Deload. Keep every rep fast and easy. Cut optional conditioning if you feel beat up.'
    : peak
      ? 'Performance week. Stop the top set at RPE 8. No grinders. Back-off work stays crisp.'
      : 'Add load only when the last main-lift set stays at or below RPE 8. Leave 1-2 reps in reserve on assistance.'

  return [
    day('Day 1 - Squat / Lower Strength',[
      ex('Back Squat',main,'Main lift. Use a current e1RM or current training max, not an old PR.'),
      ex('Romanian Deadlift',deload?'2x8 light':'3x8','Controlled hinge; keep the bar close.'),
      ex('Bulgarian Split Squat',deload?'2x8/leg easy':'3x10/leg','Use load only if balance and knee position stay solid.'),
      ex('Calf Raise',deload?'2x12':'3x15','Full range and controlled pause.'),
      ex('Dead Bug / Leg Raise',deload?'2x8/side':'3x10/side','Brace hard and keep the low back controlled.'),
      ex('Suitcase Carry / Sled',deload?'6 min easy':'8-10 min easy','Easy conditioning only on this day.'),
    ],weekNote),

    day('Day 2 - Bench / Upper Strength',[
      ex('Bench Press',main,'Main lift. Pause lightly and keep the setup repeatable.'),
      ex('Barbell Row / DB Row',deload?'2x8':'4x8','Controlled pull; no heaving.'),
      ex('Strict Press',deload?'2x8 light':'3x8','Stay stacked; no back lean.'),
      ex('Pullup / Pulldown',deload?'2 easy sets':'3-4 sets','Stop 1-2 reps before failure.'),
      ex('Triceps Pressdown / Dip',deload?'2x10 easy':'3x10-12','Choose the shoulder-friendly option.'),
      ex('Pallof Press',deload?'2x8/side':'3x10/side','Pause fully extended.'),
    ],weekNote),

    day('Day 3 - Deadlift / Lower Hypertrophy',[
      ex('Deadlift',main,'Main lift. Reset every rep and stop before technique changes.'),
      ex('Front Squat',deload?'2x8 light':'3x8','Upright torso and controlled depth.'),
      ex('Hamstring Curl',deload?'2x10':'3x12','Smooth reps.'),
      ex('Reverse Lunge',deload?'2x8/leg easy':'3x10/leg','Controlled step and stable knee.'),
      ex('Farmer Carry',deload?'3x30 yd easy':'4x40 yd','Heavy enough to challenge grip without changing posture.'),
      ex('Zone 2 Row / Walk',deload?'10 min easy':'15-20 min easy','Optional. Keep it conversational.'),
    ],weekNote),

    day('Day 4 - Press / Upper Hypertrophy',[
      ex('Strict Press',main,'Main lift. Brace before every rep and keep the bar path clean.'),
      ex('Incline DB Bench',deload?'2x10 light':'4x10','Controlled lowering; stop short of shoulder irritation.'),
      ex('Lat Pulldown / Pullup',deload?'2x10 easy':'3x10-12','Use a grip that feels good on elbows and shoulders.'),
      ex('Chest-Supported DB Row',deload?'2x10':'3x12','Pause briefly at the top.'),
      ex('Lateral Raise',deload?'2x12':'3x15','Light and controlled.'),
      ex('Curl + Pushdown',deload?'2x10 each':'3x12 each','Superset if desired.'),
      ex('Short Conditioning',deload?'Skip or 5 min easy':'8-12 min moderate','Choose rower, sled, kettlebell, carry or sandbag work. Keep only one hard conditioning session per week.'),
    ],weekNote),
  ]
}

function strengthStabilityBuilderWeek(week) {
  const w=Math.max(1,Math.min(6,Number(week)||1))
  const main = w<=2 ? '3x8 @ RPE 6-7' : w<=4 ? '4x6 @ RPE 7-8' : w===5 ? '5x5 @ RPE 8' : '3x5 @ RPE 6-7'
  const secondary = w<=2 ? '3x8' : w<=4 ? '4x6-8' : w===5 ? '4x6' : '2x8 light'
  const accessory = w<=2 ? '3x10' : w<=4 ? '3x8-10' : w===5 ? '3x8' : '2x10 easy'
  const unilateral = w<=2 ? '3x8/leg' : w<=4 ? '3x10/leg' : w===5 ? '3x8/leg moderate' : '2x8/leg easy'
  const core = w<=2 ? '3x8/side' : w<=4 ? '3x10/side' : w===5 ? '4x8/side' : '2x8/side'
  const carry = w<=2 ? '4x40 yd' : w<=4 ? '5x40 yd' : w===5 ? '5x50 yd' : '3x40 yd easy'

  const weekNote = w===1 ? 'Start conservative. Finish every main lift with 2-3 reps still in reserve.'
    : w===2 ? 'Add a small amount of weight only where Week 1 felt clean and controlled.'
    : w===3 ? 'Volume increases. Keep the final work set around RPE 7-8.'
    : w===4 ? 'Repeat the Week 3 structure with a small load increase where earned.'
    : w===5 ? 'Strongest week. Work hard, but no grinding or ugly reps.'
    : 'Deload week. Reduce load and volume so you finish fresh.'

  return [
    day('Day 1 - Squat + Push/Pull',[
      ex('Front Squat',main,'Brace hard, control the descent, and keep the final set smooth.'),
      ex('Bench Press',secondary,'Pause lightly on the chest; keep shoulder blades set.'),
      ex('Chest-Supported DB Row',accessory,'Pull elbows back without shrugging.'),
      ex('Bulgarian Split Squat',unilateral,'Stay balanced; use load only if control is solid.'),
      ex('Dead Bug',core,'Long exhale; keep low back quiet.'),
      ex('Suitcase Carry',carry+'/side','Walk tall and resist side-bending.'),
      ex('Zone 2 Bike / Walk','8-12 min easy','Optional finisher; conversational pace.'),
    ],weekNote),

    day('Day 2 - Hinge + Press',[
      ex('Romanian Deadlift',main,'Keep the bar close and own the stretch; no bouncing.'),
      ex('Strict Press',secondary,'Ribs down and glutes tight; no back lean.'),
      ex('Lat Pulldown / Assisted Pullup',accessory,'Use a grip that feels good on shoulders and elbows.'),
      ex('Reverse Lunge',unilateral,'Controlled step and steady knee position.'),
      ex('Pallof Press',core,'Pause fully extended for 1-2 seconds.'),
      ex('Side Plank',w<=2?'3x25 sec/side':w<=4?'3x35 sec/side':w===5?'3x45 sec/side':'2x25 sec/side','Stay stacked; do not rotate.'),
      ex('Sled Push / Bike Intervals',w===6?'6 min easy':'8-10 min moderate','Optional. Short repeatable efforts; stop before form or pace falls apart.'),
    ],weekNote),

    day('Day 3 - Full Body + Carry',[
      ex('Trap Bar Deadlift',w<=2?'3x5 @ RPE 6-7':w<=4?'4x5 @ RPE 7':w===5?'5x3 @ RPE 8':'3x3 light','Treat every rep like a clean first rep; no grinding.'),
      ex('Incline DB Bench',accessory,'Controlled lower; stop short of shoulder discomfort.'),
      ex('One-Arm DB Row',accessory+'/side','Square the hips and pause at the top.'),
      ex('Step-Up',unilateral,'Drive through the working leg; avoid pushing off the trailing foot.'),
      ex('Hamstring Curl',accessory,'Smooth reps with a full range you can control.'),
      ex('Farmer Carry',carry,'Heavy enough to challenge grip without changing posture.'),
      ex('Zone 2 Row / Walk',w===6?'10 min easy':'12-20 min easy','Optional conditioning. Keep it truly easy.'),
    ],weekNote),
  ]
}

const beginnerCoreStabilityWeeks = {
  1:[
    day('Day 1 - Brace + Single-Leg Control',[
      ex('Front Squat','3x8 light','Smooth reps; stop with 3-4 reps in reserve'),
      ex('Bulgarian Split Squat','3x8/leg','Use bodyweight or light DBs; own the bottom position'),
      ex('Chest-Supported DB Row','3x10','Controlled pull; ribs down'),
      ex('Dead Bug','3x6/side','Exhale fully and keep low back quiet'),
      ex('Suitcase Carry','4x40 yd/side','Walk tall; do not lean toward or away from the load'),
    ],'Beginner stability day. Quality before load.'),
    day('Day 2 - Hinge + Anti-Rotation',[
      ex('Romanian Deadlift','3x8 light-moderate','3-second lowering; keep the bar close'),
      ex('Reverse Lunge','3x8/leg','Controlled step; keep hips and knee steady'),
      ex('Strict Press','3x8 light','Stay stacked; no back lean'),
      ex('Pallof Press','3x8/side','Pause 2 seconds fully extended'),
      ex('Side Plank','3x20 sec/side','Straight line from shoulder to ankle'),
      ex('Easy Sled / Carry','10 min easy','Continuous easy work; nasal-breathing pace'),
    ],'Brace during every standing movement.'),
    day('Day 3 - Posterior Chain + Carry',[
      ex('Hamstring Curl','3x12','Controlled tempo'),
      ex('Ring Row / Inverted Row','3x8','Keep the body rigid from shoulders to heels'),
      ex('Glute Bridge','3x10','Pause 2 seconds at the top'),
      ex('Bird Dog','3x6/side','Reach long without rotating the hips'),
      ex('Farmer Carry','4x40 yd','Moderate load; tall posture and even steps'),
      ex('Zone 2 Row / Walk','10-15 min easy','Optional easy conditioning'),
    ],'Keep this day easy enough to finish feeling better than you started.'),
  ],
  2:[
    day('Day 1 - Brace + Single-Leg Control',[
      ex('Front Squat','3x8','Add a small amount only if Week 1 stayed <= RPE 8'),
      ex('Bulgarian Split Squat','3x10/leg','Same control; add reps before load'),
      ex('Chest-Supported DB Row','3x10','Pause briefly at the top'),
      ex('Dead Bug','3x8/side','Slow exhale on every rep'),
      ex('Suitcase Carry','4x40 yd/side','Slightly heavier if posture stays perfect'),
    ]),
    day('Day 2 - Hinge + Anti-Rotation',[
      ex('Romanian Deadlift','3x8','Add load only if position stays solid'),
      ex('Reverse Lunge','3x10/leg','Control the lowering phase'),
      ex('Strict Press','3x8','Small load increase only if no back lean'),
      ex('Pallof Press','3x10/side','Pause 2 seconds'),
      ex('Side Plank','3x25 sec/side','Do not let the hips rotate'),
      ex('Easy Sled / Carry','10 min easy','Steady pace'),
    ]),
    day('Day 3 - Posterior Chain + Carry',[
      ex('Hamstring Curl','3x12'),
      ex('Ring Row / Inverted Row','3x10','Keep full-body tension'),
      ex('Glute Bridge','3x12','Pause 2 seconds'),
      ex('Bird Dog','3x8/side','Slow and controlled'),
      ex('Farmer Carry','4x40 yd','Slightly heavier if grip and posture are solid'),
      ex('Zone 2 Row / Walk','15 min easy','Optional'),
    ]),
  ],
  3:[
    day('Day 1 - Brace + Single-Leg Strength',[
      ex('Front Squat','4x6','Moderate load; last set <= RPE 8'),
      ex('Bulgarian Split Squat','3x10/leg','Add light load if balance is solid'),
      ex('Chest-Supported DB Row','4x8'),
      ex('Dead Bug','3x8/side','3-second exhale'),
      ex('Suitcase Carry','4x40 yd/side','Moderate-heavy without leaning'),
    ]),
    day('Day 2 - Hinge + Anti-Rotation',[
      ex('Romanian Deadlift','4x6','Moderate; perfect hinge position'),
      ex('Reverse Lunge','3x10/leg','Light-moderate load'),
      ex('Strict Press','3x8','Stay stacked'),
      ex('Pallof Press','3x10/side','Use slightly more resistance'),
      ex('Side Plank','3x30 sec/side'),
      ex('Sled Push / Drag','8-10 min easy','Short trips; smooth effort'),
    ]),
    day('Day 3 - Posterior Chain + Carry',[
      ex('Hamstring Curl','3x12'),
      ex('Ring Row / Inverted Row','4x8'),
      ex('Glute Bridge','3x12','Add light load if easy'),
      ex('Bird Dog','3x8/side','Pause fully extended'),
      ex('Farmer Carry','4x40 yd','Moderate-heavy'),
      ex('Zone 2 Row / Walk','15-20 min easy','Optional'),
    ]),
  ],
  4:[
    day('Day 1 - Brace + Single-Leg Strength',[
      ex('Front Squat','4x6','Add a small amount only if Week 3 stayed <= RPE 8'),
      ex('Bulgarian Split Squat','3x10/leg','Keep pelvis level'),
      ex('Chest-Supported DB Row','4x8'),
      ex('Dead Bug','3x10/side','Slow and strict'),
      ex('Suitcase Carry','5x40 yd/side','Same posture on every trip'),
    ]),
    day('Day 2 - Hinge + Anti-Rotation',[
      ex('Romanian Deadlift','4x6','Small load increase if form is unchanged'),
      ex('Reverse Lunge','3x10/leg'),
      ex('Strict Press','4x6','No back lean'),
      ex('Pallof Press','3x12/side','Controlled return'),
      ex('Side Plank','3x35 sec/side'),
      ex('Sled Push / Drag','10 min easy-moderate','Stay well short of failure'),
    ]),
    day('Day 3 - Posterior Chain + Carry',[
      ex('Hamstring Curl','3x12'),
      ex('Ring Row / Inverted Row','4x10'),
      ex('Glute Bridge','3x15'),
      ex('Bird Dog','3x10/side'),
      ex('Farmer Carry','5x40 yd','Moderate-heavy'),
      ex('Zone 2 Row / Walk','20 min easy','Optional'),
    ]),
  ],
  5:[
    day('Day 1 - Strength + Stability',[
      ex('Front Squat','5x5','Controlled strength work; final set <= RPE 8'),
      ex('Bulgarian Split Squat','3x8/leg','Moderate load; no wobble'),
      ex('Chest-Supported DB Row','4x8'),
      ex('Dead Bug','3x10/side','Add a light band only if perfect'),
      ex('Suitcase Carry','5x40 yd/side','Challenging but no lean'),
    ]),
    day('Day 2 - Hinge + Anti-Rotation',[
      ex('Romanian Deadlift','5x5','Controlled strength work; final set <= RPE 8'),
      ex('Reverse Lunge','3x8/leg','Moderate load'),
      ex('Strict Press','4x6','Brace before every rep'),
      ex('Pallof Press','4x10/side','Pause 2 seconds'),
      ex('Side Plank','3x40 sec/side'),
      ex('Sled Push / Drag','8-12 min','Moderate; stop before technique fades'),
    ]),
    day('Day 3 - Posterior Chain + Carry',[
      ex('Hamstring Curl','3x12'),
      ex('Ring Row / Inverted Row','4x10'),
      ex('Glute Bridge','4x10','Moderate load; 2-second pause'),
      ex('Bird Dog','3x10/side','Pause fully extended'),
      ex('Farmer Carry','5x40 yd','Challenging but smooth'),
      ex('Zone 2 Row / Walk','20-25 min easy','Optional'),
    ]),
  ],
  6:[
    day('Day 1 - Deload + Control',[
      ex('Front Squat','3x5 light','Move perfectly; no grinding'),
      ex('Bulgarian Split Squat','2x8/leg','Easy and controlled'),
      ex('Chest-Supported DB Row','3x8 light'),
      ex('Dead Bug','2x8/side','Slow exhale'),
      ex('Suitcase Carry','3x40 yd/side','Easy-moderate'),
    ],'Deload week: leave the gym fresh.'),
    day('Day 2 - Deload + Anti-Rotation',[
      ex('Romanian Deadlift','3x5 light','Easy hinge practice'),
      ex('Reverse Lunge','2x8/leg'),
      ex('Strict Press','3x5 light'),
      ex('Pallof Press','2x8/side'),
      ex('Side Plank','2x25 sec/side'),
      ex('Easy Sled / Carry','8-10 min easy','Recovery pace'),
    ]),
    day('Day 3 - Deload + Movement Quality',[
      ex('Hamstring Curl','2x10 light'),
      ex('Ring Row / Inverted Row','3x8 easy'),
      ex('Glute Bridge','2x10'),
      ex('Bird Dog','2x8/side'),
      ex('Farmer Carry','3x40 yd','Easy-moderate'),
      ex('Zone 2 Row / Walk','10-15 min easy','Optional'),
    ]),
  ],
}


const hybridCalisthenicsQuickDays = [
  day('Pushups + Leg Raises',[
    ex('Pushup progression','2 sets','Choose a variation you can do cleanly; stop 1-2 reps before failure. Add a third set when you want more volume.'),
    ex('Leg Raise progression','2 sets','Use a progression that stays controlled. Add a third set when you want more volume.'),
  ],'WorkoutBoard quick track based on the free Hybrid Routine 2.0. Designed to fit the source routine\'s commonly stated 10-15 minute session window.'),
  day('Pullups + Squats',[
    ex('Pullup progression','2 sets','Wall, horizontal, jackknife or full pullups depending on your current level; stop 1-2 reps before failure.'),
    ex('Squat progression','2 sets','Assisted through single-leg variations as appropriate; stop 1-2 reps before failure.'),
  ]),
  day('Bridges + Twists',[
    ex('Bridge progression','2 sets','Choose the safest progression you can control.'),
    ex('Twist progression','2 sets','Controlled reps; do not perform twists explosively.'),
  ]),
  day('Pushups + Leg Raises',[
    ex('Pushup progression','2 sets','Stop 1-2 reps before failure.'),
    ex('Leg Raise progression','2 sets','Controlled reps.'),
  ]),
  day('Pullups + Squats',[
    ex('Pullup progression','2 sets','Stop 1-2 reps before failure.'),
    ex('Squat progression','2 sets','Controlled reps.'),
  ]),
  day('Bridges + Twists',[
    ex('Bridge progression','2 sets','Controlled progression.'),
    ex('Twist progression','2 sets','Controlled reps; no explosive twisting.'),
  ]),
]

const redditMinimalistDays = [
  day('Minimalist Full Body',[
    ex('Walking Lunge','3 sets','One circuit set; work 1-2 reps short of failure. Source allows 2-6 circuits, so use + Add set to scale volume.'),
    ex('Pushup progression','3 sets','Work 1-2 reps short of failure. Progress the variation when it becomes easy.'),
    ex('Row progression','3 sets','Use table, rings, low bar or another safe row setup.'),
    ex('Plank Shoulder Tap','3 sets','Controlled alternating taps.'),
  ],'Three-circuit WorkoutBoard default for the public r/bodyweightfitness Minimalist Routine. The source allows 2-6 circuits with little to no rest.'),
]

const redditRecommendedRoutineDays = [
  day('Recommended Routine - Full Body',[
    ex('Pullup progression','3x5-8','Pair with squat progression; ~90 sec between paired exercises.'),
    ex('Squat progression','3x5-8','Pair with pullup progression.'),
    ex('Dip progression','3x5-8','Pair with hinge progression.'),
    ex('Hinge progression','3x5-8','Pair with dip progression.'),
    ex('Row progression','3x5-8','Pair with pushup progression.'),
    ex('Pushup progression','3x5-8','Pair with row progression.'),
    ex('Anti-Extension progression','3x8-12','Core triplet; ~60 sec between movements.'),
    ex('Anti-Rotation progression','3x8-12','Core triplet.'),
    ex('Extension progression','3x8-12','Core triplet.'),
  ],'Public r/bodyweightfitness Recommended Routine. Full session is typically much longer than the quick daily plan.'),
]

const nerdFitnessBeginnerDays = [
  day('Beginner Bodyweight Circuit',[
    ex('Bodyweight Squat','2x20','Assisted squat is fine when needed.'),
    ex('Pushup','2x10','Use an elevated or knee variation if needed.'),
    ex('Walking Lunge','2x10/side','Good mornings are an alternative if lunges bother your knees.'),
    ex('Doorway Row','2x10/side','A dumbbell/backpack row is another option.'),
    ex('Plank','2x15-30 sec','Elevate hands if floor planks are not comfortable.'),
    ex('Jumping Jack','2x30','Walking jacks or marching can make this low impact.'),
  ],'WorkoutBoard repeat track based on Nerd Fitness\' public Beginner Bodyweight Workout. The source recommends 2-4 sessions per week with rest between sessions.'),
]

const streetParkingPublicSampleWeek = [
  day('Monday - Vault 4 FUCANGLONG (Program A)',[
    ex('Dumbbell Squat','20-18-16-14-12-10-8-6-4-2 reps','Use the same load through the descending ladder.'),
    ex('Wall Walk','3 reps after every squat set','Scale to pike walkout, inchworm, or push-up + taps as needed.'),
  ],'For time. Public sample goal: 12-18 minutes.'),
  day('Tuesday - Deadlift + Box Jump',[
    ex('Dumbbell Deadlift','5-min AMRAP: 3, 6, 9, 12... reps','Add 3 deadlifts every round.'),
    ex('Box Jump','9 reps every round','Choose a repeatable height.'),
    ex('Rest','5 minutes'),
    ex('Repeat Part 1','For time','Repeat the same work from Part 1.'),
  ],'Two-part public daily sample.'),
  day('Wednesday - Move for 25 Minutes',[
    ex('Run','200 meters'),
    ex('Alternating Dumbbell Farmer Step Up','18 reps'),
    ex('Run','200 meters'),
    ex('Barbell Shoulder Press','18 reps'),
  ],'Move continuously for 25 minutes at an intentional, sustainable pace.'),
  day('Thursday - 30/30 Intervals',[
    ex('Double Under / Dumbbell Hop Over','5 rounds: 30 sec work / 30 sec off'),
    ex('Wall Ball','5 rounds: 30 sec work / 30 sec off'),
    ex('Barbell Hang Power Snatch','5 rounds: 30 sec work / 30 sec off'),
  ],'Public Program B sample. Record total reps for each movement.'),
  day('Friday - Run + Power Clean',[
    ex('Run','2x800 meters'),
    ex('Barbell Power Clean','2x25 reps','Perform 25 cleans after each 800m run.'),
  ],'Score each round. Public sample goal: roughly 6-9 minutes per round.'),
  day('Saturday - Chipper',[
    ex('Toes to Bar','75 total reps','May be partitioned.'),
    ex('Alternating Unweighted Lunge','200 total reps','May be partitioned.'),
    ex('Barbell Bench Press','75 total reps','May be partitioned.'),
  ],'Complete straight through or break the work into rounds. Public sample goal: 20-30 minutes.'),
]

const streetParkingPublicExtras = [
  day('Dumbbell Strength - Session 4',[
    ex('Supported Single-Leg Romanian Deadlift','4 rounds: 6/leg','Every 3 minutes for 12 minutes.'),
    ex('Slow Dumbbell Deadlift','4 rounds: 6 reps','Every 3 minutes for 12 minutes.'),
    ex('Alternating Bent-Over Row','4 rounds: 12 reps','Perform with the slow deadlifts in Part 2.'),
  ],'Official Street Parking public Dumbbell Strength sample.'),
  day('5K Program - Week 3 Run 2 (Threshold)',[
    ex('Run','2 rounds: 1000m moderate','Rest 3 min.'),
    ex('Run','2 rounds: 400m fast','Rest 3 min.'),
    ex('Run','2 rounds: 600m fast','Rest 5 min before repeating.'),
  ],'4000m total. Public threshold-session sample.'),
  day('Bodyweight Strength - Session 1',[
    ex('Feet-Elevated Inverted Row','3-4x10','Slow lowering.'),
    ex('Slow-Lower Push-Up + Taps','3-4 rounds: 10 push-ups + 4 taps'),
    ex('Standing Windmill','3-4x10/side'),
    ex('Bar Hang','2-3x30 sec'),
    ex('Pike Handstand Hold','2-3x30 sec'),
    ex('Side Plank Hold','2-3x40 sec/side'),
    ex('Face-Down Snow Angel','2-3x10','Slow reps.'),
  ],'Official public Bodyweight Strength sample.'),
  day('On Ramp - Session 1',[
    ex('Dumbbell Shoulder Press','5x7'),
    ex('Air Squat','5x10'),
  ],'Five rounds for time. Public goal: 5-9 minutes.'),
  day('On Ramp - Session 3',[
    ex('Dumbbell Deadlift','9x6'),
    ex('Burpee','9x3'),
  ],'Nine rounds for time. Public goal: 6-10 minutes.'),
  day('On Ramp - Session 6',[
    ex('Dumbbell Hang Power Clean','10-min AMRAP: 7 reps'),
    ex('Dumbbell Shoulder Press','10-min AMRAP: 7 reps'),
    ex('Low Jump / Low Jump Over','10-min AMRAP: 7 reps'),
  ],'Cycle 7/7/7 for 10 minutes. Public goal: 6-9 rounds.'),
]

const sofletePublicDailySamples = [
  day('SOFLETE Public Sample - Meathead Friday',[
    ex('Bench Press','10-min AMRAP @ bodyweight','Rest as needed while accumulating reps.'),
    ex('Dumbbell Row','5x12/side','Superset with skull crushers.'),
    ex('Skull Crusher','5x15','Rest 20 sec after rows; 90 sec between supersets.'),
    ex('400m Sprint','Every 3 min for 18 min','Six starts total.'),
  ],'Official SOFLETE public daily sample.'),
  day('SOFLETE Public Sample - Bench / Deadlift EMOM',[
    ex('Close-Grip Bench Press','14-min EMOM: 8 reps on odd minutes','Build weight each set.'),
    ex('Deadlift','14-min EMOM: 4 reps on even minutes','Build weight each set.'),
    ex('Bench Press','15-min AMRAP: 3 reps @ bodyweight'),
    ex('Sandbag Ground to Shoulder','15-min AMRAP: 6 reps @ 95 lb'),
    ex('Toes to Bar','15-min AMRAP: 9 reps'),
  ],'Official SOFLETE public daily sample.'),
  day('SOFLETE Public Sample - Bench / Curl / Sprint',[
    ex('Bench Press','5x3','Superset with hammer curls.'),
    ex('Hammer Curl','5x10'),
    ex('Deadlift','4x4'),
    ex('Push-Up','10-min EMOM: 10 reps'),
    ex('Sprint','10-min EMOM: 50 meters','Perform after the push-ups each minute.'),
  ],'Official SOFLETE public daily sample.'),
  day('SOFLETE Public Sample - Clean / Bench / Stamina',[
    ex('Hang Power Clean','5x2'),
    ex('Bench Press','5,3,1,5,3,15','Increase load as reps fall; final 15-rep back-off set.'),
    ex('Sandbag Ground to Shoulder','20-min EMOM: 5 reps on minute 1'),
    ex('Dip','20-min EMOM: 12 reps on minute 2'),
    ex('Toes to Bar','20-min EMOM: max reps on minute 3'),
    ex('Rest','20-min EMOM: minute 4'),
  ],'Official SOFLETE public daily sample.'),
  day('SOFLETE Public Sample - Push Press / Squat / AMRAP',[
    ex('Push Press + Jerk Complex','Build to heaviest: 2 push press + 3 jerks'),
    ex('Back Squat Cluster','4x2.2.2.2 @ 77.5%','20 sec within clusters; 3 min between sets.'),
    ex('Front Squat','9-min AMRAP: 5 reps @ 185 lb','Starts from the floor in the public sample.'),
    ex('Chest-to-Bar Pull-Up','9-min AMRAP: 7 reps'),
    ex('Shuttle Sprint','9-min AMRAP: 40m (4x10m)'),
  ],'Official SOFLETE public daily sample.'),
]

const sofleteAssaulterPublicSample = [
  day('Assaulter Demo - Upper-Body Strength',[
    ex('Banded Shoulder Dislocate','3x10','Movement prep.'),
    ex('Scap Push-Up','3x12','Movement prep.'),
    ex('Ring Row','3xAMRAP','Movement prep.'),
    ex('Bench Press','Build to a new 3RM','Public demo strength-build segment.'),
    ex('Bench Press','5x5 @ 70% of 3RM','Public demo strength segment.'),
    ex('Pull-Up','5 rounds during 15-min stamina EMOM','Public demo shows an 8-rep target with scaling.'),
    ex('Push-Up','5 rounds during 15-min stamina EMOM','Public demo shows a 20-rep target with scaling.'),
    ex('Cyclic Breathing','3x1 min','Recovery segment.'),
    ex('Foam Roll','3x1 min','Recovery segment.'),
  ],'SOFLETE Assaulter public app-demo session. The paid cycle contains additional programming not reproduced here.'),
]

export const archivePrograms = [
  {id:'hybrid-calisthenics-quick',name:'Hybrid Calisthenics 2.0 - Quick Daily Track',category:'Calisthenics',difficulty:'Beginner / Scalable',weeksCount:12,daysPerWeek:6,durationLabel:'5-15 min/day',source:'Hybrid Calisthenics public Hybrid Routine 2.0',description:'Short six-day bodyweight track: two movements per day. Uses two working sets by default with an optional third set so it can live beside a lifting program.',getWeek:()=>hybridCalisthenicsQuickDays},
  {id:'reddit-bwf-minimalist',name:'r/bodyweightfitness - Minimalist Routine',category:'Calisthenics',difficulty:'Beginner / Scalable',weeksCount:8,daysPerWeek:3,durationLabel:'Minimalist',source:'r/bodyweightfitness public Minimalist Routine wiki',description:'Public minimalist full-body routine built around lunges, pushups, rows and plank shoulder taps. WorkoutBoard defaults to three circuits; add/remove sets to scale within the source\'s 2-6 circuit range.',getWeek:()=>redditMinimalistDays},
  {id:'reddit-bwf-recommended',name:'r/bodyweightfitness - Recommended Routine',category:'Calisthenics',difficulty:'Beginner / Intermediate',weeksCount:8,daysPerWeek:3,durationLabel:'~60 min/session',source:'r/bodyweightfitness public Recommended Routine wiki',description:'Full public bodyweight strength routine with pull, squat, dip, hinge, row, push and three core progressions.',getWeek:()=>redditRecommendedRoutineDays},
  {id:'nerd-fitness-beginner-bodyweight',name:'Nerd Fitness - Beginner Bodyweight Track',category:'Calisthenics',difficulty:'Beginner',weeksCount:6,daysPerWeek:3,durationLabel:'~20 min/session',source:'Nerd Fitness public Beginner Bodyweight Workout',description:'WorkoutBoard repeat track based on the public beginner circuit. Two circuits by default, three nonconsecutive days per week.',getWeek:()=>nerdFitnessBeginnerDays},
  {id:'street-parking-public-week',name:'Street Parking - Public Sample Week',category:'Strength + Conditioning',difficulty:'Intermediate',weeksCount:1,daysPerWeek:6,source:'Street Parking official public Sample Workouts page',description:'Six publicly posted daily workouts from Street Parking\'s sample week. Source-backed; not the paid daily-program library.',getWeek:()=>streetParkingPublicSampleWeek},
  {id:'street-parking-public-extras',name:'Street Parking - Public Extra Samples',category:'General + Conditioning',difficulty:'Beginner / Intermediate',weeksCount:1,daysPerWeek:6,source:'Street Parking official public Sample Workouts page',description:'Public samples from Dumbbell Strength, 5K, Bodyweight Strength, and On Ramp.',getWeek:()=>streetParkingPublicExtras},
  {id:'soflete-public-dailies',name:'SOFLETE - Public Daily Samples',category:'Tactical + Strength + Conditioning',difficulty:'Intermediate / Advanced',weeksCount:1,daysPerWeek:5,source:'SOFLETE official public daily workout posts',description:'Five non-periodized public SOFLETE daily sample workouts. These are samples, not subscription programming.',getWeek:()=>sofletePublicDailySamples},
  {id:'soflete-assaulter-public-sample',name:'SOFLETE - Assaulter Public Sample',category:'Tactical Strength',difficulty:'Advanced',weeksCount:1,daysPerWeek:1,source:'SOFLETE official training-app public demo',description:'One detailed upper-body Assaulter demo session publicly shown by SOFLETE; not the full paid cycle.',getWeek:()=>sofleteAssaulterPublicSample},
  {id:'andy-hybrid-rebuild',name:'Hybrid Powerbuilding Rebuild',category:'Powerbuilding + Stability',difficulty:'Intermediate',weeksCount:8,daysPerWeek:4,durationLabel:'45-60 min/session',source:'Workout archive + WorkoutBoard rebuild',description:'Built from repeated 5/3/1, 5x5 and powerbuilding patterns: squat, bench, deadlift and press anchors with familiar unilateral work, rows/pullups, carries, core and short conditioning. Progression is capped around RPE 8 with a deload to avoid stacking too much intensity.',getWeek:andyHybridRebuildWeek},
  {id:'strength-stability-builder',name:'Strength + Stability Builder',category:'Strength + Stability',difficulty:'Beginner / Intermediate',weeksCount:6,daysPerWeek:3,durationLabel:'35-50 min/session',source:'WorkoutBoard custom program',description:'A stronger step up from Beginner Core & Stability: three full-body lifting days with squat, hinge, press, pull, unilateral work, carries, core stability and optional conditioning. Six weeks with a progressive build and a final deload.',getWeek:strengthStabilityBuilderWeek},
  {id:'beginner-core-stability',name:'Beginner Core & Stability',category:'Core + Stability',difficulty:'Beginner',weeksCount:6,daysPerWeek:3,source:'WorkoutBoard custom program',description:'Six-week beginner stability block using familiar unilateral leg work, hinges, rows, presses, carries, core bracing and easy conditioning.',getWeek:w=>beginnerCoreStabilityWeeks[Math.max(1,Math.min(6,w))]},
  {id:'squatober',name:'Squatober',category:'Specialization',difficulty:'Intermediate',weeksCount:3,daysPerWeek:2,source:'FEB SQUATOBER.pdf',description:'Squat-focused block with bench, deadlift, pulling, and accessories.',getWeek:w=>squatoberWeeks[Math.max(1,Math.min(3,w))]},
  {id:'phat',name:'PHAT - Power Hypertrophy Adaptive Training',category:'Powerbuilding',difficulty:'Intermediate',weeksCount:12,daysPerWeek:5,source:'phat_ebook.pdf',description:'Two power days plus three hypertrophy days.',getWeek:()=>phatDays},
  {id:'wild20',name:'Wild 20 Powerbuilding',category:'Powerbuilding',difficulty:'Intermediate',weeksCount:20,daysPerWeek:4,source:'wild20powerbuilding.pdf',description:'Four-day powerbuilding split using the Wild 20 method on the lead movement.',getWeek:()=>wild20Days},
  {id:'beach531',name:'Beach 5/3/1',category:'Strength',difficulty:'Intermediate',weeksCount:3,daysPerWeek:3,source:'Beach 5-3-1 (1).docx',description:'Three-day 5/3/1 variation combining squat, press, clean, deadlift and high-rep pulling.',getWeek:w=>beach531[Math.max(1,Math.min(3,w))]},
  {id:'monolith',name:'Building the Monolith + KB / Prowler',category:'Strength + Conditioning',difficulty:'Advanced',weeksCount:6,daysPerWeek:3,source:'Monolith With KB  and Prowler Conditioning.docx',description:'Six-week high-volume strength block with kettlebell and prowler conditioning.',getWeek:monolithDays},
  {id:'starting-strength',name:'Starting Strength - Original Novice',category:'Strength',difficulty:'Beginner',weeksCount:12,daysPerWeek:3,source:'Starting Strength Calculator Spreadsheet.xlsx',description:'A/B novice linear progression. Add weight each session.',getWeek:w=> w%2 ? [startingStrengthDays[0],startingStrengthDays[1],startingStrengthDays[0]] : [startingStrengthDays[1],startingStrengthDays[0],startingStrengthDays[1]]},
  {id:'cowboy',name:'Juggernaut Cowboy Method - Squat',category:'Strength',difficulty:'Advanced',weeksCount:13,daysPerWeek:3,source:'JUGGERNAUT-THE-COWBOY-METHOD.pdf',description:'Thirteen-week high-frequency squat progression with low-, medium-, and high-intensity days.',getWeek:cowboyDays},
  {id:'deadlift8',name:'8 Week Deadlift Program',category:'Specialization',difficulty:'Intermediate',weeksCount:8,daysPerWeek:1,source:'Deadlift_8_Week.01.pdf',description:'Eight-week deadlift specialization culminating in a new max attempt.',getWeek:w=>[day(`Week ${w} - Deadlift`,deadlift8[Math.max(1,Math.min(8,w))])]},
  {id:'crossfit-strength8',name:'8 Week Strength for CrossFitters',category:'Strength + Conditioning',difficulty:'Intermediate',weeksCount:8,daysPerWeek:5,source:'8 Week Strength Program for Crossfitters.pdf',description:'Five-day strength-focused plan with barbell-free metcons and Olympic lifting.',getWeek:w=>crossfit8[Math.max(1,Math.min(8,w))]},
  {id:'pl-oly6',name:'6 Week Powerlifting / Olympic Lifting',category:'Olympic + Strength',difficulty:'Intermediate',weeksCount:6,daysPerWeek:4,source:'6 week PL _ Oly Program.pdf',description:'Four training days: two Olympic-lifting days and two powerlifting days.',getWeek:w=>plOly6[Math.max(1,Math.min(6,w))]},
]

export const referenceArchivePrograms = [
  // Already cataloged from the original archive. These stay visible until their source
  // prescriptions are fully transcribed into runnable week/day data.
  {id:'juggernaut2',name:'Juggernaut Method 2.0',category:'Strength',difficulty:'Intermediate',weeksCount:16,daysPerWeek:4,source:'The_Juggernaut_Method_2.0 .pdf',description:'Four-wave Juggernaut progression.',transcriptionStatus:'source'},
  {id:'von-moger',name:'Von Moger Mass',category:'Bodybuilding',difficulty:'Intermediate',weeksCount:6,daysPerWeek:5,source:"Andy's Von Moger Mass.xlsx",description:'High-volume bodybuilding split with alternating 5- and 6-day weeks.',transcriptionStatus:'source'},
  {id:'colorado',name:'Colorado Experiment',category:'Bodybuilding',difficulty:'Advanced',weeksCount:4,daysPerWeek:3,source:'Colorado Experiment.xlsx',description:'Fourteen sequential high-intensity workouts from the archive.',transcriptionStatus:'source'},
  {id:'lifestyle-powerbuilding',name:'Lifestyle Powerbuilding',category:'Powerbuilding',difficulty:'Intermediate',weeksCount:8,daysPerWeek:4,source:'Nick_Cheadles_Lifestyle_Powerbuilding.pdf',description:'Four-session powerbuilding plan with 4-week progression repeated with increased training maxes.',transcriptionStatus:'source'},
  {id:'massbuilder',name:'MASSbuilder',category:'Strength + Conditioning',difficulty:'Advanced',weeksCount:12,daysPerWeek:4,source:'MASSbuilder.pdf',description:'Twelve-week, four-day giant-set strength/hypertrophy/conditioning program.',transcriptionStatus:'source'},
  {id:'beginner-oly',name:'Beginner Olympic Lifting',category:'Olympic + Strength',difficulty:'Beginner',weeksCount:4,daysPerWeek:4,source:'Beginner Oly Program.docx',description:'Four-week beginner Olympic-lifting program.',transcriptionStatus:'source'},
  {id:'lower-body',name:'Lower Body Program',category:'Specialization',difficulty:'Intermediate',weeksCount:6,daysPerWeek:3,source:'Lower Body Program.docx',description:'Six-week lower-body-focused plan.',transcriptionStatus:'source'},
  {id:'revised-deadlift',name:'Deadlift Cycle for Maximum Floor Speed',category:'Specialization',difficulty:'Intermediate',weeksCount:9,daysPerWeek:1,source:'Revised Deadlift Cycle.docx',description:'Nine-week deadlift cycle focused on floor speed.',transcriptionStatus:'source'},
  {id:'wendler-challenge',name:'Wendler Challenge',category:'Strength',difficulty:'Intermediate',weeksCount:3,daysPerWeek:4,source:'Wendler challenge.docx',description:'Three-week Wendler strength challenge.',transcriptionStatus:'source'},
  {id:'heavy-explosive8',name:'8 Week Heavy / Explosive Program',category:'Strength + Power',difficulty:'Intermediate',weeksCount:8,daysPerWeek:4,source:'New Program.docx',description:'Eight-week bench/squat/deadlift/clean plan.',transcriptionStatus:'source'},
  {id:'summer-swolstice',name:'Summer Swolstice',category:'Olympic + Conditioning',difficulty:'Intermediate',weeksCount:8,daysPerWeek:4,source:'Summer Swolstice Template.docx',description:'Olympic lifting, strength, and conditioning template.',transcriptionStatus:'source'},
  {id:'raider',name:'Raider',category:'Tactical',difficulty:'Advanced',weeksCount:8,daysPerWeek:5,source:'Raider.docx',description:'Tactical strength and stamina program.',transcriptionStatus:'source'},
  {id:'training12',name:'12 Week Training Program',category:'Bodybuilding',difficulty:'Intermediate',weeksCount:12,daysPerWeek:5,source:'12 Week Training Program.xlsx',description:'Multi-block program using Burst, Y3T, FST-7, and negative-training phases.',transcriptionStatus:'source'},
  {id:'powerbuild',name:'Powerbuild',category:'Powerbuilding',difficulty:'Intermediate',weeksCount:12,daysPerWeek:4,source:'Powerbuild.xlsx',description:'Three-month powerbuilding workbook.',transcriptionStatus:'source'},
  {id:'occam',name:"Occam's Protocol",category:'Minimalist',difficulty:'Beginner',weeksCount:8,daysPerWeek:2,source:"Occam's Protocol Tracking.xlsx",description:'Minimalist strength/mass protocol.',transcriptionStatus:'source'},
  {id:'primer4',name:'Primer 4 Program',category:'General',difficulty:'Intermediate',weeksCount:4,daysPerWeek:4,source:'Primer 4 Program.xlsx',description:'Four-week training template.',transcriptionStatus:'source'},

  // Missing items from Workouts.zip added back into the catalog.
  // Exact week/day prescriptions are intentionally not invented when the original
  // source file is not currently available for verification.
  {id:'ranger-selection-12',name:'12 Week Ranger Assessment & Selection',category:'Tactical',difficulty:'Advanced',weeksCount:12,daysPerWeek:null,source:'Workouts.zip · PDF',description:'Twelve-week Ranger assessment and selection preparation program from the original archive.',transcriptionStatus:'source'},
  {id:'60-days-fit',name:'60 Days to Fit',category:'General',difficulty:'Varies',weeksCount:null,daysPerWeek:null,durationLabel:'60 days',source:'Workouts.zip · PDF',description:'Sixty-day fitness program from the original archive.',transcriptionStatus:'source'},
  {id:'every-day-carry',name:'Every.Day.Carry',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · PDF',description:'Every.Day.Carry training program from the original archive.',transcriptionStatus:'source'},
  {id:'pump-dragon',name:'Pump Dragon',category:'Bodybuilding',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · PDF',description:'Pump Dragon program from the original archive.',transcriptionStatus:'source'},
  {id:'zach-even-esh',name:'Zach Even-Esh Strength & Conditioning',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · PDF',description:'Strength and conditioning program from the original archive.',transcriptionStatus:'source'},
  {id:'street-parking-db',name:'Street Parking Dumbbell Strength',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · PDF',description:'Dumbbell-focused strength program from the original archive.',transcriptionStatus:'source'},
  {id:'vaughn-weightlifting',name:'Vaughn Weightlifting',category:'Olympic + Strength',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · PDF',description:'Weightlifting program from the original archive.',transcriptionStatus:'source'},
  {id:'rowing-program',name:'Rowing Program',category:'Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · PDF',description:'Rowing-focused program from the original archive.',transcriptionStatus:'source'},
  {id:'pause-squat-deadlift',name:'Pause Squat / Deadlift Cycle',category:'Specialization',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · XLSX',description:'Pause squat and deadlift cycle from the original archive.',transcriptionStatus:'source'},
  {id:'9-by-5',name:'9 by 5',category:'Strength',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · DOCX',description:'9 by 5 strength program from the original archive.',transcriptionStatus:'source'},
  {id:'915-program',name:'915 Program',category:'Strength',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · spreadsheet/document',description:'915 program from the original archive.',transcriptionStatus:'source'},
  {id:'adab-cycle-1',name:'ADAB Cycle 1',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · XLSX',description:'ADAB Cycle 1 from the original archive.',transcriptionStatus:'source'},
  {id:'beginners-jan-2016',name:'Beginners Program - Jan 2016',category:'General',difficulty:'Beginner',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · DOCX/XLSX',description:'Beginner program dated January 2016 from the original archive.',transcriptionStatus:'source'},
  {id:'build-muscle',name:'Build Muscle',category:'Bodybuilding',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · XLSX',description:'Build Muscle program from the original archive.',transcriptionStatus:'source'},
  {id:'critical-mass',name:'Critical Mass',category:'Bodybuilding',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · XLSX',description:'Critical Mass program from the original archive.',transcriptionStatus:'source'},
  {id:'hiit-strength-trainer',name:'HIIT Strength Trainer',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · DOCX',description:'HIIT and strength program from the original archive.',transcriptionStatus:'source'},
  {id:'ndp-531',name:'NDP 5/3/1',category:'Strength',difficulty:'Intermediate',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · XLSX',description:'5/3/1-based NDP program from the original archive.',transcriptionStatus:'source'},
  {id:'osbc-new',name:'OSBC New Program',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · DOCX',description:'OSBC program from the original archive.',transcriptionStatus:'source'},
  {id:'pause-dead-squat-cycles',name:'Pause + Dead Squat Cycles',category:'Specialization',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · DOCX',description:'Pause and dead-squat cycle program from the original archive.',transcriptionStatus:'source'},
  {id:'ppsa-21-party',name:'PPSA 21 to Party',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · DOCX',description:'PPSA 21 to Party program from the original archive.',transcriptionStatus:'source'},
  {id:'ppsa-meat-wagon',name:'PPSA Meat Wagon',category:'Strength + Conditioning',difficulty:'Varies',weeksCount:null,daysPerWeek:null,source:'Workouts.zip · DOCX',description:'PPSA Meat Wagon program from the original archive.',transcriptionStatus:'source'},
]

const verifiedById = Object.fromEntries(verifiedSourcePrograms.map(p=>[p.id,p]))
const catalogBase = [...archivePrograms,...referenceArchivePrograms]
const catalogIds = new Set(catalogBase.map(p=>p.id))

export const allArchivePrograms = [
  ...catalogBase.map(p=>verifiedById[p.id] ? {...p,...verifiedById[p.id]} : p),
  ...verifiedSourcePrograms.filter(p=>!catalogIds.has(p.id)),
]
export const archiveProgramById = Object.fromEntries(allArchivePrograms.map(p=>[p.id,p]))

function archiveExerciseRest(program,item) {
  const name=String(item?.name||'').toLowerCase()
  const rx=String(item?.prescription||'').toLowerCase()
  const category=String(program?.category||'').toLowerCase()

  if (/metcon|conditioning|prowler|sled|run|row|bike|burpee/.test(name)) return 60
  if (/curl|triceps|raise|abs|core|calf|fly|pushup/.test(name)) return 60
  if (/pullup|pulldown|row|lunge|split squat|ham curl|good morning|carry/.test(name)) return 75
  if (/snatch|clean|jerk|squat|deadlift|bench|press/.test(name)) {
    if (/1x|2x|3x|4x|5x|single|double|triple|@8[0-9]|@9[0-9]|@100|max/.test(rx)) return 180
    if (/8x|10x|12x|15x|20x|hypertrophy/.test(rx) || /bodybuilding/.test(category)) return 90
    return 120
  }
  if (/olympic|strength|powerlifting|specialization/.test(category)) return 120
  if (/bodybuilding|powerbuilding/.test(category)) return 75
  return 90
}

export function makePlannedFromArchive(program, week, dayIndex, scheduledDate) {
  const days = program.getWeek ? program.getWeek(week) : [day(`Week ${week} - Source workout`,[
    ex('Source program session','Use the original program prescription for this day','Add/edit exercises below as needed.')
  ])]
  const chosen = days[Math.max(0,Math.min(days.length-1,dayIndex))]
  return {
    scheduled_date: scheduledDate,
    title: chosen.title,
    source_program_name: program.name,
    source_week: week,
    source_day: chosen.title,
    workout: {
      version:2,
      type:'flexible',
      archive_program_id:program.id,
      source:program.source,
      notes:chosen.note || '',
      exercises:(chosen.exercises || []).map((item,i)=>({...item,id:`e${i+1}`,rest_seconds:archiveExerciseRest(program,item),result:'',done:false})),
      sleep:'', energy:'', pain:'', rpe:'', bodyweight:'', note:'',
    },
    status:'planned',
  }
}
