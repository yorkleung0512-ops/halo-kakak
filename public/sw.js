/* Halo Kakak service worker — caches app shell only; never caches private API */
const CACHE = 'halo-kakak-shell-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

function offlineResponse() {
  return new Response(
    '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>Offline</title></head><body><p>離線 / Offline — silakan muat ulang saat online.</p></body></html>',
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

async function shellFallback() {
  const cached =
    (await caches.match('/index.html')) || (await caches.match('/'))
  return cached || offlineResponse()
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache Supabase / API / functions
  if (
    url.hostname.includes('supabase') ||
    url.pathname.startsWith('/functions') ||
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/auth/')
  ) {
    return
  }

  if (event.request.method !== 'GET') return

  // Navigation: network first, always resolve to a real Response (never undefined)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {})
          }
          return res
        })
        .catch(() => shellFallback()),
    )
    return
  }

  // Static assets: stale-while-revalidate; never leave respondWith without a Response
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetched = fetch(event.request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => cached || offlineResponse())
        return cached || fetched
      }),
    )
  }
})
