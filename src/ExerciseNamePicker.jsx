import {useEffect,useId,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {findExerciseNameSuggestions} from './exerciseIdentity.js'

// Screen/keyboard-aware placement, also used in browser regressions.
export function suggestionPosition(rect,viewport,results=5){
  const top=Number(viewport?.top)||0
  const bottom=top+(Number(viewport?.height)||window.innerHeight)
  const width=Math.min(Math.max(180,rect.width),Math.max(180,window.innerWidth-24))
  const left=Math.min(Math.max(12,rect.left),Math.max(12,window.innerWidth-width-12))
  const desired=Math.min(268,37+Math.min(5,results)*44)
  const spaceBelow=Math.max(0,bottom-rect.bottom-10)
  const spaceAbove=Math.max(0,rect.top-top-10)
  const above=(spaceBelow<Math.min(160,desired)&&spaceAbove>spaceBelow)
  const room=above?spaceAbove:spaceBelow
  const maxHeight=Math.max(36,Math.min(desired,room))
  const listTop=above?rect.top-maxHeight-6:rect.bottom+6
  return {position:'fixed',zIndex:3600,left,top:Math.max(top+5,listTop),width,
    maxHeight:Math.min(maxHeight,Math.max(36,bottom-top-10)),overflowY:'auto'}
}

// Bounded suggestions. Always allow new free-text names.
export default function ExerciseNamePicker({
  value='',onChange,onSelect,choices=[],placeholder='Type an exercise name',
  label='Exercise name',id='',autoFocus=false,disabled=false,maxResults=5
}){
  const [open,setOpen]=useState(false)
  const [placement,setPlacement]=useState(null)
  const root=useRef(null)
  const popover=useRef(null)
  const listId=useId()
  const matches=findExerciseNameSuggestions(value,choices,maxResults)
  const visible=open&&matches.length>0

  useEffect(()=>{
    if(!open)return
    const close=event=>{
      if(!root.current?.contains(event.target)&&!popover.current?.contains(event.target))
        setOpen(false)
    }
    document.addEventListener('pointerdown',close)
    return()=>document.removeEventListener('pointerdown',close)
  },[open])

  useEffect(()=>{
    if(!visible)return
    let frame=0
    const update=()=>{
      cancelAnimationFrame(frame)
      frame=requestAnimationFrame(()=>{
        const rect=root.current?.querySelector('input')?.getBoundingClientRect()
        if(!rect)return
        const vv=window.visualViewport
        setPlacement(suggestionPosition(rect,{
          top:vv?.offsetTop||0,height:vv?.height||window.innerHeight
        },matches.length))
      })
    }
    update()
    const vv=window.visualViewport
    vv?.addEventListener('resize',update)
    vv?.addEventListener('scroll',update)
    window.addEventListener('resize',update)
    window.addEventListener('scroll',update,true)
    return()=>{
      cancelAnimationFrame(frame)
      vv?.removeEventListener('resize',update)
      vv?.removeEventListener('scroll',update)
      window.removeEventListener('resize',update)
      window.removeEventListener('scroll',update,true)
    }
  },[visible,matches.length,value])

  const choose=name=>{onSelect?.(name);setOpen(false);root.current?.querySelector('input')?.blur()}
  return <div className="exercise-name-picker" ref={root}>
    <input id={id||undefined} type="text" autoFocus={autoFocus} disabled={disabled}
      autoComplete="off" enterKeyHint="done" value={value} aria-label={label}
      aria-expanded={visible} aria-controls={visible?listId:undefined}
      placeholder={placeholder}
      onFocus={()=>setOpen(true)}
      onChange={event=>{onChange?.(event.target.value);setOpen(true)}}
      onKeyDown={event=>{
        if(event.key==='Escape')setOpen(false)
      }}/>
    {visible&&placement&&createPortal(
      <div ref={popover} id={listId} className="exercise-name-suggestions"
        role="group" aria-label="Matching exercise names" style={placement}>
        <small>Previously used · tap to select, or keep typing</small>
        {matches.map(name=><button type="button" key={name}
          onClick={()=>choose(name)}>
          <span>{name}</span><b>Use</b>
        </button>)}
      </div>,document.body)}
  </div>
}
