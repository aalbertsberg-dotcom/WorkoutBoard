import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {PlatformProgress} from '../../src/platform.jsx'
import WorkoutHistory from '../../src/workoutHistory.jsx'
import '../../src/styles.css'

const session={user:{id:'00000000-0000-4000-8000-000000000001',email:'test@example.test'}}
const legacy={
 id:'00000000-0000-4000-8000-000000000003',user_id:session.user.id,
 lift:'Bench',program:'Sample program',week:3,completed_at:'2026-11-15T10:00:00Z',
 workout:{main:[{weight:185,actualReps:3},{weight:195,actualReps:2}]},
 _metrics:{volume:945,estimated1rm:214.5}
}
const progress={
 completed:[legacy],strength:{Squat:null,Bench:null,Deadlift:null,Press:null},
 totalVolume:945,volume7:945,volume30:945,latestBodyweight:null,
 weekly:[],volume30Prior:0
}
function Fixture(){
 const [active,setActive]=useState('progress')
 const [workoutId,setWorkoutId]=useState(null)
 const [links,setLinks]=useState([])
 return <>
  {active==='progress'?<PlatformProgress
    session={session} profile={{display_name:'Tester'}} setProfile={()=>{}}
    view="mine" progress={progress} lifts={['Squat','Bench','Deadlift','Press']}
    formatWeight={x=>Math.round(Number(x)||0).toLocaleString()}
    programs={{}} dbNameToProgram={{}}
    initialSection="History"
    onOpenHistory={()=>{setWorkoutId(null);setActive('history')}}
    onOpenWorkout={id=>{setLinks(x=>[...x,id]);setWorkoutId(id);setActive('history')}}
    onSectionChange={()=>{}}/>
  :<WorkoutHistory session={session} initialWorkoutId={workoutId}
    legacyHistory={progress.completed} fromProgress={true}
    onBack={()=>setActive('progress')}/>}
  <output id="progress-test-links" role="status">{links.join(',')}</output>
 </>
}
createRoot(document.getElementById('root')).render(<Fixture/>)
