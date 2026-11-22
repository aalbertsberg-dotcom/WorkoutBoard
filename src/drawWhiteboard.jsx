import {confirmWorkset,promptWorkset} from './worksetDialogs'
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import {hitTestBoardItem,moveBoardItem,boardItemBounds,readBoardDraft,saveBoardDraft,clearBoardDraft,preferredBoardContent} from './whiteboardModel'

const palette=['#111827','#dc2626','#2563eb','#16a34a','#9333ea','#ea580c']
const clamp=v=>Math.max(0,Math.min(1,v))
const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random())

async function fileToDataUrl(file){
  const raw=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file)})
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=raw})
  const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height))
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale))
  c.getContext('2d').drawImage(img,0,0,c.width,c.height)
  return c.toDataURL('image/jpeg',.82)
}

export function DrawWhiteboard({session}) {
  const canvasRef=useRef(null),wrapRef=useRef(null),drawingRef=useRef(false),currentRef=useRef(null),imageInputRef=useRef(null),imageCacheRef=useRef({})
  const draggingRef=useRef(null),dirtyRef=useRef(false),boardStateRef=useRef(null)
  const [boards,setBoards]=useState([])
  const [boardId,setBoardId]=useState(null)
  const [boardTitle,setBoardTitle]=useState('Main Board')
  const [items,setItems]=useState([])
  const [redo,setRedo]=useState([])
  const [undoHistory,setUndoHistory]=useState([])
  const [selectedId,setSelectedId]=useState(null)
  const [tool,setTool]=useState('pen')
  const [color,setColor]=useState('#111827')
  const [width,setWidth]=useState(4)
  const [grid,setGrid]=useState(true)
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const [zoom,setZoom]=useState(1)

  boardStateRef.current={items,boardTitle,grid,boardId}

  const saveDraftOnDevice=()=>{
    if(!loaded||!dirtyRef.current||!session?.user?.id)return
    const state=boardStateRef.current
    const ok=saveBoardDraft(window.localStorage,session.user.id,state.boardId,
      {items:state.items,title:state.boardTitle,grid:state.grid})
    if(!ok)setMessage('Could not save draft on this device. Use Save board to sync it now.')
  }
  useEffect(()=>{saveDraftOnDevice()},[items,boardTitle,grid,boardId,loaded,session?.user?.id])
  useEffect(()=>()=>{
    const state=boardStateRef.current,userId=session?.user?.id
    if(state&&dirtyRef.current&&userId)
      saveBoardDraft(window.localStorage,userId,state.boardId,{
        items:state.items,title:state.boardTitle,grid:state.grid
      })
  },[session?.user?.id])

  const rememberChange=()=>{
    setUndoHistory(history=>[...history.slice(-49),boardStateRef.current.items])
    setRedo([])
    dirtyRef.current=true
  }
  const restoreContent=(record,userId)=>{
    const raw=record?.drawing||{}
    const saved={title:record?.title||'Main Board',items:Array.isArray(raw.items)?raw.items:(raw.strokes||[]).map(x=>({...x,type:'stroke'})),
      grid:raw.grid!==false,updatedAt:Date.parse(record?.updated_at||'')||0}
    const draft=readBoardDraft(window.localStorage,userId,record?.id||null)
    const content=preferredBoardContent(saved,draft)
    dirtyRef.current=content.source==='draft'
    setBoardId(record?.id||null);setBoardTitle(content.title);setGrid(content.grid)
    setItems(content.items);setRedo([]);setUndoHistory([]);setSelectedId(null)
    setMessage(dirtyRef.current?'Recovered your unsaved draft on this device.':'')
  }

  const loadBoards=async(preferId=null)=>{
    if(!session?.user)return
    const userId=session.user.id
    const {data,error}=await supabase.from('whiteboard_drawings').select('*').eq('user_id',userId).order('updated_at',{ascending:false})
    if(error){
      // Never discard a saved-board draft because a network request failed.
      const last=window.localStorage.getItem('workset-board-current:'+userId)
      restoreContent(last&&last!=='unsaved'?{id:last,title:'Board',drawing:{items:[]}}:null,userId)
      setMessage(error.message+' — your local draft is kept.')
      setLoaded(true);return
    }
    const rows=data||[]
    setBoards(rows)
    const last=window.localStorage.getItem('workset-board-current:'+userId)
    const chosen=rows.find(x=>x.id===(preferId||last))||(last==='unsaved'?null:rows[0])
    restoreContent(chosen||null,userId)
    setLoaded(true)
  }

  useEffect(()=>{loadBoards()},[session?.user?.id])

  const selectBoard=id=>{
    if(!session?.user)return
    saveDraftOnDevice()
    const record=id?boards.find(x=>x.id===id):null
    if(id&&!record)return
    window.localStorage.setItem('workset-board-current:'+session.user.id,id||'unsaved')
    restoreContent(record,session.user.id)
  }

  const drawArrow=(ctx,x1,y1,x2,y2)=>{
    const angle=Math.atan2(y2-y1,x2-x1),head=12
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()
    ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle-Math.PI/6),y2-head*Math.sin(angle-Math.PI/6));ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle+Math.PI/6),y2-head*Math.sin(angle+Math.PI/6));ctx.stroke()
  }

  const drawAll=()=>{
    const canvas=canvasRef.current,wrap=wrapRef.current;if(!canvas||!wrap)return
    const rect=wrap.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1)
    const viewportWidth=Math.max(280,Math.floor(rect.width))
    const w=Math.max(240,Math.floor(viewportWidth*zoom))
    const h=Math.max(180,Math.floor(w*.72))
    canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px'
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h)
    if(grid){ctx.strokeStyle='#e5e7eb';ctx.lineWidth=1;for(let x=24;x<w;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=24;y<h;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}}
    for(const item of items){
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=item.width||4;ctx.strokeStyle=item.color||'#111827';ctx.fillStyle=item.color||'#111827'
      if(item.type==='image'){
        let img=imageCacheRef.current[item.src]
        if(!img){img=new Image();img.onload=drawAll;img.src=item.src;imageCacheRef.current[item.src]=img}
        if(img.complete)ctx.drawImage(img,(item.x||.05)*w,(item.y||.05)*h,(item.w||.5)*w,(item.h||.5)*h)
      }else if(item.type==='text'){
        ctx.font='700 22px system-ui';ctx.fillText(item.text||'',item.x*w,item.y*h)
      }else if(item.type==='sticky'){
        const x=item.x*w,y=item.y*h,bw=(item.w||.28)*w,bh=(item.h||.18)*h;ctx.fillStyle='#fef3c7';ctx.strokeStyle='#f59e0b';ctx.fillRect(x,y,bw,bh);ctx.strokeRect(x,y,bw,bh);ctx.fillStyle='#111827';ctx.font='700 16px system-ui'
        const words=String(item.text||'').split(' ');let line='',yy=y+24;for(const word of words){const test=line+word+' ';if(ctx.measureText(test).width>bw-20){ctx.fillText(line,x+10,yy);line=word+' ';yy+=20}else line=test}ctx.fillText(line,x+10,yy)
      }else if(item.type==='shape'){
        const x1=item.start.x*w,y1=item.start.y*h,x2=item.end.x*w,y2=item.end.y*h
        if(item.shape==='line'){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
        if(item.shape==='arrow')drawArrow(ctx,x1,y1,x2,y2)
        if(item.shape==='rect')ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1))
        if(item.shape==='circle'){ctx.beginPath();ctx.ellipse((x1+x2)/2,(y1+y2)/2,Math.abs(x2-x1)/2,Math.abs(y2-y1)/2,0,0,Math.PI*2);ctx.stroke()}
      }else{
        const pts=item.points||[];if(!pts.length){ctx.restore();continue}
        ctx.globalAlpha=item.tool==='highlighter'?.28:1;ctx.strokeStyle=item.tool==='eraser'?'#fff':(item.color||'#111827');ctx.lineWidth=item.width||4
        ctx.beginPath();pts.forEach((p,i)=>{const x=p.x*w,y=p.y*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});if(pts.length===1){const p=pts[0];ctx.lineTo(p.x*w+.01,p.y*h+.01)}ctx.stroke()
      }
      ctx.restore()
    }
    if(selectedId&&tool==='select'){
      const target=items.find(x=>x.id===selectedId)
      const b=boardItemBounds(target,w,h)
      if(b){
        ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#2563eb';ctx.setLineDash([6,4])
        ctx.strokeRect(b.x1*w-7,b.y1*h-7,Math.max(14,(b.x2-b.x1)*w+14),Math.max(14,(b.y2-b.y1)*h+14))
        ctx.restore()
      }
    }
  }

  useEffect(()=>{drawAll()},[items,grid,zoom,selectedId,tool])
  useEffect(()=>{const ro=new ResizeObserver(drawAll);if(wrapRef.current)ro.observe(wrapRef.current);return()=>ro.disconnect()},[items,grid,zoom,selectedId,tool])

  const point=e=>{
    const rect=canvasRef.current.getBoundingClientRect()
    return {x:clamp((e.clientX-rect.left)/rect.width),y:clamp((e.clientY-rect.top)/rect.height)}
  }

  const addPromptItem=async(kind,p)=>{
    const text=await promptWorkset(kind==='sticky'?'Sticky note text':'Text')
    if(!text)return
    const item=kind==='sticky'?{id:uid(),type:'sticky',text,x:p.x,y:p.y,w:.28,h:.18}:{id:uid(),type:'text',text,x:p.x,y:p.y,color}
    rememberChange();setItems(v=>[...v,item]);setSelectedId(item.id)
  }
  const start=e=>{
    if(!loaded||saving)return
    e.preventDefault();canvasRef.current.setPointerCapture?.(e.pointerId)
    const p=point(e)
    if(tool==='select'){
      const canvas=canvasRef.current
      const hit=hitTestBoardItem(items,p,canvas.clientWidth,canvas.clientHeight)
      setSelectedId(hit)
      draggingRef.current=hit?{id:hit,start:p,original:items.find(x=>x.id===hit),snapshot:items,moved:false,
        width:canvas.clientWidth,height:canvas.clientHeight}:null
      return
    }
    if(tool==='text'||tool==='sticky'){void addPromptItem(tool,p);return}
    rememberChange();drawingRef.current=true;setSelectedId(null)
    const item=['line','arrow','rect','circle'].includes(tool)
      ? {id:uid(),type:'shape',shape:tool,color,width,start:p,end:p}
      : {id:uid(),type:'stroke',tool,color,width:tool==='eraser'?Math.max(18,width*4):tool==='highlighter'?Math.max(16,width*3):width,points:[p]}
    currentRef.current=item;setItems(v=>[...v,item])
  }
  const move=e=>{
    const drag=draggingRef.current
    if(drag){
      e.preventDefault()
      const p=point(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y
      if(!drag.moved&&Math.abs(dx)*drag.width+Math.abs(dy)*drag.height<3)return
      if(!drag.moved){
        drag.moved=true;setUndoHistory(history=>[...history.slice(-49),drag.snapshot]);setRedo([])
        dirtyRef.current=true
      }
      setItems(v=>v.map(item=>item.id===drag.id?moveBoardItem(drag.original,dx,dy,drag.width,drag.height):item))
      return
    }
    if(!drawingRef.current||!currentRef.current)return
    e.preventDefault()
    const p=point(e),id=currentRef.current.id
    setItems(v=>v.map(x=>x.id===id?(x.type==='shape'?{...x,end:p}:{...x,points:[...(x.points||[]),p]}):x))
  }
  const end=e=>{
    if(draggingRef.current){
      if(draggingRef.current.moved)setMessage('Moved. Draft kept on this device.')
      draggingRef.current=null
    }
    if(!drawingRef.current)return
    e.preventDefault();drawingRef.current=false;currentRef.current=null
  }
  const undo=()=>{
    if(!undoHistory.length)return
    const before=undoHistory[undoHistory.length-1]
    setUndoHistory(v=>v.slice(0,-1));setRedo(v=>[...v.slice(-49),items])
    setItems(before);dirtyRef.current=true;setSelectedId(null)
  }
  const redoOne=()=>{
    if(!redo.length)return
    const after=redo[redo.length-1]
    setRedo(v=>v.slice(0,-1));setUndoHistory(v=>[...v.slice(-49),items])
    setItems(after);dirtyRef.current=true;setSelectedId(null)
  }
  const removeSelected=()=>{
    if(!selectedId)return
    rememberChange();setItems(v=>v.filter(item=>item.id!==selectedId));setSelectedId(null)
  }
  const clear=async()=>{
    if(items.length&&await confirmWorkset('Clear this board?')){
      rememberChange();setItems([]);setSelectedId(null)
    }
  }

  const save=async()=>{
    if(!session?.user||saving)return
    const userId=session.user.id
    saveDraftOnDevice();setSaving(true)
    const previousId=boardId
    const payload={version:2,items,grid}
    let error=null,record=null
    if(previousId){
      const res=await supabase.from('whiteboard_drawings')
        .update({title:boardTitle,drawing:payload,updated_at:new Date().toISOString()})
        .eq('id',previousId).eq('user_id',userId).select('*').single()
      error=res.error;record=res.data
    }else{
      const res=await supabase.from('whiteboard_drawings')
        .insert({user_id:userId,title:boardTitle,drawing:payload,updated_at:new Date().toISOString()})
        .select('*').single()
      error=res.error;record=res.data
    }
    setSaving(false)
    if(error||!record){setMessage(error?.message||'Save failed. Your draft is still stored on this device.');return}
    dirtyRef.current=false
    clearBoardDraft(window.localStorage,userId,previousId)
    window.localStorage.setItem('workset-board-current:'+userId,record.id)
    setBoardId(record.id);setBoards(v=>[record,...v.filter(b=>b.id!==record.id)])
    setMessage('Saved across devices.')
  }

  const newBoard=async()=>{
    saveDraftOnDevice()
    const name=await promptWorkset('New board name','Board '+(boards.length+1))
    if(!name||!session?.user)return
    const {data,error}=await supabase.from('whiteboard_drawings').insert({
      user_id:session.user.id,title:name.trim(),
      drawing:{version:2,items:[],grid:true}
    }).select().single()
    if(error||!data){setMessage(error?.message||'Could not add board');return}
    window.localStorage.setItem('workset-board-current:'+session.user.id,data.id)
    await loadBoards(data.id)
  }
  const deleteBoard=async()=>{
    if(!boardId||!session?.user||!await confirmWorkset('Delete this whiteboard?'))return
    const id=boardId,userId=session.user.id
    const {error}=await supabase.from('whiteboard_drawings').delete().eq('id',id).eq('user_id',userId)
    if(error){setMessage(error.message);return}
    dirtyRef.current=false;clearBoardDraft(window.localStorage,userId,id)
    window.localStorage.removeItem('workset-board-current:'+userId)
    await loadBoards()
  }

  const addImage=async e=>{
    const file=e.target.files?.[0];if(!file)return
    try{
      const src=await fileToDataUrl(file)
      rememberChange();setItems(v=>[...v,{id:uid(),type:'image',src,x:.08,y:.08,w:.55,h:.55}])
    }catch{setMessage('Could not load that image.')}
    e.target.value=''
  }

  const exportPng=()=>{const c=canvasRef.current;if(!c)return;const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`Workset-${boardTitle.replace(/[^a-z0-9]+/gi,'-')}.png`;document.body.appendChild(a);a.click();a.remove()}

  return <section className="draw-board-section">
    <div className="draw-board-manager">
      <select value={boardId||''} onChange={e=>selectBoard(e.target.value)}><option value="">Unsaved board</option>{boards.map(b=><option value={b.id} key={b.id}>{b.title}</option>)}</select>
      <input value={boardTitle} onChange={e=>{dirtyRef.current=true;setBoardTitle(e.target.value)}} placeholder="Board name"/>
      <button onClick={newBoard}>+ Board</button><button onClick={deleteBoard} disabled={!boardId}>Delete</button>
    </div>
    <div className="draw-board-toolbar">
      <div className="draw-tools">{['select','pen','highlighter','eraser','line','arrow','rect','circle','text','sticky'].map(t=><button type="button" key={t} className={tool===t?'active':''} onClick={()=>{setTool(t);if(t!=='select')setSelectedId(null)}}>{t==='select'?'Move':t[0].toUpperCase()+t.slice(1)}</button>)}</div>
      <div className="draw-colors">{palette.map(c=><button key={c} className={color===c?'active':''} style={{background:c}} onClick={()=>setColor(c)} aria-label={'Use '+c}/>)}</div>
      <label className="draw-width">Size<input type="range" min="2" max="14" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label>
      <label className="draw-grid-toggle"><input type="checkbox" checked={grid} onChange={e=>{dirtyRef.current=true;setGrid(e.target.checked)}}/> Grid</label>
      <button onClick={()=>imageInputRef.current?.click()}>Image</button><input ref={imageInputRef} type="file" accept="image/*" hidden onChange={addImage}/>
      <div className="draw-actions"><button type="button" onClick={undo} disabled={!undoHistory.length}>Undo</button><button type="button" onClick={redoOne} disabled={!redo.length}>Redo</button><button type="button" onClick={removeSelected} disabled={!selectedId}>Delete selected</button><button type="button" onClick={clear} disabled={!items.length}>Clear</button></div>
    </div>
    <div className="draw-board-wrap">
      <div className="draw-board-zoom" aria-label="Whiteboard zoom controls">
        <button type="button" onClick={()=>setZoom(v=>Math.max(.6,Math.round((v-.1)*10)/10))} disabled={zoom<=.6}>−</button>
        <button type="button" className="zoom-readout" onClick={()=>setZoom(1)} title="Reset zoom">{Math.round(zoom*100)}%</button>
        <button type="button" onClick={()=>setZoom(v=>Math.min(2.2,Math.round((v+.1)*10)/10))} disabled={zoom>=2.2}>+</button>
      </div>
      <div className="draw-board-pan" ref={wrapRef}>
        <canvas ref={canvasRef} data-tool={tool} aria-label="Whiteboard canvas: choose Move to select and drag an object"
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={e=>{if(!e.currentTarget.hasPointerCapture?.(e.pointerId))end(e)}}/>
      </div>
    </div>
    <div className="draw-board-bottom"><span role="status">{message||(dirtyRef.current?'Draft kept on this device. Tap Save board to sync across devices.':'Choose Move to grab shapes, strokes, text or images. Changes are kept as a draft until saved.')}</span><div><button className="secondary-action" onClick={exportPng}>Export PNG</button><button className="primary-action" onClick={save} disabled={saving}>{saving?'Saving…':'Save board'}</button></div></div>
  </section>
}
