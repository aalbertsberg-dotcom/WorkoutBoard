// Native Android Back decisions; keeps the web/PWA history behavior separate.
export function androidBackAction({activeWorkout=false,historyDetail=false,completion=false,
  deleteDialog=false,preview=false,overlay=false,depth=0,tab='today'}={}) {
  if(deleteDialog)return 'close-delete-dialog'
  if(activeWorkout)return 'confirm-workout-exit'
  if(historyDetail)return 'close-history-detail'
  if(completion)return 'close-completion'
  if(overlay)return 'close-overlay'
  if(preview)return 'close-preview'
  if(Number(depth)>0)return 'history-back'
  if(tab!=='today')return 'go-today'
  return 'minimize-app'
}
