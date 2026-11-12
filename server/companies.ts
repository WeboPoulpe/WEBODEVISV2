'use server';

import { sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  COMPANY_SEARCH_UNAVAILABLE, parseCompanyQuery,
  type CompanyResult, type CompanySearchResponse,
} from '@/lib/companies';
import { apiBase, fetchCompanies } from './companyLookup';
import { getSessionUser } from './session';

// Recherche d'entreprise par nom, SIREN ou SIRET, pour remplir une fiche client entreprise.
// Source : l'API publique « Recherche d'entreprises » de l'État (gratuite, sans clé, environ 7 appels
// par seconde). Réservée aux comptes connectés, démonstration comprise (simple lecture).

/** Espaces, points et tirets retirés d'un SIRET saisi à la main (motif passé en paramètre SQL). */
const SEPARATORS = '[[:space:].-]';

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
