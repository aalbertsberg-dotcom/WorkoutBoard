// Geometry is normalized to the current whiteboard canvas (0..1).
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n))
const pointDistance=(a,b,w,h)=>Math.hypot((a.x-b.x)*w,(a.y-b.y)*h)
const segmentDistance=(p,a,b,w,h)=>{
  const ax=a.x*w,ay=a.y*h,bx=b.x*w,by=b.y*h,px=p.x*w,py=p.y*h
  const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy
  const t=length?clamp(((px-ax)*dx+(py-ay)*dy)/length):0
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))
}
export function boardItemBounds(item,w=600,h=430){
  if(!item)return null
  if(item.type==='shape'){
    const a=item.start||{x:0,y:0},b=item.end||a
    return {x1:Math.min(a.x,b.x),y1:Math.min(a.y,b.y),x2:Math.max(a.x,b.x),y2:Math.max(a.y,b.y)}
  }
  if(item.type==='image'||item.type==='sticky'){
    const x=item.x||0,y=item.y||0
    return {x1:x,y1:y,x2:x+(item.w||.3),y2:y+(item.h||.18)}
  }
  if(item.type==='text'){
    const x=item.x||0,y=item.y||0
    const len=String(item.text||'').length
    return {x1:x,y1:y-28/h,x2:x+Math.max(25,Math.min(w,15*len))/w,y2:y+5/h}
  }
  const pts=item.points||[]
  if(!pts.length)return null
  return {x1:Math.min(...pts.map(p=>p.x)),y1:Math.min(...pts.map(p=>p.y)),
    x2:Math.max(...pts.map(p=>p.x)),y2:Math.max(...pts.map(p=>p.y))}
}
export function hitTestBoardItem(items,p,width=600,height=430){
  const w=Math.max(1,width),h=Math.max(1,height)
  for(let i=(items||[]).length-1;i>=0;i--){
    const item=items[i],b=boardItemBounds(item,w,h)
    if(!b)continue
    const margin=14
    if(p.x*w<b.x1*w-margin||p.x*w>b.x2*w+margin||p.y*h<b.y1*h-margin||p.y*h>b.y2*h+margin)continue
    if(item.type==='text'||item.type==='image'||item.type==='sticky')return item.id
    if(item.type==='shape'){
      if(item.shape==='rect'||item.shape==='circle')return item.id
      if(segmentDistance(p,item.start,item.end,w,h)<=Math.max(14,(item.width||4)+8))return item.id
      continue
    }
    const pts=item.points||[]
    if(pts.length===1 && pointDistance(p,pts[0],w,h)<=14)return item.id
    for(let j=1;j<pts.length;j++){
      if(segmentDistance(p,pts[j-1],pts[j],w,h)<=Math.max(14,(item.width||4)/2+7))return item.id
    }
  }
  return null
}
export function moveBoardItem(item,dx,dy,width=600,height=430){
  if(!item)return item
  const b=boardItemBounds(item,width,height)
  const x=Number(dx)||0,y=Number(dy)||0
  const safeX=b?clamp(x,-b.x1,1-b.x2):x
  const safeY=b?clamp(y,-b.y1,1-b.y2):y
  const add=p=>({x:(p?.x||0)+safeX,y:(p?.y||0)+safeY})
  if(item.type==='shape')return {...item,start:add(item.start),end:add(item.end)}
  if(item.type==='stroke')return {...item,points:(item.points||[]).map(add)}
  return {...item,x:(item.x||0)+safeX,y:(item.y||0)+safeY}
}

export function boardDraftKey(userId,boardId){
  return 'workset-board-draft-v1:'+String(userId||'')+':'+String(boardId||'unsaved')
}
export function readBoardDraft(store,userId,boardId){
  try{
    const value=JSON.parse(store?.getItem(boardDraftKey(userId,boardId))||'null')
    return value?.version===1&&Array.isArray(value.items)?value:null
  }catch{return null}
}
export function saveBoardDraft(store,userId,boardId,details,updatedAt=Date.now()){
  if(!userId)return false
  try{
    store?.setItem(boardDraftKey(userId,boardId),JSON.stringify({
      version:1,updatedAt,items:details.items||[],
      grid:details.grid!==false,title:String(details.title||'Main Board')
    }))
    return true
  }catch{return false}
}
export function clearBoardDraft(store,userId,boardId){
  try{store?.removeItem(boardDraftKey(userId,boardId))}catch{}
}
export function preferredBoardContent(saved,draft){
  if(!draft)return {source:'server',items:saved.items||[],grid:saved.grid!==false,title:saved.title||'Main Board'}
  if(saved.updatedAt && Number(draft.updatedAt)<Number(saved.updatedAt))
    return {source:'server',items:saved.items||[],grid:saved.grid!==false,title:saved.title||'Main Board'}
  return {source:'draft',items:draft.items,grid:draft.grid!==false,title:draft.title}
}
