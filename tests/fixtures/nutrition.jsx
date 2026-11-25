import React from 'react'
import {createRoot} from 'react-dom/client'
import NutritionPage from '../../src/NutritionPage.jsx'
import '../../src/styles.css'

const session={user:{id:'00000000-0000-4000-8000-000000000087',email:'nutrition@example.test'}}
createRoot(document.getElementById('root')).render(
  <NutritionPage session={session} onBack={()=>{window.location.hash='back'}}/>
)
