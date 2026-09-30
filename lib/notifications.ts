// Où mène une notification. Les liens sont écrits par la base (déclencheurs) et certains datent de l'ancienne
// version de l'app : ils sont traduits ici vers les pages actuelles, et un lien inconnu retombe sur la page
// qui correspond au type de notification plutôt que sur une page introuvable.

const PAGES = ['/', '/devis', '/clients', '/prospects', '/calendrier', '/evenements', '/commandes', '/stock', '/prestations',
  '/ingredients', '/extras', '/fournisseurs', '/location-globale', '/courses-globales', '/parametres', '/modeles', '/location-templates', '/notifications'];

/** Anciennes adresses et leur équivalent. */
const LEGACY: [RegExp, string][] = [
  [/^\/prospect-requests\b.*/, '/prospects'],
  [/^\/prospection\b.*/, '/prospects'],
  [/^\/events?\/([0-9a-f-]{36}).*/, '/evenements/$1'],
  [/^\/quotes?\/([0-9a-f-]{36}).*/, '/devis/$1/modifier'],
];

const BY_TYPE: Record<string, string> = {
  prospect_request: '/prospects',
  upcoming_event: '/evenements',
  task_reminder: '/devis',
  stock_alert: '/stock',
  invoice_due: '/devis',
};

export function notificationHref(n: { type: string; action_url: string | null }): string {
  const url = (n.action_url ?? '').trim();
  if (url.startsWith('/')) {
    for (const [pattern, target] of LEGACY) if (pattern.test(url)) return url.replace(pattern, target);
    const path = url.split(/[?#]/)[0];
    if (PAGES.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`)))) return url;
  }
  return BY_TYPE[n.type] ?? '/notifications';
}
