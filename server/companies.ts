'use server';

import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import {
  COMPANY_SEARCH_UNAVAILABLE, normalizeCompanies, parseCompanyQuery,
  type CompanyResult, type CompanySearchResponse,
} from '@/lib/companies';
import { getSessionUser } from './session';

// Recherche d'entreprise par nom, SIREN ou SIRET, pour remplir une fiche client entreprise.
// Source : l'API publique « Recherche d'entreprises » de l'État (gratuite, sans clé, environ 7 appels
// par seconde). Réservée aux comptes connectés, démonstration comprise (simple lecture).

const PUBLIC_API = 'https://recherche-entreprises.api.gouv.fr';
/** Délai au-delà duquel on laisse la saisie à la main. */
const TIMEOUT_MS = 4_000;
/** Une même recherche n'est pas redemandée à l'API pendant ce temps. */
const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 300;
/** Cookie réservé aux tests (serveur de développement seulement) : adresse d'une API simulée sur cette machine. */
const TEST_URL_COOKIE = 'webodevis_company_search_url';

/** Espaces, points et tirets retirés d'un SIRET saisi à la main (motif passé en paramètre SQL). */
const SEPARATORS = '[[:space:].-]';

const cache = new Map<string, { at: number; results: CompanyResult[] }>();

/** Adresse de l'API : COMPANY_SEARCH_URL si défini, l'API publique sinon. */
async function apiBase(): Promise<string> {
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

async function fetchCompanies(base: string, query: NonNullable<ReturnType<typeof parseCompanyQuery>>): Promise<CompanyResult[] | 'busy' | 'error'> {
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

/** Clients du carnet (ceux que le compte voit) qui portent déjà un de ces SIRET. */
async function existingCustomers(userId: string, sirets: string[]) {
  if (sirets.length === 0) return new Map<string, { id: string; name: string }>();
  const { rows } = await db.execute(sql`
    select c.id, c.company_name, c.first_name, c.last_name, regexp_replace(c.siret_number, ${SEPARATORS}, '', 'g') as siret
    from public.customers c
    where c.siret_number is not null
      and regexp_replace(c.siret_number, ${SEPARATORS}, '', 'g') in (${sql.join(sirets.map((s) => sql`${s}`), sql`, `)})
      and (c.owner_user_id = ${userId} or c.owner_user_id in (
        select cp.id from public.profiles cp
        where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${userId})))
    order by (c.owner_user_id = ${userId}) desc`);
  const map = new Map<string, { id: string; name: string }>();
  for (const r of rows as { id: string; company_name: string | null; first_name: string | null; last_name: string | null; siret: string }[]) {
    if (map.has(r.siret)) continue;
    const name = r.company_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Client sans nom';
    map.set(r.siret, { id: r.id, name });
  }
  return map;
}

/**
 * Entreprises correspondant à un nom, un SIREN ou un SIRET (l'établissement exact pour un SIRET).
 * Chaque résultat signale le client du carnet qui porte déjà ce SIRET.
 */
export async function searchCompanies(raw: string): Promise<CompanySearchResponse> {
  const user = await getSessionUser();
  if (!user) return { results: [], error: 'Votre session a expiré. Reconnectez-vous pour rechercher une entreprise.' };
  const query = parseCompanyQuery(typeof raw === 'string' ? raw : '');
  if (!query) return { results: [], error: null };

  const found = await fetchCompanies(await apiBase(), query);
  if (found === 'busy') return { results: [], error: 'Trop de recherches à la fois. Réessayez dans un instant.' };
  if (found === 'error') return { results: [], error: COMPANY_SEARCH_UNAVAILABLE };

  try {
    const known = await existingCustomers(user.id, found.map((r) => r.siret));
    return { results: found.map((r) => (known.has(r.siret) ? { ...r, existingCustomer: known.get(r.siret) } : r)), error: null };
  } catch {
    // Le carnet n'a pas pu être consulté : les suggestions restent utiles.
    return { results: found, error: null };
  }
}
