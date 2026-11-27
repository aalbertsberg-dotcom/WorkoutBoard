// Classic 5/3/1 programs retain their original week schemes. A new
// 3-week training cycle advances TM by 5 lb upper / 10 lb lower.
// Week 7 deload uses the completed second leader-cycle TM.
// This never changes the user's independently saved 1RM.
const PROGRAMS=new Set([
  'andy-531-original-6','new-531-leader-anchor-11',
  'andy-bbb-jokers-11','andy-hybrid-12'
])
export const classic531ProgramIds=[...PROGRAMS]

export function classic531CycleIndex(programId,week){
  const w=Number(week)
  if(!PROGRAMS.has(programId)||!Number.isInteger(w)||w<1)return 0
  if(programId==='andy-531-original-6')return w>=4&&w<=6?1:0
  if(w>=8&&w<=(programId==='andy-hybrid-12'?12:11))return 2
  if(w>=4&&w<=7)return 1
  return 0
}

export function classic531TrainingMaxOffset(programId,week,lift){
  const cycle=classic531CycleIndex(programId,week)
  if(['Squat','Deadlift'].includes(lift))return 10*cycle
  if(['Bench','Press'].includes(lift))return 5*cycle
  return 0
}
