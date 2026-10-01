// Service worker de WeboDevis, servi par une route : le dossier des fichiers statiques du projet
// s'appelle « Public » (majuscule), que l'hébergement Linux ne reconnaît pas comme « public ».
//
// Rôle actuel : rendre l'app installable, garder ses fichiers en cache et afficher une page claire
// hors ligne. Les données (devis, événements) ne sont pas mises en cache ici.
const SCRIPT = String.raw`
const CACHE = 'webodevis-v1';

// Notifications push : { title, body, url, tag } envoyés par le serveur (lib/push.ts).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'WeboDevis', {
    body: data.body || '',
    tag: data.tag,
    icon: '/icons/192',
    badge: '/icons/192',
    data: { url: data.url || '/' },
  }));
});

// Au toucher : la page déjà ouverte est ramenée au premier plan, sinon elle s'ouvre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const w of wins) {
      if (w.url === target && 'focus' in w) return w.focus();
    }
    return self.clients.openWindow(target);
  }));
});
const OFFLINE_URL = '/hors-ligne';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages : le réseau d'abord ; sans réseau, la page « hors ligne ».
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Fichiers de l'app (scripts, styles, polices, icônes) : le cache d'abord, rafraîchi en arrière-plan.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fresh = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fresh;
      }),
    );
  }
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
}
