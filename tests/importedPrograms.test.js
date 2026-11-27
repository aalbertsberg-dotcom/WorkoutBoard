import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {zipSync,strToU8} from 'fflate'
import {DOMParser} from '@xmldom/xmldom'
import {
  parseCSV,parseXlsx,convertSpreadsheetSheets,inspectProgramFile,
  validateReviewedProgram,normalizeReviewedProgram,importedProgramFromLibrary,
  makePlannedFromImported,importedProgramKey,importedReferenceLift
} from '../src/importedPrograms.js'

const row=(...values)=>values.map(value=>({value:String(value??''),formula:false}))
const sheet=(...lines)=>[{name:'Sheet1',rows:lines.map(values=>row(...values))}]
const headers=row('Week','Day','Exercise','Sets','Reps','Percent','Basis','Weight','Notes')
const simple=()=>convertSpreadsheetSheets([{
  name:'Sheet1',rows:[
    headers,
    row(1,'Monday','Squat',3,5,65,'TM','','Warm up'),
    row(1,'Monday','Bench Press',3,5,75,'TM','',''),
    row(1,'Wednesday','Deadlift',3,3,80,'TM','',''),
    row(2,'Monday','Squat',3,5,70,'TM','',''),
  ]
}],{name:'My cycle'})

test('CSV parsing handles escaped names and embedded newlines without losing columns',()=>{
  const rows=parseCSV('Week,Day,Exercise,Sets,Reps\n1,Monday,"Press, Strict",3,5\n1,Tuesday,"Row ""Heavy""",4,8\n')
  assert.equal(rows.length,3)
  assert.equal(rows[1][2].value,'Press, Strict')
  assert.equal(rows[2][2].value,'Row "Heavy"')
  const withNewline=parseCSV('Week,Exercise,Notes\n1,Squat,"Pause\nat bottom"\n')
  assert.equal(withNewline[1][2].value,'Pause\nat bottom')
  assert.throws(()=>parseCSV('Week,Exercise\n1,"Squat'),/unclosed quoted/)
})
test('normalized CSV imports weeks, days, exact percentages, notes and saved 1RM bases',()=>{
  const plan=simple()
  assert.equal(plan.canSave,true)
  assert.equal(plan.weeksCount,2)
  assert.equal(plan.workoutCount,3)
  assert.equal(plan.exerciseCount,4)
  assert.equal(plan.weeks[0].days[0].title,'Monday')
  const exercise=plan.weeks[0].days[0].exercises[0]
  assert.equal(exercise.name,'Squat')
  assert.equal(exercise.imported.pct,65)
  assert.equal(exercise.imported.basis,'tm')
  assert.equal(exercise.imported.maxLift,'Squat')
  assert.equal(exercise.note,'Warm up')
  assert.deepEqual(validateReviewedProgram(plan),[])
  const normalized=normalizeReviewedProgram(plan)
  assert.equal(normalized.weekCount,2)
  assert.equal(normalized.weeks[0].days[0].exercises[0].prescription,'3x5 @ 65% TM')
})
test('converts reviewed 1RM/TM workouts into real tracked planned sets',()=>{
  const p=simple(),normal=normalizeReviewedProgram(p)
  const dbRow={
    id:'0c9c1979-f435-4bd5-81a8-411091235f31',
    status:'active',name:p.name,weeks_count:2,
    plan:{schema_version:1,reviewed:true,weeks:normal.weeks,source_file:'gym.xlsx'}
  }
  const program=importedProgramFromLibrary(dbRow)
  assert.equal(program.key,importedProgramKey(dbRow.id))
  assert.equal(program.kind,'custom')
  const planned=makePlannedFromImported(program,1,0,'2026-11-30',{
    Squat:300,Bench:200,Deadlift:350,Press:125
  })
  assert.equal(planned.source_week,1)
  assert.equal(planned.workout.imported_program_id,dbRow.id)
  assert.equal(planned.workout.exercises[0].setProgress.length,3)
  // 300 × 85% × 65% = 165.75 -> 165 lb (5-lb plate increment).
  assert.equal(planned.workout.exercises[0].setProgress[0].weight,165)
  assert.equal(planned.workout.exercises[0].setProgress[0].weight_lift,'Squat')
  assert.equal(planned.workout.exercises[1].setProgress[0].weight,130)
  assert.equal(planned.workout.exercises[1].setProgress[0].weight_lift,'Bench')
  const next=makePlannedFromImported(program,2,0,'2026-12-07',{Squat:300})
  assert.equal(next.workout.exercises[0].setProgress[0].weight,180)
  assert.equal(next.status,'planned')
})
test('imported formula-driven cells fail closed rather than using cached results',()=>{
  const sheets=[{name:'Week 1',rows:[
    row('Exercise','Sets','Reps','Percent'),
    [row('Squat',3,5,65)[0],row('Squat',3,5,65)[1],row('Squat',3,5,65)[2],{value:'85',formula:true}]
  ]}]
  const result=convertSpreadsheetSheets(sheets,{defaultBasis:'tm'})
  assert.equal(result.canSave,false)
  assert.equal(result.formulaCount,1)
  assert.match(result.issues[0].text,/Formula-driven/)
})
test('rejects complex formula-driven worksheets rather than silently omitting a cycle',()=>{
  const good={name:'Week 1',rows:[
    row('Exercise','Sets','Reps'),row('Squat','3','5')
  ]}
  const complex={name:'Anchor Cycle 2',rows:[
    [{value:'New training max',formula:false},{value:'310',formula:true}]
  ]}
  const p=convertSpreadsheetSheets([good,complex])
  assert.equal(p.canSave,false)
  assert.ok(p.issues.some(i=>i.level==='error'&&i.text.includes('Formula-based')))
})

test('ambiguous percent basis blocks save until the athlete confirms TM or 1RM',()=>{
  const sheets=sheet(
    ['Exercise','Sets','Reps','Percent'].map(x=>x),
    ['Squat',3,5,'85'])
  const unknown=convertSpreadsheetSheets(sheets)
  assert.equal(unknown.canSave,false)
  const known=convertSpreadsheetSheets(sheets,{defaultBasis:'tm'})
  assert.equal(known.canSave,true)
  assert.equal(known.weeks[0].days[0].exercises[0].imported.basis,'tm')
})
test('percentage-based non-primary lifts require an explicit saved max selection',()=>{
  const s=sheet(['Exercise','Sets','Reps','Percent','Basis'],['Cable Curl',3,10,55,'1RM'])
  const p=convertSpreadsheetSheets(s)
  assert.equal(p.canSave,true)
  assert.equal(validateReviewedProgram(p).some(i=>i.includes('percentage basis')),true)
  const exercise=p.weeks[0].days[0].exercises[0]
  exercise.imported.maxLift='Press'
  assert.deepEqual(validateReviewedProgram(p),[])
  assert.equal(importedReferenceLift('Barbell Bench Press'),'Bench')
  assert.equal(importedReferenceLift('Front Squat'),'')
})
test('requires every week, rejects ambiguous fixed + percentage loads',()=>{
  const gap=convertSpreadsheetSheets([{name:'Sheet1',rows:[
    headers,row(1,'Monday','Squat',3,5,65,'TM','',''),
    row(3,'Monday','Squat',3,5,65,'TM','','')
  ]}])
  assert.equal(gap.canSave,false)
  assert.match(gap.issues.find(i=>i.level==='error').text,/Missing week numbers/)
  const ambig=convertSpreadsheetSheets([{name:'Sheet1',rows:[
    headers,row(1,'Monday','Squat',3,5,65,'TM',225,'')
  ]}])
  assert.equal(ambig.canSave,false)
})
test('imports actual zipped XLSX with sharedStrings, relationships, and formula detection',()=>{
  const book='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Week 1" sheetId="1" r:id="rId1"/></sheets></workbook>'
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
  const strings='<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Exercise</t></si><si><t>Sets</t></si><si><t>Reps</t></si><si><t>Percent</t></si><si><t>Basis</t></si><si><t>Squat</t></si><si><t>TM</t></si></sst>'
  const xml='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row><row r="2"><c r="A2" t="s"><v>5</v></c><c r="B2"><v>3</v></c><c r="C2"><v>5</v></c><c r="D2"><v>0.65</v></c><c r="E2" t="s"><v>6</v></c></row></sheetData></worksheet>'
  const archive=zipSync({
    'xl/workbook.xml':strToU8(book),
    'xl/_rels/workbook.xml.rels':strToU8(rels),
    'xl/sharedStrings.xml':strToU8(strings),
    'xl/worksheets/sheet1.xml':strToU8(xml)
  })
  const originalParser=globalThis.DOMParser
  globalThis.DOMParser=DOMParser
  try{
    const sheets=parseXlsx(archive)
    assert.equal(sheets[0].name,'Week 1')
    assert.equal(sheets[0].rows[1][0].value,'Squat')
    const p=convertSpreadsheetSheets(sheets)
    assert.equal(p.canSave,true)
    assert.equal(p.weeks[0].days[0].exercises[0].imported.pct,65)
  }finally{globalThis.DOMParser=originalParser}
})
test('UI exposes upload, review, private save, and tracked program integration',()=>{
  const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
  const ui=src('src/ProgramUpload.jsx'),plan=src('src/platform.jsx'),app=src('src/App.jsx')
  assert.match(ui,/Analyze spreadsheet/)
  assert.match(ui,/I reviewed the exercises/)
  assert.match(ui,/Save to My Programs/)
  assert.match(ui,/source_type:'manual',status:'active',visibility:'private'/)
  assert.match(ui,/validateReviewedProgram/)
  assert.match(plan,/importedCatalog/)
  assert.match(plan,/makePlannedFromImported\(preview/)
  assert.match(app,/makePlannedFromImported\(program/)
  assert.match(app,/importedProgramsRef\.current/)
  assert.match(app,/\^\(archive\|classic\|custom\):/)
  assert.match(plan,/Track this program/)
  assert.match(plan,/Save shared copy to My Programs/)
  assert.match(plan,/saveSharedImportedProgram/)
  assert.match(plan,/reviewed:Boolean\(p.kind==='custom'&&p.reviewed===true\)/)
})
