import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { PlatformProgress, PlanPage, AdminPanel, FeedbackPanel } from './platform'
import { PlannedWorkoutRunner, ExerciseHistoryStrip, InstallAppButton, ExportDataButton, SharedTimer } from './productFeatures'
import { WhiteboardPage } from './whiteboard'
import { TrainingTimer } from './trainingTools'
import { WorkoutCoach, MetconTracker, AccountSecurityPanel, BackupRestorePanel, WorkoutSettingsPanel } from './advancedFeatures'
import { archiveProgramById, makePlannedFromArchive } from './archivePrograms'
import QRCode from 'qrcode'
import { BarcodeDetector as BarcodeDetectorPonyfill } from 'barcode-detector/ponyfill'

const WORKSET_BUILD_ID = __WORKSET_BUILD_ID__

const localDateKey=(value=new Date())=>{
  const d=value instanceof Date ? value : new Date(value)
  if(Number.isNaN(d.getTime()))return ''
  const y=d.getFullYear()
  const m=String(d.getMonth()+1).padStart(2,'0')
  const day=String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

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
const defaultOneRms = { Squat:'', Bench:'', Deadlift:'', Press:'' }
const round5 = n => Math.round(n / 5) * 5
const appUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).toString()

function targetWeight(oneRm, pct, basis) {
  if (!oneRm || pct == null) return null
  const base = basis === 'e1rm' ? oneRm : oneRm * 0.85
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

const classicLiftExerciseNames = {
  Squat:'Back Squat',
  Bench:'Bench Press',
  Deadlift:'Deadlift',
  Press:'Overhead Press',
}

function classicSetProgressFromPrescription(text) {
  const value=String(text||'').trim()
  const multi=value.match(/(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?([^,;]*)/i)
  if(multi){
    const sets=Math.max(1,Number(multi[1])||1)
    const reps=Math.max(1,Number(multi[2])||1)
    const upper=Number(multi[3]||0)
    const suffix=String(multi[4]||'').trim().replace(/^\s+/,'')
    const repLabel=upper ? reps+'-'+upper+(suffix?' '+suffix:'') : reps+(suffix?' '+suffix:'')
    return Array.from({length:sets},(_,i)=>({
      set:i+1,reps,label:repLabel,done:false,weight:'',
      editable_reps:Boolean(upper)||/amrap|max|rpe|as performed/i.test(value),
    }))
  }

  const setsOnly=value.match(/(\d+)\s*sets?/i)
  if(setsOnly){
    const sets=Math.max(1,Number(setsOnly[1])||1)
    return Array.from({length:sets},(_,i)=>({
      set:i+1,reps:null,label:'As performed',done:false,weight:'',editable_reps:true,
    }))
  }

  const repRange=value.match(/(\d+)\s*[-–]\s*(\d+)\s*reps?/i)
  if(repRange){
    return [{
      set:1,reps:Number(repRange[1]),label:repRange[1]+'-'+repRange[2]+' reps',
      done:false,weight:'',editable_reps:true,
    }]
  }

  const xRange=value.match(/(?:^|\s)x\s*(\d+)\s*[-–]\s*(\d+)/i)
  if(xRange){
    return [{
      set:1,reps:Number(xRange[1]),label:xRange[1]+'-'+xRange[2]+' reps',
      done:false,weight:'',editable_reps:true,
    }]
  }

  if(/single/i.test(value)){
    return [{set:1,reps:1,label:'1 rep',done:false,weight:'',editable_reps:false}]
  }

  return [{set:1,reps:null,label:'As performed',done:false,weight:'',editable_reps:true}]
}

function classicAssistanceExercise(text,restSeconds,index) {
  const value=String(text||'').trim()
  let name=value||'Assistance'
  let prescription='As performed'
  const scheme=value.match(/\b\d+\s*(?:[x×]|sets?\b)/i)
  const totalRange=value.match(/\b\d+\s*[-–]\s*\d+\s*reps?/i)
  const split=scheme||totalRange
  if(split&&split.index>0){
    name=value.slice(0,split.index).trim()
    prescription=value.slice(split.index).trim()
  }
  const setProgress=classicSetProgressFromPrescription(prescription)
  return {
    id:'assist-'+index,
    name:name||'Assistance',
    prescription,
    rest_seconds:Number(restSeconds||75),
    result:'',load:'',done:false,setProgress,
  }
}

function classicSecondaryExercises(programId,week,lift,oneRms,plan) {
  const secondary=plan.secondary
  if(!secondary?.title)return []
  const program=programs[programId]
  const mainName=classicLiftExerciseNames[lift]||lift
  const currentOneRm=Number(oneRms?.[lift]||0)
  const parts=String(secondary.title).split(/\s+\+\s+/).map(x=>x.trim()).filter(Boolean)
  const result=parts.map((part,index)=>{
    const lower=part.toLowerCase()
    let name
    if(/widowmaker/.test(lower)) name=mainName+' — Widowmaker'
    else if(/\bfsl\b|first[ -]?set/.test(lower)) name=mainName+' — FSL'
    else if(/\bbbb\b/.test(lower)) name=mainName+' — BBB'
    else if(/joker/.test(lower)) name=mainName+' — Joker'
    else if(/tm test|training max|100% tm/.test(lower)) name=mainName+' — TM Test'
    else if(/backoff|back-off/.test(lower)) name=mainName+' — Backoff'
    else {
      const movement=part.replace(/\s+\d+\s*[x×].*$/i,'').replace(/\s+@.*$/,'').trim()
      name=movement||secondary.label||'Supplemental'
    }

    const setProgress=classicSetProgressFromPrescription(part)
    const textLift=/bench/i.test(part)?'Bench'
      : /deadlift/i.test(part)?'Deadlift'
      : /squat/i.test(part)?'Squat'
      : /press/i.test(part)?'Press'
      : lift
    const explicitPct=part.match(/@\s*([0-9]+(?:\.[0-9]+)?)(?:\s*[-–]\s*([0-9]+(?:\.[0-9]+)?))?\s*%/i)
    const pct=explicitPct?Number(explicitPct[1]):secondary.pct
    const autoWeight=pct!=null && (
      Boolean(explicitPct) ||
      parts.length===1 ||
      /\bfsl\b|first[ -]?set|\bbbb\b|widowmaker|tm test|training max|100% tm|backoff|back-off/i.test(part)
    ) && !(parts.length>1&&/joker/i.test(part)&&!explicitPct)
    const sourceOneRm=Number(oneRms?.[textLift]||currentOneRm||0)
    const prescribedWeight=autoWeight ? targetWeight(sourceOneRm,pct,program.basis) : ''
    if(autoWeight)setProgress.forEach(set=>{
      set.weight=prescribedWeight||''
      set.weight_lift=textLift
      set.weight_basis=program.basis
      set.pct=pct!=null?Number(pct):null
    })
    if(explicitPct?.[2]&&sourceOneRm){
      const upper=targetWeight(sourceOneRm,Number(explicitPct[2]),program.basis)
      setProgress.forEach(set=>{set.target_weight_range=prescribedWeight+'-'+upper+' lb'})
    }

    return {
      id:'secondary-'+index,
      name,
      prescription:part,
      note:secondary.label||'Supplemental work',
      rest_seconds:Number(plan.rest?.secondary||120),
      result:'',load:'',done:false,setProgress,
    }
  })

  if((plan.jokers||[]).length && !result.some(item=>/joker/i.test(item.name))){
    result.unshift({
      id:'joker-sets',
      name:mainName+' — Joker Sets',
      prescription:(plan.jokers||[]).length+' sets · choose load and reps as performed',
      note:'Optional heavier work. Stop before a grinder.',
      rest_seconds:Number(plan.rest?.secondary||180),
      result:'',load:'',done:false,
      setProgress:(plan.jokers||[]).map((item,index)=>({
        set:index+1,reps:null,label:item.label||('Joker '+(index+1)),
        done:false,weight:'',editable_reps:true,
      })),
    })
  }
  return result
}

function makePlannedFromClassic(programId,week,lift,scheduledDate,oneRms,trackingProgramKey='',trackingWorkoutKey='') {
  const program=programs[programId] || programs['andy-hybrid-12']
  const plan=getProgramWeek(programId,week,lift)
  const mainName=classicLiftExerciseNames[lift]||lift
  const oneRm=Number(oneRms?.[lift]||0)
  const mainSets=(plan.main||[]).map((set,index)=>{
    const repsText=String(set.reps??'')
    const reps=Math.max(1,Number.parseInt(repsText,10)||1)
    const pctText=set.pctLabel || (set.pct!=null?set.pct+'%':'RPE / manual load')
    return {
      set:index+1,
      reps,
      label:pctText+' × '+repsText,
      done:false,
      weight:set.pct!=null ? (targetWeight(oneRm,set.pct,program.basis)||'') : '',
      weight_lift:lift,
      weight_basis:program.basis,
      pct:set.pct!=null?Number(set.pct):null,
      editable_reps:/[+]|[-–]|rpe|amrap|max/i.test(repsText+' '+pctText),
    }
  })
  const mainPrescription=(plan.main||[]).map(set=>{
    const pctText=set.pctLabel || (set.pct!=null?set.pct+'%':'RPE / manual')
    return pctText+' × '+set.reps
  }).join(' · ')

  const exercises=[
    {
      id:'main',
      name:mainName,
      prescription:mainPrescription||'Main work',
      note:[plan.phase,plan.rule].filter(Boolean).join(' · '),
      rest_seconds:Number(plan.rest?.main||180),
      result:'',load:'',done:false,setProgress:mainSets,
      primary_lift:lift,
    },
    ...classicSecondaryExercises(programId,week,lift,oneRms,plan),
    ...(plan.assistance||[]).map((item,index)=>classicAssistanceExercise(
      item,
      typeof plan.rest?.assistance==='function' ? plan.rest.assistance(item) : plan.rest?.assistance,
      index
    )),
  ]

  const conditioning=String(plan.conditioning||'').trim()
  const hasConditioning=Boolean(conditioning&&conditioning!=='None')
  const conditioningPrescribed=Boolean(hasConditioning&&!/^optional\b/i.test(conditioning))

  return {
    scheduled_date:scheduledDate,
    title:lift+' Day',
    source_program_name:program.name,
    source_week:Number(week),
    source_day:lift,
    workout:{
      version:2,
      type:'flexible',
      classic_program_id:programId,
      tracking_program_key:trackingProgramKey||undefined,
      tracking_workout_key:trackingWorkoutKey||undefined,
      started_explicitly:true,
      source:'Workset built-in',
      phase:plan.phase||'',
      rule:plan.rule||'',
      exercises,
      conditioning_plan:hasConditioning?conditioning:'',
      conditioningEnabled:conditioningPrescribed,
      conditioning_prescribed:conditioningPrescribed,
      metcon:{name:hasConditioning?conditioning:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'},
      sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',
    },
    status:'started',
  }
}

function personalizeWorkoutLoads(workout,maxes={}) {
  return {
    ...workout,
    exercises:(workout?.exercises||[]).map(item=>({
      ...item,
      setProgress:(item.setProgress||[]).map(set=>{
        const targetLift=set.weight_lift
        const pct=set.pct
        if(!targetLift||pct==null)return {...set}
        const low=targetWeight(Number(maxes?.[targetLift]||0),Number(pct),set.weight_basis||'e1rm')
        const high=set.pct_high!=null
          ? targetWeight(Number(maxes?.[targetLift]||0),Number(set.pct_high),set.weight_basis||'e1rm')
          : null
        return {
          ...set,
          weight:low||'',
          target_weight_range:high&&high!==low?low+'-'+high+' lb':set.target_weight_range||'',
        }
      })
    }))
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

const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

function canonicalMainLift(name) {
  const value=String(name||'').trim().toLowerCase()
  if(/^(back\s+)?squat$/.test(value)) return 'Squat'
  if(/^(barbell\s+)?bench(\s+press)?$/.test(value)) return 'Bench'
  if(/^(conventional\s+|sumo\s+)?deadlift$/.test(value)) return 'Deadlift'
  if(/^(overhead\s+|strict\s+|military\s+)?press$/.test(value)) return 'Press'
  return null
}

function calculatedOneRmsFromWorkouts(sessions=[],legacyRows=[]) {
  const best=Object.fromEntries(lifts.map(name=>[name,null]))
  const consider=(lift,weight,reps,source='Workout')=>{
    const w=Number(weight||0),r=Number(reps||0)
    if(!lift||!w||!r||r>15)return
    const estimate=round2(e1rm(w,r))
    if(!best[lift]||estimate>best[lift].value)best[lift]={value:estimate,weight:w,reps:r,source}
  }
  for(const row of sessions||[]){
    const workout=row.workout||{}
    for(const item of workout.exercises||[]){
      const lift=canonicalMainLift(item.name)
      if(!lift)continue
      const prescriptionReps=Number(String(item.prescription||'').match(/\d+\s*[x×]\s*(\d+(?:\.\d+)?)/i)?.[1]||0)
      for(const set of item.setProgress||[]){
        if(set.done===false)continue
        const weight=Number(set.weight!==undefined&&set.weight!==''?set.weight:item.load||0)
        consider(lift,weight,Number(set.reps||prescriptionReps),row.title||item.name)
      }
    }
    const legacyLift=lifts.includes(row.primary_lift)?row.primary_lift:null
    if(legacyLift){
      for(const set of workout.main||[])consider(legacyLift,set.weight,set.actualReps||set.reps,row.title||legacyLift)
    }
  }
  for(const row of legacyRows||[]){
    if(!row.completed_at||!lifts.includes(row.lift))continue
    for(const set of row.workout?.main||[])consider(row.lift,set.weight,set.actualReps||set.reps,row.program||row.lift)
  }
  return best
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
        <div className="brand-lockup"><img src={import.meta.env.BASE_URL+'icon.svg'} alt="" /><span>Work<b>set</b></span></div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-sub">{mode === 'signin' ? 'Use your Workset email and password.' : 'Just enter an email and password.'}</p>

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
        <div className="brand-lockup"><img src={import.meta.env.BASE_URL+'icon.svg'} alt="" /><span>Work<b>set</b></span></div>
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
  const [oneRepMaxes,setOneRepMaxes] = useState(defaultOneRms)
  const [oneRmWeight,setOneRmWeight] = useState('')
  const [oneRmReps,setOneRmReps] = useState(5)
  const [oneRmLift,setOneRmLift] = useState('')
  const [baselineTestChoice,setBaselineTestChoice] = useState('')
  const [history,setHistory] = useState([])
  const [saveState,setSaveState] = useState('Saved')
  const [inviteState,setInviteState] = useState('')
  const [log,setLog] = useState(() => makeLog('andy-hybrid-12',1,'Squat',0))

  const [togetherReady,setTogetherReady] = useState(null)
  const [activeSession,setActiveSession] = useState(null)
  const [participants,setParticipants] = useState([])
  const [sessionResults,setSessionResults] = useState([])
  const [sessionOneRms,setSessionOneRms] = useState({})
  const [friends,setFriends] = useState([])
  const [incomingFriendRequests,setIncomingFriendRequests] = useState([])
  const [outgoingFriendRequests,setOutgoingFriendRequests] = useState([])
  const [selectedFriendIds,setSelectedFriendIds] = useState([])
  const [friendAddOpen,setFriendAddOpen] = useState(false)
  const [friendEmail,setFriendEmail] = useState('')
  const [friendMessage,setFriendMessage] = useState('')
  const [friendManageOpen,setFriendManageOpen] = useState(false)
  const [managedAthletes,setManagedAthletes] = useState([])
  const [selectedManagedAthleteIds,setSelectedManagedAthleteIds] = useState([])
  const [managedAthleteEditorOpen,setManagedAthleteEditorOpen] = useState(false)
  const [managedAthleteDraft,setManagedAthleteDraft] = useState({id:null,display_name:'',Squat:'',Bench:'',Deadlift:'',Press:''})
  const [joinCode,setJoinCode] = useState('')
  const [togetherMessage,setTogetherMessage] = useState('')
  const [togetherAction,setTogetherAction] = useState('')
  const [incomingTogetherInvites,setIncomingTogetherInvites] = useState([])
  const [recentTogetherSessions,setRecentTogetherSessions] = useState([])
  const [inviteEmail,setInviteEmail] = useState('')
  const [invitePanelOpen,setInvitePanelOpen] = useState(false)
  const [sessionQr,setSessionQr] = useState('')
  const [showSessionQr,setShowSessionQr] = useState(false)
  const [qrScanning,setQrScanning] = useState(false)
  const [qrScanMessage,setQrScanMessage] = useState('')
  const qrVideoRef=useRef(null)
  const [sharedWorkoutActive,setSharedWorkoutActive] = useState(false)
  const [isAdmin,setIsAdmin] = useState(false)
  const [plannedToday,setPlannedToday] = useState(null)
  const [showRegularToday,setShowRegularToday] = useState(false)
  const [togetherTracking,setTogetherTracking] = useState([])
  const [togetherProgramKey,setTogetherProgramKey] = useState('')
  const [togetherWeek,setTogetherWeek] = useState(1)
  const [togetherWorkoutIndex,setTogetherWorkoutIndex] = useState(0)
  const [trackedTodayInfo,setTrackedTodayInfo] = useState(null)
  const [trackedProgramsInfo,setTrackedProgramsInfo] = useState([])
  const [togetherView,setTogetherView] = useState('live')
  const [conditioningOpen,setConditioningOpen] = useState(false)
  const [completionSummary,setCompletionSummary] = useState(null)
  const [baselineFinishReview,setBaselineFinishReview] = useState(null)
  const [extraWorkoutOpen,setExtraWorkoutOpen] = useState(false)
  const [nextDayPreviewOpen,setNextDayPreviewOpen] = useState(false)
  const [pendingWorkoutStart,setPendingWorkoutStart] = useState(null)
  const [todayCompletedWorkouts,setTodayCompletedWorkouts] = useState([])
  const [completedDeletePrompt,setCompletedDeletePrompt] = useState(null)
  const [deletingCompletedWorkout,setDeletingCompletedWorkout] = useState(false)
  const [workoutStartError,setWorkoutStartError] = useState('')
  const [classicCancelConfirm,setClassicCancelConfirm] = useState(false)
  const [classicCancelling,setClassicCancelling] = useState(false)
  const [feedbackUnread,setFeedbackUnread] = useState(0)
  const [feedbackToast,setFeedbackToast] = useState(null)
  const [progressStartSection,setProgressStartSection] = useState('Overview')
  const [completedTrainingSessions,setCompletedTrainingSessions] = useState([])
  const [programCompletionPrompt,setProgramCompletionPrompt] = useState(null)
  const [oneRmNotice,setOneRmNotice] = useState(null)
  const [releaseUpdate,setReleaseUpdate] = useState(null)

  useEffect(()=>{
    if(!import.meta.env.PROD)return
    let cancelled=false
    let timer=null
    const checkRelease=async()=>{
      try{
        const res=await fetch(import.meta.env.BASE_URL+'version.json?ts='+Date.now(),{cache:'no-store'})
        if(!res.ok)return
        const info=await res.json()
        if(!cancelled&&info?.buildId&&info.buildId!==WORKSET_BUILD_ID){
          setReleaseUpdate(info)
        }
      }catch{}
    }
    const refresh=()=>{
      if(document.visibilityState==='hidden')return
      clearTimeout(timer)
      timer=setTimeout(checkRelease,350)
    }
    checkRelease()
    const interval=setInterval(checkRelease,5*60*1000)
    window.addEventListener('focus',refresh)
    window.addEventListener('pageshow',refresh)
    document.addEventListener('visibilitychange',refresh)
    return()=>{
      cancelled=true
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('focus',refresh)
      window.removeEventListener('pageshow',refresh)
      document.removeEventListener('visibilitychange',refresh)
    }
  },[])

  const applyReleaseUpdate=async()=>{
    if(!releaseUpdate?.buildId)return
    try{
      if('caches' in window){
        const keys=await caches.keys()
        await Promise.all(keys.filter(key=>/^(workoutboard|workset)-/i.test(key)).map(key=>caches.delete(key)))
      }
      if('serviceWorker' in navigator){
        const regs=await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(reg=>reg.unregister()))
      }
    }catch{}
    const url=new URL(window.location.href)
    url.searchParams.set('_workset_release',String(releaseUpdate.buildId).slice(0,12))
    window.location.replace(url.toString())
  }

  const personalProgram = programs[activeProgram]
  const sharedProgramId = activeSession ? (dbNameToProgram[activeSession.program] || activeProgram) : activeProgram
  const workoutProgramId = sharedWorkoutActive && activeSession ? sharedProgramId : activeProgram
  const workoutProgram = programs[workoutProgramId]
  const plan = getProgramWeek(workoutProgramId,week,lift)
  const tm = Number(oneRepMaxes[lift] || 0)

  const oneRmEstimate = useMemo(() => {
    const weight=Number(oneRmWeight)
    const reps=Math.max(1,Math.min(15,Number(oneRmReps)||1))
    if(!weight)return 0
    return reps===1 ? weight : weight*(1+reps/30)
  },[oneRmWeight,oneRmReps])
  const oneRmRounded = oneRmEstimate ? round2(oneRmEstimate) : 0
  const oneRmTrainingMax = oneRmEstimate ? round2(oneRmRounded*.85) : 0
  const calculatedOneRms = useMemo(
    () => calculatedOneRmsFromWorkouts(completedTrainingSessions,history),
    [completedTrainingSessions,history]
  )

  const buildTrackedProgramInfo = (track,completedRows,today) => {
    const key=String(track?.program_key||'')
    const afterStart=(completedRows||[]).filter(row=>
      row.completed_at && new Date(row.completed_at).getTime()>=new Date(track.started_at).getTime()
    )
    const trackRows=afterStart.filter(row=>{
      if(row.workout?.tracking_program_key===key)return true
      if(key.startsWith('archive:')){
        const program=archiveProgramById[key.slice(8)]
        return Boolean(program&&row.program===program.name)
      }
      if(key.startsWith('classic:')){
        const program=programs[key.slice(8)]
        return Boolean(program&&row.program===program.dbName)
      }
      return false
    })
    const workoutsToday=trackRows.filter(row=>(row.session_date||localDateKey(row.completed_at))===today).length

    const rowMatchesSlot=(row,slot)=>{
      if(row.workout?.tracking_workout_key && row.workout.tracking_workout_key===slot.trackingWorkoutKey)return true
      if(Number(row.week)!==Number(slot.week))return false
      const rowDay=String(row.primary_lift||row.title||'').trim().toLowerCase()
      return rowDay===String(slot.matchDay||slot.title||'').trim().toLowerCase()
    }

    if(key.startsWith('archive:')){
      const archiveId=key.slice(8)
      const program=archiveProgramById[archiveId]
      if(!program?.getWeek||!program.weeksCount||!program.daysPerWeek)return null
      const slots=[]
      for(let programWeek=1;programWeek<=Number(program.weeksCount);programWeek++){
        const days=program.getWeek(programWeek)||[]
        days.forEach((workoutDay,dayIndex)=>{
          const slot={
            week:programWeek,dayIndex,
            title:workoutDay.title,
            matchDay:workoutDay.title,
            note:workoutDay.note||'',
            exercises:workoutDay.exercises||[],
            trackingWorkoutKey:`${key}|w${programWeek}|d${dayIndex}`,
          }
          slot.completed=trackRows.some(row=>rowMatchesSlot(row,slot))
          slots.push(slot)
        })
      }
      const incomplete=slots.filter(slot=>!slot.completed)
      const completedCount=slots.length-incomplete.length
      const currentWeek=incomplete[0]?.week||Number(program.weeksCount)
      const weekChoices=slots.filter(slot=>slot.week===currentWeek)
      const upcoming=incomplete.slice(0,3)
      return {
        kind:'archive',key,trackingId:track.id,startedAt:track.started_at,archiveId,name:program.name,
        category:program.category||'Program',durationLabel:program.durationLabel||'',
        completed:completedCount,total:slots.length,
        completedToday:workoutsToday>0,workoutsToday,
        nextWeek:upcoming[0]?.week||currentWeek,nextDayIndex:upcoming[0]?.dayIndex||0,
        nextTitle:upcoming[0]?.title||'',upcoming,weekChoices,currentWeek,
        complete:incomplete.length===0,
      }
    }

    if(key.startsWith('classic:')){
      const programId=key.slice(8)
      const program=programs[programId]
      if(!program?.weeksCount)return null
      const slots=[]
      for(let programWeek=1;programWeek<=Number(program.weeksCount);programWeek++){
        lifts.forEach((liftName,dayIndex)=>{
          const workoutPlan=getProgramWeek(programId,programWeek,liftName)
          const mainPrescription=(workoutPlan.main||[]).map(set=>(set.pctLabel||set.pct+'%')+' × '+set.reps).join(', ')
          const exercises=[{name:liftName,prescription:mainPrescription||'Main work'}]
          if(workoutPlan.secondary?.title)exercises.push({name:workoutPlan.secondary.label||'Supplemental',prescription:workoutPlan.secondary.title})
          const slot={
            week:programWeek,dayIndex,lift:liftName,title:liftName+' Day',matchDay:liftName,
            note:workoutPlan.phase||'',exercises,
            trackingWorkoutKey:`${key}|w${programWeek}|${liftName.toLowerCase()}`,
          }
          slot.completed=trackRows.some(row=>rowMatchesSlot(row,slot))
          slots.push(slot)
        })
      }
      const incomplete=slots.filter(slot=>!slot.completed)
      const completedCount=slots.length-incomplete.length
      const currentWeek=incomplete[0]?.week||Number(program.weeksCount)
      const weekChoices=slots.filter(slot=>slot.week===currentWeek)
      const upcoming=incomplete.slice(0,3)
      return {
        kind:'classic',key,trackingId:track.id,startedAt:track.started_at,programId,name:program.name,
        category:'Strength',durationLabel:'',
        completed:completedCount,total:slots.length,
        completedToday:workoutsToday>0,workoutsToday,
        nextWeek:upcoming[0]?.week||currentWeek,nextDayIndex:upcoming[0]?.dayIndex||0,
        nextLift:upcoming[0]?.lift||lifts[0],nextTitle:upcoming[0]?.title||'',
        upcoming,weekChoices,currentWeek,complete:incomplete.length===0,
      }
    }

    return null
  }

  useEffect(() => {
    const dismissKeyboard = event => {
      const target=event.target
      if(!(target instanceof Element))return
      if(target.closest('input, textarea, select, button, a, label, [contenteditable="true"]'))return
      const active=document.activeElement
      if(active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName))active.blur()
    }
    document.addEventListener('pointerdown',dismissKeyboard)
    return ()=>document.removeEventListener('pointerdown',dismissKeyboard)
  },[])

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

  useEffect(() => {
    if(!session?.user||!isAdmin)return
    let mounted=true
    supabase.from('feedback_submissions').select('*',{count:'exact',head:true}).eq('status','new').then(({count,error})=>{
      if(mounted&&!error)setFeedbackUnread(count||0)
    })
    const channel=supabase.channel('workoutboard-admin-feedback')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'feedback_submissions'},payload=>{
        const row=payload.new
        setFeedbackUnread(v=>v+1)
        setFeedbackToast(row)
      }).subscribe()
    return ()=>{mounted=false;supabase.removeChannel(channel)}
  },[session?.user?.id,isAdmin])

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
      const today = localDateKey()
      const [{data:profileData},{data:oneRmData},{data:tmData},{data:logsData},{data:todayPlans},{data:trackingData},{data:flexCompleted}] = await Promise.all([
        supabase.from('profiles').select('*').eq('id',userId).single(),
        supabase.from('one_rep_maxes').select('*').eq('user_id',userId).maybeSingle(),
        supabase.from('training_maxes').select('*').eq('user_id',userId).single(),
        supabase.from('workout_logs').select('*').eq('user_id',userId).order('updated_at',{ascending:false}),
        supabase.from('planned_workouts').select('*').eq('user_id',userId).eq('scheduled_date',today).in('status',['planned','started','skipped']).order('created_at'),
        supabase.from('user_program_tracking').select('*').eq('user_id',userId).eq('status','tracking').order('updated_at',{ascending:false}),
        supabase.from('training_sessions').select('id,title,program,week,primary_lift,workout,session_date,completed_at').eq('user_id',userId).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(1000),
      ])

      const savedMetaOneRms=session.user.user_metadata?.one_rep_maxes
      const loadedOneRms=oneRmData ? {
        Squat:oneRmData.squat ?? '',
        Bench:oneRmData.bench ?? '',
        Deadlift:oneRmData.deadlift ?? '',
        Press:oneRmData.press ?? '',
      } : savedMetaOneRms&&typeof savedMetaOneRms==='object' ? {
        Squat:savedMetaOneRms.Squat ?? '',
        Bench:savedMetaOneRms.Bench ?? '',
        Deadlift:savedMetaOneRms.Deadlift ?? '',
        Press:savedMetaOneRms.Press ?? '',
      } : tmData ? {
        Squat:tmData.squat==null?'':round2(Number(tmData.squat)/.85),
        Bench:tmData.bench==null?'':round2(Number(tmData.bench)/.85),
        Deadlift:tmData.deadlift==null?'':round2(Number(tmData.deadlift)/.85),
        Press:tmData.press==null?'':round2(Number(tmData.press)/.85),
      } : defaultOneRms

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

      const activeSupportedTracks=(trackingData||[])
        .filter(row=>/^(archive|classic):/.test(String(row.program_key||'')))
        .sort((a,b)=>new Date(a.started_at)-new Date(b.started_at))
      const activeArchiveTracks=activeSupportedTracks.filter(row=>String(row.program_key||'').startsWith('archive:'))
      const multipleTrackedPrograms=activeSupportedTracks.length>1
      const workoutsToday=(flexCompleted||[]).filter(row=>(row.session_date||localDateKey(row.completed_at))===today).length
      const activeTrackKeys=new Set(activeArchiveTracks.map(row=>row.program_key))
      let resolvedTodayPlan=multipleTrackedPrograms
        ? (todayPlans||[]).find(row=>
            row.workout?.started_explicitly ||
            plannedWorkoutHasProgress(row) ||
            ((row.status==='started'||row.status==='planned')&&!row.workout?.tracking_program_key)
          ) || null
        : (todayPlans||[]).find(row=>row.status==='planned'||row.status==='started') || null

      if(multipleTrackedPrograms){
        const staleAutoRows=(todayPlans||[]).filter(row=>
          (row.status==='planned'||row.status==='started') &&
          activeTrackKeys.has(row.workout?.tracking_program_key) &&
          !row.workout?.started_explicitly &&
          !plannedWorkoutHasProgress(row)
        )
        if(staleAutoRows.length){
          await Promise.all(staleAutoRows.map(row=>supabase.from('planned_workouts').update({status:'skipped',updated_at:new Date().toISOString()}).eq('id',row.id)))
        }
      }

      const trackInfos=activeSupportedTracks
        .map(track=>buildTrackedProgramInfo(track,flexCompleted||[],today))
        .filter(Boolean)
      for(const activeArchiveTrack of activeArchiveTracks){
        const info=trackInfos.find(item=>item.key===activeArchiveTrack.program_key)
        const trackedProgram=archiveProgramById[info?.archiveId]
        if(!info||!trackedProgram)continue
        const completedCount=info.completed
        const completedToday=info.completedToday
        const total=info.total
        const nextWeek=info.nextWeek
        const nextDayIndex=info.nextDayIndex
        const nextDay=info.upcoming?.[0] ? trackedProgram.getWeek(nextWeek)?.[nextDayIndex] : null

        if(!multipleTrackedPrograms){
          const staleTrackedToday=workoutsToday>0 &&
            resolvedTodayPlan?.workout?.tracking_program_key===activeArchiveTrack.program_key &&
            !resolvedTodayPlan?.workout?.started_explicitly &&
            !plannedWorkoutHasProgress(resolvedTodayPlan)
          if(staleTrackedToday){
            await supabase.from('planned_workouts').update({status:'skipped',updated_at:new Date().toISOString()}).eq('id',resolvedTodayPlan.id)
            resolvedTodayPlan=null
          }
          const cancelledTrackedToday=(todayPlans||[]).some(row=>row.status==='skipped'&&row.workout?.tracking_program_key===activeArchiveTrack.program_key)
          if(!resolvedTodayPlan && !completedToday && !cancelledTrackedToday && completedCount<total && nextDay){
            const plannedPayload=makePlannedFromArchive(trackedProgram,nextWeek,nextDayIndex,today,loadedOneRms)
            plannedPayload.workout={...plannedPayload.workout,tracking_program_key:activeArchiveTrack.program_key}
            const inserted=await supabase.from('planned_workouts').insert({...plannedPayload,user_id:userId}).select().single()
            if(!inserted.error)resolvedTodayPlan=inserted.data
          }
        }
      }

      setPlannedToday(resolvedTodayPlan)
      setTrackedProgramsInfo(trackInfos)
      setTrackedTodayInfo(trackInfos[0]||null)
      setTodayCompletedWorkouts((flexCompleted||[]).filter(row=>(row.session_date||localDateKey(row.completed_at))===today))
      setCompletedTrainingSessions(flexCompleted||[])
      setShowRegularToday(false)
      setTogetherTracking(trackingData || [])

      setOneRepMaxes(loadedOneRms)

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

  const plannedWorkoutHasProgress = row => {
    const workout=row?.workout||{}
    const exerciseProgress=(workout.exercises||[]).some(item=>{
      if(item.done || String(item.result||'').trim() || Number(item.load||0))return true
      return (item.setProgress||[]).some(set=>set.done)
    })
    const conditioning=workout.metcon||{}
    const conditioningProgress=Boolean(
      conditioning.format || conditioning.name || conditioning.activity || conditioning.duration ||
      conditioning.workTime || conditioning.restTime || conditioning.interval || conditioning.time ||
      conditioning.rounds || conditioning.reps || conditioning.distance || conditioning.calories
    )
    return exerciseProgress || conditioningProgress || Boolean(String(workout.note||'').trim())
  }

  const refreshTrackedProgramsInfo = async () => {
    if(!session?.user)return []
    const today=localDateKey()
    const [{data:trackingRows},{data:completedRows}]=await Promise.all([
      supabase.from('user_program_tracking').select('*')
        .eq('user_id',session.user.id).eq('status','tracking').order('started_at'),
      supabase.from('training_sessions').select('id,title,program,week,primary_lift,workout,session_date,completed_at')
        .eq('user_id',session.user.id).not('completed_at','is',null)
        .order('completed_at',{ascending:false}).limit(1000)
    ])
    const activeSupportedTracks=(trackingRows||[]).filter(row=>/^(archive|classic):/.test(String(row.program_key||'')))
    const infos=activeSupportedTracks.map(track=>buildTrackedProgramInfo(track,completedRows||[],today)).filter(Boolean)
    setTrackedProgramsInfo(infos)
    setTrackedTodayInfo(infos[0]||null)
    setTogetherTracking(trackingRows||[])
    return infos
  }

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

  const startTrackedWorkout = async (trackInfo=trackedTodayInfo,{confirmed=false,selectedWorkout=null}={}) => {
    if(!session?.user || !trackInfo || trackInfo.complete)return
    const chosenWorkout=selectedWorkout||trackInfo.upcoming?.[0]
    if(!chosenWorkout)return
    if((trackInfo.workoutsToday||todayCompletedWorkouts.length||0)>0 && !confirmed){
      setPendingWorkoutStart({kind:'program',trackingKey:trackInfo.key,workoutKey:chosenWorkout.trackingWorkoutKey,label:chosenWorkout.title||'program workout'})
      return
    }
    if(trackInfo.kind==='classic'){
      const programId=trackInfo.programId
      const nextWeek=chosenWorkout.week||trackInfo.nextWeek||1
      const nextLift=chosenWorkout.lift||trackInfo.nextLift||lifts[chosenWorkout.dayIndex]||'Squat'
      const today=localDateKey()
      const plannedPayload=makePlannedFromClassic(
        programId,nextWeek,nextLift,today,oneRepMaxes,
        trackInfo.key,chosenWorkout.trackingWorkoutKey
      )
      const {data,error}=await supabase.from('planned_workouts')
        .insert({...plannedPayload,user_id:session.user.id}).select().single()
      if(error){setWorkoutStartError(error.message);return}
      setActiveProgram(programId)
      setWeek(nextWeek)
      setLift(nextLift)
      setTrackedTodayInfo(trackInfo)
      activatePlannedWorkout(data)
      return
    }
    const program=archiveProgramById[trackInfo.archiveId]
    const next=chosenWorkout
    if(!program?.getWeek || !next)return
    const today=localDateKey()
    const plannedPayload=makePlannedFromArchive(program,next.week,next.dayIndex,today,oneRepMaxes)
    plannedPayload.status='started'
    plannedPayload.workout={...plannedPayload.workout,tracking_program_key:trackInfo.key,tracking_workout_key:next.trackingWorkoutKey,started_explicitly:true}
    const {data,error}=await supabase.from('planned_workouts').insert({...plannedPayload,user_id:session.user.id}).select().single()
    if(error){setWorkoutStartError(error.message);return}
    setTrackedTodayInfo(trackInfo)
    activatePlannedWorkout(data)
  }

  const scheduleClassicWorkoutFromPlan = async ({programId,week:targetWeek,lift:targetLift,scheduledDate}) => {
    if(!session?.user)return {error:'Sign in to schedule a workout.'}
    if(!programs[programId]||!lifts.includes(targetLift))return {error:'That workout could not be scheduled.'}

    const activeTrack=trackedProgramsInfo.find(info=>info.kind==='classic'&&info.programId===programId)
    const trackingKey=activeTrack?.key||''
    const trackingWorkoutKey=trackingKey
      ? `${trackingKey}|w${Number(targetWeek)}|${String(targetLift).toLowerCase()}`
      : ''
    const payload=makePlannedFromClassic(
      programId,
      Number(targetWeek),
      targetLift,
      scheduledDate,
      oneRepMaxes,
      trackingKey,
      trackingWorkoutKey
    )
    payload.status='planned'
    payload.workout={...payload.workout,started_explicitly:false}

    const {data,error}=await supabase.from('planned_workouts')
      .insert({...payload,user_id:session.user.id}).select().single()
    if(error)return {error:error.message}
    if(scheduledDate===localDateKey())await refreshPlannedToday()
    return {data}
  }

  const startStrengthBaseline = async (path='full',{confirmed=false,liftName=null}={}) => {
    if(!session?.user)return
    const pathLifts=path==='upper' ? ['Bench','Press']
      : path==='lower' ? ['Squat','Deadlift']
      : path==='single'&&liftName ? [liftName]
      : lifts
    const label=path==='upper'?'Upper-body strength baseline'
      : path==='lower'?'Lower-body strength baseline'
      : path==='single' ? (liftName+' strength baseline')
      : 'Full strength baseline'
    if((todayCompletedWorkouts.length||trackedTodayInfo?.workoutsToday||0)>0&&!confirmed){
      setPendingWorkoutStart({kind:'baseline',baselinePath:path,baselineLift:liftName,label})
      return
    }
    const exerciseName={Squat:'Back Squat',Bench:'Bench Press',Deadlift:'Deadlift',Press:'Overhead Press'}
    const exercises=pathLifts.map(mainLift=>({
      name:exerciseName[mainLift],
      prescription:'Ramp 5 / 3 / 2, then 4 test reps @ RPE 8.5-9',
      note:'Build gradually. The final set is 4 clean reps around RPE 8.5-9; stop before form breaks.',
      rest_seconds:240,
      strength_baseline_lift:mainLift,
      setProgress:[
        {set:1,reps:5,label:'5 easy',done:false,weight:''},
        {set:2,reps:3,label:'3 moderate',done:false,weight:''},
        {set:3,reps:2,label:'2 heavier',done:false,weight:''},
        {set:4,reps:4,label:'4 test @ RPE 8.5-9',done:false,weight:''},
      ],
    }))
    const today=localDateKey()
    const workout={
      version:2,type:'flexible',standalone:true,started_explicitly:true,
      strength_baseline:true,baseline_path:path,
      exercises,sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:'',
      conditioningEnabled:false,conditioning_prescribed:false,
      metcon:{name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'},
    }
    const {data,error}=await supabase.from('planned_workouts').insert({
      user_id:session.user.id,scheduled_date:today,title:label,
      source_program_name:'Strength Baseline',source_week:null,source_day:path,
      workout,status:'started',
    }).select().single()
    if(error){setWorkoutStartError(error.message);return}
    activatePlannedWorkout(data)
    setActiveTab('today')
  }

  const startStandaloneWorkout = async (kind,{confirmed=false}={}) => {
    if(!session?.user)return
    const labels={free:'Free workout',run:'Run / Walk',conditioning:'Conditioning / Metcon'}
    if((trackedTodayInfo?.workoutsToday||0)>0 && !confirmed){
      setPendingWorkoutStart({kind,label:labels[kind]||'another workout'})
      return
    }
    const today=localDateKey()
    const metconBase={name:'',format:'',activity:'',duration:'',workTime:'',restTime:'',interval:'',rounds:'',reps:'',time:'',distance:'',calories:'',scale:'Rx',intensity:'Easy'}
    const workout={
      version:2,type:'flexible',standalone:true,started_explicitly:true,
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
    if(pending.kind==='program'){
      const track=trackedProgramsInfo.find(item=>item.key===pending.trackingKey)||trackedTodayInfo
      const selectedWorkout=[...(track?.weekChoices||[]),...(track?.upcoming||[])].find(item=>item.trackingWorkoutKey===pending.workoutKey)||track?.upcoming?.[0]
      await startTrackedWorkout(track,{confirmed:true,selectedWorkout})
    }else if(pending.kind==='baseline'){
      await startStrengthBaseline(pending.baselinePath,{confirmed:true,liftName:pending.baselineLift})
    }else await startStandaloneWorkout(pending.kind,{confirmed:true})
  }

  const refreshPlannedToday = async () => {
    if (!session?.user) return
    const today = localDateKey()
    const [{data:activePlans},{data:completedRows},{data:activeTracking}]=await Promise.all([
      supabase.from('planned_workouts').select('*')
        .eq('user_id',session.user.id).eq('scheduled_date',today)
        .in('status',['planned','started']).order('created_at'),
      supabase.from('training_sessions').select('id,title,program,week,total_volume,session_date,completed_at,workout')
        .eq('user_id',session.user.id).eq('session_date',today).not('completed_at','is',null)
        .order('completed_at',{ascending:false}),
      supabase.from('user_program_tracking').select('program_key')
        .eq('user_id',session.user.id).eq('status','tracking')
    ])
    const multipleTracks=(activeTracking||[]).filter(row=>/^(archive|classic):/.test(String(row.program_key||''))).length>1
    let activePlan=multipleTracks
      ? (activePlans||[]).find(row=>
          row.workout?.started_explicitly ||
          plannedWorkoutHasProgress(row) ||
          ((row.status==='started'||row.status==='planned')&&!row.workout?.tracking_program_key)
        ) || null
      : (activePlans||[]).find(row=>row.status==='started'||row.workout?.started_explicitly||plannedWorkoutHasProgress(row))
        || (activePlans||[]).find(row=>row.status==='planned')
        || null
    const staleAutoPlans=multipleTracks
      ? (activePlans||[]).filter(row=>
          row.workout?.tracking_program_key &&
          !row.workout?.started_explicitly &&
          !plannedWorkoutHasProgress(row)
        )
      : []
    if(staleAutoPlans.length)await Promise.all(staleAutoPlans.map(row=>supabase.from('planned_workouts').update({status:'skipped',updated_at:new Date().toISOString()}).eq('id',row.id)))
    const staleTrackedPlan=(completedRows||[]).length>0 &&
      Boolean(activePlan?.workout?.tracking_program_key) &&
      !activePlan?.workout?.started_explicitly &&
      !plannedWorkoutHasProgress(activePlan)
    if(staleTrackedPlan){
      await supabase.from('planned_workouts').update({status:'skipped',updated_at:new Date().toISOString()}).eq('id',activePlan.id)
      activePlan=null
    }
    setPlannedToday(activePlan)
    setTodayCompletedWorkouts(completedRows||[])
    setShowRegularToday(false)
  }

  const deleteCompletedWorkout = async row => {
    if(!session?.user || !row?.id || deletingCompletedWorkout)return
    setDeletingCompletedWorkout(true)
    const {data:sessionRow,error:lookupError}=await supabase.from('training_sessions')
      .select('id,planned_workout_id')
      .eq('id',row.id)
      .eq('user_id',session.user.id)
      .maybeSingle()

    if(lookupError || !sessionRow){
      setWorkoutStartError(lookupError?.message||'Could not find that completed workout.')
      setDeletingCompletedWorkout(false)
      return
    }

    const communityResult=await supabase.from('community_activity')
      .delete().eq('training_session_id',sessionRow.id)
    if(communityResult.error){
      setWorkoutStartError(communityResult.error.message)
      setDeletingCompletedWorkout(false)
      return
    }

    const sessionResult=await supabase.from('training_sessions')
      .delete().eq('id',sessionRow.id).eq('user_id',session.user.id)
    if(sessionResult.error){
      setWorkoutStartError(sessionResult.error.message)
      setDeletingCompletedWorkout(false)
      return
    }

    if(sessionRow.planned_workout_id){
      const planResult=await supabase.from('planned_workouts')
        .delete().eq('id',sessionRow.planned_workout_id).eq('user_id',session.user.id)
      if(planResult.error){
        setWorkoutStartError(planResult.error.message)
        setDeletingCompletedWorkout(false)
        return
      }
    }

    setTodayCompletedWorkouts(rows=>rows.filter(item=>item.id!==row.id))
    setCompletedDeletePrompt(null)
    setCompletionSummary(null)
    setBaselineFinishReview(null)
    await refreshTrackedProgramsInfo()
    setDeletingCompletedWorkout(false)
  }

  const startSelectedBaseline = () => {
    if(!baselineTestChoice)return
    if(baselineTestChoice.startsWith('single:')){
      startStrengthBaseline('single',{liftName:baselineTestChoice.split(':')[1]})
    }else{
      startStrengthBaseline(baselineTestChoice)
    }
    setBaselineTestChoice('')
  }

  const openToday = async () => {
    await refreshTrackedProgramsInfo()
    await refreshPlannedToday()
    setActiveTab('today')
  }

  useEffect(() => {
    if(!session?.user)return
    let timer=null
    const syncToday=()=>{
      if(document.visibilityState==='hidden')return
      clearTimeout(timer)
      // PlannedWorkoutRunner autosaves after ~350 ms. Waiting a little longer
      // avoids replacing a just-entered set with an older server snapshot.
      timer=setTimeout(()=>{
        refreshPlannedToday()
        if(activeTab==='today')refreshTrackedProgramsInfo()
      },650)
    }
    window.addEventListener('focus',syncToday)
    window.addEventListener('pageshow',syncToday)
    document.addEventListener('visibilitychange',syncToday)
    return ()=>{
      clearTimeout(timer)
      window.removeEventListener('focus',syncToday)
      window.removeEventListener('pageshow',syncToday)
      document.removeEventListener('visibilitychange',syncToday)
    }
  },[session?.user?.id,activeTab])

  const openMe = async () => {
    await refreshTrackedProgramsInfo()
    setActiveTab('me')
  }

  useEffect(() => {
    // Treat each app section like a separate page. Mobile browsers can restore
    // scroll after React paints, so reset immediately and once more after layout.
    if('scrollRestoration' in history)history.scrollRestoration='manual'
    const reset=()=>{
      window.scrollTo({top:0,left:0,behavior:'auto'})
      document.documentElement.scrollTop=0
      document.body.scrollTop=0
    }
    reset()
    const frame=requestAnimationFrame(reset)
    const timer=setTimeout(reset,80)
    return ()=>{cancelAnimationFrame(frame);clearTimeout(timer)}
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

  const refreshManagedAthletes = async () => {
    if(!session?.user)return
    const {data,error}=await supabase.from('managed_athletes')
      .select('*').eq('owner_user_id',session.user.id).order('updated_at',{ascending:false})
    if(error)return
    setManagedAthletes((data||[]).map(row=>({
      id:row.id,
      display_name:row.display_name,
      Squat:row.squat??'',
      Bench:row.bench??'',
      Deadlift:row.deadlift??'',
      Press:row.press??'',
    })))
  }

  useEffect(()=>{
    if(!session?.user)return
    refreshManagedAthletes()
  },[session?.user?.id])

  const openManagedAthleteEditor = athlete => {
    setManagedAthleteDraft(athlete ? {...athlete} : {id:null,display_name:'',Squat:'',Bench:'',Deadlift:'',Press:''})
    setManagedAthleteEditorOpen(true)
  }

  const saveManagedAthlete = async () => {
    if(!session?.user)return
    const name=String(managedAthleteDraft.display_name||'').trim()
    if(!name){setTogetherMessage('Partner name is required.');return}
    const num=value=>value===''?null:round2(Math.max(0,Number(value)||0))
    const payload={
      owner_user_id:session.user.id,
      display_name:name,
      squat:num(managedAthleteDraft.Squat),
      bench:num(managedAthleteDraft.Bench),
      deadlift:num(managedAthleteDraft.Deadlift),
      press:num(managedAthleteDraft.Press),
      updated_at:new Date().toISOString(),
    }
    const query=managedAthleteDraft.id
      ? supabase.from('managed_athletes').update(payload).eq('id',managedAthleteDraft.id).eq('owner_user_id',session.user.id)
      : supabase.from('managed_athletes').insert(payload)
    const {error}=await query
    if(error){setTogetherMessage(error.message);return}
    setManagedAthleteEditorOpen(false)
    setManagedAthleteDraft({id:null,display_name:'',Squat:'',Bench:'',Deadlift:'',Press:''})
    setTogetherMessage(name+' saved.')
    await refreshManagedAthletes()
  }

  const deleteManagedAthlete = async athlete => {
    if(!session?.user||!athlete?.id)return
    if(!window.confirm('Remove '+athlete.display_name+' from your managed training partners?'))return
    const {error}=await supabase.from('managed_athletes').delete()
      .eq('id',athlete.id).eq('owner_user_id',session.user.id)
    if(error){setTogetherMessage(error.message);return}
    setSelectedManagedAthleteIds(ids=>ids.filter(id=>id!==athlete.id))
    setTogetherMessage(athlete.display_name+' removed.')
    await refreshManagedAthletes()
  }

  const refreshTogether = async sessionId => {
    if (!sessionId) return
    const [{data:sessionData},{data:people},{data:results},{data:maxRows}] = await Promise.all([
      supabase.from('shared_sessions').select('*').eq('id',sessionId).single(),
      supabase.from('session_participants').select('*').eq('session_id',sessionId).order('joined_at'),
      supabase.from('session_results').select('*').eq('session_id',sessionId).order('updated_at',{ascending:false}),
      supabase.rpc('shared_session_one_rep_maxes',{target_session:sessionId}),
    ])
    if (sessionData) setActiveSession(sessionData)
    setParticipants(people || [])
    setSessionResults(results || [])
    setSessionOneRms(Object.fromEntries((maxRows||[]).map(row=>[row.user_id,{
      displayName:row.display_name,
      Squat:row.squat??'',
      Bench:row.bench??'',
      Deadlift:row.deadlift??'',
      Press:row.press??'',
    }])))
  }

  useEffect(() => {
    if (!activeSession?.id || togetherReady !== true) return
    refreshTogether(activeSession.id)
    const timer = setInterval(() => refreshTogether(activeSession.id),5000)
    return () => clearInterval(timer)
  },[activeSession?.id,togetherReady])

  const refreshFriends = async () => {
    if(!session?.user)return
    const userId=session.user.id
    const {data,error}=await supabase.from('workset_friendships')
      .select('*')
      .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`)
      .order('created_at',{ascending:false})
    if(error)return

    const rows=data||[]
    const accepted=[]
    const incoming=[]
    const outgoing=[]

    for(const row of rows){
      const requesterIsMe=row.requester_user_id===userId
      const other={
        friendship_id:row.id,
        user_id:requesterIsMe?row.addressee_user_id:row.requester_user_id,
        display_name:requesterIsMe?row.addressee_display_name:row.requester_display_name,
        status:row.status,
        created_at:row.created_at,
      }
      if(row.status==='accepted')accepted.push(other)
      else if(row.status==='pending'&&row.addressee_user_id===userId)incoming.push({...other,requester_user_id:row.requester_user_id})
      else if(row.status==='pending'&&row.requester_user_id===userId)outgoing.push(other)
    }

    setFriends(accepted)
    setIncomingFriendRequests(incoming)
    setOutgoingFriendRequests(outgoing)
    setSelectedFriendIds(ids=>ids.filter(id=>accepted.some(friend=>friend.user_id===id)))
  }

  const requestWorksetFriend = async () => {
    const email=String(friendEmail||'').trim()
    if(!email){setFriendMessage('Enter their Workset account email.');return}
    setFriendMessage('Sending friend request…')
    const {data,error}=await supabase.rpc('request_workset_friend_by_email',{target_email:email})
    if(error){setFriendMessage(error.message);return}
    const result=data?.[0]
    setFriendEmail('')
    if(result?.friendship_status==='accepted'){
      setFriendMessage((result.friend_display_name||'That user')+' is now in your friends.')
      setFriendAddOpen(false)
    }else{
      setFriendMessage('Friend request sent to '+(result?.friend_display_name||email)+'.')
    }
    await refreshFriends()
  }

  const respondFriendRequest = async (friendship,response) => {
    if(!friendship?.friendship_id)return
    setFriendMessage(response==='accepted'?'Adding friend…':'Dismissing request…')
    const {error}=await supabase.rpc('respond_workset_friend_request',{
      target_friendship:friendship.friendship_id,
      response,
    })
    if(error){setFriendMessage(error.message);return}
    setFriendMessage(response==='accepted'?(friendship.display_name+' added to friends.'):'')
    await refreshFriends()
  }

  const removeWorksetFriend = async friend => {
    if(!friend?.user_id)return
    if(!window.confirm('Remove '+friend.display_name+' from your Workset friends?'))return
    const {error}=await supabase.rpc('remove_workset_friend',{target_friend:friend.user_id})
    if(error){setFriendMessage(error.message);return}
    setSelectedFriendIds(ids=>ids.filter(id=>id!==friend.user_id))
    setFriendMessage(friend.display_name+' removed from friends.')
    await refreshFriends()
  }

  const refreshTogetherLobby = async () => {
    if(!session?.user)return
    await refreshFriends()
    const [{data:invites},{data:memberships}]=await Promise.all([
      supabase.from('together_invites').select('*')
        .eq('recipient_user_id',session.user.id)
        .eq('status','pending')
        .order('created_at',{ascending:false})
        .limit(8),
      supabase.from('session_participants').select('session_id,joined_at')
        .eq('user_id',session.user.id)
        .order('joined_at',{ascending:false})
        .limit(8),
    ])
    setIncomingTogetherInvites(invites||[])
    const ids=[...new Set((memberships||[]).map(row=>row.session_id).filter(Boolean))]
    if(!ids.length){setRecentTogetherSessions([]);return}
    const {data:sessions}=await supabase.from('shared_sessions').select('*').in('id',ids)
    const order=new Map(ids.map((id,index)=>[id,index]))
    setRecentTogetherSessions((sessions||[])
      .filter(row=>row.id!==activeSession?.id)
      .sort((a,b)=>(order.get(a.id)??99)-(order.get(b.id)??99))
      .slice(0,4))
  }

  useEffect(()=>{
    if(!session?.user)return
    refreshTogetherLobby()
    const timer=setInterval(refreshTogetherLobby,activeTab==='together'?10000:30000)
    return()=>clearInterval(timer)
  },[session?.user?.id,activeTab,activeSession?.id])

  const sendTogetherInvite = async () => {
    if(!activeSession?.id||activeSession.host_user_id!==session?.user?.id)return
    const email=String(inviteEmail||'').trim()
    if(!email){setTogetherMessage('Enter the Workset account email.');return}
    setTogetherMessage('Sending invite…')
    const {data,error}=await supabase.rpc('invite_workset_user_by_email',{
      target_session:activeSession.id,
      target_email:email,
    })
    if(error){setTogetherMessage(error.message);return}
    const person=data?.[0]?.recipient_display_name||email
    setInviteEmail('')
    setTogetherMessage('Invite sent to '+person+'.')
    await refreshTogetherLobby()
  }

  const inviteFriendToActiveSession = async friend => {
    if(!activeSession?.id||activeSession.host_user_id!==session?.user?.id||!friend?.user_id)return
    setTogetherMessage('Inviting '+friend.display_name+'…')
    const {error}=await supabase.rpc('invite_workset_friend_to_session',{
      target_session:activeSession.id,
      friend_user_id:friend.user_id,
    })
    setTogetherMessage(error?error.message:'Invite sent to '+friend.display_name+'.')
    if(!error)await refreshTogetherLobby()
  }

  const respondTogetherInvite = async (invite,response) => {
    if(!invite?.id)return
    setTogetherMessage(response==='accepted'?'Joining session…':'Dismissing invite…')
    const {data,error}=await supabase.rpc('respond_to_together_invite',{
      target_invite:invite.id,
      response,
    })
    if(error){setTogetherMessage(error.message);return}
    await refreshTogetherLobby()
    if(response==='accepted'&&data?.[0]?.session_id){
      const {data:joined}=await supabase.from('shared_sessions').select('*').eq('id',data[0].session_id).single()
      if(joined){
        setActiveSession(joined)
        setTogetherAction('')
        setTogetherMessage('')
        await refreshTogether(joined.id)
      }
    }else{
      setTogetherMessage('')
    }
  }

  const updateMain = (i,field,value) => {
    setSaveState('Unsaved')
    setLog(v => ({...v,complete:false,main:v.main.map((set,idx) => idx === i ? {...set,[field]:value} : set)}))
  }

  const saveOneRepMaxes = async next => {
    const cleaned=Object.fromEntries(lifts.map(name=>[name,next[name]===''?'':round2(Math.max(0,Number(next[name])||0))]))
    setOneRepMaxes(cleaned)
    if (!session?.user) return {error:null}
    const results=await Promise.all([
      supabase.auth.updateUser({data:{...session.user.user_metadata,one_rep_maxes:cleaned}}),
      supabase.from('one_rep_maxes').upsert({
        user_id:session.user.id,
        squat:cleaned.Squat === '' ? null : Number(cleaned.Squat),
        bench:cleaned.Bench === '' ? null : Number(cleaned.Bench),
        deadlift:cleaned.Deadlift === '' ? null : Number(cleaned.Deadlift),
        press:cleaned.Press === '' ? null : Number(cleaned.Press),
        updated_at:new Date().toISOString(),
      }),
      supabase.from('training_maxes').upsert({
        user_id:session.user.id,
        squat:cleaned.Squat === '' ? null : round2(Number(cleaned.Squat)*.85),
        bench:cleaned.Bench === '' ? null : round2(Number(cleaned.Bench)*.85),
        deadlift:cleaned.Deadlift === '' ? null : round2(Number(cleaned.Deadlift)*.85),
        press:cleaned.Press === '' ? null : round2(Number(cleaned.Press)*.85),
        updated_at:new Date().toISOString(),
      })
    ])
    return {error:results.find(result=>result?.error)?.error||null}
  }

  const setOneRm = async (name,raw,{notify=false}={}) => {
    const value = raw === '' ? '' : round2(Math.max(0,Number(raw)))
    const result=await saveOneRepMaxes({...oneRepMaxes,[name]:value})
    if(notify){
      const notice=result?.error
        ? {type:'error',text:'Could not save '+name+' 1RM.'}
        : {type:'success',name,value,text:name+' 1RM saved at '+Number(value).toFixed(2)+' lb'}
      setOneRmNotice(notice)
      setTimeout(()=>setOneRmNotice(current=>current===notice?null:current),2800)
    }
    return result
  }

  const acceptBaselineResult = async result => {
    if(!result?.lift||!result?.estimated_1rm)return
    const saved=await setOneRm(result.lift,result.estimated_1rm,{notify:true})
    if(saved?.error)return
    setBaselineFinishReview(current=>current ? {
      ...current,
      accepted:{...(current.accepted||{}),[result.lift]:true}
    } : current)
  }

  const acceptAllBaselineResults = async () => {
    const rows=baselineFinishReview?.results||[]
    if(!rows.length)return
    const next={...oneRepMaxes}
    for(const result of rows)next[result.lift]=round2(result.estimated_1rm)
    const saved=await saveOneRepMaxes(next)
    if(saved?.error){
      const notice={type:'error',text:'Could not save baseline 1RMs.'}
      setOneRmNotice(notice)
      setTimeout(()=>setOneRmNotice(current=>current===notice?null:current),2800)
      return
    }
    setBaselineFinishReview(current=>current ? {
      ...current,
      accepted:Object.fromEntries(rows.map(result=>[result.lift,true]))
    } : current)
    const text=rows.length===1
      ? rows[0].lift+' 1RM saved at '+Number(rows[0].estimated_1rm).toFixed(2)+' lb'
      : rows.length+' baseline 1RMs saved'
    const notice={type:'success',text}
    setOneRmNotice(notice)
    setTimeout(()=>setOneRmNotice(current=>current===notice?null:current),2800)
  }

  const refreshOneRmCandidates = async () => {
    if(!session?.user)return
    const {data}=await supabase.from('training_sessions')
      .select('id,title,program,primary_lift,workout,completed_at')
      .eq('user_id',session.user.id).not('completed_at','is',null)
      .order('completed_at',{ascending:false}).limit(1000)
    setCompletedTrainingSessions(data||[])
  }

  const openOneRmReview = async () => {
    await refreshOneRmCandidates()
    setProgramCompletionPrompt(null)
    setActiveTab('me')
    requestAnimationFrame(()=>document.getElementById('one-rm-center')?.scrollIntoView({behavior:'smooth',block:'start'}))
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
    const classicTrack=trackedProgramsInfo.find(info=>info.kind==='classic'&&info.programId===workoutProgramId)
    const payload = {
      ...log,complete,savedAt:now,week,lift,phase:plan.phase,program:workoutProgram.name,
      ...(classicTrack?{
        tracking_program_key:classicTrack.key,
        tracking_workout_key:`${classicTrack.key}|w${week}|${String(lift).toLowerCase()}`
      }:{})
    }

    // Classic workout_logs has one row per program/week/lift. When a new tracked
    // run starts over, detach the old completed durable session before reusing
    // that legacy row so historical runs remain intact.
    if(classicTrack){
      const {data:priorLegacy}=await supabase.from('workout_logs').select('id,completed_at')
        .eq('user_id',session.user.id).eq('program',workoutProgram.dbName).eq('week',week).eq('lift',lift).maybeSingle()
      if(priorLegacy?.id && priorLegacy.completed_at && new Date(priorLegacy.completed_at).getTime()<new Date(classicTrack.startedAt||0).getTime()){
        await supabase.from('training_sessions').update({legacy_log_id:null}).eq('legacy_log_id',priorLegacy.id).not('completed_at','is',null)
      }
    }

    const {data,error} = await supabase.from('workout_logs').upsert({
      user_id:session.user.id,
      program:workoutProgram.dbName,
      week,
      lift,
      workout_date:localDateKey(),
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
      session_date:localDateKey(),
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
        activity_date:localDateKey(),
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

    const refreshedTracks=await refreshTrackedProgramsInfo()
    const finishedTrack=refreshedTracks.find(info=>info.kind==='classic'&&info.programId===workoutProgramId)
    if(finishedTrack?.complete)setProgramCompletionPrompt({name:finishedTrack.name||workoutProgram.name})
    if(finishedTrack){
      setShowRegularToday(false)
      setPlannedToday(null)
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
    const data = {title:'Workset',text:'Join me on Workset. Create your own account and track your workouts.',url}
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
      const planned=makePlannedFromClassic(
        togetherProgramChoice.id,
        selectedWeek,
        sessionLift,
        localDateKey(),
        oneRepMaxes
      )
      sharedTemplate=planned.workout
      sharedMeta={
        program_key:togetherProgramChoice.key,
        program_name:togetherProgramChoice.name,
        week:selectedWeek,
        workout_index:selectedIndex,
        workout_title:planned.title,
      }
    }else{
      const planned=makePlannedFromArchive(togetherProgramChoice.program,selectedWeek,selectedIndex,localDateKey(),oneRepMaxes)
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

    const selectedManagedPartners=managedAthletes
      .filter(athlete=>selectedManagedAthleteIds.includes(athlete.id))
      .map(athlete=>({
        id:athlete.id,
        display_name:athlete.display_name,
        Squat:athlete.Squat??'',
        Bench:athlete.Bench??'',
        Deadlift:athlete.Deadlift??'',
        Press:athlete.Press??'',
      }))
    sharedMeta={...(sharedMeta||{}),managed_partners:selectedManagedPartners}

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

    let friendInviteCount=0
    if(selectedFriendIds.length){
      const inviteResults=await Promise.all(selectedFriendIds.map(friendId=>
        supabase.rpc('invite_workset_friend_to_session',{
          target_session:created.id,
          friend_user_id:friendId,
        })
      ))
      friendInviteCount=inviteResults.filter(result=>!result.error).length
    }

    setTogetherReady(true)
    setActiveSession(created)
    setTogetherAction('')
    setInvitePanelOpen(false)
    setShowSessionQr(false)
    setTogetherMessage(friendInviteCount?friendInviteCount+' friend invite'+(friendInviteCount===1?'':'s')+' sent.':'')
    await refreshTogether(created.id)
  }

  const joinTogetherSession = async providedCode => {
    const raw=String(providedCode||joinCode||'').trim()
    if (!session?.user || !raw) return
    setTogetherMessage('Joining…')
    const code = raw.toUpperCase()

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
    setTogetherAction('')
    setJoinCode('')
    setQrScanning(false)
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
          scheduled_date:localDateKey(),
          title:sharedMeta?.workout_title||'Shared workout',
          source_program_name:sharedMeta?.program_name||'Workout Together',
          source_week:Number(sharedMeta?.week||1),
          source_day:marker,
          workout:{...personalizeWorkoutLoads(sharedTemplate,sessionOneRms[session.user.id]||oneRepMaxes),shared_session_id:activeSession.id,shared_meta:sharedMeta,shared_template:sharedTemplate},
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
    setLog(normalizeLog(found?.workout || null,programId,activeSession.week,activeSession.lift,Number(oneRepMaxes[activeSession.lift] || 0)))
  }

  const sessionJoinUrl = sessionRow => {
    if(!sessionRow?.join_code)return ''
    const url=new URL(appUrl())
    url.searchParams.set('join',sessionRow.join_code)
    return url.toString()
  }

  const shareSession = async () => {
    if (!activeSession) return
    const shareUrl=sessionJoinUrl(activeSession)
    const text='Join my Workset session'
    try {
      if (navigator.share) await navigator.share({title:'Workset Together',text,url:shareUrl})
      else {
        await navigator.clipboard.writeText(shareUrl)
        setTogetherMessage('Join link copied.')
      }
    } catch {
      setTogetherMessage(shareUrl)
    }
  }

  useEffect(()=>{
    if(!showSessionQr||!activeSession?.join_code){setSessionQr('');return}
    let cancelled=false
    QRCode.toDataURL(sessionJoinUrl(activeSession),{
      width:300,
      margin:1,
      errorCorrectionLevel:'M',
      color:{dark:'#07101f',light:'#ffffff'},
    }).then(url=>{if(!cancelled)setSessionQr(url)}).catch(()=>{if(!cancelled)setSessionQr('')})
    return()=>{cancelled=true}
  },[showSessionQr,activeSession?.id,activeSession?.join_code])

  const parseScannedJoinCode = raw => {
    const value=String(raw||'').trim()
    if(!value)return ''
    try{
      const url=new URL(value)
      const code=url.searchParams.get('join')
      if(code)return code.trim().toUpperCase().slice(0,6)
    }catch{}
    const match=value.toUpperCase().match(/[A-Z0-9]{6}/)
    return match?.[0]||''
  }

  useEffect(()=>{
    if(!qrScanning)return
    let stopped=false
    let stream=null
    let timer=null

    const stop=()=>{
      stopped=true
      clearTimeout(timer)
      stream?.getTracks?.().forEach(track=>track.stop())
    }

    const start=async()=>{
      try{
        const Detector=window.BarcodeDetector||BarcodeDetectorPonyfill
        const detector=new Detector({formats:['qr_code']})
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
        await new Promise(resolve=>setTimeout(resolve,50))
        const video=qrVideoRef.current
        if(!video){stop();return}
        video.srcObject=stream
        await video.play()

        const scan=async()=>{
          if(stopped)return
          try{
            const codes=await detector.detect(video)
            const code=parseScannedJoinCode(codes?.[0]?.rawValue)
            if(code){
              setJoinCode(code)
              setQrScanMessage('QR code found: '+code)
              setQrScanning(false)
              stop()
              await joinTogetherSession(code)
              return
            }
          }catch{}
          timer=setTimeout(scan,350)
        }
        scan()
      }catch(error){
        setQrScanMessage(error?.name==='NotAllowedError'?'Camera permission was denied.':'Could not start the QR scanner.')
        setQrScanning(false)
        stop()
      }
    }

    start()
    return stop
  },[qrScanning])

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
    setTogetherAction('')
    setInvitePanelOpen(false)
    setShowSessionQr(false)
    setQrScanning(false)
    setTogetherMessage('')
  }

  const secondary = plan.secondary
  const secondaryTarget = secondary?.pct != null ? targetWeight(tm,secondary.pct,workoutProgram.basis) : null
  const displayName = profile?.display_name || session?.user?.email?.split('@')[0] || 'You'
  const ownSessionResult = sessionResults.find(result => result.user_id === session?.user?.id)
  const sharedHostResult = activeSession ? sessionResults.find(result => result.user_id === activeSession.host_user_id) : null
  const sharedMeta = sharedHostResult?.workout?.shared_meta || null
  const sharedManagedPartners=sharedMeta?.managed_partners||[]
  const sharedManagedPartnerOneRms=Object.fromEntries(sharedManagedPartners.map(athlete=>[
    'managed:'+athlete.id,
    {
      displayName:athlete.display_name,
      Squat:athlete.Squat??'',
      Bench:athlete.Bench??'',
      Deadlift:athlete.Deadlift??'',
      Press:athlete.Press??'',
    }
  ]))
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

  if (authLoading) return <div className="loading-screen">Loading Workset…</div>
  if (passwordRecovery) return <RecoveryScreen onDone={() => setPasswordRecovery(false)} />
  if (!session) return <AuthScreen />

  return (
    <>
      <main className="app">
        <header className="app-header">
          <div>
            <div className="brand-lockup"><img src={import.meta.env.BASE_URL+'icon.svg'} alt="" /><span>Work<b>set</b></span></div>
            <h1>{activeTab === 'today' ? 'Today' : activeTab === 'together' ? 'Together' : activeTab === 'program' ? 'Plan' : activeTab === 'whiteboard' ? 'Whiteboard' : activeTab === 'progress' ? 'Progress' : activeTab === 'admin' ? 'Admin' : 'Me'}</h1>
          </div>
          <button className={'account-chip ' + (isAdmin ? 'admin' : '')} onClick={openMe}>
            <span>{displayName}</span>
            {isAdmin && <b>ADMIN</b>}
          </button>
        </header>

        <nav className="primary-nav">
          <button className={activeTab === 'today' ? 'active' : ''} onClick={openToday}><b>●</b><span>Today</span></button>
          <button className={activeTab === 'together' ? 'active' : ''} onClick={() => setActiveTab('together')}><b>⇄</b><span>Together</span>{(incomingTogetherInvites.length+incomingFriendRequests.length)>0&&<i className="nav-invite-badge">{incomingTogetherInvites.length+incomingFriendRequests.length}</i>}</button>
          <button className={activeTab === 'program' ? 'active' : ''} onClick={() => setActiveTab('program')}><b>▦</b><span>Plan</span></button>
          <button className={activeTab === 'whiteboard' ? 'active' : ''} onClick={() => setActiveTab('whiteboard')}><b>□</b><span>Board</span></button>
        </nav>

        {activeTab === 'today' && <TrainingTimer />}

        {dataLoading ? (
          <div className="loading-card">Loading your workouts…</div>
        ) : activeTab === 'today' ? (
          plannedToday && !showRegularToday ? (
            <PlannedWorkoutRunner
              planned={plannedToday}
              oneRepMaxes={oneRepMaxes}
              sharedSessionId={sharedWorkoutActive&&activeSession ? activeSession.id : null}
              partnerOneRms={sharedWorkoutActive ? {...sessionOneRms,...sharedManagedPartnerOneRms} : {}}
              onCancelled={async() => {
                setPlannedToday(null)
                setShowRegularToday(false)
                setCompletionSummary(null)
                setBaselineFinishReview(null)
                setWorkoutStartError('')
                if(sharedWorkoutActive&&activeSession){
                  setSharedWorkoutActive(false)
                  await refreshTogether(activeSession.id)
                  setActiveTab('together')
                }
              }}
              onFinished={async(summary) => {
                const finishedTrackingKey=plannedToday?.workout?.tracking_program_key||null
                const finishedTrack=finishedTrackingKey?trackedProgramsInfo.find(info=>info.key===finishedTrackingKey):null
                const programWillComplete=Boolean(finishedTrack&&finishedTrack.completed+1>=finishedTrack.total)
                setPlannedToday(null)
                setShowRegularToday(false)
                if(sharedWorkoutActive&&activeSession){
                  await refreshTogether(activeSession.id)
                  setActiveTab('together')
                }else{
                  setCompletionSummary(summary||null)
                  if(summary?.strengthBaseline&&summary?.baselineResults?.length){
                    setBaselineFinishReview({
                      results:summary.baselineResults,
                      accepted:{},
                      sessionId:summary.trainingSessionId||null,
                    })
                  }else{
                    setBaselineFinishReview(null)
                  }
                  if(programWillComplete)setProgramCompletionPrompt({name:finishedTrack?.name||summary?.program||'Program'})
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
                  const advanceTrackedInfo=v=>{
                    if(!v)return v
                    const workoutsToday=(v.workoutsToday||0)+1
                    if(finishedTrackingKey!==v.key)return {...v,workoutsToday}
                    const completed=Math.min(v.total,v.completed+1)
                    const next=v.upcoming?.slice(1)||[]
                    const first=next[0]
                    return {...v,completedToday:true,workoutsToday,completed,upcoming:next,nextWeek:first?.week||v.nextWeek,nextDayIndex:first?.dayIndex??v.nextDayIndex,nextTitle:first?.title||'',complete:completed>=v.total}
                  }
                  setTrackedProgramsInfo(list=>list.map(advanceTrackedInfo))
                  setTrackedTodayInfo(advanceTrackedInfo)
                }
              }}
              onDismiss={sharedWorkoutActive || trackedProgramsInfo.length ? undefined : () => setShowRegularToday(true)}
            />
          ) : trackedProgramsInfo.length && !showRegularToday ? (
            <section className="page-section tracked-today-state">
              {todayCompletedWorkouts.length>0&&<details className="today-completed-workouts" open>
                <summary><span><b>Today’s workouts</b><small>{todayCompletedWorkouts.length} completed</small></span></summary>
                <div className="today-completed-list">{todayCompletedWorkouts.map(row=><article key={row.id}>
                  <button type="button" className="completed-workout-delete" aria-label={'Delete '+(row.title||'workout')} onClick={()=>setCompletedDeletePrompt(row)}>×</button>
                  <div><strong>{row.title||'Workout'}</strong><span>{row.program||'Workout'}{row.completed_at?' · '+new Date(row.completed_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''}</span></div>
                  <b>{Number(row.total_volume||0)>0?Number(row.total_volume).toLocaleString()+' lb':'Completed'}</b>
                  {row.workout?.exercises?.length>0&&<details><summary>Exercises</summary><p>{row.workout.exercises.map(x=>x.name).filter(Boolean).join(' · ')}</p></details>}
                </article>)}</div>
              </details>}
              {completionSummary&&<section className="workout-complete-summary">
                <div className="completion-check">✓</div>
                <div><span className="card-label">WORKOUT COMPLETE</span><h2>{completionSummary.title||'Workout complete'}</h2><p>{completionSummary.program||trackedProgramsInfo.find(x=>x.key===plannedToday?.workout?.tracking_program_key)?.name||trackedTodayInfo?.name||'Workout'}</p></div>
                <div className="completion-stats">
                  <div><span>Exercises</span><strong>{completionSummary.exercises||0}</strong></div>
                  <div><span>Sets</span><strong>{completionSummary.sets||0}</strong></div>
                  <div><span>Volume</span><strong>{Number(completionSummary.volume||0).toLocaleString()} lb</strong></div>
                </div>
                {baselineFinishReview?.results?.length>0&&<section className="baseline-finish-review">
                  <div className="section-heading"><div><span className="card-label">STRENGTH BASELINE</span><h3>Review your calculated 1RMs</h3></div></div>
                  <p className="helper-text">Calculated from the best completed set for each tested lift using your actual reps. Nothing changes until you choose Use.</p>
                  <div className="baseline-result-list">
                    {baselineFinishReview.results.map(result=>{
                      const current=Number(oneRepMaxes[result.lift]||0)
                      const accepted=Boolean(baselineFinishReview.accepted?.[result.lift])
                      return <article key={result.lift} className={accepted?'accepted':''}>
                        <div className="baseline-result-head"><strong>{result.lift}</strong><span>{result.weight} × {result.reps}</span></div>
                        <div className="baseline-result-values">
                          <div><span>Current</span><b>{current?current.toFixed(2)+' lb':'—'}</b></div>
                          <div><span>Calculated</span><b>{Number(result.estimated_1rm).toFixed(2)} lb</b></div>
                        </div>
                        <button type="button" className={accepted?'secondary-action':'primary-action'} disabled={accepted} onClick={()=>acceptBaselineResult(result)}>
                          {accepted?'✓ Saved':`Use ${Number(result.estimated_1rm).toFixed(2)} lb`}
                        </button>
                      </article>
                    })}
                  </div>
                  {baselineFinishReview.results.length>1&&<button type="button" className="wide-button" onClick={acceptAllBaselineResults}>Use all calculated 1RMs</button>}
                  <small className="baseline-history-note">The actual test sets stay in workout history so you can always see where each estimate came from.</small>
                </section>}
              </section>}

              {!completionSummary&&<section className="today-card multi-track-heading">
                <div><span className="card-label">{trackedProgramsInfo.length>1?'TRACKED PROGRAMS':'TRACKED PROGRAM'}</span><h2>{trackedProgramsInfo.length>1?trackedProgramsInfo.length+' active programs':trackedProgramsInfo[0]?.name}</h2><p>{trackedProgramsInfo.length>1?'Choose which track you want to train today.':trackedProgramsInfo[0]?.completedToday?'Workout tracked today':'Ready to train'}</p></div>
              </section>}

              <div className="tracked-programs-today-list">
                {trackedProgramsInfo.map(info=><section className="simple-card tracked-program-today-card" key={info.key}>
                  <div className="section-heading">
                    <div><span className="card-label">{info.category}{info.durationLabel?' · '+info.durationLabel:''}</span><h3>{info.name}</h3></div>
                    <div className="progress-badge">{info.completed}/{info.total}</div>
                  </div>
                  <div className="program-progress-track"><div style={{width:(info.total?Math.min(100,info.completed/info.total*100):0)+'%'}}/></div>
                  {info.complete?<p className="helper-text">Program complete.</p>:<>
                    <div className="tracked-week-choice-head"><span>WEEK {info.currentWeek}</span><strong>Choose today's workout</strong><small>Days can be completed in any order.</small></div>
                    <div className="tracked-week-choice-list">{(info.weekChoices||[]).map((choice,index)=><div className={'tracked-week-choice '+(choice.completed?'completed':'')} key={choice.trackingWorkoutKey}>
                      <div><span>Day {index+1}</span><strong>{choice.title}</strong>{choice.note&&<small>{choice.note}</small>}</div>
                      {choice.completed?<b className="tracked-day-done">✓ Done</b>:<button type="button" onClick={()=>startTrackedWorkout(info,{selectedWorkout:choice})}>Start</button>}
                    </div>)}</div>
                    {info.upcoming?.[0]&&<details className="tracked-next-preview">
                      <summary>Preview {info.upcoming[0].title}</summary>
                      <div className="next-day-exercises">{info.upcoming[0].exercises.map((exercise,index)=><div key={index}><strong>{exercise.name}</strong><span>{exercise.prescription}</span></div>)}</div>
                    </details>}
                  </>}
                </section>)}
              </div>

              {!extraWorkoutOpen&&<button className="secondary-action" onClick={()=>setExtraWorkoutOpen(true)}>+ Start a non-program workout</button>}

              {extraWorkoutOpen&&<section className="simple-card extra-workout-picker">
                <div className="section-heading"><div><span className="card-label">ANOTHER WORKOUT</span><h3>What are you tracking?</h3></div><button className="conditioning-remove" onClick={()=>setExtraWorkoutOpen(false)}>Cancel</button></div>
                <button onClick={()=>startStrengthBaseline('full')}><strong>Strength baseline · All 4</strong><span>Squat, bench, deadlift and press · 4-rep test sets</span></button>
                <button onClick={()=>startStrengthBaseline('upper')}><strong>Strength baseline · Upper</strong><span>Bench + press</span></button>
                <button onClick={()=>startStrengthBaseline('lower')}><strong>Strength baseline · Lower</strong><span>Squat + deadlift</span></button>
                <button onClick={()=>startStandaloneWorkout('free')}><strong>Free workout</strong><span>Add whatever exercises you want</span></button>
                <button onClick={()=>startStandaloneWorkout('run')}><strong>Run / Walk</strong><span>Track distance and time</span></button>
                <button onClick={()=>startStandaloneWorkout('conditioning')}><strong>Conditioning / Metcon</strong><span>Intervals, AMRAP, EMOM, cardio, etc.</span></button>
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

            {!tm && <div className="hint"><strong>No {lift} 1RM yet.</strong><span>Add it under Me → 1 Rep Maxes, or type working weights directly.</span></div>}

            <ExerciseHistoryStrip history={history} lift={lift} formatWeight={formatWeight} />
            <details className="today-collapsible">
              <summary><span><b>Workout Coach</b><small>Last performance, suggested load, warm-ups & PRs</small></span></summary>
              <WorkoutCoach session={session} lift={lift} log={log} history={history} tm={tm*.85} plan={plan} />
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
                {incomingTogetherInvites.length>0&&<section className="together-invite-inbox">
                  <div className="section-heading"><div><span className="card-label">INVITES</span><h3>Workout invitations</h3></div><b>{incomingTogetherInvites.length}</b></div>
                  <div className="together-invite-list">
                    {incomingTogetherInvites.map(invite=><article key={invite.id}>
                      <div><strong>{invite.sender_display_name}</strong><span>invited you to train together</span></div>
                      <div>
                        <button type="button" className="secondary-action" onClick={()=>respondTogetherInvite(invite,'declined')}>Dismiss</button>
                        <button type="button" className="primary-action" onClick={()=>respondTogetherInvite(invite,'accepted')}>Join</button>
                      </div>
                    </article>)}
                  </div>
                </section>}

                {incomingFriendRequests.length>0&&<section className="together-friend-requests">
                  <div className="section-heading"><div><span className="card-label">FRIEND REQUESTS</span><h3>People adding you</h3></div><b>{incomingFriendRequests.length}</b></div>
                  <div className="friend-request-list">
                    {incomingFriendRequests.map(request=><article key={request.friendship_id}>
                      <div><strong>{request.display_name}</strong><span>wants to be your Workset friend</span></div>
                      <div><button type="button" className="secondary-action" onClick={()=>respondFriendRequest(request,'declined')}>Dismiss</button><button type="button" className="primary-action" onClick={()=>respondFriendRequest(request,'accepted')}>Accept</button></div>
                    </article>)}
                  </div>
                </section>}

                <section className="simple-card together-friends-card">
                  <div className="section-heading">
                    <div><span className="card-label">FRIENDS</span><h3>Workset friends</h3></div>
                    <button type="button" className="secondary-action compact-action" onClick={()=>{setFriendAddOpen(v=>!v);setFriendMessage('')}}>+ Friend</button>
                  </div>
                  <p className="helper-text">Friends have their own Workset account. Select who you're training with and Workset will invite them when you start.</p>

                  {friends.length>0?<div className="together-partner-chips friend-chips">
                    {friends.map(friend=><button
                      type="button"
                      key={friend.user_id}
                      className={selectedFriendIds.includes(friend.user_id)?'selected':''}
                      onClick={()=>setSelectedFriendIds(ids=>ids.includes(friend.user_id)?ids.filter(id=>id!==friend.user_id):[...ids,friend.user_id])}
                    ><strong>{friend.display_name}</strong><span>{selectedFriendIds.includes(friend.user_id)?'Training with you':'Friend'}</span></button>)}
                  </div>:<p className="helper-text">No Workset friends yet. Add someone by the email they use for Workset.</p>}

                  {friendAddOpen&&<div className="friend-add-panel">
                    <label><span>Workset email</span><input type="email" value={friendEmail} onChange={e=>setFriendEmail(e.target.value)} placeholder="name@example.com"/></label>
                    <div><button type="button" className="secondary-action" onClick={()=>{setFriendAddOpen(false);setFriendEmail('');setFriendMessage('')}}>Cancel</button><button type="button" className="primary-action" onClick={requestWorksetFriend}>Send request</button></div>
                  </div>}

                  {outgoingFriendRequests.length>0&&<div className="friend-pending-list">
                    <span>Pending</span>
                    <div>{outgoingFriendRequests.map(request=><b key={request.friendship_id}>{request.display_name}</b>)}</div>
                  </div>}

                  {friendMessage&&<p className="status-message friend-status-message">{friendMessage}</p>}

                  {friends.length>0&&<button type="button" className="together-manage-link" onClick={()=>setFriendManageOpen(v=>!v)}>{friendManageOpen?'Close friend management':'Manage friends'}</button>}
                  {friendManageOpen&&friends.length>0&&<div className="together-partner-manage-list">
                    {friends.map(friend=><div key={friend.user_id}><span>{friend.display_name}</span><div><button type="button" className="danger-lite" onClick={()=>removeWorksetFriend(friend)}>Remove</button></div></div>)}
                  </div>}
                </section>

                <section className="together-lobby-hero">
                  <span className="card-label">TRAIN TOGETHER</span>
                  <h2>{selectedFriendIds.length||selectedManagedAthleteIds.length?'Ready to train together?':'Start or join a workout'}</h2>
                  <p>{selectedFriendIds.length
                    ? 'Your selected friends will receive a Workset invite when you start.'
                    : 'Choose friends above, add a no-account partner below, or start and share a code / QR.'}</p>
                  <div className="together-primary-actions">
                    <button type="button" className={togetherAction==='start'?'primary-action active':'primary-action'} onClick={()=>setTogetherAction(v=>v==='start'?'':'start')}>Start together</button>
                    <button type="button" className={togetherAction==='join'?'secondary-action active':'secondary-action'} onClick={()=>setTogetherAction(v=>v==='join'?'':'join')}>Join session</button>
                  </div>
                </section>

                <section className="simple-card together-partners-card managed-partners-compact">
                  <div className="section-heading">
                    <div><span className="card-label">NO ACCOUNT PARTNERS</span><h3>Managed partners</h3></div>
                    <button type="button" className="secondary-action compact-action" onClick={()=>openManagedAthleteEditor(null)}>+ Managed</button>
                  </div>
                  {managedAthletes.length>0?<div className="together-partner-chips">
                    {managedAthletes.map(athlete=><button
                      type="button"
                      key={athlete.id}
                      className={selectedManagedAthleteIds.includes(athlete.id)?'selected':''}
                      onClick={()=>setSelectedManagedAthleteIds(ids=>ids.includes(athlete.id)?ids.filter(id=>id!==athlete.id):[...ids,athlete.id])}
                    ><strong>{athlete.display_name}</strong><span>{selectedManagedAthleteIds.includes(athlete.id)?'Training with you':'Managed'}</span></button>)}
                  </div>:<p className="helper-text">For someone training beside you who doesn't use Workset. You maintain their 1RMs and target weights.</p>}
                  {managedAthletes.length>0&&<button type="button" className="together-manage-link" onClick={()=>{setManagedAthleteEditorOpen(v=>!v);setManagedAthleteDraft({id:null,display_name:'',Squat:'',Bench:'',Deadlift:'',Press:''})}}>{managedAthleteEditorOpen?'Close managed partners':'Manage partners'}</button>}
                  {managedAthleteEditorOpen&&managedAthletes.length>0&&<div className="together-partner-manage-list">
                    {managedAthletes.map(athlete=><div key={athlete.id}><span>{athlete.display_name}</span><div><button type="button" onClick={()=>openManagedAthleteEditor(athlete)}>Edit</button><button type="button" onClick={()=>deleteManagedAthlete(athlete)}>×</button></div></div>)}
                  </div>}
                  {managedAthleteEditorOpen&&<div className="managed-athlete-editor">
                    <label><span>Name</span><input value={managedAthleteDraft.display_name} onChange={e=>setManagedAthleteDraft(v=>({...v,display_name:e.target.value}))} placeholder="Tracey"/></label>
                    <div className="managed-athlete-max-grid">
                      {lifts.map(lift=><label key={lift}><span>{lift}</span><div className="input-with-unit"><input type="number" inputMode="decimal" value={managedAthleteDraft[lift]} onChange={e=>setManagedAthleteDraft(v=>({...v,[lift]:e.target.value===''?'':Math.max(0,Number(e.target.value)||0)}))} placeholder="0"/><b>lb</b></div></label>)}
                    </div>
                    <div className="managed-athlete-editor-actions"><button type="button" className="secondary-action" onClick={()=>setManagedAthleteEditorOpen(false)}>Cancel</button><button type="button" className="primary-action" onClick={saveManagedAthlete}>Save partner</button></div>
                    {managedAthleteDraft.id&&<button type="button" className="danger-lite" onClick={()=>deleteManagedAthlete(managedAthleteDraft)}>Remove partner</button>}
                  </div>}
                </section>

                {togetherAction==='start'&&<section className="together-flow-card">
                  <div className="section-heading"><div><span className="card-label">START TOGETHER</span><h3>Choose the workout</h3></div><button type="button" className="icon-close" onClick={()=>setTogetherAction('')}>×</button></div>
                  {(selectedFriendIds.length>0||selectedManagedAthleteIds.length>0)&&<div className="together-selected-partners"><span>Training with</span><strong>{[
                    ...friends.filter(friend=>selectedFriendIds.includes(friend.user_id)).map(friend=>friend.display_name),
                    ...managedAthletes.filter(a=>selectedManagedAthleteIds.includes(a.id)).map(a=>a.display_name),
                  ].join(' · ')}</strong></div>}
                  <div className="together-host-picker">
                    <label><span>Program</span><select value={togetherProgramChoice?.key||''} onChange={e=>{setTogetherProgramKey(e.target.value);setTogetherWeek(1);setTogetherWorkoutIndex(0)}}>{togetherProgramOptions.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
                    <label><span>Week</span><select value={togetherWeek} onChange={e=>{setTogetherWeek(Number(e.target.value));setTogetherWorkoutIndex(0)}}>{Array.from({length:Number(togetherProgramChoice?.weeksCount||1)},(_,i)=>i+1).map(n=><option key={n} value={n}>Week {n}</option>)}</select></label>
                    <label><span>Workout</span><select value={togetherWorkoutIndex} onChange={e=>setTogetherWorkoutIndex(Number(e.target.value))}>{togetherWorkoutChoices.map((d,i)=><option key={i} value={i}>{d.title}</option>)}</select></label>
                  </div>
                  <div className="together-workout-preview"><strong>{togetherProgramChoice?.shortName||'Choose a program'}</strong><span>Week {togetherWeek} · {togetherWorkoutChoices[togetherWorkoutIndex]?.title||'Choose workout'}</span></div>
                  <button className="primary-action together-start-now" disabled={!togetherProgramChoice||!togetherWorkoutChoices.length} onClick={createTogetherSession}>Start together</button>
                </section>}

                {togetherAction==='join'&&<section className="together-flow-card">
                  <div className="section-heading"><div><span className="card-label">JOIN SESSION</span><h3>Code or QR</h3></div><button type="button" className="icon-close" onClick={()=>{setTogetherAction('');setQrScanning(false)}}>×</button></div>
                  <div className="join-row together-join-row">
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength="6" placeholder="ABC123" />
                    <button type="button" onClick={()=>joinTogetherSession()}>Join</button>
                  </div>
                  <button type="button" className="secondary-action together-scan-button" onClick={()=>{setQrScanMessage('');setQrScanning(v=>!v)}}>{qrScanning?'Stop camera':'Scan QR code'}</button>
                  {qrScanning&&<div className="together-qr-scanner"><video ref={qrVideoRef} playsInline muted/><div>Point the camera at a Workset join QR code.</div></div>}
                  {qrScanMessage&&<p className="status-message">{qrScanMessage}</p>}
                  {togetherMessage&&<p className="status-message">{togetherMessage}</p>}
                </section>}

                {recentTogetherSessions.length>0&&<section className="simple-card together-recent-card">
                  <div className="section-heading"><div><span className="card-label">RECENT</span><h3>Recent sessions</h3></div></div>
                  <div className="together-recent-list">
                    {recentTogetherSessions.map(row=><div key={row.id}>
                      <div><strong>{row.program||'Shared workout'}</strong><span>Week {row.week} · {row.lift}</span></div>
                      <b>{row.status==='open'?'Live':'Finished'}</b>
                    </div>)}
                  </div>
                </section>}
              </>
            ) : (
              <>
                <section className="session-hero together-active-hero">
                  <div className="together-active-head">
                    <div>
                      <span className="card-label">{activeSession.status === 'open' ? 'LIVE NOW' : 'SESSION SUMMARY'}</span>
                      <h2>{sharedMeta?.program_name || programs[sharedProgramId]?.shortName || activeSession.program}</h2>
                      <p>{sharedMeta ? 'Week '+sharedMeta.week+' · '+sharedMeta.workout_title : 'Week '+activeSession.week+' · '+activeSession.lift}</p>
                    </div>
                    <div className="together-live-count"><strong>{participants.length+sharedManagedPartners.length}</strong><span>people</span></div>
                  </div>

                  {activeSession.status === 'open' && !ownSessionResult?.completed_at&&<button className="primary-action together-resume-button" onClick={openSharedWorkout}>{sharedWorkoutActive?'Resume workout':'Open my workout'}</button>}

                  <div className="together-session-share">
                    <div className="together-code-compact"><span>Join code</span><strong>{activeSession.join_code}</strong></div>
                    {activeSession.status==='open'&&<div className="together-share-actions">
                      <button type="button" onClick={shareSession}>Share</button>
                      <button type="button" onClick={()=>setShowSessionQr(v=>!v)}>{showSessionQr?'Hide QR':'QR code'}</button>
                      {activeSession.host_user_id===session.user.id&&<button type="button" onClick={()=>setInvitePanelOpen(v=>!v)}>Notify</button>}
                    </div>}
                  </div>

                  {showSessionQr&&<div className="together-qr-card">
                    {sessionQr?<img src={sessionQr} alt={'QR code to join Workset session '+activeSession.join_code}/>:<div className="qr-loading">Generating QR…</div>}
                    <div><strong>Scan to join</strong><span>or enter {activeSession.join_code}</span></div>
                  </div>}

                  {invitePanelOpen&&activeSession.host_user_id===session.user.id&&<div className="together-notify-panel">
                    <span>Invite to this workout</span>
                    {friends.length>0&&<>
                      <p>Your Workset friends</p>
                      <div className="active-session-friend-invites">{friends.map(friend=><button type="button" key={friend.user_id} onClick={()=>inviteFriendToActiveSession(friend)}>{friend.display_name}</button>)}</div>
                    </>}
                    <p>{friends.length?'Or invite another Workset user by exact email.':'Enter their exact Workset account email. They will get an invite inside Together.'}</p>
                    <div><input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="name@example.com"/><button type="button" onClick={sendTogetherInvite}>Send invite</button></div>
                  </div>}

                  {togetherMessage&&<p className="status-message">{togetherMessage}</p>}
                </section>

                <section className="summary-grid together-summary">
                  <div><span>People</span><strong>{participants.length+sharedManagedPartners.length}</strong></div>
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
                    {sharedManagedPartners.map(athlete=><div className="partner-row managed" key={'managed:'+athlete.id}>
                      <div><strong>{athlete.display_name}</strong><span>Managed partner · targets shown in workout</span></div>
                      <div><strong>—</strong><span>No login required</span></div>
                    </div>)}
                  </div>
                </section>

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
            onTrackingChanged={refreshTrackedProgramsInfo}
            onProgramCompleted={track=>setProgramCompletionPrompt({name:track?.program_name||'Program'})}
            onStartStrengthBaseline={startStrengthBaseline}
            onScheduleClassicWorkout={scheduleClassicWorkoutFromPlan}
            oneRepMaxes={oneRepMaxes}
          />
        ) : activeTab === 'whiteboard' ? (
          <WhiteboardPage session={session} />
        ) : activeTab === 'progress' ? (
          <section className="page-section progress-page">
            <div className="progress-page-top">
              <button className="secondary-action progress-back-button" onClick={()=>{setProgressStartSection('Overview');setActiveTab('me')}}>← Back to Me</button>
              <div>
                <span className="card-label">YOUR PROGRESS</span>
                <h2>Progress & Analytics</h2>
                <p>Charts, PRs, strength trends, body metrics, goals, history, consistency and everything you track.</p>
              </div>
            </div>
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
              trackedProgramInfo={trackedTodayInfo}
              trackedProgramsInfo={trackedProgramsInfo}
              initialSection={progressStartSection}
            />
          </section>
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

            <PlatformProgress
              view="mine"
              compact
              onOpenProgress={()=>{setProgressStartSection('Overview');setActiveTab('progress');window.scrollTo({top:0,behavior:'auto'})}}
              onOpenWeight={()=>{setProgressStartSection('Weight & Measurements');setActiveTab('progress');window.scrollTo({top:0,behavior:'auto'})}}
              session={session}
              profile={profile}
              setProfile={setProfile}
              progress={progress}
              lifts={lifts}
              formatWeight={formatWeight}
              programs={programs}
              dbNameToProgram={dbNameToProgram}
            />

            <section className="simple-card" id="one-rm-center">
              <div className="section-heading"><div><span className="card-label">1 REP MAXES</span><h3>Your current 1RMs</h3></div></div>
              <p className="helper-text">Saved to 2 decimals. Programs calculate their own training max and working percentages from these numbers.</p>
              <div className="tm-grid">
                {lifts.map(x => (
                  <label key={x}><span>{x}</span>
                    <div className="input-with-unit">
                      <input type="number" inputMode="decimal" value={oneRepMaxes[x] || ''} placeholder="0"
                        onFocus={e => e.currentTarget.select()}
                        onChange={e => setOneRm(x,e.target.value)} />
                      <b>lb</b>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="simple-card one-rm-card">
              <div className="section-heading"><div><span className="card-label">1RM CALCULATOR</span><h3>Estimate from a rep set</h3></div>{oneRmEstimate>0&&<b className="one-rm-result">{oneRmRounded} lb</b>}</div>
              <p className="helper-text">Uses the Epley estimate: weight × (1 + reps ÷ 30). Best used with lower-rep sets; it is an estimate, not a tested max.</p>
              <div className="one-rm-inputs">
                <label><span>Weight lifted</span><div className="input-with-unit"><input type="number" inputMode="decimal" value={oneRmWeight} placeholder="225" onFocus={e=>e.currentTarget.select()} onChange={e=>setOneRmWeight(e.target.value===''?'':Math.max(0,Number(e.target.value)))}/><b>lb</b></div></label>
                <label><span>Reps</span><input type="number" inputMode="numeric" min="1" max="15" value={oneRmReps} onFocus={e=>e.currentTarget.select()} onChange={e=>setOneRmReps(Math.max(1,Math.min(15,Number(e.target.value)||1)))}/></label>
              </div>
              {oneRmEstimate>0&&<div className="one-rm-summary">
                <div><span>Estimated 1RM</span><strong>{oneRmRounded} lb</strong></div>
                <div><span>85% training max</span><strong>{oneRmTrainingMax} lb</strong></div>
              </div>}
              {oneRmEstimate>0&&<div className="one-rm-apply">
                <label className="one-rm-add-to"><span>Add estimate to</span>
                  <select value={oneRmLift} onChange={e=>setOneRmLift(e.target.value)}>
                    <option value="">Choose lift…</option>
                    {lifts.map(name=><option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <button className="wide-button" type="button" disabled={!oneRmLift||!oneRmRounded} onClick={()=>setOneRm(oneRmLift,oneRmRounded,{notify:true})}>
                  {oneRmNotice?.type==='success'&&oneRmNotice.name===oneRmLift&&Number(oneRmNotice.value)===Number(oneRmRounded)
                    ? `✓ Saved ${oneRmLift} at ${oneRmRounded} lb`
                    : oneRmLift?`Add ${oneRmRounded} lb to ${oneRmLift} 1RM`:'Choose a lift to save this estimate'}
                </button>
              </div>}
            </section>

            <section className="simple-card one-rm-card">
              <div className="section-heading"><div><span className="card-label">CALCULATED FROM WORKOUTS</span><h3>Best estimated 1RMs</h3></div></div>
              <p className="helper-text">Calculated from completed main-lift sets using Epley. Use one as your saved 1RM, or test it with a baseline workout.</p>
              <div className="one-rm-summary">
                {lifts.map(name=>{
                  const candidate=calculatedOneRms[name]
                  return <div key={name}><span>{name}</span><strong>{candidate?candidate.value.toFixed(2)+' lb':'—'}</strong>{candidate&&<small>{candidate.weight} × {candidate.reps}</small>}{candidate&&<button type="button" onClick={()=>setOneRm(name,candidate.value,{notify:true})}>Use</button>}</div>
                })}
              </div>
              <p className="helper-text"><strong>Would you like to test this now?</strong></p>
              <div className="baseline-test-picker">
                <select value={baselineTestChoice} onChange={e=>setBaselineTestChoice(e.target.value)}>
                  <option value="">Choose a baseline test…</option>
                  <option value="full">All 4 lifts</option>
                  <option value="upper">Upper</option>
                  <option value="lower">Lower</option>
                  {lifts.map(name=><option key={name} value={'single:'+name}>Test {name}</option>)}
                </select>
                <button className="wide-button" type="button" disabled={!baselineTestChoice} onClick={startSelectedBaseline}>Start test</button>
              </div>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">{trackedProgramsInfo.length>1?'TRACKED PROGRAMS':'CURRENT PROGRAM'}</span><h3>{trackedProgramsInfo.length>1?trackedProgramsInfo.length+' active programs':trackedProgramsInfo[0]?.name||personalProgram.name}</h3></div></div>
              {trackedProgramsInfo.length>0&&<div className="me-tracked-program-list">{trackedProgramsInfo.map(info=><div key={info.key}>
                <div><strong>{info.name}</strong><span>{info.nextTitle?'Next: '+info.nextTitle:info.complete?'Complete':'Tracking'}</span></div>
                <b>{info.completed}/{info.total}</b>
              </div>)}</div>}
              <button className="wide-button" onClick={() => setActiveTab('program')}>Plan & programs</button>
            </section>

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">INVITE</span><h3>Invite someone</h3></div></div>
              <p className="helper-text">Anyone you invite gets their own account, program, maxes, history, and progress dashboard.</p>
              <button className="wide-button invite-button" onClick={shareInvite}>Share Workset</button>
              {inviteState && <div className="invite-status">{inviteState}</div>}
            </section>

            <FeedbackPanel session={session} profile={profile} />

            <section className="simple-card">
              <div className="section-heading"><div><span className="card-label">APP</span><h3>Install & update Workset</h3></div></div>
              <p className="helper-text">Install Workset, check for a new release, or force a clean refresh if the installed app ever looks stale.</p>
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
                <div className="section-heading"><div><span className="card-label">WORKSET ADMIN</span><h3>Administration</h3></div></div>
                <p className="helper-text">View users, workout history, progress totals, training maxes, and manage current programs.</p>
                <button className="wide-button admin-button" onClick={() => {setFeedbackUnread(0);setActiveTab('admin')}}>Open Admin{feedbackUnread?` · ${feedbackUnread} feedback`:''}</button>
              </section>
            )}

            <button className="signout-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </section>
        )}

        <div className="bottom-space" />
      </main>

      <nav className="mobile-bottom-nav app-level-mobile-nav" aria-label="Workset mobile navigation">
        <button className={activeTab==='today'?'active':''} onClick={openToday}><b>●</b><span>Today</span></button>
        <button className={activeTab==='together'?'active':''} onClick={()=>setActiveTab('together')}><b>⇄</b><span>Together</span>{(incomingTogetherInvites.length+incomingFriendRequests.length)>0&&<i className="nav-invite-badge">{incomingTogetherInvites.length+incomingFriendRequests.length}</i>}</button>
        <button className={activeTab==='program'?'active':''} onClick={()=>setActiveTab('program')}><b>▦</b><span>Plan</span></button>
        <button className={activeTab==='whiteboard'?'active':''} onClick={()=>setActiveTab('whiteboard')}><b>□</b><span>Board</span></button>
      </nav>

      {releaseUpdate&&<div className="release-update-toast" role="status">
        <div><strong>Workset update ready</strong><span>Reload to use the latest version.</span></div>
        <button type="button" onClick={applyReleaseUpdate}>Reload</button>
      </div>}

      {feedbackToast&&isAdmin&&<button className="admin-feedback-toast" onClick={()=>{setFeedbackUnread(0);setFeedbackToast(null);setActiveTab('admin')}}>
        <span>New feedback · {feedbackToast.category}</span>
        <strong>{String(feedbackToast.message||'').slice(0,120)}</strong>
      </button>}

      {oneRmNotice&&<div className={'one-rm-save-toast '+(oneRmNotice.type==='error'?'error':'success')} role="status">{oneRmNotice.type==='success'?'✓ ':''}{oneRmNotice.text}</div>}

      {completedDeletePrompt&&<div className="same-day-sheet-backdrop" onClick={()=>!deletingCompletedWorkout&&setCompletedDeletePrompt(null)}>
        <section className="same-day-sheet completed-workout-delete-sheet" onClick={e=>e.stopPropagation()}>
          <span className="card-label">DELETE WORKOUT</span>
          <h3>Delete this completed workout?</h3>
          <p>{completedDeletePrompt.title||'Workout'}{completedDeletePrompt.completed_at?' · '+new Date(completedDeletePrompt.completed_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''}</p>
          <p>This removes it from your history and Community. This cannot be undone.</p>
          <div>
            <button className="secondary-action" type="button" disabled={deletingCompletedWorkout} onClick={()=>setCompletedDeletePrompt(null)}>Keep workout</button>
            <button className="danger-action" type="button" disabled={deletingCompletedWorkout} onClick={()=>deleteCompletedWorkout(completedDeletePrompt)}>{deletingCompletedWorkout?'Deleting…':'Delete workout'}</button>
          </div>
        </section>
      </div>}

      {programCompletionPrompt&&<div className="same-day-sheet-backdrop" onClick={()=>setProgramCompletionPrompt(null)}>
        <section className="same-day-sheet" onClick={e=>e.stopPropagation()}>
          <span className="card-label">PROGRAM COMPLETE</span>
          <h3>{programCompletionPrompt.name} complete. Update your 1 rep maxes?</h3>
          <p>Review workout-calculated estimates, enter a number manually, or start a strength baseline.</p>
          <div><button className="secondary-action" onClick={()=>setProgramCompletionPrompt(null)}>Not now</button><button className="primary-action" onClick={openOneRmReview}>Review 1RMs</button></div>
        </section>
      </div>}

      {pendingWorkoutStart&&<div className="same-day-sheet-backdrop" onClick={()=>setPendingWorkoutStart(null)}>
        <section className="same-day-sheet" onClick={e=>e.stopPropagation()}>
          <span className="card-label">ANOTHER WORKOUT TODAY</span>
          <h3>You already completed {todayCompletedWorkouts.length||trackedProgramsInfo[0]?.workoutsToday||trackedTodayInfo?.workoutsToday||1} workout{(todayCompletedWorkouts.length||trackedProgramsInfo[0]?.workoutsToday||trackedTodayInfo?.workoutsToday||1)===1?'':'s'} today.</h3>
          <p>Start <strong>{pendingWorkoutStart.label}</strong> anyway?</p>
          <div><button className="secondary-action" onClick={()=>setPendingWorkoutStart(null)}>Cancel</button><button className="primary-action" onClick={confirmPendingWorkout}>Yes, start it</button></div>
        </section>
      </div>}
    </>
  )
}

export default App
