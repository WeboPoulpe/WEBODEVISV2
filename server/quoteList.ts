'use server';

import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { formulaSql, lightServices } from './formulaColumns';
import { requireUser } from './session';

// Liste des devis et des modèles de devis (page /devis). Elle était lue par /api/db avec la colonne `services`
// entière : chaque ligne y embarque la description et les cartes HTML de la prestation, soit 7 Mo pour les 95 devis
// d'un traiteur, à chaque ouverture de la page. C'est ce qui a épuisé le transfert du plan gratuit de Neon le
// 26 novembre 2026. La liste n'a besoin que des noms, quantités et prix : lightServices retire le reste dans la base.
// Le devis complet (éditeur, duplication, « Utiliser » un modèle) est relu par son identifiant.
// Les lignes ont la même forme que par /api/db (row_to_json) : dates en texte, nombres en nombres.

/** Mêmes droits que la règle « quotes » de server/compat/rules.ts : les devis de l'entreprise. */
const quoteAccess = (uid: string) => sql`(q.user_id = ${uid} or q.owner_user_id = ${uid} or q.owner_user_id in (
  select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (
    select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))`;

export async function listQuotesLight<T = unknown>(): Promise<T[]> {
  const user = await requireUser();
  const res = await db.execute<{ data: T[] }>(sql`
    select coalesce(json_agg(row_to_json(q) order by q.created_at desc), '[]'::json) as data from (
      select q.id, q.quote_number, q.client_name, q.internal_name, q.event_type, q.event_date, q.guest_count,
        q.guest_count_adults, q.guest_count_children, q.status, q.total_amount, q.vat_rate, q.created_at, q.user_id,
        q.owner_user_id, ${lightServices('q.services')} as services, q.imported, q.imported_file_url, q.imported_file_name,
        q.prospect_id, q.client_first_name, q.client_last_name, q.client_email, q.folder_id, ${await formulaSql('q')}
      from public.quotes q where ${quoteAccess(user.id)}
    ) q`);
  return res.rows[0]?.data ?? [];
}

/** Modèles de devis de l'entreprise, lignes allégées (la liste n'en montre que les noms). */
export async function listQuoteTemplatesLight<T = unknown>(): Promise<T[]> {
  const user = await requireUser();
  const res = await db.execute<{ data: T[] }>(sql`
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) as data from (
      select d.id, d.name, d.template, d.created_at, ${lightServices('d.services')} as services, d.remarks, d.vat_rate, d.hide_price
      from public.devis_templates d where d.user_id in (
        select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (
          select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${user.id}::uuid))
    ) t`);
  return res.rows[0]?.data ?? [];
}
