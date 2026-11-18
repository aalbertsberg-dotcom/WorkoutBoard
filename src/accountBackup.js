/** WorkSet's recoverable personal training data.
 * Social connections, authentication, and photo file bytes are excluded.
 * Explicit owner keys avoid accidentally exporting other users' records.
 */
export const ACCOUNT_BACKUP_TABLES=[
  {name:'profiles',owner:'id'},
  {name:'one_rep_maxes',owner:'user_id'},
  {name:'training_maxes',owner:'user_id'},
  {name:'managed_athletes',owner:'owner_user_id'},
  {name:'program_library',owner:'owner_user_id'},
  {name:'program_versions',owner:'user_id'},
  {name:'workout_templates',owner:'user_id'},
  {name:'equipment_profiles',owner:'user_id'},
  {name:'exercise_substitutions',owner:'user_id'},
  {name:'exercise_timer_presets',owner:'user_id'},
  {name:'user_program_tracking',owner:'user_id'},
  {name:'planned_workouts',owner:'user_id'},
  // Session rows can refer to legacy workout-log IDs, so restore logs first.
  {name:'workout_logs',owner:'user_id'},
  {name:'training_sessions',owner:'user_id'},
  {name:'training_goals',owner:'user_id'},
  {name:'body_measurements',owner:'user_id'},
  {name:'whiteboard_notes',owner:'user_id'},
  {name:'whiteboard_drawings',owner:'user_id'},
]
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
export const ACCOUNT_BACKUP_VERSION=3
const LIMIT=500

export function validateAccountBackup(doc){
  if(!isObject(doc)||doc.format!=='WorkoutBoard Backup'||![2,3].includes(Number(doc.version))||
    !isObject(doc.tables))throw new Error('Not a compatible WorkSet backup file.')
  for(const [name,rows] of Object.entries(doc.tables)){
    if(!Array.isArray(rows)||rows.some(row=>!isObject(row)))
      throw new Error('Invalid backup records in '+name+'. Nothing was restored.')
  }
  return doc
}
export async function buildAccountBackup(client,{userId,email,pageSize=LIMIT}={}){
  if(!userId)throw new Error('Sign in to back up your account.')
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)
    throw new Error('Invalid backup page size.')
  const result={
    format:'WorkoutBoard Backup',version:ACCOUNT_BACKUP_VERSION,
    exported_at:new Date().toISOString(),user_email:email||null,
    scope:'Personal training data; excludes account login, social connections and photo files',
    tables:{}
  }
  for(const {name,owner} of ACCOUNT_BACKUP_TABLES){
    const rows=[]
    for(let offset=0;offset<100000;offset+=pageSize){
      let reply
      try{reply=await client.from(name).select('*').eq(owner,userId).range(offset,offset+pageSize-1)}
      catch(error){throw new Error('Backup stopped at '+name+': '+(error?.message||'request failed'))}
      if(reply?.error)throw new Error('Backup stopped at '+name+': '+reply.error.message)
      if(!Array.isArray(reply?.data))throw new Error('Backup stopped at '+name+': no records returned')
      rows.push(...reply.data)
      if(reply.data.length<pageSize){result.tables[name]=rows;break}
      if(offset+pageSize>=100000)throw new Error('Backup stopped at '+name+': too many records')
    }
  }
  return validateAccountBackup(result)
}

export async function mergeAccountBackup(client,doc,{userId,pageSize=LIMIT}={}){
  validateAccountBackup(doc)
  if(!userId)throw new Error('Sign in before restoring a backup.')
  let imported=0
  for(const {name,owner} of ACCOUNT_BACKUP_TABLES){
    const rows=doc.tables[name]||[]
    // Validate all rows in each table before attempting a write.
    const mapped=rows.map(row=>({...row,[owner]:userId}))
    for(let start=0;start<mapped.length;start+=pageSize){
      const part=mapped.slice(start,start+pageSize)
      let reply
      try{reply=await client.from(name).upsert(part)}
      catch(error){throw new Error('Restore stopped at '+name+': '+(error?.message||'request failed')+
        '. Earlier tables may already have been merged.')}
      if(reply?.error)throw new Error('Restore stopped at '+name+': '+reply.error.message+
        '. Earlier tables may already have been merged.')
      imported+=part.length
    }
  }
  return {imported}
}
