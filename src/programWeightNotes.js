import {partnerSetTarget} from './programSetTargets.js'

// Describe the actual formula. A prescribed TM increase is already included.
// Manual +5/+10 adjustments are separate, one-set-only actions.
const pounds=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2})
export function explainProgramSetWeight(maxes,set,{programId='',week=null}={}){
  if(!set?.weight_lift||set.pct==null||!['tm','e1rm'].includes(set.weight_basis))return null
  const oneRm=Number(maxes?.[set.weight_lift]||0)
  const pct=Number(set.pct)
  const basis=set.weight_basis
  const offset=basis==='tm'?Number(set.tm_offset||0):0
  const reTest=programId==='531-original-challenge'&&Number(week)>=7
  const offsetLabel=offset>0?('+'+pounds(offset)+' lb already added to training max'):
    offset<0?(pounds(offset)+' lb adjustment already applied'):'No automatic cycle increase this week'
  const source=reTest?'Week 6 estimated 1RM':'saved 1RM'
  const basisLabel=basis==='tm'?'85% training max (TM)':'100% of 1RM'
  const target=partnerSetTarget(maxes,set)
  const formula=oneRm>0&&Number.isFinite(pct)
    ? basis==='tm'
      ? '('+pounds(oneRm)+' lb '+source+' × 85%'+(offset>0?' + '+pounds(offset)+' lb':offset<0?' − '+pounds(-offset)+' lb':'')+') × '+pounds(pct)+'% = '+target
      : pounds(oneRm)+' lb '+source+' × '+pounds(pct)+'% = '+target
    : ''
  return {basisLabel,offsetLabel,formula,target,offset,source,percent:pct,
    isProgramIncrease:offset!==0}
}

export function adjustedManualSetWeight(current,increment){
  const base=Number(current)
  const change=Number(increment)
  if(!Number.isFinite(base)||base<=0||![5,10].includes(change))return null
  const value=base+change
  return Number.isFinite(value)&&value<=2000?String(Number(value.toFixed(2))):null
}

export function programWeightNotes(preview){
  if(preview?.id==='531-original-challenge')return {
    heading:'531 Original Challenge · weight calculations',
    summary:'Training max = 85% of 1RM. Programmed +5/+10 lb increases are applied automatically.',
    detail:'Weeks 4–6 and 10–12: +5 lb to Bench/Press TM and +10 lb to Squat/Deadlift TM. Week 6 test results update the program-specific estimated 1RM used for Weeks 7–12. Each set uses its own prescribed percentage and is rounded to the nearest 5 lb. No need to tap an increase button for these required adjustments.'
  }
  if(preview?.kind==='classic'&&preview?.weightBasis==='tm')return {
    heading:'How this program calculates weights',
    summary:'Set percentages use 85% of the saved 1RM (training max).',
    detail:'Only adjustments explicitly prescribed by this program are automatic. Optional +5/+10 buttons in the workout change only the selected set.'
  }
  if(preview?.kind==='classic'&&preview?.weightBasis==='e1rm')return {
    heading:'How this program calculates weights',
    summary:'Set percentages use the saved 1RM, not an 85% training max.',
    detail:'Only adjustments explicitly prescribed by this program are automatic. Optional +5/+10 buttons in the workout change only the selected set.'
  }
  return null
}
