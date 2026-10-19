'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { document_counters, profiles } from '@/db/schema';
import type { DocumentKind } from '@/lib/numbering';
import { requireUser } from './session';

/** Derniers numéros attribués par l'entreprise de l'utilisateur, pour l'aperçu des formats dans Paramètres. */
export async function getLastDocumentNumbers(): Promise<Record<DocumentKind, { year: number; none: number }>> {
  const user = await requireUser();
  const [me] = await db.select({ parent: profiles.parent_user_id }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const company = me?.parent ?? user.id;
  const year = new Date().getFullYear();
  const rows = await db.select().from(document_counters)
    .where(and(eq(document_counters.owner_user_id, company), inArray(document_counters.year, [year, 0])));
  const last = (kind: DocumentKind, y: number) => rows.find((r) => r.kind === kind && r.year === y)?.last_value ?? 0;
  return {
    quote: { year: last('quote', year), none: last('quote', 0) },
    invoice: { year: last('invoice', year), none: last('invoice', 0) },
    credit: { year: last('credit', year), none: last('credit', 0) },
  };
}
