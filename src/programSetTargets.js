// Pure helpers for per-user strength targets. No workout is changed or completed
// when the 1RM is updated; existing edited and completed sets remain authoritative.
export function partnerSetTarget(maxes,set) {
  const lift=set?.weight_lift
  const pct=set?.pct
  const oneRm=Number(maxes?.[lift]||0)
  if(!lift||pct==null||!(oneRm>0))return ''
  const base=set.weight_basis==='tm'?oneRm*.85+Number(set.tm_offset||0):oneRm
  const low=Math.round((base*Number(pct)/100)/5)*5
  if(set.pct_high!=null){
    const high=Math.round((base*Number(set.pct_high)/100)/5)*5
    if(high&&high!==low)return low+'-'+high+' lb'
  }
  return low?low+' lb':''
}

export function missingWorkoutOneRms(workout,oneRepMaxes={}) {
  const required=Array.from(new Set((workout?.exercises||[])
    .flatMap(item=>(item.setProgress||[])
      .filter(set=>set?.weight_lift&&set?.pct!=null&&set?.weight_basis)
      .map(set=>set.weight_lift))))
  return required.filter(lift=>!(Number(oneRepMaxes?.[lift])>0))
}
