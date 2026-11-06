// Web Push subscription (PRD 4). iOS: works only from the Home Screen app (16.4+),
// and permission must be requested from a tap.
import { db, dbMode } from './db'
import { updateSettings } from './settings'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'needs-install' | 'no-backend' | 'denied' | 'off' | 'on'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent)

function b64ToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (dbMode !== 'supabase' || !VAPID) return 'no-backend'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

export async function enablePush(): Promise<PushState> {
  const state = await pushState()
  if (state !== 'off') return state
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID!) as BufferSource })
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  db.upsertBy('push_subscriptions', (r) => r.endpoint === j.endpoint, {
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    ua: navigator.userAgent.slice(0, 160),
  })
  updateSettings({ notifications: true })
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    const ep = sub.endpoint
    await sub.unsubscribe()
    const row = db.rows('push_subscriptions').find((r) => r.endpoint === ep)
    if (row) db.remove('push_subscriptions', row.id)
  }
  updateSettings({ notifications: false })
  return 'off'
}
