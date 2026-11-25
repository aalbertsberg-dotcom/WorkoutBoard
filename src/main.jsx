import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import {applyNativeNavigationInsets,isNativeAndroid} from './androidUpdates.js'
import WorksetErrorBoundary from './WorksetErrorBoundary.jsx'
import './styles.css'

// Android 15+ may extend the WebView behind the Samsung navigation buttons.
// Measure the actual native overlap, not a guessed constant or PWA inset.
if(isNativeAndroid()){
  const update=()=>{applyNativeNavigationInsets().catch(()=>{});};
  update();
  window.addEventListener('resize',update);
  window.addEventListener('orientationchange',update);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
}

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
