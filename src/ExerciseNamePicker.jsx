import {useEffect,useRef,useState} from 'react'
import {findExerciseNameSuggestions} from './exerciseIdentity.js'

// Short, tappable search-as-you-type picker used during a workout.
// Typing is always allowed; suggestions never silently rename an exercise.
export default function ExerciseNamePicker({
  value='',onChange,onSelect,choices=[],placeholder='Type an exercise name',
  label='Exercise name',id='',autoFocus=false,disabled=false,maxResults=5
}){
  const [open,setOpen]=useState(false)
  const root=useRef(null)
  const matches=findExerciseNameSuggestions(value,choices,maxResults)
  useEffect(()=>{
    if(!open)return
    const close=event=>{
      if(root.current&&!root.current.contains(event.target))setOpen(false)
    }
    document.addEventListener('pointerdown',close)
    return()=>document.removeEventListener('pointerdown',close)
  },[open])
  return <div className="exercise-name-picker" ref={root}>
    <input id={id||undefined} type="text" autoFocus={autoFocus} disabled={disabled}
      autoComplete="off" enterKeyHint="done" value={value} aria-label={label}
      placeholder={placeholder}
      onFocus={()=>setOpen(true)}
      onChange={event=>{onChange?.(event.target.value);setOpen(true)}}
      onKeyDown={event=>{
        if(event.key==='Escape')setOpen(false)
        if(event.key==='Enter'&&matches.length&&open&&event.currentTarget.dataset.pickFirst==='true'){
          event.preventDefault()
          onSelect?.(matches[0]);setOpen(false)
        }
      }}
    />
    {open&&matches.length>0&&<div className="exercise-name-suggestions" role="group" aria-label="Matching exercise names">
      <small>Previously used · choose one, or keep typing</small>
      {matches.map(name=><button type="button" key={name}
        onClick={()=>{onSelect?.(name);setOpen(false)}}>
        <span>{name}</span><b>Use</b>
      </button>)}
    </div>}
  </div>
}
