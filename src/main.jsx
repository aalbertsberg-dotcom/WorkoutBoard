import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Disable the offline service worker while WorkoutBoard is under active development.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(reg => reg.unregister()))
      const keys = await caches.keys()
      await Promise.all(keys.filter(key => key.startsWith('workoutboard-')).map(key => caches.delete(key)))
    } catch {}
  })
}
