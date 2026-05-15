// Cross-Origin Isolation ServiceWorker
// Injects COOP/COEP/CORP headers so SharedArrayBuffer is available (needed for ORT WASM threads).
// Based on https://github.com/gzuidhof/coi-serviceworker

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  // Don't intercept non-GET or chrome-extension requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then((resp) => {
      // Opaque responses (status 0) can't be modified — pass through
      if (!resp || resp.status === 0 || !resp.headers) return resp;

      const headers = new Headers(resp.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers,
      });
    })
  );
});
