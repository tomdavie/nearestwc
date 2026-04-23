import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { initAnalytics } from './utils/analytics'
import './index.css'

initAnalytics()

const splashEl = document.getElementById('nwc-splash')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if (splashEl) {
  window.requestAnimationFrame(() => {
    splashEl.classList.add('nwc-hide')
    window.setTimeout(() => splashEl.remove(), 320)
  })
}