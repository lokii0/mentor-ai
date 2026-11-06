// Lock state. Locked on every cold start when a PIN exists; re-locks after the
// configured auto-lock time in the background (PRD 8: 1–5 min).
import { hasPin } from '../lib/pin'
import { getSettings } from '../lib/settings'
import { atom } from '../lib/store'

export const locked = atom<boolean>(hasPin())

let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }
  const limit = Math.max(1, getSettings().autolock_min) * 60_000
  if (hasPin() && hiddenAt && Date.now() - hiddenAt >= limit) locked.set(true)
  hiddenAt = 0
})

export const lockNow = () => {
  if (hasPin()) locked.set(true)
}
