'use server';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { company_invitations, profiles, users } from '@/db/schema';
import { normalizeEmail } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { appOrigin, sendMail } from '@/lib/mail';
import { teamInviteEmail } from '@/lib/mail/templates';
import { COMPANY_ROLES, type CompanyRole } from '@/lib/team';
import { transferAccountData } from './accountPurge';
import { requireUser } from './session';

// Équipe d'une entreprise : le titulaire (ou un gérant) invite des collaborateurs, change leur rôle, les retire.
// Les collaborateurs partagent les données de l'entreprise (voir server/compat/rules.ts, companyMembers).

const INVITE_DAYS = 7;
const MIN_PASSWORD = 8;
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

type Result<T = object> = ({ error: null } & T) | { error: string };

/** L'entreprise de l'utilisateur et son droit de gérer l'équipe (titulaire ou gérant). */
async function teamContext(uid: string) {
  const [me] = await db.select({ parent: profiles.parent_user_id, role: profiles.company_role }).from(profiles).where(eq(profiles.id, uid)).limit(1);
  const company = me?.parent ?? uid;
  const isOwner = !me?.parent;
  return { company, isOwner, canManage: isOwner || me?.role === 'gerant' };
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: CompanyRole | 'titulaire';
  active: boolean;
  isMe: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: CompanyRole;
  expiresAt: string;
}

export async function getTeam(): Promise<{ canManage: boolean; members: TeamMember[]; invitations: TeamInvitation[]; seats: number; used: number } | null> {
  const user = await requireUser();
  const ctx = await teamContext(user.id);
  const rows = await db.select({
    id: profiles.id, email: profiles.email, first: profiles.first_name, last: profiles.last_name,
    parent: profiles.parent_user_id, role: profiles.company_role, active: profiles.is_active, seats: profiles.max_linked_users,
  }).from(profiles).where(sql`${profiles.id} = ${ctx.company}::uuid or ${profiles.parent_user_id} = ${ctx.company}::uuid`);
  const owner = rows.find((r) => r.id === ctx.company);
  const invitations = ctx.canManage
    ? await db.select().from(company_invitations).where(and(
      eq(company_invitations.company_id, ctx.company), isNull(company_invitations.accepted_at), gt(company_invitations.expires_at, new Date().toISOString()),
    ))
    : [];
  const members: TeamMember[] = rows
    .sort((a, b) => (a.id === ctx.company ? -1 : b.id === ctx.company ? 1 : a.email.localeCompare(b.email)))
    .map((r) => ({
      id: r.id, email: r.email, name: [r.first, r.last].filter(Boolean).join(' ') || r.email,
      role: r.id === ctx.company ? 'titulaire' : ((COMPANY_ROLES as readonly string[]).includes(r.role) ? r.role as CompanyRole : 'collaborateur'),
      active: r.active, isMe: r.id === user.id,
    }));
  const activeMembers = rows.filter((r) => r.id !== ctx.company && r.active).length;
  return {
    canManage: ctx.canManage,
    members,
    invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.company_role as CompanyRole, expiresAt: i.expires_at })),
    seats: owner?.seats ?? 1,
    used: activeMembers + invitations.length,
  };
}

export async function inviteMember(input: { email: string; role: CompanyRole }): Promise<Result> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const ctx = await teamContext(user.id);
  if (!ctx.canManage) return { error: 'Seul le titulaire ou un gérant peut inviter un collaborateur.' };
  const email = normalizeEmail(input.email ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'L’adresse email n’est pas valide.' };
  if (!(COMPANY_ROLES as readonly string[]).includes(input.role)) return { error: 'Choisissez un rôle.' };

  const team = await getTeam();
  if (team && team.used >= team.seats) {
    return { error: `Votre abonnement compte ${team.seats} collaborateur${team.seats > 1 ? 's' : ''} : retirez-en un ou contactez-nous pour en ajouter.` };
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: 'Cette adresse a déjà un compte WeboDevis. Écrivez-nous pour la rattacher à votre entreprise.' };

  const token = crypto.randomBytes(32).toString('base64url');
  await db.delete(company_invitations).where(and(eq(company_invitations.company_id, ctx.company), eq(company_invitations.email, email), isNull(company_invitations.accepted_at)));
  await db.insert(company_invitations).values({
    company_id: ctx.company, email, company_role: input.role, token_hash: hashToken(token), invited_by: user.id,
    expires_at: new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString(),
  });
  const [owner] = await db.select({ company: profiles.company_name, first: profiles.first_name }).from(profiles).where(eq(profiles.id, ctx.company)).limit(1);
  const [me] = await db.select({ first: profiles.first_name, last: profiles.last_name, email: profiles.email }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const sent = await sendMail({
    to: email, replyTo: me?.email,
    ...teamInviteEmail({
      companyName: owner?.company || 'votre entreprise',
      inviterName: [me?.first, me?.last].filter(Boolean).join(' ') || me?.email || 'Votre gérant',
      roleLabel: COMPANY_ROLE_LABEL[input.role],
      link: `${await appOrigin()}/invitation/${token}`,
      days: INVITE_DAYS,
    }),
  });
  if (sent.error) return { error: 'L’invitation est enregistrée, mais l’email n’est pas parti. Réessayez dans un instant.' };
  return { error: null };
}

const COMPANY_ROLE_LABEL: Record<CompanyRole, string> = { gerant: 'gérant', collaborateur: 'collaborateur', lecture: 'consultation' };

export async function revokeInvitation(id: string): Promise<Result> {
  const user = await requireUser();
  const ctx = await teamContext(user.id);
  if (!ctx.canManage) return { error: 'Seul le titulaire ou un gérant peut gérer l’équipe.' };
  await db.delete(company_invitations).where(and(eq(company_invitations.id, id), eq(company_invitations.company_id, ctx.company)));
  return { error: null };
}

async function memberOf(company: string, memberId: string) {
  const [m] = await db.select({ id: profiles.id, active: profiles.is_active }).from(profiles)
    .where(and(eq(profiles.id, memberId), eq(profiles.parent_user_id, company))).limit(1);
  return m ?? null;
}

export async function setMemberRole(memberId: string, role: CompanyRole): Promise<Result> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const ctx = await teamContext(user.id);
  if (!ctx.canManage) return { error: 'Seul le titulaire ou un gérant peut changer les rôles.' };
  if (!(COMPANY_ROLES as readonly string[]).includes(role)) return { error: 'Rôle inconnu.' };
  if (memberId === user.id) return { error: 'Vous ne pouvez pas changer votre propre rôle.' };
  if (!(await memberOf(ctx.company, memberId))) return { error: 'Ce collaborateur ne fait pas partie de votre entreprise.' };
  await db.update(profiles).set({ company_role: role }).where(eq(profiles.id, memberId));
  await logAudit({ actor: user.id, target: memberId, action: 'role_modifie', details: { equipe: role } });
  return { error: null };
}

/** Retire un collaborateur : ses données passent au titulaire, son accès est désactivé. */
export async function removeMember(memberId: string): Promise<Result> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const ctx = await teamContext(user.id);
  if (!ctx.canManage) return { error: 'Seul le titulaire ou un gérant peut retirer un collaborateur.' };
  if (memberId === user.id) return { error: 'Vous ne pouvez pas vous retirer vous-même.' };
  if (!(await memberOf(ctx.company, memberId))) return { error: 'Ce collaborateur ne fait pas partie de votre entreprise.' };
  await transferAccountData(memberId, ctx.company);
  await db.update(profiles).set({ is_active: false, parent_user_id: null, company_role: 'gerant' }).where(eq(profiles.id, memberId));
  await logAudit({ actor: user.id, target: memberId, action: 'compte_desactive', details: { equipe: 'retiré, données rendues au titulaire' } });
  return { error: null };
}

// ── Page d'invitation (publique, le jeton du lien est la seule clé) ─────────────

async function invitationByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{30,}$/.test(token ?? '')) return null;
  const [inv] = await db.select().from(company_invitations).where(eq(company_invitations.token_hash, hashToken(token))).limit(1);
  return inv ?? null;
}

export async function getInvitation(token: string): Promise<{ status: 'ok' | 'expired' | 'used' | 'unknown'; email?: string; companyName?: string; roleLabel?: string }> {
  const inv = await invitationByToken(token);
  if (!inv) return { status: 'unknown' };
  if (inv.accepted_at) return { status: 'used' };
  if (inv.expires_at < new Date().toISOString()) return { status: 'expired' };
  const [owner] = await db.select({ company: profiles.company_name }).from(profiles).where(eq(profiles.id, inv.company_id)).limit(1);
  return { status: 'ok', email: inv.email, companyName: owner?.company || 'l’entreprise', roleLabel: COMPANY_ROLE_LABEL[inv.company_role as CompanyRole] ?? 'collaborateur' };
}

export async function acceptInvitation(input: { token: string; firstName: string; lastName: string; password: string }): Promise<Result<{ email: string }>> {
  const inv = await invitationByToken(input.token);
  if (!inv || inv.accepted_at || inv.expires_at < new Date().toISOString()) return { error: 'Cette invitation n’est plus valable. Demandez-en une nouvelle.' };
  const firstName = (input.firstName ?? '').trim().slice(0, 80);
  const lastName = (input.lastName ?? '').trim().slice(0, 80);
  if (!firstName) return { error: 'Indiquez votre prénom.' };
  if ((input.password ?? '').length < MIN_PASSWORD) return { error: `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.` };
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, inv.email)).limit(1);
  if (existing) return { error: 'Cette adresse a déjà un compte WeboDevis. Connectez-vous, ou écrivez-nous.' };

  const [owner] = await db.select({ company: profiles.company_name }).from(profiles).where(eq(profiles.id, inv.company_id)).limit(1);
  const password_hash = await bcrypt.hash(input.password, 10);
  const newId = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email: inv.email, password_hash }).returning({ id: users.id });
    await tx.insert(profiles).values({
      id: u.id, email: inv.email, first_name: firstName, last_name: lastName || null,
      company_name: owner?.company ?? null, role: 'user', is_active: true, has_completed_onboarding: true,
      parent_user_id: inv.company_id, company_role: inv.company_role,
    });
    await tx.update(company_invitations).set({ accepted_at: new Date().toISOString() }).where(eq(company_invitations.id, inv.id));
    return u.id;
  });
  await logAudit({ actor: newId, target: inv.company_id, action: 'compte_cree', details: { equipe: inv.company_role, invitePar: inv.invited_by } });
  return { error: null, email: inv.email };
}
