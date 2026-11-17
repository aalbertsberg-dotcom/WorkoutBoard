import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {createRoot} from 'react-dom/client'

// All WorkSet-owned confirmations use one visible, keyboard-accessible modal.
// Unlike an inline card, this portal never inherits the page's scroll position.
export function DialogPortal({children,onDismiss,label='WorkSet confirmation'}){
  const panelRef=useRef(null)
  const dismissRef=useRef(onDismiss)
  dismissRef.current=onDismiss
  useEffect(()=>{
    const previous=document.activeElement
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    const panel=panelRef.current
    const focusables=()=>[...(panel?.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])')||[])]
      .filter(node=>node.getClientRects().length)
    const initial=panel?.querySelector('[data-dialog-focus]')||focusables()[0]||panel
    initial?.focus?.()
    const onKey=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismissRef.current?.();return}
      if(e.key!=='Tab')return
      const elements=focusables()
      if(!elements.length){e.preventDefault();panel?.focus();return}
      const first=elements[0],last=elements.at(-1)
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel)){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel)){e.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',onKey,true)
    return()=>{
      document.removeEventListener('keydown',onKey,true)
      document.body.style.overflow=previousOverflow
      if(previous?.isConnected)previous.focus?.()
    }
  },[])
  return createPortal(<div className="workset-dialog-backdrop" onMouseDown={e=>{
    if(e.target===e.currentTarget)dismissRef.current?.()
  }}>
    <section ref={panelRef} className="workset-dialog-panel" role="alertdialog" aria-modal="true" aria-label={label} tabIndex={-1}>
      {children}
    </section>
  </div>,document.body)
}

function ChoiceDialog({message,options,settle}){
  return <DialogPortal label={options.title||'Confirm action'} onDismiss={()=>settle(false)}>
    <h3>{options.title||'Please confirm'}</h3>
    <p>{message}</p>
    <div className="workset-dialog-actions">
      {!options.hideCancel&&<button type="button" className="secondary-action" data-dialog-focus onClick={()=>settle(false)}>{options.cancelLabel||'Cancel'}</button>}
      <button type="button" className={options.danger===false?'primary-action':'danger-action'} data-dialog-focus={options.hideCancel?'':undefined} onClick={()=>settle(true)}>{options.confirmLabel||'Confirm'}</button>
    </div>
  </DialogPortal>
}
function TextDialog({message,defaultValue,settle}){
  const [value,setValue]=useState(defaultValue)
  return <DialogPortal label={message} onDismiss={()=>settle(null)}>
    <form onSubmit={e=>{e.preventDefault();settle(value)}}>
      <h3>{message}</h3>
      <input type="text" className="workset-dialog-input" autoFocus value={value} onChange={e=>setValue(e.target.value)} />
      <div className="workset-dialog-actions">
        <button type="button" className="secondary-action" onClick={()=>settle(null)}>Cancel</button>
        <button type="submit" className="primary-action">Save</button>
      </div>
    </form>
  </DialogPortal>
}
function openDialog(render){
  if(typeof document==='undefined')return Promise.resolve(null)
  return new Promise(resolve=>{
    const mount=document.createElement('div')
    document.body.appendChild(mount)
    const root=createRoot(mount)
    let finished=false
    const settle=value=>{
      if(finished)return
      finished=true
      resolve(value)
      // Defer root removal until React has completed the current click event.
      window.setTimeout(()=>{root.unmount();mount.remove()},0)
    }
    root.render(render(settle))
  })
}
export function confirmWorkset(message,options={}){
  return openDialog(settle=><ChoiceDialog message={message} options={options} settle={settle}/>)
}
export function promptWorkset(message,defaultValue=''){
  return openDialog(settle=><TextDialog message={message} defaultValue={defaultValue} settle={settle}/>)
}
export function noticeWorkset(message){
  return confirmWorkset(message,{title:'WorkSet notice',confirmLabel:'OK',hideCancel:true,danger:false})
}
