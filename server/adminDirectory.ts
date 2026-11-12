'use server';

// Validation des fiches de l'annuaire « Choisir Mon Traiteur » par l'équipe : file des fiches à vérifier, décisions
// (valider, refuser, suspendre, republier), e-mail au titulaire et trace au journal.

import { and, eq, inArray, sql } from 'drizzle-orm';
import { logAudit, type AuditAction } from '@/lib/audit';
import { db } from '@/db';
import { directory_listings, profiles } from '@/db/schema';
import type { CheckResult } from '@/lib/annuaire/companyCheck';
import type { ListingStatus } from '@/lib/annuaire/listing';
import { sendMail } from '@/lib/mail';
import { listingDecisionEmail } from '@/lib/mail/templates';
import { requireAdmin } from './session';

export interface AdminListing {
  companyId: string;
  slug: string;
  status: ListingStatus;
  displayName: string;
  city: string | null;
  postalCode: string | null;
  siret: string | null;
  check: CheckResult | null;
  ownerEmail: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  /** Fiche en ligne modifiée par le traiteur après sa dernière validation. */
  modifiedSinceValidation: boolean;
  coverUrl: string | null;
  photoCount: number;
  refusedReason: string | null;
}

export type ListingDecision = 'valider' | 'refuser' | 'suspendre' | 'republier';

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

/** Les fiches envoyées à la validation (les brouillons ne regardent pas l'équipe), les plus récemment envoyées d'abord. */
export async function listAdminListings(): Promise<AdminListing[]> {
  await requireAdmin();
  const { rows } = await db.execute(sql`
    select l.company_id, l.slug, l.status, l.display_name, l.city, l.postal_code, l.siret, l.check_result,
      coalesce(p.company_email, p.email) as owner_email,
      l.submitted_at, l.published_at, l.validated_at, l.updated_at, l.refused_reason,
      (select url from public.directory_photos where id = l.cover_photo_id) as cover_url,
      (select count(*)::int from public.directory_photos ph where ph.company_id = l.company_id) as photo_count
    from public.directory_listings l
    left join public.profiles p on p.id = l.company_id
    where l.status <> 'brouillon'
    order by l.submitted_at desc nulls last, l.updated_at desc`);
  type Raw = {
    company_id: string; slug: string; status: ListingStatus; display_name: string; city: string | null; postal_code: string | null;
    siret: string | null; check_result: CheckResult | null; owner_email: string | null; submitted_at: string | null; published_at: string | null;
    validated_at: string | null; updated_at: string; refused_reason: string | null; cover_url: string | null; photo_count: number;
  };
  const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);
  return (rows as unknown as Raw[]).map((r) => ({
    companyId: r.company_id,
    slug: r.slug,
    status: r.status,
    displayName: r.display_name,
    city: r.city,
    postalCode: r.postal_code,
    siret: r.siret,
    check: r.check_result,
    ownerEmail: r.owner_email,
    submittedAt: iso(r.submitted_at),
    publishedAt: iso(r.published_at),
    updatedAt: iso(r.updated_at)!,
    modifiedSinceValidation: r.status === 'publiee' && ms(r.updated_at) > ms(r.validated_at),
    coverUrl: r.cover_url,
    photoCount: Number(r.photo_count),
    refusedReason: r.refused_reason,
  }));
}

/** Nombre de fiches qui attendent une décision (pastille du menu). */
export async function pendingListingCount(): Promise<number> {
  await requireAdmin();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(directory_listings).where(eq(directory_listings.status, 'en_attente'));
  return Number(n);
}

const FROM: Record<ListingDecision, ListingStatus[]> = {
  valider: ['en_attente'],
  refuser: ['en_attente'],
  suspendre: ['publiee'],
  republier: ['suspendue', 'refusee'],
};
const AUDIT: Record<ListingDecision, AuditAction> = {
  valider: 'annuaire_fiche_validee',
  refuser: 'annuaire_fiche_refusee',
  suspendre: 'annuaire_fiche_suspendue',
  republier: 'annuaire_fiche_republiee',
};
const REASON_MAX = 500;

export async function decideListing(companyId: string, decision: ListingDecision, reason?: string): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (!(decision in FROM)) return { error: 'Cette décision n’existe pas.' };
  const why = String(reason ?? '').trim().slice(0, REASON_MAX);
  if ((decision === 'refuser' || decision === 'suspendre') && !why) return { error: 'Indiquez le motif : il sera transmis au traiteur.' };

  const [current] = await db.select({ status: directory_listings.status }).from(directory_listings).where(eq(directory_listings.company_id, companyId)).limit(1);
  if (!current) return { error: 'Cette fiche est introuvable.' };
  if (!FROM[decision].includes(current.status as ListingStatus)) {
    return { error: 'Cette décision n’est pas possible pour l’état actuel de la fiche. Rechargez la page.' };
  }

  const at = new Date().toISOString();
  const publishes = decision === 'valider' || decision === 'republier';
  const changes = publishes
    ? {
      status: 'publiee', validated_at: at, updated_at: at, refused_reason: null,
      published_at: sql`coalesce(${directory_listings.published_at}, ${at})`,
    }
    : { status: decision === 'refuser' ? 'refusee' : 'suspendue', refused_reason: why };
  // La condition sur l'état d'origine tient la transition même si deux administrateurs décident en même temps.
  const done = await db.update(directory_listings).set(changes)
    .where(and(eq(directory_listings.company_id, companyId), inArray(directory_listings.status, FROM[decision])))
    .returning({ id: directory_listings.company_id });
  if (done.length === 0) return { error: 'La fiche vient d’être traitée par quelqu’un d’autre. Rechargez la page.' };

  await logAudit({ actor: admin.id, target: companyId, action: AUDIT[decision], details: why && !publishes ? { companyId, reason: why } : { companyId } });

  // Le titulaire est prévenu ; une panne de messagerie ne défait pas la décision.
  try {
    const [owner] = await db.select({ email: profiles.email, companyEmail: profiles.company_email }).from(profiles).where(eq(profiles.id, companyId)).limit(1);
    const to = owner?.companyEmail?.trim() || owner?.email;
    if (to) {
      const mail = listingDecisionEmail({ decision, reason: why || null });
      await sendMail({ to, subject: mail.subject, html: mail.html });
    }
  } catch (e) {
    console.error('[annuaire] e-mail de décision', e);
  }
  return { error: null };
}
