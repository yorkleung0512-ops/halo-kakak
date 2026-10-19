import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const bar = document.createElement('div')
            bar.setAttribute('role', 'status')
            bar.style.cssText =
              'position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);z-index:60;background:#0f766e;color:#fff;padding:0.75rem 1rem;border-radius:0.75rem;font:600 14px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer'
            bar.textContent = '有新版本 / Ada versi baru — ketuk untuk muat ulang'
            bar.onclick = () => {
              nw.postMessage?.('SKIP_WAITING')
              window.location.reload()
            }
            document.body.appendChild(bar)
          }
        })
      })
    }).catch(() => {})
  })
}
