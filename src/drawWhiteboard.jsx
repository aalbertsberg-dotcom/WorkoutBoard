import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const palette=['#111827','#dc2626','#2563eb','#16a34a','#9333ea','#ea580c']
const clamp=v=>Math.max(0,Math.min(1,v))

export function DrawWhiteboard({session}) {
  const canvasRef=useRef(null)
  const wrapRef=useRef(null)
  const drawingRef=useRef(false)
  const currentRef=useRef(null)
  const [strokes,setStrokes]=useState([])
  const [redo,setRedo]=useState([])
  const [tool,setTool]=useState('pen')
  const [color,setColor]=useState('#111827')
  const [width,setWidth]=useState(4)
  const [grid,setGrid]=useState(true)
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [loaded,setLoaded]=useState(false)

  const drawAll=()=>{
    const canvas=canvasRef.current
    const wrap=wrapRef.current
    if(!canvas||!wrap)return
    const rect=wrap.getBoundingClientRect()
    const dpr=Math.max(1,window.devicePixelRatio||1)
    const w=Math.max(320,Math.floor(rect.width))
    const h=Math.max(420,Math.floor(Math.min(720,Math.max(460,w*.72))))
    canvas.width=Math.floor(w*dpr)
    canvas.height=Math.floor(h*dpr)
    canvas.style.width=w+'px'
    canvas.style.height=h+'px'
    const ctx=canvas.getContext('2d')
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.clearRect(0,0,w,h)
    ctx.fillStyle='#ffffff'
    ctx.fillRect(0,0,w,h)

    if(grid){
      ctx.strokeStyle='#e5e7eb'
      ctx.lineWidth=1
      for(let x=24;x<w;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
      for(let y=24;y<h;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    }

    for(const stroke of strokes){
      const pts=stroke.points||[]
      if(!pts.length)continue
      ctx.save()
      ctx.lineCap='round'
      ctx.lineJoin='round'
      ctx.lineWidth=stroke.width||4
      ctx.globalAlpha=stroke.tool==='highlighter'?.28:1
      ctx.globalCompositeOperation=stroke.tool==='eraser'?'destination-out':'source-over'
      if(stroke.tool==='eraser'){
        ctx.globalCompositeOperation='source-over'
        ctx.strokeStyle='#ffffff'
      }else{
        ctx.strokeStyle=stroke.color||'#111827'
      }
      ctx.beginPath()
      pts.forEach((p,i)=>{
        const x=p.x*w,y=p.y*h
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
      })
      if(pts.length===1){const p=pts[0];ctx.lineTo(p.x*w+.01,p.y*h+.01)}
      ctx.stroke()
      ctx.restore()
    }
  }

  useEffect(()=>{drawAll()},[strokes,grid])
  useEffect(()=>{
    const ro=new ResizeObserver(()=>drawAll())
    if(wrapRef.current)ro.observe(wrapRef.current)
    return()=>ro.disconnect()
  },[strokes,grid])

  useEffect(()=>{
    if(!session?.user)return
    let cancelled=false
    supabase.from('whiteboard_drawings').select('*').eq('user_id',session.user.id).maybeSingle()
      .then(({data,error})=>{
        if(cancelled)return
        if(error){setMessage(error.message);setLoaded(true);return}
        const d=data?.drawing||{}
        setStrokes(Array.isArray(d.strokes)?d.strokes:[])
        setGrid(d.grid!==false)
        setLoaded(true)
      })
    return()=>{cancelled=true}
  },[session?.user?.id])

  const pointFromEvent=e=>{
    const rect=canvasRef.current.getBoundingClientRect()
    return {x:clamp((e.clientX-rect.left)/rect.width),y:clamp((e.clientY-rect.top)/rect.height)}
  }

  const start=e=>{
    if(!loaded)return
    e.preventDefault()
    canvasRef.current.setPointerCapture?.(e.pointerId)
    drawingRef.current=true
    const stroke={
      id:crypto.randomUUID?.()||String(Date.now()),
      tool,
      color,
      width:tool==='eraser'?Math.max(18,width*4):tool==='highlighter'?Math.max(16,width*3):width,
      points:[pointFromEvent(e)]
    }
    currentRef.current=stroke
    setRedo([])
    setStrokes(v=>[...v,stroke])
  }

  const move=e=>{
    if(!drawingRef.current||!currentRef.current)return
    e.preventDefault()
    const p=pointFromEvent(e)
    const id=currentRef.current.id
    setStrokes(v=>v.map(s=>s.id===id?{...s,points:[...s.points,p]}:s))
  }

  const end=e=>{
    if(!drawingRef.current)return
    e.preventDefault()
    drawingRef.current=false
    currentRef.current=null
  }

  const undo=()=>{
    setStrokes(v=>{
      if(!v.length)return v
      const last=v[v.length-1]
      setRedo(r=>[last,...r])
      return v.slice(0,-1)
    })
  }

  const redoOne=()=>{
    setRedo(v=>{
      if(!v.length)return v
      const [first,...rest]=v
      setStrokes(s=>[...s,first])
      return rest
    })
  }

  const clear=()=>{
    if(!strokes.length||!window.confirm('Clear the entire drawing?'))return
    setRedo(strokes)
    setStrokes([])
  }

  const save=async()=>{
    if(!session?.user)return
    setSaving(true)
    const payload={version:1,strokes,grid}
    const {error}=await supabase.from('whiteboard_drawings').upsert({
      user_id:session.user.id,
      title:'Main Board',
      drawing:payload,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'})
    setSaving(false)
    setMessage(error?error.message:'Board saved.')
  }

  const exportPng=()=>{
    const canvas=canvasRef.current
    if(!canvas)return
    const a=document.createElement('a')
    a.href=canvas.toDataURL('image/png')
    a.download=`WorkoutBoard-whiteboard-${new Date().toISOString().slice(0,10)}.png`
    document.body.appendChild(a);a.click();a.remove()
  }

  return <section className="draw-board-section">
    <div className="draw-board-toolbar">
      <div className="draw-tools">
        <button className={tool==='pen'?'active':''} onClick={()=>setTool('pen')}>Pen</button>
        <button className={tool==='highlighter'?'active':''} onClick={()=>setTool('highlighter')}>Highlighter</button>
        <button className={tool==='eraser'?'active':''} onClick={()=>setTool('eraser')}>Eraser</button>
      </div>
      <div className="draw-colors">
        {palette.map(c=><button key={c} className={color===c?'active':''} style={{background:c}} onClick={()=>{setColor(c);setTool('pen')}} aria-label={'Use '+c}/>)}
      </div>
      <label className="draw-width">Size
        <input type="range" min="2" max="14" value={width} onChange={e=>setWidth(Number(e.target.value))}/>
      </label>
      <label className="draw-grid-toggle"><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Grid</label>
      <div className="draw-actions">
        <button onClick={undo} disabled={!strokes.length}>Undo</button>
        <button onClick={redoOne} disabled={!redo.length}>Redo</button>
        <button onClick={clear} disabled={!strokes.length}>Clear</button>
      </div>
    </div>

    <div className="draw-board-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
    </div>

    <div className="draw-board-bottom">
      <span>{message||'Draw with mouse, pen, or finger. Save when you want it synced across devices.'}</span>
      <div>
        <button className="secondary-action" onClick={exportPng}>Export PNG</button>
        <button className="primary-action" onClick={save} disabled={saving}>{saving?'Saving…':'Save board'}</button>
      </div>
    </div>
  </section>
}
