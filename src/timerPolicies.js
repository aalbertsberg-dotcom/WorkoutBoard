export const WORK_TIMER_MODES=['AMRAP','EMOM','Intervals','Metcon','Stopwatch']
export function keepTimerPanelVisible(mode){
  return WORK_TIMER_MODES.includes(mode)||mode==='Beats'
}
export function canSwitchTimerMode({running=false,beatsRunning=false,elapsed=0}={}){
  return !running&&!beatsRunning&&Number(elapsed)<=0
}
export function timerIsActive({running=false,beatsRunning=false,mode='Rest'}={}){
  return Boolean(running||(mode==='Beats'&&beatsRunning))
}
