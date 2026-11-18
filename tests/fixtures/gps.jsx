import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {OutdoorTracker,emptyOutdoorTrack} from '../../src/outdoorTracking.jsx'
import '../../src/styles.css'

function Fixture(){
  const [running,setRunning]=useState(false)
  const [outdoor,setOutdoor]=useState(()=>emptyOutdoorTrack('walk'))
  const [elapsedSeconds,setElapsedSeconds]=useState(0)
  return <main className="page-section">
    <button type="button" onClick={()=>{setRunning(x=>!x);setElapsedSeconds(0)}}>{running?'Pause mock walk':'Start mock walk'}</button>
    <OutdoorTracker activity="walk" outdoor={outdoor} onChange={setOutdoor}
      running={running} elapsedSeconds={elapsedSeconds}/>
    <output id="gps-distance" aria-label="Recorded distance">{Number(outdoor.distance_m||0)}</output>
    <output id="gps-health">{JSON.stringify(outdoor.gps_health||{})}</output>
  </main>
}
createRoot(document.getElementById('root')).render(<Fixture/>)
