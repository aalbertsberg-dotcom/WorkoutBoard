// A saved name is never overwritten. Only conservative spelling variants
// merge automatically. Different machine movements require user confirmation.
export function exerciseHistoryKey(name){
  return String(name||'').normalize('NFKC').toLowerCase()
    .replace(/[‐‑‒–—-]/g,' ')
    .replace(/[^a-z0-9 ]+/g,' ')
    .replace(/\braises\b/g,'raise')
    .replace(/\bcurls\b/g,'curl')
    .replace(/\bextensions\b/g,'extension')
    .replace(/\s+/g,' ').trim()
}

export function resolveExerciseHistoryKey(name,links={}){
  let current=exerciseHistoryKey(name)
  const seen=new Set()
  for(let i=0;i<12;i++){
    if(seen.has(current))break
    seen.add(current)
    const next=exerciseHistoryKey(links[current])
    if(!next||next===current||seen.has(next))break
    current=next
  }
  return current
}

export function exerciseAliasLookup(rows=[]){
  return Object.fromEntries((rows||[]).map(row=>[
    exerciseHistoryKey(row.alias_key||row.alias_name),
    row.canonical_name
  ]).filter(([key,value])=>key&&value))
}

// Suggest candidates without ever merging them automatically. A brand or
// shared word like "iso" is not proof that the machines are equivalent.
export function rankExerciseHistoryCandidates(name,choices=[]){
  const tokens=new Set(exerciseHistoryKey(name).split(' ').filter(Boolean))
  const score=candidate=>{
    const words=new Set(exerciseHistoryKey(candidate).split(' ').filter(Boolean))
    let overlap=0
    for(const word of words)if(tokens.has(word))overlap++
    return overlap/(new Set([...tokens,...words]).size||1)
  }
  return [...choices].sort((a,b)=>score(b)-score(a)||a.localeCompare(b))
}

export function exerciseHistoryNames(sessions=[]){
  const seen=new Set(), result=[]
  for(const row of sessions||[]){
    for(const item of row?.workout?.exercises||[]){
      const name=String(item.name||'').trim()
      if(!name||seen.has(exerciseHistoryKey(name)))continue
      const hasWork=(item.setProgress||[]).some(set=>set.done)||Boolean(item.result)
      if(!hasWork)continue
      seen.add(exerciseHistoryKey(name))
      result.push(name)
    }
  }
  return result
}

export function aggregateExerciseHistory(sessions=[],aliases={},getWeight,getReps,isDistance){
  const map={}
  // Caller gives most recent completed sessions first; first hit is last time.
  for(const row of sessions||[]){
    for(const item of row?.workout?.exercises||[]){
      const key=resolveExerciseHistoryKey(item.name,aliases)
      if(!key)continue
      const completed=(item.setProgress||[]).filter(set=>set.done&&!set.skipped)
      const weights=completed.map(set=>({
        weight:Number(getWeight(item,set))||0,
        reps:Number(getReps(item,set))||0,
        drop:Boolean(set.drop_set)
      }))
      const best=weights.filter(set=>set.weight>0&&set.reps>0&&!set.drop)
        .reduce((best,set)=>!best||set.weight>best.weight?set:best,null)
      const last=completed.length
        ?completed.map((set,i)=>{
          const weight=Number(getWeight(item,set))||0
          return (set.drop_set?'Drop '+(set.drop_stage||i+1):'S'+(i+1))+
            (weight?' '+weight+' lb':'')+
            (set.drop_set?' × '+(Number(getReps(item,set))||0):'')
        }).join(' · ')
        :String(item.result||'').trim()
      if(!last&&!best)continue
      const estimate=best&&!isDistance(item.name)?best.weight*(1+best.reps/30):0
      if(!map[key])map[key]={
        last,sourceName:String(item.name||''),lastWeights:weights.filter(set=>!set.drop).map(set=>set.weight),
        bestE:estimate||0,bestWeight:best?.weight||0
      }
      else if(best){
        map[key].bestE=Math.max(map[key].bestE||0,estimate||0)
        map[key].bestWeight=Math.max(map[key].bestWeight||0,best.weight)
      }
    }
  }
  return map
}
