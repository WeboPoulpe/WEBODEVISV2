import 'server-only';
import { and, desc, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { site_requests } from '@/db/schema';
import { parseOrigin } from '@/lib/origine';

/**
 * Origine Instagram d'un compte : celle de la visite si elle est valide, sinon celle de la plus récente demande
 * (démo, contact) faite avec la même adresse, sinon null. Un compte créé dans l'admin pour un prospect venu
 * d'Instagram garde ainsi le parcours, du clic au client.
 */
export async function originForEmail(email: string, given: unknown): Promise<string | null> {
  const fromVisit = parseOrigin(given);
  if (fromVisit) return fromVisit;
  const [row] = await db.select({ origin: site_requests.origin }).from(site_requests)
    .where(and(sql`lower(${site_requests.email}) = lower(${email.trim()})`, isNotNull(site_requests.origin)))
    .orderBy(desc(site_requests.created_at)).limit(1);
  return parseOrigin(row?.origin);
}
