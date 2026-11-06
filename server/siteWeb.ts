'use server';

// Onglet « Site web » : la vitrine des sites et logiciels Webomax, et la demande de rappel qui arrive dans
// /admin/demandes (site_requests, type « service ») et par e-mail. Voir lib/siteWeb.ts et la spec
// docs/superpowers/specs/2026-10-23-onglet-site-web-webomax-design.md.

import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { app_settings, profiles, site_requests } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { appOrigin, isTestAddress, sendMail } from '@/lib/mail';
import { siteServiceAckEmail, siteServiceNotificationEmail } from '@/lib/mail/templates';
import { hasModule } from '@/lib/modules';
import { answersText, parseCatalog, readAnswers, type SiteCatalog } from '@/lib/siteWeb';
import { requireAdmin, requireUser } from './session';

const CATALOG_KEY = 'site_web_catalog';
/** Demandes acceptées par heure et par entreprise. */
const MAX_PER_HOUR = 3;

export interface SiteWebPage {
  catalog: SiteCatalog;
  contact: { name: string; phone: string; email: string; company: string; logoUrl: string | null };
  /** Date de la dernière demande encore à traiter (nouvelle ou en cours), s'il y en a une. */
  pendingSince: string | null;
}

async function catalog(): Promise<SiteCatalog> {
  const [row] = await db.select({ value: app_settings.value }).from(app_settings).where(eq(app_settings.key, CATALOG_KEY)).limit(1);
  return parseCatalog(row?.value);
}

/**
 * L'entreprise de la personne connectée, si elle voit l'onglet : titulaire ou gérant (pas les employés), avec
 * l'option « Site web Webomax » active sur le compte principal.
 */
async function access(userId: string) {
  const [me] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!me) return null;
  if (me.parent_user_id && me.company_role !== 'gerant') return null;
  const companyId = me.parent_user_id ?? me.id;
  const [owner] = me.parent_user_id ? await db.select().from(profiles).where(eq(profiles.id, companyId)).limit(1) : [me];
  if (!owner || !hasModule(owner.modules, 'siteweb')) return null;
  return { me, owner, companyId };
}

/** La page de l'onglet ; null si la personne ne le voit pas. */
export async function getSiteWebPage(): Promise<SiteWebPage | null> {
  const user = await requireUser();
  const a = await access(user.id);
  if (!a) return null;
  const [pending] = await db.select({ at: site_requests.created_at }).from(site_requests)
    .where(and(eq(site_requests.user_id, a.companyId), eq(site_requests.kind, 'service'), inArray(site_requests.status, ['nouvelle', 'en_cours'])))
    .orderBy(desc(site_requests.created_at)).limit(1);
  return {
    catalog: await catalog(),
    contact: {
      name: [a.me.first_name, a.me.last_name].filter(Boolean).join(' '),
      phone: a.owner.company_phone ?? '',
      email: a.me.email,
      company: a.owner.company_name ?? '',
      // Deux colonnes de logo selon l'ancienneté du compte.
      logoUrl: a.owner.company_logo_url || a.owner.logo_url || null,
    },
    pendingSince: pending?.at ?? null,
  };
}

/** Envoie la demande de rappel : enregistrée pour l'admin, e-mail à Webomax, accusé de réception au traiteur. */
export async function submitSiteWebRequest(raw: unknown): Promise<{ error: string | null }> {
  const user = await requireUser();
  const a = await access(user.id);
  if (!a) return { error: 'Cette page n’est pas disponible pour votre compte.' };
  const cat = await catalog();
  const { answers, error } = readAnswers(raw, cat);
  if (error) return { error };
  // Démonstration : la page répond comme d'habitude, mais rien n'est enregistré ni envoyé.
  if (isDemoUser(a.companyId)) return { error: null };

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(site_requests)
    .where(and(eq(site_requests.user_id, a.companyId), eq(site_requests.kind, 'service'), gt(site_requests.created_at, new Date(Date.now() - 3600_000).toISOString())));
  if (n >= MAX_PER_HOUR) return { error: 'Vous avez déjà envoyé plusieurs demandes. Réessayez dans une heure.' };

  // Rattachée à l'entreprise ; on garde qui l'a envoyée.
  const full = { ...answers, sentBy: [a.me.first_name, a.me.last_name].filter(Boolean).join(' ') || a.me.email };
  const company = a.owner.company_name ?? null;
  const message = answersText(full, cat);
  await db.insert(site_requests).values({
    kind: 'service', name: full.name, email: full.email, phone: full.phone, company, message, user_id: a.companyId, answers: full,
  });

  if (isTestAddress(full.email)) return { error: null };
  // La demande est enregistrée : un e-mail qui ne part pas ne la fait pas échouer.
  try {
    const admins = process.env.CONTACT_EMAIL
      ? [process.env.CONTACT_EMAIL]
      : (await db.select({ email: profiles.email }).from(profiles).where(and(eq(profiles.role, 'admin'), eq(profiles.is_active, true)))).map((x) => x.email);
    const appUrl = await appOrigin();
    await Promise.all([
      ...admins.map((to) => sendMail({ to, replyTo: full.email, ...siteServiceNotificationEmail({ answers: full, catalog: cat, company, appUrl }) })),
      sendMail({ to: full.email, ...siteServiceAckEmail({ answers: full, catalog: cat }) }),
    ]);
  } catch (e) {
    console.error('[site-web] e-mails', e);
  }
  return { error: null };
}

// ── Administration ───────────────────────────────────────────────────────────

export async function getSiteWebCatalogAdmin(): Promise<SiteCatalog> {
  await requireAdmin();
  return catalog();
}

export async function saveSiteWebCatalog(raw: unknown): Promise<{ error: string | null }> {
  await requireAdmin();
  // Sans pack lisible, parseCatalog reprendrait la valeur initiale : on le dit plutôt que de tout remettre.
  const packs = (raw as { packs?: { name?: unknown }[] } | null)?.packs;
  if (!Array.isArray(packs) || !packs.some((p) => typeof p?.name === 'string' && p.name.trim())) return { error: 'Gardez au moins un pack, avec son nom.' };
  const value = parseCatalog(raw);
  await db.insert(app_settings).values({ key: CATALOG_KEY, value })
    .onConflictDoUpdate({ target: app_settings.key, set: { value, updated_at: new Date().toISOString() } });
  return { error: null };
}
