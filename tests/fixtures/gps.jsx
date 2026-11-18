import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {OutdoorTracker,emptyOutdoorTrack} from '../../src/outdoorTracking.jsx'
import {describeOutdoorGps} from '../../src/gpsStatus.js'
import GpsStatusBadge from '../../src/GpsStatusBadge.jsx'
import '../../src/styles.css'

function Fixture(){
  const [running,setRunning]=useState(false)
  const [outdoor,setOutdoor]=useState(()=>emptyOutdoorTrack('walk'))
  const [elapsedSeconds,setElapsedSeconds]=useState(0)
  const status=describeOutdoorGps({outdoor,running,elapsedSeconds})
  return <main className="page-section">
    <div className="quick-cardio-timer">
      <span className="quick-cardio-timer-state">{running?'TIMING NOW':'READY'}</span>
      <GpsStatusBadge status={status}
        onClick={()=>document.getElementById('workset-gps-panel')?.scrollIntoView({block:'start'})}/>
      <button type="button" onClick={()=>{setRunning(x=>!x);setElapsedSeconds(0)}}>{running?'Pause mock walk':'Start mock walk'}</button>
    </div>
    <OutdoorTracker activity="walk" outdoor={outdoor} onChange={setOutdoor}
      running={running} elapsedSeconds={elapsedSeconds}/>
    <output id="gps-distance" aria-label="Recorded distance">{Number(outdoor.distance_m||0)}</output>
    <output id="gps-health">{JSON.stringify(outdoor.gps_health||{})}</output>
  </main>
}
createRoot(document.getElementById('root')).render(<Fixture/>)
