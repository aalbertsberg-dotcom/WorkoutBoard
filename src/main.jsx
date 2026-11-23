import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import WorksetErrorBoundary from './WorksetErrorBoundary.jsx'
import './styles.css'
import { Capacitor } from '@capacitor/core'
// Native-only safe area classes; browser/PWA layout stays unchanged.
if(Capacitor.isNativePlatform())
  document.documentElement.classList.add('workset-native','workset-native-'+Capacitor.getPlatform())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WorksetErrorBoundary><App /></WorksetErrorBoundary>
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
