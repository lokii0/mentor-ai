// mentor.ai service worker: offline shell (last loaded UI) + Web Push.
const VERSION = 'v1'
const SHELL = `mentor-shell-${VERSION}`
const scope = self.registration.scope

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([scope, `${scope}manifest.webmanifest`]).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mentor-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase/API calls always go to the network

  if (req.mode === 'navigate') {
    // Network first so updates land; cached shell when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put(scope, copy))
          return res
        })
        .catch(() => caches.match(scope)),
    )
    return
  }
  // Hashed assets: cache first, fill on miss.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

// Neutral texts only — the server never sends sensitive words (PRD 4 / 8).
self.addEventListener('push', (e) => {
  let data = { title: 'Check-in', body: '', url: '#/today', tag: 'mentor-checkin' }
  try {
    data = { ...data, ...e.data.json() }
  } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: `${scope}icons/icon-192.png`,
      badge: `${scope}icons/badge-96.png`,
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = scope + (e.notification.data?.url ?? '#/today')
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(scope)) {
          c.navigate(target).catch(() => {})
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
