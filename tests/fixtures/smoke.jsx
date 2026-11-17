import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {DialogPortal} from '../../src/worksetDialogs.jsx'
import PocketMode from '../../src/PocketMode.jsx'
import '../../src/styles.css'

function TestFixture(){
  const [confirming,setConfirming]=useState(false)
  const [pocket,setPocket]=useState(false)
  return <>
    <main style={{minHeight:'150vh',padding:20}}>
      <h1>WorkSet mobile test fixture</h1>
      <div style={{height:'105vh'}} aria-hidden="true"/>
      <button type="button" onClick={()=>setConfirming(true)}>Delete workout</button>
      <button type="button" onClick={()=>setPocket(true)}>Open Pocket Mode</button>
    </main>
    {confirming&&<DialogPortal label="Delete this workout?" onDismiss={()=>setConfirming(false)}>
      <h3>Delete this workout?</h3>
      <p>Only this workout will be removed.</p>
      <div className="workset-dialog-actions">
        <button type="button" className="secondary-action" onClick={()=>setConfirming(false)}>Keep workout</button>
        <button type="button" className="danger-action" onClick={()=>setConfirming(false)}>Delete workout permanently</button>
      </div>
    </DialogPortal>}
    {pocket&&<PocketMode activity="walk" elapsed="12:34" distance="0.85 mi" gps="GPS recording" wakeStatus="active" onUnlock={()=>setPocket(false)}/>}
  </>
}
createRoot(document.getElementById('root')).render(<TestFixture/>)
