import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { PlatformProgress, PlanPage, AdminPanel } from './platform'
import { PlannedWorkoutRunner, ExerciseHistoryStrip, InstallAppButton, ExportDataButton, SharedTimer } from './productFeatures'
import { WhiteboardPage } from './whiteboard'
import { TrainingTimer } from './trainingTools'
import { WorkoutCoach, MetconTracker, AccountSecurityPanel, BackupRestorePanel, WorkoutSettingsPanel } from './advancedFeatures'
import { archiveProgramById, makePlannedFromArchive } from './archivePrograms'

const lifts = ['Squat', 'Bench', 'Deadlift', 'Press']
const repeatSets = (count, pct, reps, pctLabel) =>
  Array.from({ length: count }, () => ({ pct, reps, pctLabel: pctLabel || (pct != null ? pct + '%' : '') }))

const dayNames = { Squat:'Mon', Bench:'Tue', Deadlift:'Thu', Press:'Fri' }

const programs = {
  'andy-hybrid-12': {
    name:'12 Week Hybrid',
    shortName:'12W Hybrid',
    dbName:'12 Week Andy Hybrid',
    weeksCount:12,
    basis:'tm',
    description:'Strength-first 5/3/1-style training, assistance, and conditioning. Best all-around starting point.',
    phases:{
      1:'Leader 1',2:'Leader 1',3:'Leader 1',4:'Leader 2',5:'Leader 2',6:'Leader 2',
      7:'Deload',8:'Anchor',9:'Anchor',10:'Anchor',11:'TM Test',12:'Deload / Rebase'
    },
    main:{
      1:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      2:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5}],
      3:[{pct:75,reps:5},{pct:85,reps:5},{pct:95,reps:5}],
      4:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      5:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5}],
      6:[{pct:75,reps:5},{pct:85,reps:5},{pct:95,reps:5}],
      7:[{pct:40,reps:5},{pct:50,reps:5},{pct:60,reps:5}],
      8:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:'5+'}],
      9:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:'3+'}],
      10:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:'1+'}],
      11:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:3}],
      12:[{pct:40,reps:5},{pct:50,reps:5},{pct:60,reps:5}],
    },
    secondary:{
      1:{label:'BACKOFF',title:'FSL 5x5 @ 65%',pct:65},
      2:{label:'BACKOFF',title:'FSL 5x5 @ 70%',pct:70},
      3:{label:'BACKOFF',title:'FSL 5x5 @ 75%',pct:75},
      4:{label:'BACKOFF',title:'BBB 5x10 @ 50%',pct:50},
      5:{label:'BACKOFF',title:'BBB 5x10 @ 55%',pct:55},
      6:{label:'BACKOFF',title:'BBB 5x10 @ 60%',pct:60},
      7:{label:'BACKOFF',title:'2x5 @ 50%',pct:50},
      8:{label:'BACKOFF',title:'FSL 3x5',pct:65},
      9:{label:'BACKOFF',title:'FSL 3x5',pct:70},
      10:{label:'BACKOFF',title:'FSL 3x5',pct:75},
      11:{label:'TM TEST',title:'100% TM x 3-5',pct:100},
      12:{label:'BACKOFF',title:'2x5 @ 50%',pct:50},
    },
    assistance:{
      Squat:['DB Split Squat','Row','Leg Raises'],
      Bench:['Incline DB / Dips','Pullups','Triceps'],
      Deadlift:['RDL / Back Raise','Row','Abs'],
      Press:['DB Press','Pullups','Curls / Face Pulls'],
    },
    conditioning:(week,lift) => {
      if (week <= 3) return 'Easy only'
      if (week <= 6) return lift === 'Press' ? '1 short moderate session' : 'None'
      if (week === 7) return 'None'
      if (week <= 10) return lift === 'Press' ? '1 hard + 1 easy' : 'None'
      if (week === 11) return 'Easy only'
      return 'Optional performance test'
    }
  },

  'powerbuilding-8': {
    name:'8 Week Powerbuilding',
    shortName:'8W Powerbuilding',
    dbName:'8 Week Powerbuilding',
    weeksCount:8,
    basis:'e1rm',
    description:'More muscle-building volume while keeping squat, bench, deadlift, and press moving.',
    phases:{1:'Volume',2:'Volume',3:'Volume',4:'Deload',5:'Strength',6:'Strength',7:'Strength',8:'Performance'},
    main:{
      1:repeatSets(4,70,6),
      2:repeatSets(4,72.5,6),
      3:repeatSets(4,75,6),
      4:repeatSets(3,60,5),
      5:repeatSets(5,75,5),
      6:repeatSets(5,80,4),
      7:repeatSets(6,82.5,3,'82.5–85%'),
      8:[{pct:null,reps:'3-5',pctLabel:'Top set @ RPE 8'}, ...repeatSets(2,70,5)],
    },
    assistance:{
      Squat:['RDL 3x8','Bulgarian Split Squat 3x10','Calf 3x15','Abs 3x12'],
      Bench:['Row 4x8','Strict Press 3x8','Pullups 4 sets','Triceps 3x12'],
      Deadlift:['Front Squat 3x8','Ham Curl 3x12','Reverse Lunge 3x10/leg','Carry 4x40 yd'],
      Press:['Incline DB 4x10','Pulldown 3x12','Chest-Supported Row 3x12','Lateral Raise 3x15','Curl + Pushdown 3x12'],
    },
    conditioning:(week,lift) => {
      if (lift === 'Squat') return 'Easy carry/sled 10 min'
      if (lift === 'Deadlift') return '20-30 min Zone 2 optional'
      if (lift === 'Press') return '8-12 min short metcon optional'
      return 'None'
    }
  },

  'strength-power-6': {
    name:'6 Week Strength + Power',
    shortName:'6W Strength + Power',
    dbName:'6 Week Strength-Power',
    weeksCount:6,
    basis:'e1rm',
    description:'Heavy strength with speed work, jumps, cleans, and short conditioning.',
    phases:{1:'Base',2:'Build',3:'Build',4:'Deload',5:'Heavy',6:'Peak'},
    main:{
      1:repeatSets(5,70,5),
      2:repeatSets(5,75,4),
      3:repeatSets(6,80,3),
      4:repeatSets(3,60,5),
      5:repeatSets(5,82.5,3,'82.5–85%'),
      6:[{pct:null,reps:3,pctLabel:'Top triple @ RPE 8'}, ...repeatSets(3,80,3)],
    },
    secondaryByLift:{
      Squat:{label:'POWER / SPEED',title:'Bench speed 6x2 @ 55-60% + Box Jump 3x3'},
      Bench:{label:'POWER / SPEED',title:'Push Press 5x3 @ RPE 6-7'},
      Deadlift:{label:'POWER / SPEED',title:'Squat speed 6x2 @ 55-60%'},
      Press:{label:'POWER / SPEED',title:'Power Clean 5x2 @ RPE 6-7'},
    },
    assistance:{
      Squat:['Split Squat 3x8','Abs 3x12'],
      Bench:['Row 4x8','Pullups 4 sets','Triceps 3x10'],
      Deadlift:['RDL 3x8','Ham Curl 3x12','Carry 4x40 yd'],
      Press:['Incline DB 3x10','Row 3x10','Curls 3x12'],
    },
    conditioning:(week,lift) => {
      if (lift === 'Squat') return 'Easy 10-15 min'
      if (lift === 'Press') return 'Short row/sled 8-10 min'
      return 'None'
    }
  },

  'andy-531-original-6': {
    name:'Original 5/3/1 + Jokers',
    shortName:'5/3/1 + Jokers',
    dbName:'Andy Original 5/3/1 + Jokers',
    weeksCount:6,
    basis:'tm',
    description:'From Andy_531 Spreadsheet.xlsx in your archive: three FSL weeks followed by three Joker-set weeks.',
    phases:{1:'FSL',2:'FSL',3:'FSL',4:'Jokers',5:'Jokers',6:'Jokers'},
    main:{
      1:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:'5+'}],
      2:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:'3+'}],
      3:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:'1+'}],
      4:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:'5+'}],
      5:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:'3+'}],
      6:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:'1+'}],
    },
    secondary:{
      1:{label:'FSL',title:'First Set Last 5x5',pct:65},
      2:{label:'FSL',title:'First Set Last 5x5',pct:70},
      3:{label:'FSL',title:'First Set Last 5x5',pct:75},
      4:{label:'BACKOFF',title:'First-set backoff 1x5',pct:65},
      5:{label:'BACKOFF',title:'First-set backoff 1x5',pct:70},
      6:{label:'BACKOFF',title:'First-set backoff 1x5',pct:75},
    },
    assistance:{
      Squat:['Leg / core assistance'],
      Bench:['Pull / triceps assistance'],
      Deadlift:['Back / core assistance'],
      Press:['Pull / arms assistance'],
    },
    conditioning:() => 'Optional / easy'
  },

  'new-531-leader-anchor-11': {
    name:'New 5/3/1 Leader + Anchor',
    shortName:'New 5/3/1',
    dbName:'New 5/3/1 Leader + Anchor',
    weeksCount:11,
    basis:'tm',
    description:'From NEW 531 PROGRAM.docx: two leader cycles, 7th-week deload, one anchor cycle, then a training-max test.',
    phases:{1:'Leader 1',2:'Leader 1',3:'Leader 1',4:'Leader 2',5:'Leader 2',6:'Leader 2',7:'7th Week Deload',8:'Anchor',9:'Anchor',10:'Anchor',11:'TM Test'},
    main:{
      1:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:3}],
      2:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:'5+'}],
      3:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:1}],
      4:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:3}],
      5:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:'5+'}],
      6:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:1}],
      7:[{pct:70,reps:5},{pct:80,reps:3},{pct:100,reps:1}],
      8:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:'5+'}],
      9:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:'3+'}],
      10:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:'1+'}],
      11:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5},{pct:100,reps:'3-5'}],
    },
    secondary:{
      1:{label:'FSL',title:'FSL 5x5 @ 70%',pct:70},
      2:{label:'FSL',title:'FSL 5x5 @ 65%',pct:65},
      3:{label:'FSL',title:'FSL 5x5 @ 75%',pct:75},
      4:{label:'FSL',title:'FSL 5x5 @ 70%',pct:70},
      5:{label:'FSL',title:'FSL 5x5 @ 65%',pct:65},
      6:{label:'FSL',title:'FSL 5x5 @ 75%',pct:75},
      7:{label:'DELOAD',title:'Light assistance only',pct:null},
      8:{label:'WIDOWMAKER',title:'1x20 @ 65%',pct:65},
      9:{label:'WIDOWMAKER',title:'1x20 @ 70%',pct:70},
      10:{label:'WIDOWMAKER',title:'1x20 @ 75%',pct:75},
      11:{label:'TM TEST',title:'Fast, strong 3-5 reps at TM',pct:100},
    },
    assistance:{
      Squat:['Push 50-100 reps','Pull 50-100 reps','Single-leg / core 50-100 reps'],
      Bench:['Push 50-100 reps','Pull 50-100 reps','Single-leg / core 50-100 reps'],
      Deadlift:['Push 50-100 reps','Pull 50-100 reps','Single-leg / core 50-100 reps'],
      Press:['Push 50-100 reps','Pull 50-100 reps','Single-leg / core 50-100 reps'],
    },
    conditioning:(week) => week >= 8 && week <= 10 ? 'More hard conditioning allowed' : 'Easy / light conditioning'
  },

  'andy-bbb-jokers-11': {
    name:'5/3/1 BBB + Jokers',
    shortName:'BBB + Jokers',
    dbName:'Andy BBB + Jokers Archive',
    weeksCount:11,
    basis:'tm',
    description:'From ANDY 531-Boring But Big-Jokers.xlsx: two BBB leader cycles, deload, Joker/FSL anchor, and max test.',
    phases:{1:'BBB Leader 1',2:'BBB Leader 1',3:'BBB Leader 1',4:'BBB Leader 2',5:'BBB Leader 2',6:'BBB Leader 2',7:'7th Week Deload',8:'Joker Anchor',9:'Joker Anchor',10:'Joker Anchor',11:'Max Test'},
    main:{
      1:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5}],
      2:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      3:[{pct:75,reps:5},{pct:85,reps:5},{pct:95,reps:5}],
      4:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5}],
      5:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      6:[{pct:75,reps:5},{pct:85,reps:5},{pct:95,reps:5}],
      7:[{pct:50,reps:5},{pct:60,reps:5},{pct:70,reps:5},{pct:80,reps:3},{pct:90,reps:1},{pct:100,reps:1}],
      8:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      9:[{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5}],
      10:[{pct:75,reps:5},{pct:85,reps:5},{pct:95,reps:5}],
      11:[{pct:50,reps:5},{pct:60,reps:5},{pct:70,reps:5},{pct:80,reps:5},{pct:90,reps:5},{pct:100,reps:'3-5'}],
    },
    secondary:{
      1:{label:'BBB',title:'BBB 5x10 - source target',pct:null},
      2:{label:'BBB',title:'BBB 5x10 - source target',pct:null},
      3:{label:'BBB',title:'BBB 5x10 - source target',pct:null},
      4:{label:'BBB',title:'BBB 5x10 - source target',pct:null},
      5:{label:'BBB',title:'BBB 5x10 - source target',pct:null},
      6:{label:'BBB',title:'BBB 5x10 - source target',pct:null},
      7:{label:'DELOAD',title:'Assistance only after main work',pct:null},
      8:{label:'JOKERS + FSL',title:'Jokers 2x2 + FSL 5x5',pct:65},
      9:{label:'JOKERS + FSL',title:'Jokers 1x2 + 1x1 + FSL 5x5',pct:70},
      10:{label:'JOKERS + FSL',title:'Joker max-effort single + FSL',pct:75},
      11:{label:'MAX TEST',title:'Training max x 3-5',pct:100},
    },
    assistance:{
      Squat:['DB Front Squat','Single-leg Bulgarian Split Squat','Leg Raises'],
      Bench:['Dumbbell Rows','Pullups','Triceps / push assistance'],
      Deadlift:['Rows / posterior chain','Pullups','Core'],
      Press:['Rows / pullups','Arms','Core'],
    },
    conditioning:(week) => week === 7 || week === 11 ? 'Light / easy' : 'Easy conditioning'
  },

  'reset-4': {
    name:'4 Week Reset',
    shortName:'4W Reset',
    dbName:'4 Week Reset',
    weeksCount:4,
    basis:'tm',
    description:'Simple restart/rebuild when current strength is uncertain or you want an easier re-entry.',
    phases:{1:'Reset',2:'Build',3:'Build',4:'Deload'},
    main:{
      1:[{pct:65,reps:5},{pct:75,reps:5},{pct:85,reps:5}],
      2:[{pct:70,reps:3},{pct:80,reps:3},{pct:90,reps:3}],
      3:[{pct:75,reps:5},{pct:85,reps:3},{pct:95,reps:'1-3'}],
      4:[{pct:50,reps:5},{pct:60,reps:5},{pct:70,reps:5}],
    },
    secondary:{
      1:{label:'BACKOFF',title:'FSL 3x5 @ 65%',pct:65},
      2:{label:'BACKOFF',title:'FSL 3x5 @ 70%',pct:70},
      3:{label:'BACKOFF',title:'FSL 3x5 @ 75%',pct:75},
      4:{label:'BACKOFF',title:'2x5 @ 50%',pct:50},
    },
    rules:{1:'Cap RPE 7',2:'Cap RPE 8',3:'Cap RPE 8',4:'Deload'},
    assistance:{
      Squat:['DB Split Squat 3x8/leg','DB Row 4x10','Leg Raise 3x10'],
      Bench:['Incline DB Press 3x10','Pullups 4 sets','Triceps 3x12'],
      Deadlift:['RDL 3x8','Chest-Supported Row 3x10','Farmer Carry 4x40 yd'],
      Press:['DB Shoulder Press 3x10','Pullups 4 sets','Curls 3x12'],
    },
    conditioning:(week,lift) => {
      if (lift === 'Squat') return '10-15 min easy sled/carry or incline walk'
      if (lift === 'Press') return '8-12 min easy-moderate row/KB circuit'
      return 'None'
    }
  }
}

const programRestRules = {
  'andy-hybrid-12': {
    main:180,
    secondary:(week,secondary)=>{
      const title=String(secondary?.title||'')
      if(/BBB/i.test(title)) return 90
      if(/TM TEST|100%|test/i.test(title)) return 240
      return 120
    },
    assistance:75,
    conditioning:60,
  },
  'andy-531-original-6': {
    main:180,
    secondary:(week,secondary)=>/JOKER/i.test(String(secondary?.title||''))?180:120,
    assistance:(name)=>/Joker/i.test(name)?180:75,
    conditioning:60,
  },
  'new-531-leader-anchor-11': {
    main:(week)=>week===11?240:180,
    secondary:(week,secondary)=>{
      const title=String(secondary?.title||'')
      if(/TM TEST|training max/i.test(title)) return 240
      if(/WIDOWMAKER|1x20/i.test(title)) return 180
      if(/DELOAD|light/i.test(title)) return 60
      return 120
    },
    assistance:75,
    conditioning:60,
  },
  'andy-bbb-jokers-11': {
    main:(week)=>week===11?240:180,
    secondary:(week,secondary)=>{
      const title=String(secondary?.title||'')
      if(/BBB/i.test(title)) return 90
      if(/JOKER|max-effort|MAX TEST|Training max/i.test(title)) return 180
      if(/DELOAD|Assistance only/i.test(title)) return 60
      return 120
    },
    assistance:75,
    conditioning:60,
  },
  'powerbuilding-8': {
    main:(week)=>week===8?180:(week>=5?180:150),
    secondary:120,
    assistance:(name)=>/RDL|Front Squat|Strict Press|Incline DB|Bulgarian/i.test(name)?120:75,
    conditioning:60,
  },
  'strength-power-6': {
    main:(week)=>week===6?180:150,
    secondary:120,
    assistance:(name)=>/RDL|Incline DB|Row/i.test(name)?90:75,
    conditioning:60,
  },
  'reset-4': {
    main:(week)=>week===4?90:150,
    secondary:90,
    assistance:75,
    conditioning:60,
  },
}

function resolveRestValue(value,week,secondary,name) {
  return typeof value === 'function' ? value(week,secondary,name) : Number(value || 0)
}

function getProgramRest(programId,week,lift,secondary) {
  const rule=programRestRules[programId] || programRestRules['reset-4']
  return {
    main:resolveRestValue(rule.main,week,secondary,lift) || 150,
    secondary:resolveRestValue(rule.secondary,week,secondary,lift) || 90,
    assistance:(name)=>resolveRestValue(rule.assistance,week,secondary,name) || 75,
    conditioning:resolveRestValue(rule.conditioning,week,secondary,lift) || 60,
  }
}

const programOrder = ['andy-hybrid-12','andy-531-original-6','new-531-leader-anchor-11','andy-bbb-jokers-11','powerbuilding-8','strength-power-6','reset-4']
const dbNameToProgram = Object.fromEntries(Object.entries(programs).map(([id,p]) => [p.dbName,id]))
const defaultTms = { Squat:'', Bench:'', Deadlift:'', Press:'' }
const round5 = n => Math.round(n / 5) * 5
const appUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).toString()

function targetWeight(tm, pct, basis) {
  if (!tm || pct == null) return null
  const base = basis === 'e1rm' ? tm / 0.85 : tm
  return round5(base * pct / 100)
}

function getProgramWeek(programId, week, lift) {
  const program = programs[programId] || programs['andy-hybrid-12']
  const secondary=program.secondary?.[week] || program.secondaryByLift?.[lift] || null
  const jokers=programId==='andy-531-original-6' && week>=4 && week<=6
    ? [{label:'Joker 1'},{label:'Joker 2'}]
    : []
  return {
    programId,
    phase:program.phases[week],
    main:program.main[week] || [],
    secondary,
    jokers,
    assistance:program.assistance[lift] || [],
    conditioning:program.conditioning(week,lift),
    rule:program.rules?.[week] || '',
    rest:getProgramRest(programId,week,lift,secondary),
  }
}

function makeLog(programId, week, lift, tm) {
  const program = programs[programId]
  const plan = getProgramWeek(programId,week,lift)
  const secondaryTarget = plan.secondary?.pct != null ? targetWeight(tm,plan.secondary.pct,program.basis) : ''

  return {
    version:8,
    main:plan.main.map(set => ({
      ...set,
      weight:set.pct != null ? targetWeight(tm,set.pct,program.basis) : '',
      actualReps:Number.parseInt(String(set.reps),10) || '',
      done:false,
    })),
    backoffWeight:secondaryTarget || '',
    backoffNote:'',
    backoffSets:prescribedSetProgress(plan.secondary?.title),
    jokerSets:(plan.jokers||[]).map((item,i)=>({...item,index:i,weight:'',reps:'',done:false})),
    assistance:plan.assistance.map(name => ({name,result:'',setProgress:prescribedSetProgress(name)})),
    conditioning:'',
    conditioningEnabled:false,
    metcon:{name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'},
    sleep:'',
    energy:'',
    pain:'',
    rpe:'',
    bodyweight:'',
    note:'',
    complete:false,
  }
}

function normalizeLog(saved, programId, week, lift, tm) {
  const base = makeLog(programId,week,lift,tm)
  if (!saved) return base
  return {
    ...base,
    ...saved,
    version:8,
    main:base.main.map((item,i) => ({...item,...(saved.main?.[i] || {})})),
    backoffSets:base.backoffSets.map((item,i)=>({...item,...(saved.backoffSets?.[i]||{})})),
    jokerSets:base.jokerSets.map((item,i)=>({...item,...(saved.jokerSets?.[i]||{}),label:item.label,index:i})),
    assistance:base.assistance.map(item => {
      const prior=(saved.assistance||[]).find(x=>x?.name===item.name) || {}
      return {
        ...item,
        ...prior,
        name:item.name,
        setProgress:item.setProgress.map((set,j)=>({...set,...(prior.setProgress?.[j]||{})}))
      }
    }),
  }
}

function e1rm(weight, reps) {
  const w = Number(weight || 0)
  const r = Number(reps || 0)
  if (!w || !r) return 0
  return w * (1 + r / 30)
}

function parseLoggedVolume(value) {
  if (!value) return 0
  const text = String(value).replace(/,/g,'').replace(/[×X]/g,'x')
  const match = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i)
  if (!match) return 0
  const weight = Number(match[1])
  const reps = Number(match[2])
  const sets = match[3] ? Number(match[3]) : 1
  return weight * reps * sets
}

function secondarySetsReps(title) {
  const match = String(title || '').match(/(\d+)\s*x\s*(\d+)/i)
  return match ? {sets:Number(match[1]),reps:Number(match[2])} : null
}

function prescribedSetProgress(text) {
  const value=String(text || '')
  const rx=value.match(/(\d+)\s*[x×]\s*(\d+)/i)
  if (rx) {
    const sets=Number(rx[1]),reps=Number(rx[2])
    return Array.from({length:sets},(_,i)=>({set:i+1,reps,done:false}))
  }
  const setsOnly=value.match(/(\d+)\s*sets?/i)
  if (setsOnly) {
    const sets=Number(setsOnly[1])
    return Array.from({length:sets},(_,i)=>({set:i+1,reps:null,done:false}))
  }
  return []
}

function metricsForWorkout(workout, programId, week, lift) {
  if (!workout) return {volume:0,estimated1rm:0,bestSet:null}
  const plan = getProgramWeek(programId,week,lift)
  let volume = 0
  let estimated1rm = 0
  let bestSet = null

  ;(workout.main || []).forEach(set => {
    const weight = Number(set.weight || 0)
    const reps = Number(set.actualReps || 0)
    if (weight && reps) {
      volume += weight * reps
      const estimate = e1rm(weight,reps)
      if (estimate > estimated1rm) {
        estimated1rm = estimate
        bestSet = {weight,reps}
      }
    }
  })

  const secondaryRx = secondarySetsReps(plan.secondary?.title)
  if (secondaryRx && Number(workout.backoffWeight || 0)) {
    const tracked=Array.isArray(workout.backoffSets)&&workout.backoffSets.length
    const completedSets=tracked ? workout.backoffSets.filter(x=>x.done).length : secondaryRx.sets
    volume += Number(workout.backoffWeight) * secondaryRx.reps * completedSets
  } else {
    volume += parseLoggedVolume(workout.backoffNote)
  }

  ;(workout.jokerSets || []).forEach(set => {
    const weight=Number(set.weight||0),reps=Number(set.reps||0)
    if(weight&&reps){
      volume+=weight*reps
      const estimate=e1rm(weight,reps)
      if(estimate>estimated1rm){estimated1rm=estimate;bestSet={weight,reps}}
    }
  })

  ;(workout.assistance || []).forEach(item => {
    volume += parseLoggedVolume(item.result)
  })

  return {volume,estimated1rm,bestSet}
}

function metricsForRow(row) {
  const programId = dbNameToProgram[row.program] || 'andy-hybrid-12'
  return metricsForWorkout(row.workout,programId,row.week,row.lift)
}

function formatWeight(value) {
  return Math.round(Number(value || 0)).toLocaleString()
}

function buildProgress(history) {
  const completed = history
    .filter(row => row.completed_at)
    .sort((a,b) => new Date(a.completed_at) - new Date(b.completed_at))
    .map(row => ({...row,_metrics:metricsForRow(row)}))

  const now = Date.now()
  const withinDays = (row,days) => now - new Date(row.completed_at).getTime() <= days * 86400000
  const totalVolume = completed.reduce((sum,row) => sum + row._metrics.volume,0)
  const volume7 = completed.filter(r => withinDays(r,7)).reduce((sum,row) => sum + row._metrics.volume,0)
  const volume30 = completed.filter(r => withinDays(r,30)).reduce((sum,row) => sum + row._metrics.volume,0)

  const bodyRows = completed.filter(row => Number(row.workout?.bodyweight || 0))
  const latestBodyweight = bodyRows.at(-1)?.workout?.bodyweight || null

  const strength = {}
  lifts.forEach(lift => {
    const rows = completed.filter(row => row.lift === lift && row._metrics.estimated1rm > 0)
    if (!rows.length) {
      strength[lift] = null
      return
    }
    const first = rows[0]._metrics.estimated1rm
    const latest = rows.at(-1)._metrics.estimated1rm
    const best = Math.max(...rows.map(row => row._metrics.estimated1rm))
    const bestRow = rows.find(row => row._metrics.estimated1rm === best)
    strength[lift] = {
      first,
      latest,
      best,
      delta:latest-first,
      bestSet:bestRow?._metrics.bestSet || null,
    }
  })

  const weekly = Array.from({length:8},(_,i) => {
    const end = now - (7-i) * 7 * 86400000
    const start = end - 7 * 86400000
    const volume = completed
      .filter(row => {
        const t = new Date(row.completed_at).getTime()
        return t > start && t <= end
      })
      .reduce((sum,row) => sum + row._metrics.volume,0)
    return {label:i === 7 ? 'This week' : (7-i) + 'w ago',volume}
  })

  return {
    completed,
    totalVolume,
    volume7,
    volume30,
    latestBodyweight,
    strength,
    weekly,
  }
}

function randomJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)]
  return code
}

function movementAlternativesFor(name) {
  const value=String(name||'').toLowerCase()
  if(value==='squat' || /\bsquat\b/.test(value)) return ['Front Squat','Safety-Bar Squat','Goblet Squat','Leg Press']
  if(value==='bench' || /bench/.test(value)) return ['DB Bench Press','Incline DB Press','Pushup','Machine Chest Press']
  if(value==='deadlift' || /deadlift/.test(value)) return ['Trap-Bar Deadlift','Romanian Deadlift','Rack Pull','Kettlebell Deadlift']
  if(value==='press' || /strict press|overhead|shoulder press/.test(value)) return ['DB Shoulder Press','Landmine Press','Machine Shoulder Press','Incline DB Press']
  if(/leg.*core|core.*leg/.test(value)) return ['Bulgarian Split Squat','Reverse Lunge','Pallof Press','Dead Bug']
  if(/pull.*triceps/.test(value)) return ['Chest-Supported DB Row','Lat Pulldown','Cable Row','Triceps Pushdown']
  if(/back.*core/.test(value)) return ['Chest-Supported DB Row','Ring Row','Dead Bug','Side Plank']
  if(/pull.*arms/.test(value)) return ['Pullup / Assisted Pullup','Lat Pulldown','One-Arm DB Row','DB Curl']
  if(/row/.test(value)) return ['Chest-Supported DB Row','Cable Row','Ring Row','Lat Pulldown']
  if(/lunge|split squat/.test(value)) return ['Reverse Lunge','Step-Up','Goblet Split Squat','Single-Leg Press']
  return []
}

function AlternativeMovements({name}) {
  const [open,setOpen]=useState(false)
  const items=movementAlternativesFor(name)
  if(!items.length)return null
  return <span className="alternative-movements">
    <button type="button" className="movement-alt-button" onClick={()=>setOpen(v=>!v)}>Alternatives</button>
    {open&&<span className="movement-alt-popover"><b>Alternative movements</b>{items.map(item=><span key={item}>{item}</span>)}</span>}
  </span>
}

function NumericInput({value,onChange,placeholder,step=1}) {
  const adjust = delta => onChange(Math.max(0,Number(value || 0)+delta))
  return (
    <div className="numeric">
      <button type="button" onClick={() => adjust(-step)}>−{step}</button>
      <input
        type="number"
        inputMode="decimal"
        enterKeyHint="done"
        value={value}
        placeholder={placeholder || '0'}
        onFocus={e => e.currentTarget.select()}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <button type="button" onClick={() => adjust(step)}>+{step}</button>
    </div>
  )
}

function AuthScreen() {
  const [mode,setMode] = useState('signin')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    const cleanEmail = email.trim()

    if (mode === 'signup') {
      const {data,error} = await supabase.auth.signUp({
        email:cleanEmail,
        password,
        options:{
          emailRedirectTo:appUrl(),
          data:{active_program:'andy-hybrid-12'}
        }
      })

      if (error) {
        setMessage(error.message)
      } else if (data.session) {
        setMessage('')
      } else {
        setMessage('Account created. Check your email and click the confirmation link, then sign in.')
      }
    } else {
      const {error} = await supabase.auth.signInWithPassword({
        email:cleanEmail,
        password
      })
      if (error) setMessage(error.message)
    }

    setBusy(false)
  }

  const forgotPassword = async () => {
    if (!email.trim()) {
      setMessage('Enter the account email first.')
      return
    }
    setBusy(true)
    setMessage('')
    const {error} = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl()
    })
    setMessage(error ? error.message : 'Password reset requested. Check the inbox/spam folder for that account.')
    setBusy(false)
  }

  const resendConfirmation = async () => {
    if (!email.trim()) { setMessage('Enter the account email first.'); return }
    setBusy(true)
    const {error}=await supabase.auth.resend({
      type:'signup',
      email:email.trim(),
      options:{emailRedirectTo:appUrl()}
    })
    setMessage(error?error.message:'Confirmation email requested. Check inbox/spam.')
    setBusy(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">WORKOUTBOARD</div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-sub">{mode === 'signin' ? 'Use your WorkoutBoard email and password.' : 'Just enter an email and password.'}</p>

        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => {setMode('signin');setMessage('')}}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => {setMode('signup');setMessage('')}}>Create account</button>
        </div>

        <form onSubmit={submit}>
          <label>Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength="10"
              required
            />
          </label>

          <button className="primary" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'signin' && (
          <button className="forgot-button visible-forgot" type="button" onClick={forgotPassword} disabled={busy}>
            Forgot password?
          </button>
        )}
        {mode === 'signup' && message && (
          <button className="forgot-button visible-forgot" type="button" onClick={resendConfirmation} disabled={busy}>
            Resend confirmation email
          </button>
        )}

        {message && <div className="auth-message">{message}</div>}
      </section>
    </main>
  )
}

function RecoveryScreen({onDone}) {
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)

  const save = async e => {
    e.preventDefault()
    setBusy(true)
    const {error} = await supabase.auth.updateUser({password})
    if (error) {
      setMessage(error.message)
      setBusy(false)
      return
    }
    setMessage('Password updated. You can sign in now.')
    await supabase.auth.signOut()
    onDone()
    setBusy(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">WORKOUTBOARD</div>
        <h1>Set new password</h1>
        <p className="auth-sub">Choose a new password for this account.</p>
        <form onSubmit={save}>
          <label>New password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength="10" required /></label>
          <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
        {message && <div className="auth-message">{message}</div>}
      </section>
    </main>
  )
}

function App() {
  const [session,setSession] = useState(null)
  const [authLoading,setAuthLoading] = useState(true)
  const [passwordRecovery,setPasswordRecovery] = useState(false)
  const [dataLoading,setDataLoading] = useState(true)
  const [activeTab,setActiveTab] = useState(() => {
    const params=new URLSearchParams(window.location.search)
    return params.has('join') ? 'together' : params.has('program') ? 'program' : 'today'
  })
  const [profile,setProfile] = useState(null)
  const [activeProgram,setActiveProgram] = useState('andy-hybrid-12')
  const [week,setWeek] = useState(1)
  const [lift,setLift] = useState('Squat')
  const [trainingMaxes,setTrainingMaxes] = useState(defaultTms)
  const [history,setHistory] = useState([])
  const [saveState,setSaveState] = useState('Saved')
  const [inviteState,setInviteState] = useState('')
  const [log,setLog] = useState(() => makeLog('andy-hybrid-12',1,'Squat',0))

  const [togetherReady,setTogetherReady] = useState(null)
  const [activeSession,setActiveSession] = useState(null)
  const [participants,setParticipants] = useState([])
  const [sessionResults,setSessionResults] = useState([])
  const [joinCode,setJoinCode] = useState('')
  const [togetherMessage,setTogetherMessage] = useState('')
  const [sharedWorkoutActive,setSharedWorkoutActive] = useState(false)
  const [isAdmin,setIsAdmin] = useState(false)
  const [plannedToday,setPlannedToday] = useState(null)
  const [showRegularToday,setShowRegularToday] = useState(false)
  const [togetherTracking,setTogetherTracking] = useState([])
  const [togetherProgramKey,setTogetherProgramKey] = useState('')
  const [togetherWeek,setTogetherWeek] = useState(1)
  const [togetherWorkoutIndex,setTogetherWorkoutIndex] = useState(0)
  const [trackedTodayInfo,setTrackedTodayInfo] = useState(null)
  const [togetherView,setTogetherView] = useState('live')
  const [conditioningOpen,setConditioningOpen] = useState(false)
  const [completionSummary,setCompletionSummary] = useState(null)
  const [extraWorkoutOpen,setExtraWorkoutOpen] = useState(false)
  const [nextDayPreviewOpen,setNextDayPreviewOpen] = useState(false)
  const [pendingWorkoutStart,setPendingWorkoutStart] = useState(null)
  const [todayCompletedWorkouts,setTodayCompletedWorkouts] = useState([])
  const [workoutStartError,setWorkoutStartError] = useState('')
  const [classicCancelConfirm,setClassicCancelConfirm] = useState(false)
  const [classicCancelling,setClassicCancelling] = useState(false)

  const personalProgram = programs[activeProgram]
  const sharedProgramId = activeSession ? (dbNameToProgram[activeSession.program] || activeProgram) : activeProgram
  const workoutProgramId = sharedWorkoutActive && activeSession ? sharedProgramId : activeProgram
  const workoutProgram = programs[workoutProgramId]
  const plan = getProgramWeek(workoutProgramId,week,lift)
  const tm = Number(trainingMaxes[lift] || 0)

  useEffect(() => {
    const prescribed=Boolean(plan.conditioning && plan.conditioning !== 'None' && !/^optional\b/i.test(String(plan.conditioning).trim()))
    setConditioningOpen(prescribed)
  },[workoutProgramId,week,lift])

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const {data:listener} = supabase.auth.onAuthStateChange((event,nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  },[])

  const loadOpenSession = async userId => {
    const {data:memberships,error} = await supabase
      .from('session_participants')
      .select('session_id,joined_at')
      .eq('user_id',userId)
      .order('joined_at',{ascending:false})
      .limit(10)

    if (error) {
      setTogetherReady(false)
      return
    }

    setTogetherReady(true)
    if (!memberships?.length) return

    const ids = memberships.map(item => item.session_id)
    const {data:sessions} = await supabase
      .from('shared_sessions')
      .select('*')
      .in('id',ids)
      .eq('status','open')
      .order('created_at',{ascending:false})
      .limit(1)

    if (sessions?.[0]) setActiveSession(sessions[0])
  }

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false

    const load = async () => {
      setDataLoading(true)
      const userId = session.user.id
      const today = new Date().toISOString().slice(0,10)
      const [{data:profileData},{data:tmData},{data:logsData},{data:todayPlans},{data:trackingData},{data:flexCompleted}] = await Promise.all([
        supabase.from('profiles').select('*').eq('id',userId).single(),
        supabase.from('training_maxes').select('*').eq('user_id',userId).single(),
        supabase.from('workout_logs').select('*').eq('user_id',userId).order('updated_at',{ascending:false}),
        supabase.from('planned_workouts').select('*').eq('user_id',userId).eq('scheduled_date',today).in('status',['planned','started','skipped']).order('created_at'),
        supabase.from('user_program_tracking').select('*').eq('user_id',userId).eq('status','tracking').order('updated_at',{ascending:false}),
        supabase.from('training_sessions').select('id,program,workout,completed_at').eq('user_id',userId).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(1000),
      ])

      if (cancelled) return

      const rows = logsData || []
      const profileProgram = profileData?.active_program
      const metaProgram = session.user.user_metadata?.active_program
      const latestProgram = rows[0]?.program ? dbNameToProgram[rows[0].program] : null
      const chosenProgram = programs[profileProgram] ? profileProgram : programs[metaProgram] ? metaProgram : latestProgram || 'andy-hybrid-12'
      const chosen = programs[chosenProgram]
      const currentWeek = Math.min(profileData?.current_week || 1,chosen.weeksCount)

      setProfile(profileData)
      setActiveProgram(chosenProgram)
      setWeek(currentWeek)
      setHistory(rows)

      let resolvedTodayPlan=(todayPlans||[]).find(row=>row.status==='planned'||row.status==='started') || null
      let nextTrackedInfo=null
      const activeArchiveTrack=(trackingData||[]).find(row=>String(row.program_key||'').startsWith('archive:'))
      if(activeArchiveTrack){
        const archiveId=String(activeArchiveTrack.program_key).slice(8)
        const trackedProgram=archiveProgramById[archiveId]
        if(trackedProgram?.getWeek && trackedProgram.weeksCount && trackedProgram.daysPerWeek){
          const completedTracked=(flexCompleted||[]).filter(row=>{
            if(new Date(row.completed_at).getTime()<new Date(activeArchiveTrack.started_at).getTime())return false
            return row.workout?.tracking_program_key===activeArchiveTrack.program_key || row.program===trackedProgram.name
          })
          const completedCount=completedTracked.length
          const total=Number(trackedProgram.weeksCount)*Number(trackedProgram.daysPerWeek)
          const completedToday=completedTracked.some(row=>String(row.completed_at||'').slice(0,10)===today)
          const workoutsToday=(flexCompleted||[]).filter(row=>String(row.completed_at||'').slice(0,10)===today).length
          const nextIndex=Math.min(completedCount,total)
          const nextWeek=Math.min(Number(trackedProgram.weeksCount),Math.floor(nextIndex/Number(trackedProgram.daysPerWeek))+1)
          const nextDayIndex=nextIndex%Number(trackedProgram.daysPerWeek)
          const nextDay=nextIndex<total ? trackedProgram.getWeek(nextWeek)?.[nextDayIndex] : null
          const upcoming=[]
          for(let offset=0;offset<3;offset++){
            const idx=nextIndex+offset
            if(idx>=total)break
            const w=Math.floor(idx/Number(trackedProgram.daysPerWeek))+1
            const di=idx%Number(trackedProgram.daysPerWeek)
            const d=trackedProgram.getWeek(w)?.[di]
            if(d)upcoming.push({week:w,dayIndex:di,title:d.title,note:d.note||'',exercises:d.exercises||[]})
          }
          nextTrackedInfo={
            key:activeArchiveTrack.program_key,
            archiveId,
            name:trackedProgram.name,
            completed:completedCount,
            total,
            completedToday,
            workoutsToday,
            nextWeek,
            nextDayIndex,
            nextTitle:nextDay?.title||'',
            upcoming,
            complete:completedCount>=total,
          }
          const cancelledTrackedToday=(todayPlans||[]).some(row=>row.status==='skipped'&&row.workout?.tracking_program_key===activeArchiveTrack.program_key)
          if(!resolvedTodayPlan && !completedToday && !cancelledTrackedToday && completedCount<total && nextDay){
            const plannedPayload=makePlannedFromArchive(trackedProgram,nextWeek,nextDayIndex,today)
            plannedPayload.workout={...plannedPayload.workout,tracking_program_key:activeArchiveTrack.program_key}
            const inserted=await supabase.from('planned_workouts').insert({...plannedPayload,user_id:userId}).select().single()
            if(!inserted.error)resolvedTodayPlan=inserted.data
          }
        }
      }

      setPlannedToday(resolvedTodayPlan)
      setTrackedTodayInfo(nextTrackedInfo)
      setTodayCompletedWorkouts((flexCompleted||[]).filter(row=>String(row.completed_at||'').slice(0,10)===today))
      setShowRegularToday(false)
      setTogetherTracking(trackingData || [])

      if (tmData) {
        setTrainingMaxes({
          Squat:tmData.squat ?? '',
          Bench:tmData.bench ?? '',
          Deadlift:tmData.deadlift ?? '',
          Press:tmData.press ?? '',
        })
      }

      const completed = new Set(rows.filter(r => r.program === chosen.dbName && r.week === currentWeek && r.completed_at).map(r => r.lift))
      setLift(lifts.find(x => !completed.has(x)) || 'Press')
      const {data:adminFlag} = await supabase.rpc('is_workout_admin')
      setIsAdmin(Boolean(adminFlag))
      setDataLoading(false)
      loadOpenSession(userId)
    }

    load()
    return () => { cancelled = true }
  },[session?.user?.id])

  const activatePlannedWorkout = data => {
    setWorkoutStartError('')
    setCompletionSummary(null)
    setExtraWorkoutOpen(false)
    setNextDayPreviewOpen(false)
    setPendingWorkoutStart(null)
    setPlannedToday(data)
    setShowRegularToday(false)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const startTrackedWorkout = async ({confirmed=false}={}) => {
    if(!session?.user || !trackedTodayInfo || trackedTodayInfo.complete)return
    if((trackedTodayInfo.workoutsToday||0)>0 && !confirmed){
      setPendingWorkoutStart({kind:'program',label:trackedTodayInfo.upcoming?.[0]?.title||'next program day'})
      return
    }
    const program=archiveProgramById[trackedTodayInfo.archiveId]
    const next=trackedTodayInfo.upcoming?.[0]
    if(!program?.getWeek || !next)return
    const today=new Date().toISOString().slice(0,10)
    const plannedPayload=makePlannedFromArchive(program,next.week,next.dayIndex,today)
    plannedPayload.workout={...plannedPayload.workout,tracking_program_key:trackedTodayInfo.key}
    const {data,error}=await supabase.from('planned_workouts').insert({...plannedPayload,user_id:session.user.id}).select().single()
    if(error){setWorkoutStartError(error.message);return}
    activatePlannedWorkout(data)
  }

  const startStandaloneWorkout = async (kind,{confirmed=false}={}) => {
    if(!session?.user)return
    const labels={free:'Free workout',run:'Run / Walk',conditioning:'Conditioning / Metcon'}
    if((trackedTodayInfo?.workoutsToday||0)>0 && !confirmed){
      setPendingWorkoutStart({kind,label:labels[kind]||'another workout'})
      return
    }
    const today=new Date().toISOString().slice(0,10)
    const metconBase={name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'}
    const workout={
      version:2,type:'flexible',standalone:true,
      exercises:[],
      sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',
      conditioningEnabled:kind!=='free',
      conditioning_prescribed:kind!=='free',
      metcon:kind==='run'?{...metconBase,format:'Distance',activity:'Run'}:metconBase,
    }
    const payload={
      user_id:session.user.id,
      scheduled_date:today,
      title:labels[kind]||'Additional workout',
      source_program_name:'Standalone workout',
      source_week:null,
      source_day:null,
      workout,
      status:'started',
    }
    const {data,error}=await supabase.from('planned_workouts').insert(payload).select().single()
    if(error){setWorkoutStartError(error.message);return}
    activatePlannedWorkout(data)
  }

  const confirmPendingWorkout = async () => {
    const pending=pendingWorkoutStart
    if(!pending)return
    if(pending.kind==='program') await startTrackedWorkout({confirmed:true})
    else await startStandaloneWorkout(pending.kind,{confirmed:true})
  }

  const refreshPlannedToday = async () => {
    if (!session?.user) return
    const today = new Date().toISOString().slice(0,10)
    const [{data},{data:completedRows}]=await Promise.all([
      supabase.from('planned_workouts').select('*')
        .eq('user_id',session.user.id).eq('scheduled_date',today)
        .in('status',['planned','started']).order('created_at').limit(1),
      supabase.from('training_sessions').select('id,title,program,week,total_volume,completed_at,workout')
        .eq('user_id',session.user.id).not('completed_at','is',null)
        .gte('completed_at',today+'T00:00:00').lte('completed_at',today+'T23:59:59.999')
        .order('completed_at',{ascending:false})
    ])
    setPlannedToday(data?.[0] || null)
    setTodayCompletedWorkouts(completedRows||[])
    setShowRegularToday(false)
  }

  useEffect(() => {
    if(activeTab==='whiteboard'){
      requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))
    }
  },[activeTab])

  const personalRows = useMemo(
    () => history.filter(row => row.program === personalProgram.dbName),
    [history,personalProgram.dbName]
  )

  const workoutRows = useMemo(
    () => history.filter(row => row.program === workoutProgram.dbName),
    [history,workoutProgram.dbName]
  )

  useEffect(() => {
    if (!session?.user || dataLoading) return
    const found = workoutRows.find(row => row.week === week && row.lift === lift)
    const cacheKey = `wb-draft-${session.user.id}-${workoutProgramId}-${week}-${lift}`
    let cached = null
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null') } catch {}
    setLog(normalizeLog(found?.workout || cached || null,workoutProgramId,week,lift,tm))
    setSaveState('Saved')
  },[workoutProgramId,week,lift,workoutRows,tm,dataLoading,session?.user?.id])

  useEffect(() => {
    if (!session?.user || dataLoading) return
    const cacheKey = `wb-draft-${session.user.id}-${workoutProgramId}-${week}-${lift}`
    try { localStorage.setItem(cacheKey,JSON.stringify(log)) } catch {}
  },[log,session?.user?.id,dataLoading,workoutProgramId,week,lift])

  const completedByWeek = useMemo(() => {
    const map = {}
    personalRows.filter(r => r.completed_at).forEach(r => {
      map[r.week] ||= new Set()
      map[r.week].add(r.lift)
    })
    return map
  },[personalRows])

  const completedHistory = useMemo(
    () => history.filter(r => r.completed_at).sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at))),
    [history]
  )

  const progress = useMemo(() => buildProgress(history),[history])

  const togetherProgramOptions = useMemo(() => {
    const options=[]
    for(const track of togetherTracking){
      if(String(track.program_key||'').startsWith('classic:')){
        const id=String(track.program_key).slice(8)
        const p=programs[id]
        if(p) options.push({key:track.program_key,kind:'classic',id,name:p.name,shortName:p.shortName,weeksCount:p.weeksCount,program:p})
      } else if(String(track.program_key||'').startsWith('archive:')){
        const id=String(track.program_key).slice(8)
        const p=archiveProgramById[id]
        if(p?.getWeek) options.push({key:track.program_key,kind:'archive',id,name:p.name,shortName:p.name,weeksCount:p.weeksCount,program:p})
      }
    }
    if(!options.length && programs[activeProgram]){
      const p=programs[activeProgram]
      options.push({key:'classic:'+activeProgram,kind:'classic',id:activeProgram,name:p.name,shortName:p.shortName,weeksCount:p.weeksCount,program:p})
    }
    return options
  },[togetherTracking,activeProgram])

  useEffect(() => {
    if(!togetherProgramOptions.length)return
    if(!togetherProgramOptions.some(p=>p.key===togetherProgramKey)){
      setTogetherProgramKey(togetherProgramOptions[0].key)
      setTogetherWeek(1)
      setTogetherWorkoutIndex(0)
    }
  },[togetherProgramOptions,togetherProgramKey])

  const togetherProgramChoice = togetherProgramOptions.find(p=>p.key===togetherProgramKey) || togetherProgramOptions[0] || null
  const togetherWorkoutChoices = useMemo(() => {
    if(!togetherProgramChoice)return []
    if(togetherProgramChoice.kind==='classic') return lifts.map(name=>({title:name+' Day',lift:name}))
    return togetherProgramChoice.program.getWeek(Math.max(1,Math.min(Number(togetherWeek||1),Number(togetherProgramChoice.weeksCount||1)))) || []
  },[togetherProgramChoice,togetherWeek])

  const previousWorkout = useMemo(() => {
    const rows = workoutRows.filter(r => r.lift === lift && r.completed_at).sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    return rows.find(r => !(r.week === week && r.lift === lift))?.workout || null
  },[workoutRows,lift,week])

  useEffect(() => {
    if(!session?.user || !profile || togetherReady===false)return
    const code=new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase()
    if(!code)return
    let cancelled=false
    const joinFromUrl=async()=>{
      setJoinCode(code)
      setTogetherMessage('Joining…')
      const {data:found,error}=await supabase
        .from('shared_sessions')
        .select('*')
        .eq('join_code',code)
        .eq('status','open')
        .single()
      if(cancelled)return
      if(error||!found){
        setTogetherMessage('No open session found with that code.')
        return
      }
      const displayName=profile?.display_name||session.user.email?.split('@')[0]||'You'
      const {error:joinError}=await supabase.from('session_participants').upsert({
        session_id:found.id,
        user_id:session.user.id,
        display_name:displayName,
      },{onConflict:'session_id,user_id'})
      if(cancelled)return
      if(joinError){
        setTogetherMessage(joinError.message)
        return
      }
      setActiveSession(found)
      setJoinCode('')
      setTogetherMessage('')
      setActiveTab('together')
      const url=new URL(window.location.href)
      url.searchParams.delete('join')
      window.history.replaceState({},'',url.pathname+url.search+url.hash)
      await refreshTogether(found.id)
    }
    joinFromUrl()
    return()=>{cancelled=true}
  },[session?.user?.id,profile?.id,togetherReady])

  const refreshTogether = async sessionId => {
    if (!sessionId) return
    const [{data:sessionData},{data:people},{data:results}] = await Promise.all([
      supabase.from('shared_sessions').select('*').eq('id',sessionId).single(),
      supabase.from('session_participants').select('*').eq('session_id',sessionId).order('joined_at'),
      supabase.from('session_results').select('*').eq('session_id',sessionId).order('updated_at',{ascending:false}),
    ])
    if (sessionData) setActiveSession(sessionData)
    setParticipants(people || [])
    setSessionResults(results || [])
  }

  useEffect(() => {
    if (!activeSession?.id || togetherReady !== true) return
    refreshTogether(activeSession.id)
    const timer = setInterval(() => refreshTogether(activeSession.id),5000)
    return () => clearInterval(timer)
  },[activeSession?.id,togetherReady])

  const updateMain = (i,field,value) => {
    setSaveState('Unsaved')
    setLog(v => ({...v,complete:false,main:v.main.map((set,idx) => idx === i ? {...set,[field]:value} : set)}))
  }

  const saveTrainingMaxes = async next => {
    setTrainingMaxes(next)
    if (!session?.user) return
    await supabase.from('training_maxes').upsert({
      user_id:session.user.id,
      squat:next.Squat === '' ? null : Number(next.Squat),
      bench:next.Bench === '' ? null : Number(next.Bench),
      deadlift:next.Deadlift === '' ? null : Number(next.Deadlift),
      press:next.Press === '' ? null : Number(next.Press),
      updated_at:new Date().toISOString(),
    })
  }

  const setTm = (name,raw) => {
    const value = raw === '' ? '' : Math.max(0,Number(raw))
    saveTrainingMaxes({...trainingMaxes,[name]:value})
  }

  const usePrevious = i => {
    const prev = previousWorkout?.main?.[i]
    if (!prev) return
    setSaveState('Unsaved')
    setLog(v => ({
      ...v,
      complete:false,
      main:v.main.map((set,idx) => idx === i ? {...set,weight:prev.weight,actualReps:prev.actualReps} : set)
    }))
  }

  const saveSharedResult = async payload => {
    if (!activeSession?.id || !session?.user || !sharedWorkoutActive) return
    const metrics = metricsForWorkout(payload,workoutProgramId,week,lift)
    await supabase.from('session_results').upsert({
      session_id:activeSession.id,
      user_id:session.user.id,
      workout:payload,
      total_volume:Math.round(metrics.volume),
      estimated_1rm:metrics.estimated1rm || null,
      completed_at:payload.complete ? payload.savedAt : null,
      updated_at:new Date().toISOString(),
    },{onConflict:'session_id,user_id'})
  }

  const saveWorkout = async (complete=false) => {
    if (!session?.user) return null
    setSaveState('Saving…')
    const now = new Date().toISOString()
    const payload = {...log,complete,savedAt:now,week,lift,phase:plan.phase,program:workoutProgram.name}

    const {data,error} = await supabase.from('workout_logs').upsert({
      user_id:session.user.id,
      program:workoutProgram.dbName,
      week,
      lift,
      workout_date:new Date().toISOString().slice(0,10),
      workout:payload,
      completed_at:complete ? now : null,
      updated_at:now,
    },{onConflict:'user_id,program,week,lift'}).select().single()

    if (error || !data) {
      setSaveState('Save failed')
      return null
    }

    await saveSharedResult(payload)

    // Platform v2 dual-write. If the new tables are not deployed yet, legacy saving still succeeds.
    const workoutMetrics = metricsForWorkout(payload,workoutProgramId,week,lift)
    const {data:durableSession} = await supabase.from('training_sessions').upsert({
      legacy_log_id:data.id,
      user_id:session.user.id,
      shared_session_id:sharedWorkoutActive && activeSession ? activeSession.id : null,
      title:lift + ' Day',
      program:workoutProgram.dbName,
      week,
      primary_lift:lift,
      session_date:new Date().toISOString().slice(0,10),
      workout:payload,
      total_volume:Math.round(workoutMetrics.volume),
      estimated_1rm:workoutMetrics.estimated1rm || null,
      bodyweight:Number(payload.bodyweight || 0) || null,
      started_at:data.created_at || now,
      completed_at:complete ? now : null,
      updated_at:now,
    },{onConflict:'legacy_log_id'}).select().maybeSingle()

    if (complete && durableSession && profile?.community_opt_in) {
      await supabase.from('community_activity').upsert({
        user_id:session.user.id,
        training_session_id:durableSession.id,
        display_name:profile?.community_display_name || profile?.display_name || session.user.email?.split('@')[0] || 'Member',
        activity_date:new Date().toISOString().slice(0,10),
        title:lift + ' Day',
        summary:{
          lift,
          program:workoutProgram.name,
          volume:Math.round(workoutMetrics.volume),
          estimated_1rm:workoutMetrics.estimated1rm || null,
          bodyweight:profile?.community_share_bodyweight ? (Number(payload.bodyweight || 0) || null) : null
        }
      },{onConflict:'training_session_id'})
    }

    setLog(payload)
    setHistory(rows => [data,...rows.filter(row => row.id !== data.id && !(row.program === workoutProgram.dbName && row.week === week && row.lift === lift))])
    setSaveState('Saved')
    return data
  }

  useEffect(() => {
    if (!session?.user || dataLoading || saveState !== 'Unsaved') return
    const timer = setTimeout(() => saveWorkout(false),900)
    return () => clearTimeout(timer)
  },[log,session?.user?.id,dataLoading,saveState,sharedWorkoutActive,activeSession?.id])

  const changeWeek = async nextWeek => {
    const safeWeek = Math.max(1,Math.min(Number(nextWeek),personalProgram.weeksCount))
    setWeek(safeWeek)
    if (!session?.user || sharedWorkoutActive) return
    await supabase.from('profiles').update({current_week:safeWeek,updated_at:new Date().toISOString()}).eq('id',session.user.id)
    setProfile(v => v ? {...v,current_week:safeWeek} : v)
  }

  const chooseProgram = async programId => {
    if (!programs[programId] || programId === activeProgram) return

    // Save any in-progress edits before switching program context.
    if (saveState === 'Unsaved') {
      await saveWorkout(false)
    }

    setSharedWorkoutActive(false)
    setSaveState('Saved')
    setActiveProgram(programId)
    setWeek(1)
    setLift('Squat')

    if (session?.user) {
      await Promise.all([
        supabase.auth.updateUser({data:{...session.user.user_metadata,active_program:programId}}),
        supabase.from('profiles').update({active_program:programId,current_week:1,updated_at:new Date().toISOString()}).eq('id',session.user.id)
      ])
      setProfile(v => v ? {...v,active_program:programId,current_week:1} : v)
    }
  }

  const restorePersonalWorkout = () => {
    const personalWeek = Math.min(profile?.current_week || 1,personalProgram.weeksCount)
    const completed = new Set(personalRows.filter(r => r.week === personalWeek && r.completed_at).map(r => r.lift))
    setSharedWorkoutActive(false)
    setWeek(personalWeek)
    setLift(lifts.find(x => !completed.has(x)) || 'Press')
  }

  const cancelClassicWorkout = async () => {
    if(!session?.user || classicCancelling)return
    setClassicCancelling(true)
    const cacheKey=`wb-draft-${session.user.id}-${workoutProgramId}-${week}-${lift}`
    try { localStorage.removeItem(cacheKey) } catch {}

    const {data:existing}=await supabase.from('workout_logs').select('id,completed_at')
      .eq('user_id',session.user.id).eq('program',workoutProgram.dbName).eq('week',week).eq('lift',lift).maybeSingle()

    if(existing?.id && !existing.completed_at){
      await supabase.from('training_sessions').delete().eq('legacy_log_id',existing.id).is('completed_at',null)
      await supabase.from('workout_logs').delete().eq('id',existing.id).is('completed_at',null)
      setHistory(rows=>rows.filter(row=>row.id!==existing.id))
    }

    setLog(makeLog(workoutProgramId,week,lift,tm))
    setSaveState('Saved')
    setClassicCancelConfirm(false)
    setClassicCancelling(false)

    if(sharedWorkoutActive&&activeSession){
      restorePersonalWorkout()
      await refreshTogether(activeSession.id)
      setActiveTab('together')
    }
  }

  const finishWorkout = async () => {
    const saved = await saveWorkout(true)
    if (!saved) return

    if (sharedWorkoutActive && activeSession) {
      await refreshTogether(activeSession.id)
      restorePersonalWorkout()
      setActiveTab('together')
      return
    }

    const completed = new Set([...(completedByWeek[week] ? Array.from(completedByWeek[week]) : []),lift])
    const nextLift = lifts.find(x => !completed.has(x))

    if (nextLift) {
      setLift(nextLift)
      return
    }

    if (week < personalProgram.weeksCount) {
      const nextWeek = week + 1
      await changeWeek(nextWeek)
      setLift('Squat')
    }
  }

  const saveDisplayName = async name => {
    if (!session?.user) return
    const clean = name.trim()
    if (!clean) return
    await supabase.from('profiles').update({display_name:clean,updated_at:new Date().toISOString()}).eq('id',session.user.id)
    setProfile(v => ({...v,display_name:clean}))
  }

  const jumpToWorkout = (programId,targetWeek,targetLift='Squat') => {
    setSharedWorkoutActive(false)
    const nextProgram = programs[programId] ? programId : activeProgram
    setSaveState('Saved')
    setActiveProgram(nextProgram)
    setWeek(Number(targetWeek))
    setLift(targetLift)
    setActiveTab('today')
  }

  const shareInvite = async () => {
    const url = appUrl()
    const data = {title:'WorkoutBoard',text:'Join me on WorkoutBoard. Create your own account and track your workouts.',url}
    try {
      if (navigator.share) {
        await navigator.share(data)
        setInviteState('Invite opened')
      } else {
        await navigator.clipboard.writeText(url)
        setInviteState('Invite link copied')
      }
    } catch {
      setInviteState(url)
    }
  }

  const createTogetherSession = async () => {
    if (!session?.user || togetherReady === false || !togetherProgramChoice) return
    setTogetherMessage('Creating session…')

    const selectedWeek=Math.max(1,Math.min(Number(togetherWeek||1),Number(togetherProgramChoice.weeksCount||1)))
    const selectedIndex=Math.max(0,Math.min(Number(togetherWorkoutIndex||0),Math.max(0,togetherWorkoutChoices.length-1)))
    const selectedWorkout=togetherWorkoutChoices[selectedIndex]
    if(!selectedWorkout){setTogetherMessage('Choose a workout first.');return}

    let sessionProgram=''
    let sessionLift='Squat'
    let sharedTemplate=null
    let sharedMeta=null

    if(togetherProgramChoice.kind==='classic'){
      sessionProgram=togetherProgramChoice.program.dbName
      sessionLift=selectedWorkout.lift||lifts[selectedIndex]||'Squat'
    }else{
      const planned=makePlannedFromArchive(togetherProgramChoice.program,selectedWeek,selectedIndex,new Date().toISOString().slice(0,10))
      sessionProgram=togetherProgramChoice.key
      sessionLift=lifts[Math.min(selectedIndex,lifts.length-1)]||'Squat'
      sharedTemplate=planned.workout
      sharedMeta={
        program_key:togetherProgramChoice.key,
        program_name:togetherProgramChoice.name,
        week:selectedWeek,
        workout_index:selectedIndex,
        workout_title:planned.title,
      }
    }

    let created = null
    for (let attempt=0; attempt<4 && !created; attempt++) {
      const code = randomJoinCode()
      const {data,error} = await supabase.from('shared_sessions').insert({
        join_code:code,
        host_user_id:session.user.id,
        program:sessionProgram,
        week:Math.min(selectedWeek,12),
        lift:sessionLift,
        status:'open',
      }).select().single()
      if (!error) created = data
    }

    if (!created) {
      setTogetherMessage('Could not create the session. Try again.')
      return
    }

    const displayName = profile?.display_name || session.user.email?.split('@')[0] || 'You'
    await supabase.from('session_participants').insert({
      session_id:created.id,
      user_id:session.user.id,
      display_name:displayName,
    })

    if(sharedTemplate){
      await supabase.from('session_results').upsert({
        session_id:created.id,
        user_id:session.user.id,
        workout:{shared_template:sharedTemplate,shared_meta:sharedMeta},
        total_volume:0,
        estimated_1rm:null,
        completed_at:null,
        updated_at:new Date().toISOString(),
      },{onConflict:'session_id,user_id'})
    }

    setTogetherReady(true)
    setActiveSession(created)
    setTogetherMessage('')
    await refreshTogether(created.id)
  }

  const joinTogetherSession = async () => {
    if (!session?.user || !joinCode.trim()) return
    setTogetherMessage('Joining…')
    const code = joinCode.trim().toUpperCase()

    const {data:found,error} = await supabase
      .from('shared_sessions')
      .select('*')
      .eq('join_code',code)
      .eq('status','open')
      .single()

    if (error || !found) {
      setTogetherMessage('No open session found with that code.')
      return
    }

    const displayName = profile?.display_name || session.user.email?.split('@')[0] || 'You'
    const {error:joinError} = await supabase.from('session_participants').upsert({
      session_id:found.id,
      user_id:session.user.id,
      display_name:displayName,
    },{onConflict:'session_id,user_id'})

    if (joinError) {
      setTogetherMessage(joinError.message)
      return
    }

    setActiveSession(found)
    setJoinCode('')
    setTogetherMessage('')
    await refreshTogether(found.id)
  }

  const openSharedWorkout = async () => {
    if (!activeSession || !session?.user) return
    const hostResult=sessionResults.find(result=>result.user_id===activeSession.host_user_id)
    const sharedTemplate=hostResult?.workout?.shared_template
    const sharedMeta=hostResult?.workout?.shared_meta

    if(sharedTemplate){
      const marker='Together:'+activeSession.id
      let {data:planned}=await supabase.from('planned_workouts').select('*')
        .eq('user_id',session.user.id).eq('source_day',marker).maybeSingle()

      if(!planned){
        const payload={
          user_id:session.user.id,
          scheduled_date:new Date().toISOString().slice(0,10),
          title:sharedMeta?.workout_title||'Shared workout',
          source_program_name:sharedMeta?.program_name||'Workout Together',
          source_week:Number(sharedMeta?.week||1),
          source_day:marker,
          workout:{...sharedTemplate,shared_session_id:activeSession.id,shared_meta:sharedMeta,shared_template:sharedTemplate},
          status:'started',
        }
        const inserted=await supabase.from('planned_workouts').insert(payload).select().single()
        if(inserted.error){setTogetherMessage(inserted.error.message);return}
        planned=inserted.data
      }

      await supabase.from('session_results').upsert({
        session_id:activeSession.id,
        user_id:session.user.id,
        workout:{shared_template:sharedTemplate,shared_meta:sharedMeta},
        total_volume:0,
        estimated_1rm:null,
        completed_at:null,
        updated_at:new Date().toISOString(),
      },{onConflict:'session_id,user_id'})

      setSharedWorkoutActive(true)
      setPlannedToday(planned)
      setShowRegularToday(false)
      setActiveTab('today')
      await refreshTogether(activeSession.id)
      return
    }

    const programId = dbNameToProgram[activeSession.program] || 'andy-hybrid-12'
    setSharedWorkoutActive(true)
    setWeek(activeSession.week)
    setLift(activeSession.lift)
    setSaveState('Saved')
    setActiveTab('today')
    const found = history.find(row => row.program === programs[programId].dbName && row.week === activeSession.week && row.lift === activeSession.lift)
    setLog(normalizeLog(found?.workout || null,programId,activeSession.week,activeSession.lift,Number(trainingMaxes[activeSession.lift] || 0)))
  }

  const shareSession = async () => {
    if (!activeSession) return
    const url=new URL(appUrl())
    url.searchParams.set('join',activeSession.join_code)
    const shareUrl=url.toString()
    const text='Join my WorkoutBoard session'
    try {
      if (navigator.share) await navigator.share({title:'WorkoutBoard Together',text,url:shareUrl})
      else {
        await navigator.clipboard.writeText(shareUrl)
        setTogetherMessage('Join link copied.')
      }
    } catch {
      setTogetherMessage(shareUrl)
    }
  }

  const saveTogetherNote = async value => {
    if (!activeSession || activeSession.host_user_id !== session?.user?.id || activeSession.session_note === undefined) return
    await supabase.from('shared_sessions').update({session_note:value}).eq('id',activeSession.id)
    await refreshTogether(activeSession.id)
  }

  const endTogetherSession = async () => {
    if (!activeSession || activeSession.host_user_id !== session?.user?.id) return
    await supabase.from('shared_sessions').update({
      status:'completed',
      completed_at:new Date().toISOString()
    }).eq('id',activeSession.id)
    await refreshTogether(activeSession.id)
  }

  const repeatTogetherSession = async () => {
    if (!activeSession || activeSession.host_user_id !== session?.user?.id) return
    setTogetherMessage('Creating repeat session…')
    let created=null
    for(let attempt=0;attempt<4&&!created;attempt++){
      const code=randomJoinCode()
      const {data,error}=await supabase.from('shared_sessions').insert({
        join_code:code,
        host_user_id:session.user.id,
        program:activeSession.program,
        week:activeSession.week,
        lift:activeSession.lift,
        status:'open',
      }).select().single()
      if(!error) created=data
    }
    if(!created){setTogetherMessage('Could not create repeat session. Try again.');return}
    const displayName=profile?.display_name||session.user.email?.split('@')[0]||'You'
    await supabase.from('session_participants').insert({session_id:created.id,user_id:session.user.id,display_name:displayName})
    const priorHostResult=sessionResults.find(result=>result.user_id===activeSession.host_user_id)
    if(priorHostResult?.workout?.shared_template){
      await supabase.from('session_results').upsert({
        session_id:created.id,user_id:session.user.id,
        workout:{shared_template:priorHostResult.workout.shared_template,shared_meta:priorHostResult.workout.shared_meta||null},
        total_volume:0,estimated_1rm:null,completed_at:null,updated_at:new Date().toISOString()
      },{onConflict:'session_id,user_id'})
    }
    setActiveSession(created);setSessionResults([]);setTogetherMessage('')
    await refreshTogether(created.id)
  }

  const leaveTogetherView = () => {
    restorePersonalWorkout()
    setActiveSession(null)
    setParticipants([])
    setSessionResults([])
    setTogetherMessage('')
  }

  const secondary = plan.secondary
  const secondaryTarget = secondary?.pct != null ? targetWeight(tm,secondary.pct,workoutProgram.basis) : null
  const displayName = profile?.display_name || session?.user?.email?.split('@')[0] || 'You'
  const ownSessionResult = sessionResults.find(result => result.user_id === session?.user?.id)
  const sharedHostResult = activeSession ? sessionResults.find(result => result.user_id === activeSession.host_user_id) : null
  const sharedMeta = sharedHostResult?.workout?.shared_meta || null
  const combinedSessionVolume = sessionResults.reduce((sum,result) => sum + Number(result.total_volume || 0),0)
  const maxWeeklyVolume = Math.max(1,...progress.weekly.map(item => item.volume))
  const nextMainIndex = log.main?.findIndex(set=>!set.done) ?? -1
  const mainSetsComplete = Boolean(log.main?.length) && log.main.every(set=>set.done)
  const nextBackoffIndex = log.backoffSets?.findIndex(set=>!set.done) ?? -1
  const backoffSetsComplete = !log.backoffSets?.length || log.backoffSets.every(set=>set.done)
  const nextAssistanceIndex = log.assistance?.findIndex(item=>item.setProgress?.length ? item.setProgress.some(set=>!set.done) : !String(item.result||'').trim()) ?? -1
  const conditioningSuggested = Boolean(plan.conditioning && plan.conditioning !== 'None')
  const conditioningPrescribed = Boolean(conditioningSuggested && !/^optional\b/i.test(String(plan.conditioning).trim()))
  const conditioningHasData = Boolean(log.metcon?.format || log.metcon?.name || log.metcon?.activity || log.metcon?.duration || log.metcon?.workTime || log.metcon?.restTime || log.metcon?.interval || log.metcon?.time || log.metcon?.rounds || log.metcon?.reps || log.metcon?.distance || log.metcon?.calories)

  if (authLoading) return <div className="loading-screen">Loading WorkoutBoard…</div>
  if (passwordRecovery) return <RecoveryScreen onDone={() => setPasswordRecovery(false)} />
  if (!session) return <AuthScreen />

  return (
    <>
      <main className="app">
        <header className="app-header">
          <div>
            <div className="eyebrow">WORKOUTBOARD</div>
            <h1>{activeTab === 'today' ? 'Today' : activeTab === 'together' ? 'Together' : activeTab === 'program' ? 'Plan' : activeTab === 'whiteboard' ? 'Whiteboard' : activeTab === 'admin' ? 'Admin' : 'Me'}</h1>
          </div>
          <button className={'account-chip ' + (isAdmin ? 'admin' : '')} onClick={() => setActiveTab('me')}>
            <span>{displayName}</span>
            {isAdmin && <b>ADMIN</b>}
          </button>
        </header>

        <nav className="primary-nav">
          <button className={activeTab === 'today' ? 'active' : ''} onClick={async () => { await refreshPlannedToday(); setActiveTab('today') }}><b>●</b><span>Today</span></button>
          <button className={activeTab === 'together' ? 'active' : ''} onClick={() => setActiveTab('together')}><b>⇄</b><span>Together</span></button>
          <button className={activeTab === 'program' ? 'active' : ''} onClick={() => setActiveTab('program')}><b>▦</b><span>Plan</span></button>
          <button className={activeTab === 'whiteboard' ? 'active' : ''} onClick={() => setActiveTab('whiteboard')}><b>□</b><span>Board</span></button>
        </nav>

        <nav className={'mobile-bottom-nav '+(activeTab==='whiteboard'?'board-mobile-nav':'')} aria-label="WorkoutBoard mobile navigation">
          <button className={activeTab==='today'?'active':''} onClick={async()=>{await refreshPlannedToday();setActiveTab('today')}}><b>●</b><span>Today</span></button>
          <button className={activeTab==='together'?'active':''} onClick={()=>setActiveTab('together')}><b>⇄</b><span>Together</span></button>
          <button className={activeTab==='program'?'active':''} onClick={()=>setActiveTab('program')}><b>▦</b><span>Plan</span></button>
          <button className={activeTab==='whiteboard'?'active':''} onClick={()=>setActiveTab('whiteboard')}><b>□</b><span>Board</span></button>
        </nav>

        {activeTab === 'today' && <TrainingTimer />}

        {dataLoading ? (
          <div className="loading-card">Loading your workouts…</div>
        ) : activeTab === 'today' ? (
          plannedToday && !showRegularToday ? (
            <PlannedWorkoutRunner
              planned={plannedToday}
              sharedSessionId={sharedWorkoutActive&&activeSession ? activeSession.id : null}
              onCancelled={async() => {
                setPlannedToday(null)
                setShowRegularToday(false)
                setCompletionSummary(null)
                setWorkoutStartError('')
                if(sharedWorkoutActive&&activeSession){
                  setSharedWorkoutActive(false)
                  await refreshTogether(activeSession.id)
                  setActiveTab('together')
                }
              }}
              onFinished={async(summary) => {
                const finishedTrackingKey=plannedToday?.workout?.tracking_program_key||null
                setPlannedToday(null)
                setShowRegularToday(false)
                if(sharedWorkoutActive&&activeSession){
                  await refreshTogether(activeSession.id)
                  setActiveTab('together')
                }else{
                  setCompletionSummary(summary||null)
                  if(summary){
                    setTodayCompletedWorkouts(rows=>[{
                      id:'just-finished-'+Date.now(),
                      title:summary.title,
                      program:summary.program,
                      total_volume:summary.volume||0,
                      completed_at:new Date().toISOString(),
                      workout:{exercises:[]},
                    },...rows])
                  }
                  setTrackedTodayInfo(v=>{
                    if(!v)return v
                    const workoutsToday=(v.workoutsToday||0)+1
                    if(finishedTrackingKey!==v.key)return {...v,workoutsToday}
                    const completed=Math.min(v.total,v.completed+1)
                    const next=v.upcoming?.slice(1)||[]
                    const first=next[0]
                    return {...v,completedToday:true,workoutsToday,completed,upcoming:next,nextWeek:first?.week||v.nextWeek,nextDayIndex:first?.dayIndex??v.nextDayIndex,nextTitle:first?.title||'',complete:completed>=v.total}
                  })
                }
              }}
              onDismiss={sharedWorkoutActive || trackedTodayInfo ? undefined : () => setShowRegularToday(true)}
            />
          ) : trackedTodayInfo ? (
            <section className="page-section tracked-today-state">
              {todayCompletedWorkouts.length>0&&<details className="today-completed-workouts" open>
                <summary><span><b>Today’s workouts</b><small>{todayCompletedWorkouts.length} completed</small></span></summary>
                <div className="today-completed-list">{todayCompletedWorkouts.map(row=><article key={row.id}>
                  <div><strong>{row.title||'Workout'}</strong><span>{row.program||'Workout'}{row.completed_at?' · '+new Date(row.completed_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''}</span></div>
                  <b>{Number(row.total_volume||0)>0?Number(row.total_volume).toLocaleString()+' lb':'Completed'}</b>
                  {row.workout?.exercises?.length>0&&<details><summary>Exercises</summary><p>{row.workout.exercises.map(x=>x.name).filter(Boolean).join(' · ')}</p></details>}
                </article>)}</div>
              </details>}
              {completionSummary&&<section className="workout-complete-summary">
                <div className="completion-check">✓</div>
                <div><span className="card-label">WORKOUT COMPLETE</span><h2>{completionSummary.title||'Workout complete'}</h2><p>{completionSummary.program||trackedTodayInfo.name}</p></div>
                <div className="completion-stats">
                  <div><span>Exercises</span><strong>{completionSummary.exercises||0}</strong></div>
                  <div><span>Sets</span><strong>{completionSummary.sets||0}</strong></div>
                  <div><span>Volume</span><strong>{Number(completionSummary.volume||0).toLocaleString()} lb</strong></div>
                </div>
              </section>}

              {!completionSummary&&<section className="today-card">
                <div><span className="card-label">TRACKED PROGRAM</span><h2>{trackedTodayInfo.name}</h2><p>{trackedTodayInfo.complete?'Program complete':(trackedTodayInfo.workoutsToday||0)>0?'Workout tracked today':'Ready to train'}</p></div>
                <div className="progress-badge">{trackedTodayInfo.completed}/{trackedTodayInfo.total}</div>
              </section>}

              {!trackedTodayInfo.complete&&<section className="simple-card upcoming-workouts-card">
                <span className="card-label">UP NEXT</span>
                <h3>Continue {trackedTodayInfo.name}</h3>
                <div className="upcoming-workout-list">{(trackedTodayInfo.upcoming||[]).map((item,index)=><div className={index===0?'next':''} key={item.week+'-'+item.dayIndex}>
                  <div><strong>Week {item.week}</strong><span>{item.title}</span></div>
                  {index===0&&<b>NEXT</b>}
                </div>)}</div>
              </section>}

              {!extraWorkoutOpen&&<button className="primary-action" onClick={()=>setExtraWorkoutOpen(true)}>+ Start another workout</button>}

              {extraWorkoutOpen&&<section className="simple-card extra-workout-picker">
                <div className="section-heading"><div><span className="card-label">ANOTHER WORKOUT</span><h3>What are you tracking?</h3></div><button className="conditioning-remove" onClick={()=>setExtraWorkoutOpen(false)}>Cancel</button></div>
                <button onClick={()=>startStandaloneWorkout('free')}><strong>Free workout</strong><span>Add whatever exercises you want</span></button>
                <button onClick={()=>startStandaloneWorkout('run')}><strong>Run / Walk</strong><span>Track distance and time</span></button>
                <button onClick={()=>startStandaloneWorkout('conditioning')}><strong>Conditioning / Metcon</strong><span>Intervals, AMRAP, EMOM, cardio, etc.</span></button>
              </section>}

              {!trackedTodayInfo.complete&&<button className="secondary-action" onClick={()=>setNextDayPreviewOpen(v=>!v)}>{nextDayPreviewOpen?'Hide next program day':'See next program day'}</button>}

              {nextDayPreviewOpen&&trackedTodayInfo.upcoming?.[0]&&<section className="simple-card next-day-preview">
                <div><span className="card-label">NEXT PROGRAM DAY</span><h3>Week {trackedTodayInfo.upcoming[0].week} · {trackedTodayInfo.upcoming[0].title}</h3>{trackedTodayInfo.upcoming[0].note&&<p>{trackedTodayInfo.upcoming[0].note}</p>}</div>
                <div className="next-day-exercises">{trackedTodayInfo.upcoming[0].exercises.map((exercise,index)=><div key={index}><strong>{exercise.name}</strong><span>{exercise.prescription}</span></div>)}</div>
                <button className="secondary-action" onClick={()=>startTrackedWorkout()}>Start this program day</button>
              </section>}

              <button className="secondary-action" onClick={()=>setActiveTab('program')}>View full program / plan ahead</button>

              {workoutStartError&&<div className="status-message">{workoutStartError}</div>}
            </section>
          ) : (
          <>
            {sharedWorkoutActive && activeSession && (
              <section className="together-banner">
                <div><span>WORKOUT TOGETHER</span><strong>Code {activeSession.join_code}</strong></div>
                <button onClick={() => setActiveTab('together')}>{participants.length} people</button>
              </section>
            )}

            <section className="today-card">
              <div>
                <span className="card-label">{workoutProgram.shortName}</span>
                <h2>{lift} Day</h2>
                <p>Week {week} · {plan.phase} · {dayNames[lift]}</p>
                {plan.rule && <p className="rule-text">{plan.rule}</p>}
              </div>
              {!sharedWorkoutActive && <div className="progress-badge">{completedByWeek[week]?.size || 0}/4 done</div>}
            </section>

            {!sharedWorkoutActive && (
              <details className="change-workout">
                <summary>Change workout</summary>
                <div className="selectors">
                  <label><span>Week</span>
                    <select value={week} onChange={e => changeWeek(Number(e.target.value))}>
                      {Array.from({length:personalProgram.weeksCount},(_,i) => i+1).map(w => <option key={w} value={w}>Week {w}</option>)}
                    </select>
                  </label>
                  <label><span>Workout</span>
                    <select value={lift} onChange={e => setLift(e.target.value)}>
                      {lifts.map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <button type="button" className="program-library-link" onClick={() => setActiveTab('program')}>Choose / track programs in Plan</button>
                </div>
              </details>
            )}

            {!tm && <div className="hint"><strong>No {lift} training max yet.</strong><span>Add it under Me → Training Maxes, or type working weights directly.</span></div>}

            <ExerciseHistoryStrip history={history} lift={lift} formatWeight={formatWeight} />
            <details className="today-collapsible">
              <summary><span><b>Workout Coach</b><small>Last performance, suggested load, warm-ups & PRs</small></span></summary>
              <WorkoutCoach session={session} lift={lift} log={log} history={history} tm={tm} plan={plan} />
            </details>

            <section className="exercise-card">
              <div className="exercise-title">
                <div><span>MAIN LIFT</span><div className="exercise-heading-line"><h2>{lift}</h2><AlternativeMovements name={lift}/></div><small className="program-rest-label">Program rest: {plan.rest.main < 120 ? plan.rest.main+' sec' : plan.rest.main/60+' min'}</small></div>
                {previousWorkout && <small>Tap “Last” to reuse your previous set.</small>}
              </div>
              <div className="column-head"><span>SET / TARGET</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div>

              {log.main.map((set,i) => {
                const target = targetWeight(tm,set.pct,workoutProgram.basis)
                const prev = previousWorkout?.main?.[i]
                return (
                  <div className={'set-row ' + (set.done ? 'completed ' : '') + (!set.done && i===nextMainIndex ? 'current-set' : '')} key={i}>
                    <div className="set-meta">
                      <strong>Set {i+1}</strong>
                      <span>{set.pctLabel || (set.pct != null ? set.pct + '%' : '')} × {set.reps}</span>
                      {target && <small>Target {target} lb</small>}
                      {prev && <button className="previous" type="button" onClick={() => usePrevious(i)}>Last {prev.weight || '—'} × {prev.actualReps || '—'}</button>}
                    </div>
                    <NumericInput value={set.weight} placeholder={target ? String(target) : 'lb'} step={5} onChange={v => updateMain(i,'weight',v)} />
                    <input className="reps-input" type="number" inputMode="numeric" value={set.actualReps}
                      onFocus={e => e.currentTarget.select()}
                      onChange={e => updateMain(i,'actualReps',e.target.value === '' ? '' : Number(e.target.value))} />
                    <button type="button" className={'check ' + (set.done ? 'checked' : '')} onClick={() => { const next=!set.done; updateMain(i,'done',next); if(next) { const override=Number(localStorage.getItem('wb-rest-override-'+plan.programId+'-'+String(lift).toLowerCase())||0); const seconds=override||plan.rest.main; window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds}})) } }}>✓</button>
                  </div>
                )
              })}
            </section>

            {plan.jokers?.length>0 && (
              <section className="simple-card joker-card">
                <div className="section-heading">
                  <div><span className="card-label">OPTIONAL JOKERS</span><h3>{lift} Joker sets</h3><small className="program-rest-label">Same main lift · only use these when the top set moved well</small></div>
                  <AlternativeMovements name={lift}/>
                </div>
                <p className="helper-text">Jokers are optional heavier sets after your main 5/3/1 work. They are not separate assistance exercises.</p>
                <div className="joker-set-list">{(log.jokerSets||[]).map((set,i)=><div className={'joker-set-row '+(set.done?'completed':'')} key={i}>
                  <strong>{set.label}</strong>
                  <NumericInput value={set.weight} placeholder="lb" step={5} onChange={value=>{setSaveState('Unsaved');setLog(v=>({...v,complete:false,jokerSets:v.jokerSets.map((x,idx)=>idx===i?{...x,weight:value}:x)}))}}/>
                  <input className="reps-input" type="number" inputMode="numeric" placeholder="reps" value={set.reps} onChange={e=>{setSaveState('Unsaved');setLog(v=>({...v,complete:false,jokerSets:v.jokerSets.map((x,idx)=>idx===i?{...x,reps:e.target.value===''?'':Number(e.target.value)}:x)}))}}/>
                  <button type="button" className={'check '+(set.done?'checked':'')} onClick={()=>{const next=!set.done;setSaveState('Unsaved');setLog(v=>({...v,complete:false,jokerSets:v.jokerSets.map((x,idx)=>idx===i?{...x,done:next}:x)}));if(next)window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds:180}}))}}>✓</button>
                </div>)}</div>
              </section>
            )}

            {secondary && (
              <section className="simple-card">
                <div className="section-heading">
                  <div><span className="card-label">{secondary.label}</span><h3>{secondary.title}</h3><div className="supplemental-movement-line"><strong>Movement: {lift}</strong><AlternativeMovements name={lift}/></div><small className="program-rest-label">Program rest: {plan.rest.secondary < 120 ? plan.rest.secondary+' sec' : plan.rest.secondary/60+' min'}</small></div>
                  <div className="supplemental-head-right">
                    {secondaryTarget && <strong className="target-pill">{secondaryTarget} lb</strong>}
                    {log.backoffSets?.length>0&&<span className="set-count-pill">{log.backoffSets.filter(x=>x.done).length}/{log.backoffSets.length} done</span>}
                  </div>
                </div>
                {secondary.pct != null && (
                  <label className="field-label"><span>Working weight</span>
                    <NumericInput value={log.backoffWeight} placeholder={secondaryTarget ? String(secondaryTarget) : 'lb'} step={5}
                      onChange={v => {setSaveState('Unsaved');setLog(x => ({...x,complete:false,backoffWeight:v}))}} />
                  </label>
                )}
                {log.backoffSets?.length>0&&<div className="set-progress-grid">
                  {log.backoffSets.map((set,i)=><button
                    type="button"
                    key={i}
                    className={'set-progress-button '+(set.done?'done ':'')+(mainSetsComplete&&!set.done&&i===nextBackoffIndex?'current-set':'')}
                    onClick={()=>{
                      const next=!set.done
                      setSaveState('Unsaved')
                      setLog(v=>({...v,complete:false,backoffSets:v.backoffSets.map((x,idx)=>idx===i?{...x,done:next}:x)}))
                      if(next){const seconds=plan.rest.secondary;window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds}}))}
                    }}>
                    <strong>Set {i+1}</strong>
                    <span>{set.reps?set.reps+' reps':'Done?'}</span>
                    <b>{set.done?'✓':'○'}</b>
                  </button>)}
                </div>}
                <input className="text-input" placeholder={secondary.pct != null ? 'Optional note' : 'What you did / weight / reps'}
                  value={log.backoffNote}
                  onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,backoffNote:e.target.value}))}} />
              </section>
            )}

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">ASSISTANCE</span><h3>Log assistance work</h3></div></div>
              {log.assistance.map((item,i) => (
                <div className={'assist assist-with-progress '+(mainSetsComplete&&backoffSetsComplete&&i===nextAssistanceIndex?'current-exercise':'')} key={item.name}>
                  <div className="assist-title-row">
                    <div className="assist-name-with-alt"><span>{item.name}<small className="assistance-rest-label"> · {plan.rest.assistance(item.name) < 120 ? plan.rest.assistance(item.name)+' sec' : plan.rest.assistance(item.name)/60+' min'} rest</small></span><AlternativeMovements name={item.name}/></div>
                    {item.setProgress?.length>0&&<b>{item.setProgress.filter(x=>x.done).length}/{item.setProgress.length}</b>}
                  </div>
                  <input placeholder="weight × reps × sets" value={item.result}
                    onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,assistance:v.assistance.map((x,idx) => idx === i ? {...x,result:e.target.value} : x)}))}} />
                  {item.setProgress?.length>0&&<div className="set-progress-grid compact">
                    {item.setProgress.map((set,j)=><button
                      type="button"
                      key={j}
                      className={'set-progress-button '+(set.done?'done ':'')+(mainSetsComplete&&backoffSetsComplete&&i===nextAssistanceIndex&&!set.done&&j===item.setProgress.findIndex(x=>!x.done)?'current-set':'')}
                      onClick={()=>{
                        const next=!set.done
                        setSaveState('Unsaved')
                        setLog(v=>({...v,complete:false,assistance:v.assistance.map((x,idx)=>idx===i?{...x,setProgress:x.setProgress.map((sp,k)=>k===j?{...sp,done:next}:sp)}:x)}))
                        if(next)window.dispatchEvent(new CustomEvent('workoutboard:rest-timer',{detail:{seconds:plan.rest.assistance(item.name)}}))
                      }}>
                      <strong>Set {j+1}</strong><span>{set.reps?set.reps+' reps':'Done?'}</span><b>{set.done?'✓':'○'}</b>
                    </button>)}
                  </div>}
                </div>
              ))}
            </section>

            {(conditioningSuggested || log.conditioningEnabled || conditioningHasData) ? (
              <details className="today-collapsible conditioning-tools" open={conditioningOpen} onToggle={e=>setConditioningOpen(e.currentTarget.open)}>
                <summary><span><b>Conditioning</b><small>{conditioningSuggested?plan.conditioning:'Optional'}</small></span></summary>
                <section className="simple-card embedded-tool-card">
                  {conditioningSuggested&&<p className="conditioning-suggestion"><strong>{conditioningPrescribed?'Program conditioning:':'Program suggestion:'}</strong> {plan.conditioning}</p>}
                  <MetconTracker
                    value={log.metcon}
                    onChange={metcon => {setSaveState('Unsaved');setLog(v=>({...v,complete:false,metcon,conditioningEnabled:true}))}}
                    onRemove={()=>{setConditioningOpen(false);setSaveState('Unsaved');setLog(v=>({...v,complete:false,conditioningEnabled:false,conditioning:'',metcon:{name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'}}))}}
                  />
                </section>
              </details>
            ) : (
              <button className="context-add-button" type="button" onClick={()=>{setConditioningOpen(true);setSaveState('Unsaved');setLog(v=>({...v,conditioningEnabled:true}))}}>+ Conditioning</button>
            )}

            <details className="today-collapsible workout-details">
              <summary><span><b>Workout details</b><small>Readiness, bodyweight, pain & notes</small></span></summary>
              <div className="today-details-body">
                <section className="metrics readiness-metrics">
                  <label><span>Sleep</span><input type="number" min="1" max="10" inputMode="numeric" placeholder="1-10" value={log.sleep || ''}
                    onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,sleep:e.target.value}))}} /></label>
                  <label><span>Energy</span><input type="number" min="1" max="10" inputMode="numeric" placeholder="1-10" value={log.energy || ''}
                    onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,energy:e.target.value}))}} /></label>
                  <label><span>Workout RPE</span><input type="number" inputMode="decimal" placeholder="1-10" value={log.rpe}
                    onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,rpe:e.target.value}))}} /></label>
                  <label><span>Bodyweight</span><input type="number" inputMode="decimal" placeholder="lb" value={log.bodyweight}
                    onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,bodyweight:e.target.value}))}} /></label>
                </section>
                <input className="text-input pain-input" placeholder="Pain / injury (optional)" value={log.pain || ''}
                  onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,pain:e.target.value}))}} />
                <textarea className="notes" placeholder="Quick workout note…" value={log.note}
                  onChange={e => {setSaveState('Unsaved');setLog(v => ({...v,complete:false,note:e.target.value}))}} />
              </div>
            </details>

            <div className="save-line">● {saveState}</div>
            {!log.complete&&<button type="button" className="secondary-action cancel-workout-button" onClick={()=>setClassicCancelConfirm(true)}>Cancel workout</button>}
            {classicCancelConfirm&&<section className="cancel-workout-confirm">
              <strong>Cancel this workout?</strong>
              <p>Your in-progress entries will be discarded and will not count as a completed workout.</p>
              <div><button type="button" className="secondary-action" onClick={()=>setClassicCancelConfirm(false)} disabled={classicCancelling}>Keep workout</button><button type="button" className="danger-action" onClick={cancelClassicWorkout} disabled={classicCancelling}>{classicCancelling?'Cancelling…':'Yes, cancel'}</button></div>
            </section>}
            <div className="finish-wrap">
              <button className={'finish ' + (log.complete ? 'done' : '')} onClick={finishWorkout} disabled={classicCancelling}>
                {log.complete ? '✓ WORKOUT FINISHED' : sharedWorkoutActive ? 'FINISH MY SHARED WORKOUT' : 'FINISH WORKOUT'}
              </button>
            </div>
          </>
          )
        ) : activeTab === 'together' ? (
          <section className="page-section">
            <div className="segmented together-view-tabs">
              <button className={togetherView==='live'?'active':''} onClick={()=>setTogetherView('live')}>Live</button>
              <button className={togetherView==='community'?'active':''} onClick={()=>setTogetherView('community')}>Community</button>
            </div>
            {togetherView==='community' ? (
              <PlatformProgress
                view="community"
                session={session}
                profile={profile}
                setProfile={setProfile}
                progress={progress}
                lifts={lifts}
                formatWeight={formatWeight}
                programs={programs}
                dbNameToProgram={dbNameToProgram}
              />
            ) : <>
            {togetherReady === false ? (
              <div className="setup-needed">
                <span className="card-label">ONE DATABASE UPDATE NEEDED</span>
                <h2>Enable Workout Together</h2>
                <p>The app code is ready. Run the new shared-workouts SQL migration in Supabase once, then refresh.</p>
              </div>
            ) : !activeSession ? (
              <>
                <section className="together-start-card">
                  <span className="card-label">HOST A WORKOUT</span>
                  <h2>1. Create a session code</h2>
                  <p>Together shares one workout at a time. Choose the tracked program, week, and workout you want everyone to run.</p>
                  <div className="together-host-picker">
                    <label><span>Program</span><select value={togetherProgramChoice?.key||''} onChange={e=>{setTogetherProgramKey(e.target.value);setTogetherWeek(1);setTogetherWorkoutIndex(0)}}>{togetherProgramOptions.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
                    <label><span>Week</span><select value={togetherWeek} onChange={e=>{setTogetherWeek(Number(e.target.value));setTogetherWorkoutIndex(0)}}>{Array.from({length:Number(togetherProgramChoice?.weeksCount||1)},(_,i)=>i+1).map(n=><option key={n} value={n}>Week {n}</option>)}</select></label>
                    <label><span>Workout</span><select value={togetherWorkoutIndex} onChange={e=>setTogetherWorkoutIndex(Number(e.target.value))}>{togetherWorkoutChoices.map((d,i)=><option key={i} value={i}>{d.title}</option>)}</select></label>
                  </div>
                  <div className="together-workout-preview"><strong>{togetherProgramChoice?.shortName||'Choose a program'}</strong><span>Week {togetherWeek} · {togetherWorkoutChoices[togetherWorkoutIndex]?.title||'Choose workout'}</span></div>
                  <button className="primary-action" disabled={!togetherProgramChoice||!togetherWorkoutChoices.length} onClick={createTogetherSession}>Create my 6-character code</button>
                </section>

                <section className="together-start-card">
                  <span className="card-label">JOIN A WORKOUT</span>
                  <h2>2. Enter the host's code</h2>
                  <p>If someone else is hosting, open their join link or enter the 6-character code here.</p>
                  <div className="join-row">
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength="6" placeholder="ABC123" />
                    <button onClick={joinTogetherSession}>Join</button>
                  </div>
                  {togetherMessage && <p className="status-message">{togetherMessage}</p>}
                </section>
              </>
            ) : (
              <>
                <section className="session-hero">
                  <span className="card-label">{activeSession.status === 'open' ? 'LIVE SESSION' : 'SESSION SUMMARY'}</span>
                  <div className="session-code">{activeSession.join_code}</div>
                  <div className="code-help">This is the code your workout partners enter.</div>
                  <h2>{sharedMeta?.program_name || programs[sharedProgramId]?.shortName || activeSession.program}</h2>
                  <p>{sharedMeta ? 'Week '+sharedMeta.week+' · '+sharedMeta.workout_title : 'Week '+activeSession.week+' · '+activeSession.lift}</p>
                  <div className="session-actions">
                    {activeSession.status === 'open' && <button onClick={shareSession}>Share join link</button>}
                    <button onClick={() => refreshTogether(activeSession.id)}>Refresh</button>
                  </div>
                </section>

                <section className="summary-grid together-summary">
                  <div><span>People</span><strong>{participants.length}</strong></div>
                  <div><span>Finished</span><strong>{sessionResults.filter(r => r.completed_at).length}</strong></div>
                  <div><span>Combined volume</span><strong>{formatWeight(combinedSessionVolume)} lb</strong></div>
                </section>

                <section className="simple-card">
                  <div className="section-heading"><div><span className="card-label">SESSION TIMER</span><h3>Shared workout clock</h3></div></div>
                  <SharedTimer
                    session={activeSession}
                    isHost={activeSession.host_user_id === session.user.id}
                    onChanged={() => refreshTogether(activeSession.id)}
                  />
                </section>

                {activeSession.session_note !== undefined && (
                  <section className="simple-card">
                    <div className="section-heading"><div><span className="card-label">SESSION NOTE</span><h3>Group note</h3></div></div>
                    {activeSession.host_user_id === session.user.id ? (
                      <textarea
                        className="notes"
                        defaultValue={activeSession.session_note || ''}
                        placeholder="Shared cue, goal, substitutions, or session note…"
                        onBlur={e => saveTogetherNote(e.target.value)}
                      />
                    ) : (
                      <p className="helper-text">{activeSession.session_note || 'No shared note from the host.'}</p>
                    )}
                  </section>
                )}

                <section className="simple-card">
                  <div className="section-heading"><div><span className="card-label">PARTNERS</span><h3>Live results</h3></div></div>
                  <div className="partner-list">
                    {participants.map(person => {
                      const result = sessionResults.find(r => r.user_id === person.user_id)
                      return (
                        <div className="partner-row" key={person.user_id}>
                          <div>
                            <strong>{person.display_name}{person.user_id === session.user.id ? ' (You)' : ''}</strong>
                            <span>{result?.completed_at ? 'Finished' : result ? 'Working' : 'Not started'}</span>
                          </div>
                          <div>
                            <strong>{result ? formatWeight(result.total_volume) + ' lb' : '—'}</strong>
                            <span>{result?.estimated_1rm ? 'e1RM ' + formatWeight(result.estimated_1rm) : ''}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {activeSession.status === 'open' && !ownSessionResult?.completed_at && (
                  <button className="primary-action" onClick={openSharedWorkout}>Open my shared workout</button>
                )}

                {ownSessionResult?.completed_at && (
                  <div className="completed-callout">✓ Your workout is finished. Your personal history and this shared summary both have it.</div>
                )}

                {activeSession.host_user_id === session.user.id && activeSession.status === 'open' && (
                  <button className="secondary-action danger-lite" onClick={endTogetherSession}>End shared session</button>
                )}

                {activeSession.status === 'completed' && activeSession.host_user_id === session.user.id && (
                  <button className="primary-action" onClick={repeatTogetherSession}>Repeat this session</button>
                )}

                <button className="secondary-action" onClick={leaveTogetherView}>Leave this view</button>
                {togetherMessage && <p className="status-message">{togetherMessage}</p>}
              </>
            )}
            </>}
          </section>
        ) : activeTab === 'program' ? (
          <PlanPage
            session={session}
            profile={profile}
            programs={programs}
            programOrder={programOrder}
            activeProgram={activeProgram}
            chooseProgram={chooseProgram}
            completedByWeek={completedByWeek}
            week={week}
            lifts={lifts}
            jumpToWorkout={jumpToWorkout}
          />
        ) : activeTab === 'whiteboard' ? (
          <WhiteboardPage session={session} />
        ) : activeTab === 'admin' ? (
          <AdminPanel programs={programs} />
        ) : (
          <section className="page-section">
            {displayName === 'WorkoutAdmin' && !isAdmin && (
              <section className="admin-setup-warning">
                <span className="card-label">ADMIN SETUP INCOMPLETE</span>
                <h3>WorkoutAdmin account exists, but the admin role has not been granted yet.</h3>
                <p>Run the admin migration and one-time grant query in Supabase. Then sign out and back in.</p>
              </section>
            )}

            <section className="profile-card">
              <span className="card-label">ACCOUNT</span>
              <h2>{displayName}</h2>
              <p>{session.user.email}</p>
              <label>Display name<input defaultValue={displayName} onBlur={e => saveDisplayName(e.target.value)} /></label>
            </section>

            <section className="me-dashboard-heading">
              <span className="card-label">YOUR DASHBOARD</span>
              <h2>Analytics & tracking</h2>
              <p>Strength, volume, bodyweight, PRs, goals, measurements, history, consistency and program tracking.</p>
            </section>

            <PlatformProgress
              view="mine"
              session={session}
              profile={profile}
              setProfile={setProfile}
              progress={progress}
              lifts={lifts}
              formatWeight={formatWeight}
              programs={programs}
              dbNameToProgram={dbNameToProgram}
            />

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">TRAINING MAXES</span><h3>Your current numbers</h3></div></div>
              <p className="helper-text">Enter your normal 85% training max. Powerbuilding and Strength + Power convert it internally for e1RM-based percentages.</p>
              <div className="tm-grid">
                {lifts.map(x => (
                  <label key={x}><span>{x}</span>
                    <div className="input-with-unit">
                      <input type="number" inputMode="decimal" value={trainingMaxes[x] || ''} placeholder="0"
                        onFocus={e => e.currentTarget.select()}
                        onChange={e => setTm(x,e.target.value)} />
                      <b>lb</b>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">CURRENT PROGRAM</span><h3>{personalProgram.name}</h3></div></div>
              <button className="wide-button" onClick={() => setActiveTab('program')}>Plan & programs</button>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">INVITE</span><h3>Invite someone</h3></div></div>
              <p className="helper-text">Anyone you invite gets their own account, program, maxes, history, and progress dashboard.</p>
              <button className="wide-button invite-button" onClick={shareInvite}>Share WorkoutBoard</button>
              {inviteState && <div className="invite-status">{inviteState}</div>}
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">APP</span><h3>Install WorkoutBoard</h3></div></div>
              <p className="helper-text">Install it on your phone or desktop for a full-screen app experience and faster reopening.</p>
              <InstallAppButton />
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">BACKUP</span><h3>Export your data</h3></div></div>
              <p className="helper-text">Downloads your completed session history as CSV.</p>
              <ExportDataButton userId={session.user.id} />
            </section>

            <WorkoutSettingsPanel session={session} />
            <AccountSecurityPanel session={session} appUrl={appUrl()} />
            <BackupRestorePanel session={session} />

            {isAdmin && (
              <section className="simple-card admin-entry">
                <div className="section-heading"><div><span className="card-label">WORKOUTADMIN</span><h3>Administration</h3></div></div>
                <p className="helper-text">View users, workout history, progress totals, training maxes, and manage current programs.</p>
                <button className="wide-button admin-button" onClick={() => setActiveTab('admin')}>Open Admin</button>
              </section>
            )}

            <button className="signout-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </section>
        )}

        <div className="bottom-space" />
      </main>

      {pendingWorkoutStart&&<div className="same-day-sheet-backdrop" onClick={()=>setPendingWorkoutStart(null)}>
        <section className="same-day-sheet" onClick={e=>e.stopPropagation()}>
          <span className="card-label">ANOTHER WORKOUT TODAY</span>
          <h3>You already completed {todayCompletedWorkouts.length||trackedTodayInfo?.workoutsToday||1} workout{(todayCompletedWorkouts.length||trackedTodayInfo?.workoutsToday||1)===1?'':'s'} today.</h3>
          <p>Start <strong>{pendingWorkoutStart.label}</strong> anyway?</p>
          <div><button className="secondary-action" onClick={()=>setPendingWorkoutStart(null)}>Cancel</button><button className="primary-action" onClick={confirmPendingWorkout}>Yes, start it</button></div>
        </section>
      </div>}
    </>
  )
}

export default App
