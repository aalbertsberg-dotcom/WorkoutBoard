// App navigation has two levels: root destinations and drill-in screens.
// Root switches and sibling tabs do not accumulate browser Back entries.
const ROOT_TABS=new Set(['today','together','program','whiteboard','me'])

export function navigationTransition({
  fromTab='today',toTab='today',
  currentSection='Overview',targetSection='Overview',
  depth=0,replace=false,
}={}){
  const safeDepth=Math.max(0,Number(depth)||0)
  if(fromTab===toTab){
    if(fromTab==='progress' && currentSection!==targetSection)
      return {action:'replace',depth:safeDepth}
    return {action:'none',depth:safeDepth}
  }
  if(replace || ROOT_TABS.has(toTab))
    return {action:'replace',depth:0}
  return {action:'push',depth:safeDepth+1}
}
