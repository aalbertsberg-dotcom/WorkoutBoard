// Conservative spreadsheet-to-program importer. No Excel formulas are
// evaluated, and no source file is uploaded to the server: only a reviewed,
// structured workout plan is saved into the user's program_library row.
import {unzipSync,strFromU8} from 'fflate'

export const IMPORT_MAX_FILE_BYTES=8*1024*1024
const MAX_UNCOMPRESSED=32*1024*1024
const MAX_SHEETS=32
const MAX_ROWS=12000
const MAX_WEEKS=52
const MAX_DAYS=7
const MAX_EXERCISES_PER_DAY=45
const HEADERS={
  week:['week','weeknumber','trainingweek','wk'],
  day:['day','daynumber','workoutday','session','workout','trainingday'],
  exercise:['exercise','movement','lift','exercise name','movement name'],
  sets:['sets','set','numberofsets'],
  reps:['reps','repetitions','repetition','rep','repsper set'],
  percent:['percent','percentage','%','pct','intensity','percent1rm','percenttm'],
  weight:['weight','load','lbs','lb','weightlb','loadlb','weightlbs'],
  basis:['basis','weightbasis','percentof','percentageof','calculationbasis'],
  offset:['tmincrease','tmincrease lb','trainingmaxincrease','tmoffset','offset'],
  notes:['notes','note','instructions','comments','cue'],
  prescription:['prescription','setsprescription','scheme','setsreps'],
}
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const headerKey=value=>clean(value).toLowerCase().replace(/[^a-z%0-9]+/g,'')
const normHeaders=Object.fromEntries(Object.entries(HEADERS).map(([k,names])=>
  [k,new Set(names.map(headerKey))]))
export const isSpreadsheetImportFile=file=>/\.(xlsx|csv)$/i.test(file?.name||'')
export const importedProgramKey=id=>'custom:'+id

export function parseCSV(text){
  const result=[]
  let field='',row=[],inQuotes=false
  const input=String(text||'').replace(/^\uFEFF/,'')
  for(let i=0;i<input.length;i++){
    const ch=input[i]
    if(inQuotes){
      if(ch==='"'&&input[i+1]==='"'){field+='"';i++}
      else if(ch==='"')inQuotes=false
      else field+=ch
    }else if(ch==='"'){
      if(field)throw Error('Invalid CSV quote in an unquoted field.')
      inQuotes=true
    }else if(ch===','){row.push(field);field=''}
    else if(ch==='\n'||ch==='\r'){
      if(ch==='\r'&&input[i+1]==='\n')i++
      row.push(field)
      if(row.some(x=>clean(x)))result.push(row)
      row=[];field=''
    }else field+=ch
  }
  if(inQuotes)throw Error('CSV has an unclosed quoted field.')
  row.push(field)
  if(row.some(x=>clean(x)))result.push(row)
  if(result.length>MAX_ROWS)throw Error('Too many spreadsheet rows. Limit: 12,000.')
  return result.map(cells=>cells.map(value=>({value,formula:false})))
}

const xmlError=doc=>{
  if(!doc?.documentElement||doc.getElementsByTagName('parsererror').length)
    throw Error('Unable to read the workbook XML.')
  return doc
}
const xml=(source)=>xmlError(new DOMParser().parseFromString(source,'application/xml'))
const byName=(parent,localName)=>Array.from(parent?.getElementsByTagName('*')||[])
  .filter(el=>el.localName===localName)
const children=(parent,localName)=>Array.from(parent?.children||[])
  .filter(el=>el.localName===localName)
const attr=(el,name)=>el?.getAttribute(name)||''
const sheetPath=(target)=>{
  const cleanTarget=String(target||'').replace(/^\/+/,'')
  const full=cleanTarget.startsWith('xl/')?cleanTarget:
    cleanTarget.startsWith('worksheets/')?'xl/'+cleanTarget:
      'xl/'+cleanTarget
  if(!/^xl\/worksheets\/[\w-]+\.xml$/i.test(full))return null
  return full
}
const cellColumn=address=>{
  const letters=String(address||'').match(/^[A-Z]+/i)?.[0]?.toUpperCase()||''
  let index=0
  for(const c of letters)index=index*26+c.charCodeAt(0)-64
  return index>0&&index<=256?index-1:-1
}
const sharedText=si=>byName(si,'t').map(t=>t.textContent||'').join('')
const sheetRows=(doc,shared)=>{
  const all=byName(doc,'row')
  if(all.length>MAX_ROWS)throw Error('Workbook contains too many rows.')
  return all.map(row=>{
    const cells=[]
    for(const cell of children(row,'c')){
      const col=cellColumn(attr(cell,'r'))
      if(col<0)continue
      const t=attr(cell,'t')
      const formula=children(cell,'f').length>0
      const value=children(cell,'v')[0]?.textContent||''
      const inline=children(cell,'is')[0]
      let parsed=inline?sharedText(inline):value
      if(t==='s')parsed=shared[Number(value)]??''
      if(t==='b')parsed=value==='1'?'TRUE':'FALSE'
      cells[col]={value:parsed,formula}
    }
    return cells
  })
}

export function parseXlsx(bytes){
  if(typeof DOMParser==='undefined')throw Error('Excel parsing requires the browser document parser.')
  if(bytes.length>IMPORT_MAX_FILE_BYTES)throw Error('Workbook is too large (8 MB maximum).')
  let expanded=0,count=0
  const archive=unzipSync(bytes,{filter:entry=>{
    count++
    const size=Number(entry.size||0)
    expanded+=size
    if(count>300||expanded>MAX_UNCOMPRESSED||size>12*1024*1024)
      throw Error('Workbook is too large or contains too many ZIP entries.')
    const name=String(entry.name||'')
    return name==='xl/workbook.xml'||name==='xl/_rels/workbook.xml.rels'||
      name==='xl/sharedStrings.xml'||/^xl\/worksheets\/[\w-]+\.xml$/i.test(name)
  }})
  if(!archive['xl/workbook.xml']||!archive['xl/_rels/workbook.xml.rels'])
    throw Error('This is not a supported XLSX workbook.')
  const book=xml(strFromU8(archive['xl/workbook.xml']))
  const rels=xml(strFromU8(archive['xl/_rels/workbook.xml.rels']))
  const relations=new Map(byName(rels,'Relationship').map(x=>[attr(x,'Id'),sheetPath(attr(x,'Target'))]))
  const shared=archive['xl/sharedStrings.xml']
    ?byName(xml(strFromU8(archive['xl/sharedStrings.xml'])),'si').map(sharedText):[]
  const listed=byName(book,'sheet')
  if(listed.length>MAX_SHEETS)throw Error('Too many sheets. Limit: 32.')
  return listed.map((sheet,index)=>{
    const relationshipId=attr(sheet,'r:id')||sheet.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')
    const path=relations.get(relationshipId)
    const bytes=path?archive[path]:null
    return {
      name:clean(attr(sheet,'name'))||('Sheet '+(index+1)),
      rows:bytes?sheetRows(xml(strFromU8(bytes)),shared):[],
    }
  }).filter(s=>s.rows.length)
}

const asCell=(row,index)=>index<0?{value:'',formula:false}:
  row?.[index]||{value:'',formula:false}
function mapping(row){
  const found={}
  for(let i=0;i<(row||[]).length;i++){
    const key=headerKey(row[i]?.value)
    for(const [target,valid] of Object.entries(normHeaders)){
      if(valid.has(key)&&found[target]===undefined)found[target]=i
    }
  }
  return found
}
const parseNumber=value=>{
  const str=clean(value).replace(/,/g,'')
  return /^-?\d+(?:\.\d+)?$/.test(str)?Number(str):NaN
}
const percentValue=value=>{
  const raw=clean(value)
  if(!raw)return null
  const hasPercent=raw.endsWith('%')
  const number=parseNumber(raw.replace(/%$/,''))
  if(!Number.isFinite(number))return NaN
  const pct=hasPercent?number:number>0&&number<=1?number*100:number
  return Number.isFinite(pct)&&pct>0&&pct<=150?pct:NaN
}
const basisValue=value=>{
  const v=clean(value).toLowerCase().replace(/[\s%-]/g,'')
  if(!v)return null
  if(['tm','trainingmax','trainingmaximum'].includes(v))return 'tm'
  if(['1rm','e1rm','onerepmax','estimated1rm','max'].includes(v))return 'e1rm'
  return 'unknown'
}
export const importedProgramFromRow=row=>({
  name:row.name,prescription:row.prescription,note:row.note||'',
  ...(row.sets?{imported:{
    sets:row.sets,reps:row.reps,pct:row.pct,basis:row.basis,
    weight:row.weight,tm_offset:row.tm_offset,
  }}:{})
})
const prescriptionPattern=/^(\d+)\s*[x×]\s*(\d+\+?)\s*(?:@\s*(\d+(?:\.\d+)?)\s*%\s*(TM|1RM|e1RM))?$/i

export function convertSpreadsheetSheets(sheets,{name='Imported program',defaultBasis=''}={}){
  const issues=[],weeks=new Map()
  let parsedCount=0,formulaCount=0,unrecognized=0,usesPercents=false
  for(const sheet of sheets||[]){
    const rows=sheet.rows||[]
    const headerIndex=rows.findIndex((row,i)=>i<40&&
      mapping(row).exercise!==undefined&&
      ['sets','reps','percent','weight','prescription'].some(k=>mapping(row)[k]!==undefined))
    if(headerIndex<0){
      if(rows.some(row=>row.some(c=>clean(c?.value)))){unrecognized++;issues.push({
        level:'warning',text:sheet.name+': No supported Exercise/Sets/Reps header found; sheet was skipped.'
      })}
      continue
    }
    const map=mapping(rows[headerIndex])
    const tabWeek=Number(sheet.name.match(/(?:week|wk)\s*[-#:]?\s*(\d+)/i)?.[1]||0)
    const tabDay=sheet.name.match(/(?:day|workout|session)\s*[-#:]?\s*([A-Za-z0-9]+)/i)?.[1]||''
    let lastWeek=tabWeek||1,lastDay=tabDay?('Day '+tabDay):'Day 1'
    for(let r=headerIndex+1;r<rows.length;r++){
      const cells=rows[r]
      if(!cells||!cells.some(c=>clean(c?.value)))continue
      const get=k=>asCell(cells,map[k]===undefined?-1:map[k])
      const exercise=clean(get('exercise').value)
      const weekField=clean(get('week').value),dayField=clean(get('day').value)
      if(weekField){
        const value=parseNumber(weekField.replace(/^week\s*/i,''))
        if(Number.isInteger(value)&&value>=1&&value<=MAX_WEEKS)lastWeek=value
        else {issues.push({level:'error',text:sheet.name+' row '+(r+1)+': Invalid week.'});continue}
      }
      if(dayField)lastDay=dayField
      if(!exercise)continue
      const relevant=['exercise','sets','reps','percent','weight','basis','offset','notes','prescription','week','day']
      const hasFormula=relevant.some(k=>get(k).formula)
      if(hasFormula){formulaCount++;issues.push({level:'error',text:sheet.name+' row '+(r+1)+': Formula-driven workout cell. Review and replace with explicit values before import.'});continue}
      const rx=clean(get('prescription').value)
      const parsedRx=rx.match(prescriptionPattern)
      let sets=parsedRx?Number(parsedRx[1]):parseNumber(get('sets').value)
      let reps=parsedRx?parsedRx[2]:clean(get('reps').value)
      let pct=parsedRx&&parsedRx[3]?Number(parsedRx[3]):percentValue(get('percent').value)
      let basis=parsedRx?.[4]?basisValue(parsedRx[4]):basisValue(get('basis').value)
      const weightText=clean(get('weight').value)
      const weight=weightText?parseNumber(weightText):null
      const offsetText=clean(get('offset').value)
      const tm_offset=offsetText?parseNumber(offsetText):0
      if(!Number.isInteger(sets)||sets<1||sets>30||!reps||!/^\d{1,3}\+?$/.test(reps)||Number.parseInt(reps,10)>100||
         Number.parseInt(reps,10)<1||Number.isNaN(pct)||
         (pct!==null&&weight!==null)|| (weight!==null&&(!Number.isFinite(weight)||weight<0||weight>2000))||
         !Number.isFinite(tm_offset)||Math.abs(tm_offset)>250||
         (tm_offset!==0&&pct===null)){
        issues.push({level:'error',text:sheet.name+' row '+(r+1)+': Ambiguous or unsupported sets, reps, percent, weight, or TM increase.'});continue
      }
      if(!parsedRx&&rx&&!/^\d+\s*[x×]\s*\d+\+?$/.test(rx)&&!clean(get('sets').value)){
        issues.push({level:'error',text:sheet.name+' row '+(r+1)+': Unrecognized prescription; use columns Sets, Reps and Percent, or e.g. 3x5 @ 75% TM.'});continue
      }
      if(pct!==null){
        usesPercents=true
        basis=basis||basisValue(defaultBasis)
        if(!basis||basis==='unknown'){
          issues.push({level:'error',text:sheet.name+' row '+(r+1)+': Percent needs a confirmed TM or 1RM basis.'});continue
        }
      }
      if(basis==='unknown'){
        issues.push({level:'error',text:sheet.name+' row '+(r+1)+': Unknown percentage basis.'});continue
      }
      const week=lastWeek,day=clean(lastDay)||'Day 1'
      if(!weeks.has(week))weeks.set(week,new Map())
      const days=weeks.get(week)
      if(!days.has(day))days.set(day,[])
      const exercises=days.get(day)
      exercises.push(importedProgramFromRow({
        name:exercise.slice(0,120),
        prescription:rx||sets+'x'+reps+(pct!=null?' @ '+pct+'% '+(basis==='tm'?'TM':'1RM'):weight!==null?' @ '+weight+' lb':''),
        note:clean(get('notes').value).slice(0,500),
        sets,reps,pct,basis,weight,tm_offset,
      }))
      parsedCount++
      if(parsedCount>3500)issues.push({level:'error',text:'Too many exercises (3,500 maximum).'})
    }
  }
  const weekNumbers=Array.from(weeks.keys()).sort((a,b)=>a-b)
  const finalWeeks=weekNumbers.map(week=>{
    const groups=weeks.get(week)
    const days=Array.from(groups.entries()).map(([title,exercises])=>({title,exercises}))
    if(days.length>MAX_DAYS)issues.push({level:'error',text:'Week '+week+' has more than 7 days.'})
    for(const d of days)if(d.exercises.length>MAX_EXERCISES_PER_DAY)
      issues.push({level:'error',text:'Week '+week+' '+d.title+' exceeds 45 exercises.'})
    return {week,days}
  })
  if(!parsedCount)issues.push({level:'error',text:'No complete workout rows were recognized.'})
  if(weekNumbers.length&&weekNumbers[0]!==1)issues.push({
    level:'error',text:'Week numbering must start at Week 1.'
  })
  if(weekNumbers.some((n,i)=>i>0&&n!==weekNumbers[i-1]+1))issues.push({
    level:'error',text:'Missing week numbers. Fill every program week before saving.'
  })
  if(unrecognized)issues.push({level:'warning',text:unrecognized+' worksheet(s) were not imported. Verify they are not needed.'})
  if(!usesPercents)issues.push({level:'warning',text:'No percentage-based weights recognized; loads are fixed or entered during workouts.'})
  const maxWeek=weekNumbers.at(-1)||0
  const totalDays=finalWeeks.reduce((sum,w)=>sum+w.days.length,0)
  return {
    name:clean(name).slice(0,140)||'Imported program',
    weeks:finalWeeks,
    weeksCount:maxWeek,
    daysPerWeek:Math.max(0,...finalWeeks.map(w=>w.days.length)),
    exerciseCount:parsedCount,
    workoutCount:totalDays,
    formulaCount,issues,
    canSave:parsedCount>0&&!issues.some(i=>i.level==='error'),
  }
}

export async function inspectProgramFile(file,options={}){
  if(!isSpreadsheetImportFile(file))throw Error('Please choose an .xlsx or .csv file.')
  if(file.size>IMPORT_MAX_FILE_BYTES)throw Error('File is too large. Limit: 8 MB.')
  if(file.size<1)throw Error('File is empty.')
  const ext=file.name.split('.').pop().toLowerCase()
  const sheets=ext==='csv'
    ?[{name:'CSV',rows:parseCSV(await file.text())}]
    :parseXlsx(new Uint8Array(await file.arrayBuffer()))
  return {sourceFile:file.name,sourceFormat:ext,...convertSpreadsheetSheets(sheets,options)}
}

export function importedProgramFromLibrary(row){
  const plan=row?.plan
  if(!row?.id||row?.status!=='active'||plan?.schema_version!==1||
    !Array.isArray(plan.weeks)||!plan.weeks.length)return null
  const weeks=plan.weeks
  return {
    id:row.id,key:importedProgramKey(row.id),kind:'custom',
    name:row.name,shortName:row.name,source:plan.source_file||'Imported spreadsheet',
    description:row.description||'User-imported program (reviewed before saving)',
    category:'My Programs',difficulty:'Custom',
    weeksCount:Number(row.weeks_count||weeks.at(-1)?.week||1),
    daysPerWeek:Math.max(0,...weeks.map(w=>w.days?.length||0)),
    durationLabel:String(row.weeks_count||weeks.length)+' weeks',
    frequencyLabel:'Imported schedule',
    reviewed:plan.reviewed===true,
    getWeek:number=>weeks.find(w=>Number(w.week)===Number(number))?.days||[],
  }
}

const round5=n=>Math.round(n/5)*5
export function makePlannedFromImported(program,week,dayIndex,date,maxes={}){
  if(!program?.getWeek||!program.reviewed)throw Error('Imported program has not been reviewed.')
  const days=program.getWeek(week)
  const selected=days[Math.max(0,Math.min(Number(dayIndex)||0,days.length-1))]
  if(!selected)throw Error('This imported week has no workout.')
  const exercises=(selected.exercises||[]).map((item,i)=>{
    const info=item.imported
    if(!info?.sets||!info.reps)return {...item,id:'e'+(i+1),done:false,result:'',load:''}
    const lift=['Squat','Bench','Deadlift','Press'].find(l=>l.toLowerCase()===String(item.name).toLowerCase())||null
    const base=info.basis==='tm'?Number(maxes[lift]||0)*.85+Number(info.tm_offset||0):
      Number(maxes[lift]||0)
    const weight=info.pct!=null&&lift&&base>0
      ?round5(base*Number(info.pct)/100):
      Number.isFinite(Number(info.weight))&&info.weight!==null?Number(info.weight):''
    const progress=Array.from({length:Number(info.sets)},(_,j)=>({
      set:j+1,reps:parseInt(info.reps,10),
      label:info.reps+(info.pct!=null?' @ '+info.pct+'% '+(info.basis==='tm'?'TM':'1RM'):''),
      done:false,editable_reps:String(info.reps).includes('+'),
      weight,
      ...(info.pct!=null&&lift?{
        weight_lift:lift,weight_basis:info.basis,tm_offset:Number(info.tm_offset||0),
        pct:info.pct,pct_high:null,target_weight_range:'',
      }:{}),
    }))
    return {...item,id:'e'+(i+1),done:false,result:'',load:'',setProgress:progress}
  })
  return {
    scheduled_date:date,title:selected.title,
    source_program_name:program.name,source_week:week,source_day:selected.title,
    workout:{version:2,type:'flexible',imported_program_id:program.id,
      source:program.source,notes:'Reviewed imported program',
      exercises,conditioningEnabled:false,metcon:{name:'',format:'',activity:'',duration:''},
      sleep:'',energy:'',pain:'',rpe:'',bodyweight:'',note:''},
    status:'planned',
  }
}
