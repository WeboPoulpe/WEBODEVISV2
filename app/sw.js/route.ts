// Service worker de WeboDevis, servi par une route : le dossier des fichiers statiques du projet
// s'appelle « Public » (majuscule), que l'hébergement Linux ne reconnaît pas comme « public ».
//
// Rôle : rendre l'app installable, garder ses fichiers en cache, afficher une page claire hors ligne et
// ouvrir « Ma journée » (/journee) sans réseau.
//
// Ce qui est mis en cache, et rien d'autre :
//  - les fichiers de l'app (/_next/static : scripts, styles, polices ; /icons) — identiques pour tous les comptes ;
//  - la page /hors-ligne ;
//  - la page /journee, seule page de l'app gardée : son HTML ne contient aucune donnée (elle les charge après
//    coup, puis en garde une copie sur l'appareil, rangée par compte, voir lib/offlineStore.ts).
// Jamais mis en cache : les réponses de /api/, les actions serveur et tout ce qui n'est pas une requête GET
// (les actions serveur sont des POST), ni les autres pages de l'app, qui contiennent des données personnelles.
//
// Changer CACHE (« -v2 », « -v3 »…) quand on modifie ce qui est gardé : à l'activation, le nouveau service
// worker efface les caches portant un autre nom.
const SCRIPT = String.raw`
const CACHE = 'webodevis-v2';
// Pages de l'app consultables sans réseau (HTML sans données personnelles uniquement).
const OFFLINE_PAGES = ['/journee'];

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

  // Rien de ce qui passe par /api/ (session, fichiers, données) n'est gardé ni servi depuis le cache.
  if (url.pathname.startsWith('/api/')) return;

  // « Ma journée » : le réseau d'abord, et la copie gardée met à jour la page en cache ; sans réseau, la
  // dernière copie, sinon la page « hors ligne ». Une réponse redirigée (session expirée → connexion) ou
  // en erreur n'est pas gardée. La copie est rangée sous l'adresse sans paramètres.
  if (request.mode === 'navigate' && OFFLINE_PAGES.includes(url.pathname)) {
    const key = new Request(url.origin + url.pathname);
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && !response.redirected && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(key, copy)));
        }
        return response;
      }).catch(async () => (await caches.match(key)) || caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Autres pages : le réseau d'abord, sans rien garder ; sans réseau, la page « hors ligne ».
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Fichiers de l'app (scripts, styles, polices, icônes) : le cache d'abord, rafraîchi en arrière-plan.
  // Ceux de /_next/static portent une empreinte dans leur nom : une version gardée reste juste. Ils sont gardés
  // au fil des visites, dont celles de /journee : la page retrouve ainsi ses fichiers sans réseau.
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
