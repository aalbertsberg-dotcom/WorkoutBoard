import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import MePage from '../../src/MePage.jsx'
import '../../src/styles.css'

const session={user:{id:'00000000-0000-4000-8000-000000000001',email:'member@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'}}
const lifts=['Squat','Bench','Deadlift','Press']
function Fixture(){
  const [displayName,setDisplayName]=useState('Test Athlete')
  const [oneRepMaxes,setOneRepMaxes]=useState({Squat:250,Bench:200,Deadlift:300,Press:125})
  const [navigation,setNavigation]=useState('')
  const [choice,setChoice]=useState('')
  const [weight,setWeight]=useState('')
  const [reps,setReps]=useState(5)
  const [lift,setLift]=useState('')
  const [ops,setOps]=useState(0)
  const estimated=weight?Number(weight)*(1+reps/30):0
  const rounded=Math.round(estimated*100)/100
  const saveName=async name=>{
    setOps(v=>v+1)
    if(name==='Reject Name')return {error:new Error('Server rejected this name.')}
    setDisplayName(name);return {error:null}
  }
  const saveRm=async(name,value)=>{
    setOps(v=>v+1)
    if(Number(value)===9999)return {error:new Error('Simulated max save rejected.')}
    setOneRepMaxes(v=>({...v,[name]:value===''?'':Number(value)}))
    return {error:null}
  }
  return <>
    <MePage session={session} displayName={displayName} onSaveDisplayName={saveName}
      onOpenHistory={()=>setNavigation('History opened')}
      onOpenProgress={()=>setNavigation('Progress opened')}
      onOpenNutrition={()=>setNavigation('Nutrition opened')}
      onOpenWeight={()=>setNavigation('Measurements opened')}
      onOpenPrograms={()=>setNavigation('Plan opened')}
      profile={{display_name:displayName}} setProfile={()=>{}}
      progress={{completed:[],weekly:[]}} lifts={lifts} formatWeight={n=>Math.round(Number(n)||0).toLocaleString()}
      programs={{}} dbNameToProgram={{}}
      oneRepMaxes={oneRepMaxes} onSaveOneRm={saveRm}
      oneRmWeight={weight} setOneRmWeight={setWeight} oneRmReps={reps} setOneRmReps={setReps}
      oneRmEstimate={estimated} oneRmRounded={rounded} oneRmTrainingMax={rounded*.85}
      oneRmLift={lift} setOneRmLift={setLift} oneRmNotice={null}
      calculatedOneRms={{Bench:{value:202.5,weight:185,reps:3}}}
      baselineTestChoice={choice} setBaselineTestChoice={setChoice}
      onStartBaseline={()=>setNavigation('Baseline '+choice)}
      trackedProgramsInfo={[{key:'test',name:'Sample strength',nextTitle:'Day 2',completed:2,total:24}]}
      personalProgramName="Sample strength" shareInvite={()=>setNavigation('Invite opened')} inviteState=""
      isAdmin={false} feedbackUnread={0} onOpenAdmin={()=>setNavigation('Admin opened')}
      onSignOut={()=>setNavigation('Sign out clicked')} appUrl="http://localhost:4173/"
      onRefreshWorkset={()=>setNavigation('Refreshed safely')} refreshBlocked={false}
    />
    <output id="me-test-navigation" role="status">{navigation}</output>
    <output id="me-test-backend" role="status">Saves: {ops}</output>
  </>
}
createRoot(document.getElementById('root')).render(<Fixture/>)
