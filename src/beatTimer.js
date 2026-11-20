// Shared metronome settings and tempo calculations (no browser APIs).
export const MIN_BEAT_BPM=40
export const MAX_BEAT_BPM=220

export function clampBeatBpm(value,fallback=120){
  if(value==null||String(value).trim()==='')return clampBeatBpm(fallback,120)
  const n=Number(value)
  if(!Number.isFinite(n))return clampBeatBpm(fallback,120)
  return Math.max(MIN_BEAT_BPM,Math.min(MAX_BEAT_BPM,Math.round(n)))
}
export function beatIntervalMs(bpm){
  return 60000/clampBeatBpm(bpm)
}
export function beatIsAccent(beatNumber,beatsPerBar=4){
  return Number.isInteger(beatNumber)&&beatNumber>0&&(beatNumber-1)%Math.max(1,Math.floor(beatsPerBar))===0
}
export function tappedBpm(timestamps){
  const times=(timestamps||[]).filter(n=>Number.isFinite(Number(n))).map(Number)
  if(times.length<2)return null
  const deltas=times.slice(1).map((time,i)=>time-times[i])
  if(deltas.some(ms=>ms<270||ms>1500))return null
  return clampBeatBpm(60000/(deltas.reduce((sum,n)=>sum+n,0)/deltas.length))
}
