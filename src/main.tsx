import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// The iPhone app ships its files inside the app, so only the website needs the offline worker.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true })

// Ask the browser to keep this app's data even when storage runs low.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
