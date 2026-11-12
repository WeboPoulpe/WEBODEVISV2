import 'server-only';
import { cookies } from 'next/headers';
import { normalizeCompanies, parseCompanyQuery, type CompanyResult } from '@/lib/companies';

// Appels à l'API publique « Recherche d'entreprises » de l'État (gratuite, sans clé, environ 7 appels par seconde).
// Ce module n'est pas un fichier 'use server' : rien de ce qui s'y trouve n'est une action appelable du navigateur.
// Il sert à la recherche d'entreprise des fiches clients (server/companies.ts) et au contrôle du SIRET d'une fiche
// de l'annuaire (server/directoryListing.ts).

const PUBLIC_API = 'https://recherche-entreprises.api.gouv.fr';
/** Délai au-delà duquel on laisse la saisie à la main. */
const TIMEOUT_MS = 4_000;
/** Une même recherche n'est pas redemandée à l'API pendant ce temps. */
const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 300;
/** Cookie réservé aux tests (serveur de développement seulement) : adresse d'une API simulée sur cette machine. */
const TEST_URL_COOKIE = 'webodevis_company_search_url';

const cache = new Map<string, { at: number; results: CompanyResult[] }>();

/** Adresse de l'API : COMPANY_SEARCH_URL si défini, l'API publique sinon. */
export async function apiBase(): Promise<string> {
  if (process.env.NODE_ENV !== 'production') {
    // Les tests pointent vers une API simulée sans redémarrer le serveur ; jamais hors de cette machine.
    const override = (await cookies()).get(TEST_URL_COOKIE)?.value;
    if (override) {
      try {
        const url = new URL(override);
        if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)) return url.origin;
      } catch { /* adresse illisible : ignorée */ }
    }
  }
  return (process.env.COMPANY_SEARCH_URL || PUBLIC_API).replace(/\/+$/, '');
}

export async function fetchCompanies(base: string, query: NonNullable<ReturnType<typeof parseCompanyQuery>>): Promise<CompanyResult[] | 'busy' | 'error'> {
  const key = `${base}|${query.kind}|${query.q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;

  const params = new URLSearchParams({
    q: query.q, page: '1', per_page: '10', minimal: 'true', include: 'siege,matching_etablissements',
  });
  try {
    const res = await fetch(`${base}/search?${params}`, {
      headers: { 'User-Agent': 'WeboDevis/1.0 (logiciel de devis pour traiteurs ; https://webodevis.fr)', Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (res.status === 429) return 'busy';
    if (!res.ok) return 'error';
    const results = normalizeCompanies(await res.json(), query);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), results });
    return results;
  } catch {
    // Délai dépassé, réseau coupé ou réponse illisible.
    return 'error';
  }
}

/**
 * L'établissement qui porte exactement ce SIRET ; null si l'annuaire de l'État répond sans le connaître ;
 * 'unavailable' s'il ne répond pas (délai, réseau, trop d'appels, réponse en erreur).
 */
export async function findCompanyBySiret(siret: string): Promise<CompanyResult | null | 'unavailable'> {
  const query = parseCompanyQuery(siret ?? '');
  if (!query || query.kind !== 'siret') return null;
  const found = await fetchCompanies(await apiBase(), query);
  if (found === 'busy' || found === 'error') return 'unavailable';
  return found.find((r) => r.siret === query.q) ?? null;
}
