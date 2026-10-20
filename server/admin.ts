'use server';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { desc, eq, sql } from 'drizzle-orm';
import { AUDIT_LABELS, logAudit, type AuditAction } from '@/lib/audit';
import { db } from '@/db';
import { password_reset_tokens, profiles, site_requests, users } from '@/db/schema';
import { normalizeEmail } from '@/lib/auth';
import { DEMO_USER_ID } from '@/lib/demo';
import { enabledModules } from '@/lib/modules';
import { appOrigin, sendMail } from '@/lib/mail';
import { accountInviteEmail, passwordResetEmail } from '@/lib/mail/templates';
import { revalidateTag } from 'next/cache';
import { getAppSettings, SETTINGS_TAG, setAppSetting, type AppSettings } from './settings';
import { requireAdmin } from './session';

// Espace d'administration de la plateforme. Chaque action commence par requireAdmin() :
// c'est la seule barrière, le navigateur n'est jamais cru sur parole.

const HOUR = 3600_000;
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

async function createPasswordLink(userId: string, ttlMs: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.insert(password_reset_tokens).values({
    token_hash: hashToken(token),
    user_id: userId,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  });
  return `${await appOrigin()}/reset-password?token=${token}`;
}

// ── Vue d'ensemble ────────────────────────────────────────────────────────────
export interface AdminOverview {
  accounts: number;
  activeAccounts: number;
  newAccounts30d: number;
  quotes: number;
  quotes30d: number;
  pendingRequests: number;
  /** Usage : comptes vus dans l'app sur 7 et 30 jours, titulaires ayant envoyé au moins un devis, comptes à relancer. */
  seen7d: number;
  seen30d: number;
  owners: number;
  activated: number;
  atRisk: { id: string; name: string; email: string; last_seen_at: string | null }[];
  recentAccounts: { id: string; name: string; email: string; created_at: string }[];
  recentRequests: { id: string; kind: string; name: string; company: string | null; status: string; created_at: string }[];
}

/** Titulaires actifs qui ne sont pas venus depuis 30 jours (ou jamais, après 14 jours) : à rappeler. */
async function accountsAtRisk(): Promise<AdminOverview['atRisk']> {
  const { rows } = await db.execute(sql`
    select p.id, p.email, p.last_seen_at, coalesce(p.company_name, nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email) as name
    from public.profiles p
    where p.id <> ${DEMO_USER_ID} and p.parent_user_id is null and p.role = 'user' and p.is_active and p.deletion_requested_at is null
      and ((p.last_seen_at is null and p.created_at < now() - interval '14 days') or p.last_seen_at < now() - interval '30 days')
    order by p.last_seen_at nulls first limit 10`);
  return (rows as unknown as AdminOverview['atRisk']).map((r) => ({ ...r, last_seen_at: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null }));
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  // Le compte de démonstration n'est pas un client : il est exclu des chiffres.
  const { rows } = await db.execute(sql`
    select
      (select count(*)::int from public.profiles where id <> ${DEMO_USER_ID}) as accounts,
      (select count(*)::int from public.profiles where id <> ${DEMO_USER_ID} and is_active) as active_accounts,
      (select count(*)::int from public.profiles where id <> ${DEMO_USER_ID} and created_at > now() - interval '30 days') as new_accounts,
      (select count(*)::int from public.quotes where owner_user_id <> ${DEMO_USER_ID}) as quotes,
      (select count(*)::int from public.quotes where owner_user_id <> ${DEMO_USER_ID} and created_at > now() - interval '30 days') as quotes_30d,
      (select count(*)::int from public.site_requests where status = 'nouvelle') as pending_requests,
      (select count(*)::int from public.profiles where id <> ${DEMO_USER_ID} and last_seen_at > now() - interval '7 days') as seen_7d,
      (select count(*)::int from public.profiles where id <> ${DEMO_USER_ID} and last_seen_at > now() - interval '30 days') as seen_30d,
      (select count(*)::int from public.profiles where id <> ${DEMO_USER_ID} and parent_user_id is null and role = 'user') as owners,
      (select count(*)::int from public.profiles p where p.id <> ${DEMO_USER_ID} and p.parent_user_id is null and p.role = 'user'
         and exists (select 1 from public.quotes q where q.sent_at is not null and q.owner_user_id in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = p.id))) as activated`);
  const c = rows[0] as Record<string, number>;

  const recentAccounts = await db
    .select({ id: profiles.id, first_name: profiles.first_name, last_name: profiles.last_name, company_name: profiles.company_name, email: profiles.email, created_at: profiles.created_at })
    .from(profiles).where(sql`${profiles.id} <> ${DEMO_USER_ID}`).orderBy(desc(profiles.created_at)).limit(5);
  const recentRequests = await db
    .select({ id: site_requests.id, kind: site_requests.kind, name: site_requests.name, company: site_requests.company, status: site_requests.status, created_at: site_requests.created_at })
    .from(site_requests).orderBy(desc(site_requests.created_at)).limit(5);

  return {
    accounts: c.accounts, activeAccounts: c.active_accounts, newAccounts30d: c.new_accounts,
    quotes: c.quotes, quotes30d: c.quotes_30d, pendingRequests: c.pending_requests,
    seen7d: c.seen_7d, seen30d: c.seen_30d, owners: c.owners, activated: c.activated,
    atRisk: await accountsAtRisk(),
    recentAccounts: recentAccounts.map((a) => ({
      id: a.id, email: a.email, created_at: a.created_at,
      name: a.company_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
    })),
    recentRequests,
  };
}

// ── Comptes ───────────────────────────────────────────────────────────────────
export interface AdminAccount {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  /** Options actives du compte (clés de lib/modules.ts). */
  modules: string[];
  is_demo: boolean;
  is_self: boolean;
  created_at: string;
  quotes: number;
  customers: number;
  last_quote_at: string | null;
  /** Suppression demandée par le titulaire (purge 30 jours plus tard). */
  deletion_requested_at: string | null;
  /** Dernière activité dans l'app. */
  last_seen_at: string | null;
}

export async function listAccounts(): Promise<AdminAccount[]> {
  const admin = await requireAdmin();
  const { rows } = await db.execute(sql`
    select p.id, p.email, p.first_name, p.last_name, p.company_name, p.role, p.is_active, p.modules, p.created_at, p.deletion_requested_at, p.last_seen_at,
           (select count(*)::int from public.quotes q where q.owner_user_id = p.id) as quotes,
           (select count(*)::int from public.customers c where c.owner_user_id = p.id) as customers,
           (select max(q.updated_at) from public.quotes q where q.owner_user_id = p.id) as last_quote_at
    from public.profiles p
    order by p.created_at desc`);
  return (rows as unknown as Omit<AdminAccount, 'is_demo' | 'is_self'>[]).map((r) => ({
    ...r,
    modules: enabledModules(r.modules),
    created_at: new Date(r.created_at).toISOString(),
    last_quote_at: r.last_quote_at ? new Date(r.last_quote_at).toISOString() : null,
    deletion_requested_at: r.deletion_requested_at ? new Date(r.deletion_requested_at).toISOString() : null,
    last_seen_at: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
    is_demo: r.id === DEMO_USER_ID,
    is_self: r.id === admin.id,
  }));
}

type Result = { error: string | null };

/** Garde-fous communs : on ne modifie ni son propre compte ni celui de la démonstration depuis la liste. */
function guard(adminId: string, targetId: string): string | null {
  if (targetId === adminId) return 'Vous ne pouvez pas modifier votre propre compte ici.';
  if (targetId === DEMO_USER_ID) return 'Le compte de démonstration ne se modifie pas.';
  return null;
}

export async function setAccountActive(id: string, active: boolean): Promise<Result> {
  const admin = await requireAdmin();
  const blocked = guard(admin.id, id);
  if (blocked) return { error: blocked };
  await db.update(profiles).set({ is_active: active }).where(eq(profiles.id, id));
  await logAudit({ actor: admin.id, target: id, action: active ? 'compte_reactive' : 'compte_desactive' });
  return { error: null };
}

export async function setAccountRole(id: string, role: 'admin' | 'user'): Promise<Result> {
  const admin = await requireAdmin();
  const blocked = guard(admin.id, id);
  if (blocked) return { error: blocked };
  await db.update(profiles).set({ role: role === 'admin' ? 'admin' : 'user' }).where(eq(profiles.id, id));
  await logAudit({ actor: admin.id, target: id, action: 'role_modifie', details: { role } });
  return { error: null };
}

/** Crée un compte et envoie à la personne un lien pour choisir son mot de passe. */
export async function createAccount(input: { email: string; firstName: string; lastName: string; companyName: string; modules: string[] }): Promise<Result> {
  const admin = await requireAdmin();
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'L’adresse email n’est pas valide.' };
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: 'Un compte existe déjà avec cette adresse.' };

  // Mot de passe provisoire que personne ne connaît : le compte s'ouvre par le lien envoyé.
  const password_hash = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, password_hash }).returning({ id: users.id });
    await tx.insert(profiles).values({
      id: user.id, email,
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      company_name: input.companyName.trim() || null,
      role: 'user', is_active: true, has_completed_onboarding: false,
      modules: enabledModules(input.modules),
    });
    return user.id;
  });
  await logAudit({ actor: admin.id, target: userId, action: 'compte_cree', details: { email } });
  const link = await createPasswordLink(userId, 7 * 24 * HOUR);
  const sent = await sendMail({ to: email, ...accountInviteEmail({ firstName: input.firstName.trim() || null, link }) });
  return sent.error ? { error: 'Le compte est créé, mais l’email d’invitation n’est pas parti. Utilisez « Envoyer un lien de mot de passe ».' } : { error: null };
}

/** Identité et options d'un compte. */
export async function updateAccount(id: string, patch: { firstName: string; lastName: string; companyName: string; modules: string[] }): Promise<Result> {
  const admin = await requireAdmin();
  if (id === DEMO_USER_ID) return { error: 'Le compte de démonstration ne se modifie pas.' };
  await db.update(profiles).set({
    first_name: patch.firstName.trim() || null,
    last_name: patch.lastName.trim() || null,
    company_name: patch.companyName.trim() || null,
    modules: enabledModules(patch.modules),
  }).where(eq(profiles.id, id));
  await logAudit({ actor: admin.id, target: id, action: 'compte_modifie', details: { modules: enabledModules(patch.modules) } });
  return { error: null };
}

export async function sendAccountPasswordLink(id: string): Promise<Result> {
  const admin = await requireAdmin();
  if (id === DEMO_USER_ID) return { error: 'Le compte de démonstration n’a pas de mot de passe.' };
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  if (!user) return { error: 'Compte introuvable.' };
  const link = await createPasswordLink(id, HOUR);
  await logAudit({ actor: admin.id, target: id, action: 'lien_mot_de_passe' });
  return sendMail({ to: user.email, ...passwordResetEmail({ link }) });
}

/** Suppression définitive, réservée aux comptes vides (inscriptions d'essai, doublons). */
export async function deleteEmptyAccount(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const blocked = guard(admin.id, id);
  if (blocked) return { error: blocked };
  const { rows } = await db.execute(sql`
    select (select count(*)::int from public.quotes where owner_user_id = ${id} or user_id = ${id}) as quotes,
           (select count(*)::int from public.customers where owner_user_id = ${id}) as customers`);
  const counts = rows[0] as { quotes: number; customers: number };
  if (counts.quotes > 0 || counts.customers > 0) {
    return { error: 'Ce compte contient des devis ou des clients : désactivez-le plutôt que de le supprimer.' };
  }
  try {
    await db.delete(users).where(eq(users.id, id));
    await logAudit({ actor: admin.id, target: id, action: 'compte_supprime' });
    return { error: null };
  } catch {
    return { error: 'Ce compte a encore des données rattachées : désactivez-le plutôt que de le supprimer.' };
  }
}

// ── Demandes du site ──────────────────────────────────────────────────────────
export type SiteRequestStatus = 'nouvelle' | 'en_cours' | 'traitee';
export type AdminSiteRequest = Omit<typeof site_requests.$inferSelect, 'ip_hash'>;

export async function listSiteRequests(): Promise<AdminSiteRequest[]> {
  await requireAdmin();
  const rows = await db.select().from(site_requests).orderBy(desc(site_requests.created_at)).limit(500);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return rows.map(({ ip_hash, ...rest }) => rest);
}

export async function updateSiteRequest(id: string, patch: { status?: SiteRequestStatus; admin_notes?: string }): Promise<Result> {
  await requireAdmin();
  const set: Partial<typeof site_requests.$inferInsert> = {};
  if (patch.status && ['nouvelle', 'en_cours', 'traitee'].includes(patch.status)) {
    set.status = patch.status;
    set.handled_at = patch.status === 'traitee' ? new Date().toISOString() : null;
  }
  if (typeof patch.admin_notes === 'string') set.admin_notes = patch.admin_notes.trim().slice(0, 4000) || null;
  if (Object.keys(set).length === 0) return { error: null };
  await db.update(site_requests).set(set).where(eq(site_requests.id, id));
  return { error: null };
}

export async function deleteSiteRequest(id: string): Promise<Result> {
  await requireAdmin();
  await db.delete(site_requests).where(eq(site_requests.id, id));
  return { error: null };
}

// ── Réglages ──────────────────────────────────────────────────────────────────
export async function getAdminSettings(): Promise<AppSettings> {
  await requireAdmin();
  return getAppSettings();
}

export async function setSignupOpen(open: boolean): Promise<Result> {
  await requireAdmin();
  await setAppSetting('signup_open', !!open);
  // Le site public affiche ou retire « Créer un compte » aussitôt.
  revalidateTag(SETTINGS_TAG);
  return { error: null };
}

// ── Journal ───────────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string;
  action: string;
  label: string;
  actor: string | null;
  target: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/** Les 300 dernières actions sensibles, avec l'email de leur auteur et du compte concerné. */
export async function listAuditLog(): Promise<AuditEntry[]> {
  await requireAdmin();
  const { rows } = await db.execute(sql`
    select a.id, a.action, a.details, a.created_at, pa.email as actor, pt.email as target
    from public.audit_log a
    left join public.profiles pa on pa.id = a.actor_id
    left join public.profiles pt on pt.id = a.target_user_id
    order by a.created_at desc limit 300`);
  return (rows as unknown as Omit<AuditEntry, 'label'>[]).map((r) => ({
    ...r,
    label: AUDIT_LABELS[r.action as AuditAction] ?? r.action,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

// ── Journal d'erreurs ─────────────────────────────────────────────────────────
export interface AdminErrorGroup {
  fingerprint: string;
  source: 'navigateur' | 'serveur';
  message: string;
  stack: string | null;
  last_path: string | null;
  last_user: string | null;
  last_user_agent: string | null;
  digest: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
}

export async function listErrorGroups(): Promise<AdminErrorGroup[]> {
  await requireAdmin();
  const { rows } = await db.execute(sql`
    select g.fingerprint, g.source, g.message, g.stack, g.last_path, g.last_user_agent, g.digest, g.count,
      g.first_seen, g.last_seen, g.resolved_at, p.email as last_user
    from public.error_groups g left join public.profiles p on p.id = g.last_user_id
    order by g.resolved_at is not null, g.last_seen desc limit 200`);
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return (rows as unknown as AdminErrorGroup[]).map((r) => ({ ...r, first_seen: iso(r.first_seen)!, last_seen: iso(r.last_seen)!, resolved_at: iso(r.resolved_at) }));
}

/** Marque une erreur comme résolue (ou la rouvre). Si elle revient, l'équipe est prévenue de nouveau. */
export async function setErrorResolved(fingerprint: string, resolved: boolean): Promise<Result> {
  await requireAdmin();
  await db.execute(sql`update public.error_groups set resolved_at = ${resolved ? sql`now()` : sql`null`} where fingerprint = ${fingerprint}`);
  return { error: null };
}
