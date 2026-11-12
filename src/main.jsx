import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Keep the app shell available offline. The build ID in the service-worker URL
// forces phones to pick up a fresh worker whenever Workset is deployed.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(
        import.meta.env.BASE_URL+'sw.js?build='+encodeURIComponent(__WORKSET_BUILD_ID__),
        {scope:import.meta.env.BASE_URL}
      )
    } catch (error) {
      console.warn('Offline support could not be registered.',error)
    }
  })
}
