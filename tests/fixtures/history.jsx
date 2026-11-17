import React from 'react'
import {createRoot} from 'react-dom/client'
import WorkoutHistory from '../../src/workoutHistory.jsx'
import '../../src/styles.css'

// This is the real History component; browser tests intercept example
// Supabase endpoints and never touch production data.
const testSession={user:{id:'00000000-0000-4000-8000-000000000001'}}
createRoot(document.getElementById('root')).render(
  <WorkoutHistory session={testSession} initialWorkoutId="00000000-0000-4000-8000-000000000002" onBack={()=>document.body.dataset.back='true'}/>
)
