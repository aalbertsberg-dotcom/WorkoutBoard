import test from 'node:test'
import assert from 'node:assert/strict'
import {ACCOUNT_BACKUP_TABLES,buildAccountBackup,mergeAccountBackup,validateAccountBackup} from '../src/accountBackup.js'
test('Personal backup includes all essential user training, 1RMs, programs and board drawings',()=>{
  const tableNames=new Set(ACCOUNT_BACKUP_TABLES.map(x=>x.name))
  for(const table of ['one_rep_maxes','training_maxes','program_library','managed_athletes','whiteboard_drawings',
    'workout_logs','training_sessions','planned_workouts','body_measurements','workout_templates','profiles'])
    assert.ok(tableNames.has(table),table)
  assert.equal(tableNames.size,ACCOUNT_BACKUP_TABLES.length)
})
test('A failed backup query rejects instead of falsely claiming a complete download',async()=>{
  const client={from:name=>({select:()=>({eq:()=>({range:async()=>name==='program_library'
    ?{error:{message:'RLS unavailable'}}:{data:[]}})})})}
  await assert.rejects(buildAccountBackup(client,{userId:'athlete'}),/Backup stopped at program_library/)
})
test('Paged backup exports more than the first 1000 records with the correct owner ID',async()=>{
  const all=Array.from({length:1005},(_,i)=>({id:i}))
  const requested=[]
  const client={from:name=>({select:()=>({eq:(column,id)=>({range:async(lo,hi)=>{
    requested.push({name,column,id,lo,hi})
    return {data:name==='training_sessions'?all.slice(lo,hi+1):[]}
  }})})})}
  const data=await buildAccountBackup(client,{userId:'athlete',email:'test@example.test'})
  assert.equal(data.tables.training_sessions.length,1005)
  assert.equal(data.tables.one_rep_maxes.length,0)
  assert.equal(data.version,3)
  assert.equal(requested.filter(r=>r.name==='training_sessions').length,3)
  assert.ok(requested.every(r=>r.id==='athlete'))
})
test('Invalid backup content is rejected before any database mutation',async()=>{
  assert.throws(()=>validateAccountBackup({format:'WorkoutBoard Backup',version:3,tables:{training_sessions:{bad:true}}}),/Invalid backup/)
  let calls=0
  const client={from:()=>{calls++;return {upsert:async()=>({error:null})}}}
  await assert.rejects(mergeAccountBackup(client,{format:'WorkoutBoard Backup',version:3,tables:{planned_workouts:[null]}},{userId:'athlete'}),/Invalid backup/)
  assert.equal(calls,0)
})
test('Restore rewrites ownership to current account and stops on first failure',async()=>{
  const rows=[]
  const client={from:name=>({upsert:async payload=>{
    rows.push({name,payload})
    return name==='training_sessions'?{error:{message:'db rejected row'}}:{error:null}
  }})}
  const doc={format:'WorkoutBoard Backup',version:3,tables:{
    profiles:[{id:'old-user',display_name:'Tester'}],
    program_library:[{id:'program-1',owner_user_id:'old-user',name:'Plan'}],
    training_sessions:[{id:'session-1',user_id:'old-user',title:'Walk'}],
  }}
  await assert.rejects(mergeAccountBackup(client,doc,{userId:'new-user'}),/Restore stopped at training_sessions/)
  assert.equal(rows.find(r=>r.name==='profiles').payload[0].id,'new-user')
  assert.equal(rows.find(r=>r.name==='program_library').payload[0].owner_user_id,'new-user')
  assert.equal(rows.find(r=>r.name==='training_sessions').payload[0].user_id,'new-user')
})
test('Legacy version 2 backups remain compatible',()=>{
  assert.doesNotThrow(()=>validateAccountBackup({format:'WorkoutBoard Backup',version:2,tables:{workout_logs:[]}}))
})
