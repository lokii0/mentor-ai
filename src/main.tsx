import { QA } from './qa' // first: patches rAF before Motion loads (dev QA only)
// Global styles next: feature stylesheets imported by components must come after them.
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig, MotionGlobalConfig } from 'motion/react'
import { App } from './App'

if (QA) {
  MotionGlobalConfig.skipAnimations = true
  void import('./lib/db').then((m) => Object.assign(window, { __db: m.db }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)

// Service worker: app shell cache + Web Push. Only in production builds.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}
