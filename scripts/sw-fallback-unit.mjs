import assert from 'node:assert/strict'

/**
 * Mirrors public/sw.js navigation/static catch contract:
 * caches.match may resolve undefined; respondWith must still get a Response.
 */
function offlineFallback() {
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

async function navigationCatch(matchResult) {
  return matchResult || offlineFallback()
}

async function staticCatch(cached) {
  return cached || offlineFallback()
}

const fromUndefined = await navigationCatch(undefined)
assert.equal(fromUndefined instanceof Response, true)
assert.equal(fromUndefined.status, 503)

const real = new Response('<html></html>', { status: 200 })
const fromCached = await navigationCatch(real)
assert.equal(fromCached, real)

const staticMiss = await staticCatch(undefined)
assert.equal(staticMiss instanceof Response, true)
assert.equal(staticMiss.status, 503)

console.log('sw-fallback-unit: PASS')
