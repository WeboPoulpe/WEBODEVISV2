import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, profiles, prospect_requests, quotes } from '@/db/schema';
import { defaultVatRate } from '@/lib/vat';
import { companyIdsOf } from '../companyScope';
import { quoteOfProspect } from './moreTools';

// Exécution des propositions « du reste du logiciel » (clients, prospects, stock, commandes, brochures, factures),
// une fois validées par le traiteur. Tout est revérifié ici, dans l'entreprise.

export interface MoreResult { href: string; label: string }
type User = { id: string };

const todayFr = () => new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

async function upsertCustomer(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const v = (k: string) => (p[k] == null ? null : String(p[k]));
  const note = v('note');
  if (p.customerId) {
    const [c] = await db.select().from(customers).where(and(eq(customers.id, String(p.customerId)), sql`${customers.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
    if (!c) throw new Error('Client introuvable.');
    await db.update(customers).set({
      ...(v('firstName') ? { first_name: v('firstName') } : {}), ...(v('lastName') ? { last_name: v('lastName') } : {}),
      ...(v('companyName') ? { company_name: v('companyName') } : {}), ...(v('contactName') ? { contact_person_name: v('contactName') } : {}),
      ...(v('email') ? { email: v('email')! } : {}), ...(v('phone') ? { phone: v('phone') } : {}), ...(v('address') ? { address: v('address') } : {}),
      ...(v('siret') ? { siret_number: v('siret') } : {}),
      // Note ajoutée à la suite, datée : les notes existantes ne sont jamais écrasées.
      ...(note ? { notes: sql`concat_ws(chr(10), nullif(${customers.notes}, ''), ${`${todayFr()} : ${note}`}::text)` } : {}),
      updated_at: new Date().toISOString(),
    }).where(eq(customers.id, c.id));
    return { href: '/clients', label: 'Voir les clients' };
  }
  const [row] = await db.insert(customers).values({
    owner_user_id: user.id, user_id: user.id, customer_type: v('type') === 'entreprise' ? 'entreprise' : 'particulier',
    first_name: v('firstName'), last_name: v('lastName'), company_name: v('companyName'), contact_person_name: v('contactName'),
    email: v('email')!, phone: v('phone'), address: v('address'), siret_number: v('siret'), notes: note ? `${todayFr()} : ${note}` : null,
  }).returning({ id: customers.id });
  return { href: `/clients?id=${row.id}`, label: 'Voir le client' };
}

async function setProspectStatus(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const id = String(p.prospectId);
  const status = String(p.status);
  await db.transaction(async (tx) => {
    // Qui change le statut du devis lié : lu par le déclencheur d'historique.
    await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);
    const [row] = await tx.update(prospect_requests).set({ status, updated_at: new Date().toISOString() })
      .where(and(eq(prospect_requests.id, id), sql`${prospect_requests.owner_user_id} in ${companyIdsOf(companyId)}`)).returning({ id: prospect_requests.id });
    if (!row) throw new Error('Demande introuvable.');
    await tx.update(quotes).set({ status }).where(and(eq(quotes.prospect_id, id), sql`${quotes.owner_user_id} in ${companyIdsOf(companyId)}`));
  });
  return { href: '/prospects', label: 'Voir les prospects' };
}

async function prospectToQuote(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const id = String(p.prospectId);
  const [pr] = await db.select().from(prospect_requests).where(and(eq(prospect_requests.id, id), sql`${prospect_requests.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  if (!pr) throw new Error('Demande introuvable.');
  if (await quoteOfProspect(companyId, id)) throw new Error('Cette demande a déjà son devis.');
  if (!pr.event_date) throw new Error('La demande n’a pas de date d’événement.');
  const email = pr.email.toLowerCase();
  let [c] = await db.select().from(customers).where(and(sql`lower(${customers.email}) = ${email}`, sql`${customers.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  if (!c) {
    [c] = await db.insert(customers).values({
      owner_user_id: user.id, user_id: user.id, customer_type: 'particulier', first_name: pr.first_name, last_name: pr.last_name, email, phone: pr.phone, address: pr.address,
    }).onConflictDoNothing().returning();
    if (!c) [c] = await db.select().from(customers).where(and(eq(customers.email, email), eq(customers.owner_user_id, user.id))).limit(1);
  }
  const [profile] = await db.select({ vat: profiles.default_vat_rate }).from(profiles).where(eq(profiles.id, companyId)).limit(1);
  const [q] = await db.insert(quotes).values({
    owner_user_id: user.id, user_id: user.id, customer_id: c?.id ?? null, prospect_id: id,
    client_name: `${pr.first_name} ${pr.last_name}`, client_first_name: pr.first_name, client_last_name: pr.last_name, client_email: email, client_phone: pr.phone, client_address: pr.address,
    event_type: pr.event_type || 'Autre', event_date: pr.event_date, guest_count: Math.max(1, pr.guest_count ?? 1),
    ...(pr.guest_count_children ? { guest_count_children: pr.guest_count_children } : {}),
    event_location: pr.service_address, remarks: pr.message, status: 'devis_a_faire', template: 'classique',
    vat_rate: String(defaultVatRate(profile ? { default_vat_rate: profile.vat } : null)), services: [], total_amount: '0', hide_price: false, language: 'fr',
  }).returning({ id: quotes.id });
  await db.update(prospect_requests).set({ status: 'devis_a_faire', updated_at: new Date().toISOString() }).where(eq(prospect_requests.id, id));
  return { href: `/devis/${q.id}/modifier?mode=weboword`, label: 'Ouvrir le devis' };
}

/** Exécute une proposition de ces modules ; null si la sorte n'en fait pas partie. */
export async function executeMore(kind: string, p: Record<string, unknown>, user: User, companyId: string): Promise<MoreResult | null> {
  switch (kind) {
    case 'customer_upsert': return upsertCustomer(user, companyId, p);
    case 'prospect_status': return setProspectStatus(user, companyId, p);
    case 'prospect_to_quote': return prospectToQuote(user, companyId, p);
    default: return null;
  }
}
