import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {pocketSlideProgress,pocketSlideUnlocked,pocketHoldUnlocked,POCKET_HOLD_UNLOCK_MS,pocketModeStatus} from './pocketModeRules'

const SLIDER_GUTTER=12

/** WorkSet-only touch protection. Does not lock or switch off the device screen. */
export default function PocketMode({activity='walk',elapsed='0:00',distance='0.00 mi',gps='Waiting for GPS',wakeStatus='checking',onUnlock}){
  const overlayRef=useRef(null)
  const dragRef=useRef(null)
  const holdTimerRef=useRef(null)
  const holdStartRef=useRef(0)
  const [slideProgress,setSlideProgress]=useState(0)
  const [holding,setHolding]=useState(false)
  const wake=pocketModeStatus(wakeStatus)

  useEffect(()=>{
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    overlayRef.current?.focus()
    return()=>{
      document.body.style.overflow=previousOverflow
      window.clearTimeout(holdTimerRef.current)
    }
  },[])

  const beginSlide=event=>{
    if(!event.isPrimary)return
    event.preventDefault()
    const track=event.currentTarget.parentElement
    const travel=Math.max(0,track.clientWidth-event.currentTarget.clientWidth-SLIDER_GUTTER)
    dragRef.current={id:event.pointerId,startX:event.clientX,travel}
    setSlideProgress(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveSlide=event=>{
    const drag=dragRef.current
    if(!drag||drag.id!==event.pointerId)return
    setSlideProgress(pocketSlideProgress(event.clientX-drag.startX,drag.travel))
  }
  const finishSlide=event=>{
    const drag=dragRef.current
    if(!drag||drag.id!==event.pointerId)return
    dragRef.current=null
    if(pocketSlideUnlocked(event.clientX-drag.startX,drag.travel)){
      onUnlock?.()
      return
    }
    setSlideProgress(0)
  }
  const cancelSlide=()=>{
    dragRef.current=null
    setSlideProgress(0)
  }
  const stopHold=()=>{
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current=null
    holdStartRef.current=0
    setHolding(false)
  }
  const beginHold=()=>{
    if(holdTimerRef.current!==null)return
    holdStartRef.current=Date.now()
    setHolding(true)
    holdTimerRef.current=window.setTimeout(()=>{
      // The three-second timer completed; avoid a 1 ms clock-rounding miss.
      const held=Math.max(POCKET_HOLD_UNLOCK_MS,Date.now()-holdStartRef.current)
      holdTimerRef.current=null
      holdStartRef.current=0
      setHolding(false)
      if(pocketHoldUnlocked(held))onUnlock?.()
    },POCKET_HOLD_UNLOCK_MS)
  }
  const handleHoldKeyDown=event=>{
    if((event.key==='Enter'||event.key===' ')&&!event.repeat){
      event.preventDefault()
      beginHold()
    }
  }
  const handleHoldKeyUp=event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault()
      stopHold()
    }
  }
  const progressPixels=(slideProgress*100).toFixed(1)+'%'
  const label=activity==='bike'?'Bike':activity==='run'?'Run':'Walk'

  return createPortal(<div className="pocket-overlay" role="dialog" aria-modal="true"
    aria-label="Pocket Mode touch lock" ref={overlayRef} tabIndex={-1}
    onKeyDown={event=>{
      if(event.key!=='Tab')return
      const controls=overlayRef.current?.querySelectorAll('button')
      if(!controls?.length)return
      const first=controls[0],last=controls[controls.length-1]
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===overlayRef.current)){
        event.preventDefault();last.focus()
      }else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===overlayRef.current)){
        event.preventDefault();first.focus()
      }
    }}>
    <div className="pocket-overlay-content">
      <div className="pocket-overlay-top">
        <span className="pocket-lock-icon" aria-hidden="true">🔒</span>
        <div><span className="pocket-eyebrow">POCKET MODE</span><h2>{label} in progress</h2></div>
      </div>
      <p className="pocket-intro">Touch protection is on. Your workout continues.</p>

      <div className="pocket-live-metrics" aria-label="Live workout stats">
        <div><span>Time</span><strong>{elapsed}</strong></div>
        <div><span>Distance</span><strong>{distance}</strong></div>
      </div>
      <div className="pocket-tracking-status" role="status" aria-live="polite">
        <span className="pocket-signal-dot" aria-hidden="true"/>
        <div><strong>{gps}</strong><small>{wake.label} · {wake.detail}</small></div>
      </div>

      <div className="pocket-unlock-controls">
        <h3>Slide to unlock</h3>
        <div className="pocket-slide-track" aria-label="Slide right to unlock WorkSet">
          <div className="pocket-slide-progress" style={{width:progressPixels}} aria-hidden="true"/>
          <span className="pocket-slide-hint" aria-hidden="true">Slide all the way <span>› ›</span></span>
          <button type="button" className="pocket-slide-thumb"
            style={{left:'calc(6px + '+(slideProgress*100).toFixed(1)+'% - '+(slideProgress*84).toFixed(1)+'px)'}}
            onPointerDown={beginSlide}
            onPointerMove={moveSlide}
            onPointerUp={finishSlide}
            onPointerCancel={cancelSlide}
            aria-label="Drag this slider all the way right to unlock"
            title="Slide right to unlock">
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <button type="button" className={'pocket-hold-unlock '+(holding?'holding':'')}
          onPointerDown={event=>{if(event.isPrimary)beginHold()}}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          onKeyDown={handleHoldKeyDown}
          onKeyUp={handleHoldKeyUp}
          onContextMenu={event=>event.preventDefault()}
          aria-label="Press and hold for three seconds to unlock">
          {holding?'Keep holding…':'Or press and hold here for 3 seconds'}
        </button>
      </div>
      <p className="pocket-caution">WorkSet touch lock only · the display remains on. The phone’s power button or system gestures can still lock or leave the app.</p>
    </div>
  </div>,document.body)
}
