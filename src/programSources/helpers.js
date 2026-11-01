export const ex=(name,prescription,note='')=>({name,prescription,note})
export const day=(title,exercises,note='')=>({title,exercises,note})

const clean = value => String(value||'')
  .replace(/^[•\-–—\s]+/,'')
  .replace(/\s+/g,' ')
  .trim()

function lineName(line,index){
  const v=clean(line)
  const stripped=v
    .replace(/^\d+\)\s*/,'')
    .replace(/^\d+\s*[x×X]\s*\d+\s*/,'')
    .replace(/^\d+\s+(?:sets?|rounds?|reps?)\s+(?:of\s*)?/i,'')
  if(stripped && stripped.length<=72) return stripped
  const before=stripped.split(/\s[-–—:]\s/)[0]
  if(before&&before.length<=72) return before
  return 'Source step '+(index+1)
}

export function sourceDay(title,lines,note=''){
  const cleaned=(lines||[]).map(clean).filter(Boolean)
  return day(title,cleaned.map((line,i)=>ex(lineName(line,i),line)),note)
}

export function sourceProgram(meta,data){
  const weeks=Object.keys(data||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b)
  return {
    ...meta,
    transcriptionStatus:'full',
    weeksCount:meta.weeksCount || Math.max(1,...weeks),
    daysPerWeek:meta.daysPerWeek || Math.max(1,...weeks.map(w=>(data[String(w)]||[]).length)),
    getWeek:week=>{
      const key=String(Math.max(1,Math.min(meta.weeksCount||Math.max(...weeks),Number(week)||1)))
      return (data[key]||[]).map(d=>sourceDay(d.title,d.lines,d.note||''))
    },
  }
}

export function repeatProgram(meta,days,weeks=1){
  return {...meta,transcriptionStatus:'full',weeksCount:weeks,daysPerWeek:days.length,getWeek:()=>days}
}
