import { DIRECTORY_PREFIX } from './config';

// Aiguillage des adresses entre les deux sites du même projet. Les pages de l'annuaire vivent sous app/annuaire/ :
// sur son propre hôte (variable DIRECTORY_HOST), le middleware y réécrit chaque adresse ; sur webodevis.fr, une
// adresse /annuaire/… est renvoyée vers l'hôte de l'annuaire. En local et sur les aperçus Vercel, /annuaire se
// consulte tel quel. Fonction pure, appelée en tout premier par middleware.ts.

export type DirectoryRoute = { kind: 'rewrite'; to: string } | { kind: 'redirect'; to: string } | null;

const WEBODEVIS_HOSTS = ['webodevis.fr', 'www.webodevis.fr'];

// Chemins servis tels quels sur l'hôte de l'annuaire : l'API (statistiques, actions), les fichiers de Next, les
// icônes, les brochures (/b/…, ouvertes depuis une fiche) et le formulaire intégrable.
const PASS_PREFIXES = ['/api/', '/_next/', '/icons/', '/b/', '/embed/'];
const PASS_EXACT = ['/api', '/_next', '/icons', '/embed', '/sw.js', '/manifest.webmanifest'];
// Fichiers générés par les pages de l'annuaire : ils portent une extension mais doivent être réécrits.
const DIRECTORY_FILES = ['/sitemap.xml', '/robots.txt'];

/** Nom d'hôte sans port, sans « www. », en minuscules. */
function bareHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
}

/** La requête arrive-t-elle sur l'hôte de l'annuaire ? */
export function isDirectoryHost(host: string | null | undefined, directoryHost: string | undefined): boolean {
  if (!host || !directoryHost) return false;
  return bareHost(host) === bareHost(directoryHost);
}

const hasPrefix = (pathname: string) => pathname === DIRECTORY_PREFIX || pathname.startsWith(`${DIRECTORY_PREFIX}/`);
const withoutPrefix = (pathname: string) => pathname.slice(DIRECTORY_PREFIX.length) || '/';
// Un fichier statique : le dernier segment porte une extension (logo-pourpre.png, x.js, icone-192.png…).
const isStaticFile = (pathname: string) => /\/[^/]*\.[a-z0-9]+$/i.test(pathname) && !DIRECTORY_FILES.includes(pathname);

export function directoryRewrite(host: string | null, pathname: string, directoryHost: string | undefined): DirectoryRoute {
  if (!directoryHost || !host) return null;

  if (isDirectoryHost(host, directoryHost)) {
    if (PASS_EXACT.includes(pathname) || PASS_PREFIXES.some((p) => pathname.startsWith(p))) return null;
    if (isStaticFile(pathname)) return null;
    // /annuaire/… sur l'hôte de l'annuaire : l'adresse publique n'a pas de préfixe.
    if (hasPrefix(pathname)) return { kind: 'redirect', to: withoutPrefix(pathname) };
    return { kind: 'rewrite', to: pathname === '/' ? DIRECTORY_PREFIX : `${DIRECTORY_PREFIX}${pathname}` };
  }

  if (WEBODEVIS_HOSTS.includes(host.trim().toLowerCase().replace(/:\d+$/, '')) && hasPrefix(pathname) && !isStaticFile(pathname)) {
    return { kind: 'redirect', to: `https://${bareHost(directoryHost)}${withoutPrefix(pathname)}` };
  }
  return null;
}

/** Lien interne de l'annuaire : `base` vaut '' sur son hôte, '/annuaire' ailleurs ; `path` est le chemin public. */
export function directoryHref(base: '' | typeof DIRECTORY_PREFIX, path: string): string {
  if (path === '/' || path === '') return base || '/';
  return `${base}${path}`;
}

/**
 * Sur l'hôte de l'annuaire, la session de WeboDevis n'a pas cours : le layout racine (AuthProvider) demande quand même
 * /api/auth/session, et next-auth y poserait ses cookies. Le middleware répond à sa place : une session vide pour
 * /api/auth/session, rien pour le reste de /api/auth. L'annuaire ne dépose ainsi aucun cookie.
 */
export function directoryAuthBlock(host: string | null, pathname: string, directoryHost: string | undefined): 'empty-session' | 'not-found' | null {
  if (!isDirectoryHost(host, directoryHost)) return null;
  if (pathname === '/api/auth/session') return 'empty-session';
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/') ? 'not-found' : null;
}
