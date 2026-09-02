import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyTheme, getSavedTheme } from './theme.ts'
import { applyBackground } from './background.ts'
import { applyTabCloak } from './tabcloak.ts'
import { launchBlobCloak } from './cloak.ts'

applyTheme(getSavedTheme())
applyBackground()
applyTabCloak()
if (window.self === window.top && (window.location.pathname === '/' || window.location.pathname === '/index.html') && window.location.protocol !== 'blob:') {
  launchBlobCloak()
}

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason && (e.reason.message || String(e.reason)) || ''
  if (/domain fetch failed|luminsdk|lumin\.worker|BareMux/i.test(msg)) {
    e.preventDefault()
  }
})
window.addEventListener('error', (e) => {
  if (e.message && /domain fetch failed|luminsdk|lumin\.worker|BareMux/i.test(e.message)) {
    e.preventDefault()
  }
}, true)

const filterLuminNoise = (original: (...args: any[]) => void) => {
  return (...args: any[]) => {
    const first = args.length > 0 ? (args[0] instanceof Error ? args[0].message : String(args[0])) : ''
    if (/domain fetch failed|luminsdk|lumin\.worker|LuminSDK|Game library/i.test(first)) return
    original(...args)
  }
}
console.warn = filterLuminNoise(console.warn.bind(console))
console.error = filterLuminNoise(console.error.bind(console))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
