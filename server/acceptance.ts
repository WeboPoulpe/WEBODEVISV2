'use server';

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { notifications, profiles, quote_acceptances, quotes } from '@/db/schema';
import { appOrigin, sendMail } from '@/lib/mail';
import { quoteAcceptedClientEmail, quoteAcceptedOwnerEmail, type AcceptanceDetails } from '@/lib/mail/templates';
import { isPending } from '@/lib/quoteStatus';
import { quoteTotalTTC } from '@/lib/quoteTotals';
import { getSessionUser } from './session';

// « Bon pour accord » en ligne : le client accepte et signe le devis depuis le lien reçu (/d/<jeton>).
// Signature électronique simple : nom, case d'acceptation, signature tracée, horodatage serveur, adresse IP,
// navigateur et empreinte du devis accepté. Le jeton du lien est la seule clé : aucune session n'est requise.

const TOKEN = /^[A-Za-z0-9_-]{16,}$/;
const MAX_SIGNATURE = 300_000;
const MAX_PER_HOUR = 5;

type QuoteRow = typeof quotes.$inferSelect;

/** Empreinte de ce que le client accepte : lignes, document, TVA, couverts, date. */
function contentHash(q: QuoteRow): string {
  const content = {
    services: q.services, content_html: q.content_html, vat_rate: q.vat_rate, event_date: q.event_date,
    guest_count: q.guest_count, guest_count_adults: q.guest_count_adults, guest_count_children: q.guest_count_children,
  };
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

const today = () => new Date().toISOString().slice(0, 10);

export interface PublicAcceptance {
  signerName: string;
  signerRole: string | null;
  signature: string;
  acceptedAt: string;
}

export interface AcceptanceState {
  /** Le bloc « Accepter ce devis » est proposé. */
  canAccept: boolean;
  expired: boolean;
  validUntil: string | null;
  acceptance: PublicAcceptance | null;
  isCompany: boolean;
}

async function quoteByToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const [q] = await db.select().from(quotes).where(eq(quotes.share_token, token)).limit(1);
  return q ?? null;
}

async function activeAcceptance(quoteId: string) {
  const [a] = await db.select().from(quote_acceptances)
    .where(and(eq(quote_acceptances.quote_id, quoteId), isNull(quote_acceptances.invalidated_at)))
    .orderBy(desc(quote_acceptances.accepted_at)).limit(1);
  return a ?? null;
}

/** Ce que la page publique doit montrer : bouton d'acceptation, devis expiré ou déjà accepté. */
export async function acceptanceState(token: string): Promise<AcceptanceState | null> {
  const q = await quoteByToken(token);
  if (!q) return null;
  const a = await activeAcceptance(q.id);
  const expired = !!q.valid_until && q.valid_until < today();
  return {
    canAccept: !a && !expired && isPending(q.status),
    expired: !a && expired && isPending(q.status),
    validUntil: q.valid_until,
    acceptance: a ? { signerName: a.signer_name, signerRole: a.signer_role, signature: a.signature, acceptedAt: a.accepted_at } : null,
    isCompany: q.client_type === 'entreprise',
  };
}

/** Compte une consultation du lien, sauf quand c'est le traiteur lui-même qui l'ouvre. */
export async function recordQuoteView(token: string): Promise<void> {
  const q = await quoteByToken(token);
  if (!q) return;
  const viewer = await getSessionUser().catch(() => null);
  if (viewer && (viewer.id === q.owner_user_id || viewer.id === q.user_id)) return;
  await db.update(quotes).set({
    view_count: sql`${quotes.view_count} + 1`,
    viewed_at: sql`coalesce(${quotes.viewed_at}, now())`,
  }).where(eq(quotes.id, q.id));
  // Historique : une consultation notée au plus toutes les 6 heures (un client qui rouvre le lien dix fois n'en fait pas dix lignes).
  await db.execute(sql`insert into public.quote_events (quote_id, kind)
    select ${q.id}::uuid, 'consultation'
    where not exists (select 1 from public.quote_events e where e.quote_id = ${q.id}::uuid and e.kind = 'consultation' and e.created_at > now() - interval '6 hours')`)
    .catch(() => {});
}

export async function acceptQuote(input: {
  token: string;
  signerName: string;
  signerRole?: string | null;
  signature: string;
  acceptTerms: boolean;
}): Promise<{ error: string | null }> {
  const q = await quoteByToken(input.token);
  if (!q) return { error: 'Ce lien n’est plus valable. Demandez un nouveau lien à votre traiteur.' };

  const name = (input.signerName ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const role = (input.signerRole ?? '').trim().slice(0, 120) || null;
  if (name.length < 2) return { error: 'Indiquez vos prénom et nom.' };
  if (!input.acceptTerms) return { error: 'Cochez la case pour accepter le devis et les conditions de vente.' };
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.signature ?? '') || input.signature.length < 200) return { error: 'Signez dans le cadre prévu.' };
  if (input.signature.length > MAX_SIGNATURE) return { error: 'La signature est trop lourde. Effacez-la et signez à nouveau.' };

  if (await activeAcceptance(q.id)) return { error: 'Ce devis est déjà accepté.' };
  if (!isPending(q.status)) return { error: 'Ce devis ne peut plus être accepté en ligne. Contactez votre traiteur.' };
  if (q.valid_until && q.valid_until < today()) return { error: 'Ce devis a expiré. Contactez votre traiteur pour en recevoir un à jour.' };

  // Limite contre les envois répétés sur un même lien.
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(quote_acceptances)
    .where(and(eq(quote_acceptances.quote_id, q.id), gt(quote_acceptances.accepted_at, new Date(Date.now() - 3600_000).toISOString())));
  if (n >= MAX_PER_HOUR) return { error: 'Trop de tentatives. Réessayez dans une heure.' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const ua = h.get('user-agent')?.slice(0, 300) ?? null;
  const owner = q.owner_user_id ?? q.user_id!;
  const total = quoteTotalTTC(q);

  const accepted = await db.transaction(async (tx) => {
    const [row] = await tx.insert(quote_acceptances).values({
      quote_id: q.id, signer_name: name, signer_role: role, signature: input.signature,
      content_hash: contentHash(q), total_ttc: total, ip, user_agent: ua,
    }).returning({ at: quote_acceptances.accepted_at });
    // L'historique des statuts attribue le changement au traiteur (le client n'a pas de compte).
    await tx.execute(sql`select set_config('app.user_id', ${owner}, true)`);
    await tx.update(quotes).set({ status: 'valide', updated_at: new Date().toISOString() }).where(eq(quotes.id, q.id));
    await tx.insert(notifications).values({
      user_id: owner, type: 'quote_accepted', priority: 'high',
      title: `Devis accepté par ${name}`,
      message: `${name} a accepté et signé en ligne le devis${q.quote_number ? ` n° ${q.quote_number}` : ''}${q.event_type ? ` (${q.event_type})` : ''}.`,
      action_url: '/devis',
    });
    return row.at;
  });

  // Emails : ils ne bloquent pas l'acceptation s'ils ne partent pas.
  const [p] = await db.select({ company: profiles.company_name, email: profiles.email, companyEmail: profiles.company_email })
    .from(profiles).where(eq(profiles.id, owner)).limit(1);
  const origin = await appOrigin();
  const details: AcceptanceDetails = {
    companyName: p?.company || 'Votre traiteur', quoteNumber: q.quote_number, signerName: name,
    eventType: q.event_type, eventDate: q.event_date, totalTTC: total, acceptedAt: accepted,
  };
  if (p?.email) await sendMail({ to: p.companyEmail || p.email, ...quoteAcceptedOwnerEmail({ acceptance: details, link: `${origin}/devis` }) });
  if (q.client_email) {
    await sendMail({
      to: q.client_email, fromName: details.companyName, replyTo: p?.companyEmail || p?.email || undefined,
      ...quoteAcceptedClientEmail({ acceptance: details, link: `${origin}/d/${input.token}` }),
    });
  }
  return { error: null };
}
