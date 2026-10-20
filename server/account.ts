'use server';

import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, users } from '@/db/schema';
import { authOptions } from '@/lib/auth';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { appOrigin, sendMail } from '@/lib/mail';
import { accountDeletionAdminEmail, accountDeletionEmail } from '@/lib/mail/templates';
import { DELETION_DELAY_DAYS, purgeAccountNow } from './accountPurge';
import { requireAdmin } from './session';
import { logAudit } from '@/lib/audit';

// Suppression du compte par son titulaire (droit à l'effacement, art. 17 du RGPD). La demande désactive le compte
// tout de suite ; les données sont purgées 30 jours plus tard (tâche planifiée), le temps de revenir sur une erreur.


export async function requestAccountDeletion(input: { password: string; confirmText: string }): Promise<{ error: string | null; purgeOn?: string }> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { error: 'Votre session a expiré. Reconnectez-vous puis recommencez.' };
  if (isDemoUser(userId)) return { error: DEMO_BLOCKED };
  if (session.actingAsAdmin) return { error: 'Vous êtes dans le compte d’un client : seul son titulaire peut demander sa suppression.' };
  if (input.confirmText.trim().toUpperCase() !== 'SUPPRIMER') return { error: 'Écrivez SUPPRIMER pour confirmer.' };

  const [me] = await db.select({ email: users.email, hash: users.password_hash, role: profiles.role, parent: profiles.parent_user_id, first: profiles.first_name })
    .from(users).leftJoin(profiles, eq(profiles.id, users.id)).where(eq(users.id, userId)).limit(1);
  if (!me) return { error: 'Compte introuvable.' };
  if (me.role === 'admin') return { error: 'Un compte administrateur ne se supprime pas depuis ici.' };
  // Un collaborateur rattaché crée des devis pour l'entreprise : sa suppression emporterait des données de l'entreprise.
  if (me.parent) return { error: 'Votre compte est rattaché à une entreprise : demandez à son titulaire de vous retirer.' };
  if (!(await bcrypt.compare(input.password ?? '', me.hash))) return { error: 'Le mot de passe n’est pas le bon.' };

  const now = new Date();
  await db.update(profiles).set({ is_active: false, deletion_requested_at: now.toISOString() }).where(eq(profiles.id, userId));
  const purgeOn = new Date(now.getTime() + DELETION_DELAY_DAYS * 86400_000).toISOString().slice(0, 10);
  await logAudit({ actor: userId, target: userId, action: 'suppression_demandee', details: { purgeOn } });

  const origin = await appOrigin();
  await sendMail({ to: me.email, ...accountDeletionEmail({ firstName: me.first, purgeOn, contactUrl: `${origin}/contact` }) });
  const admins = process.env.CONTACT_EMAIL
    ? [process.env.CONTACT_EMAIL]
    : (await db.select({ email: profiles.email }).from(profiles).where(and(eq(profiles.role, 'admin'), eq(profiles.is_active, true)))).map((a) => a.email);
  await Promise.all(admins.map((to) => sendMail({ to, ...accountDeletionAdminEmail({ email: me.email, purgeOn, appUrl: origin }) })));
  return { error: null, purgeOn };
}

// ── Administration ───────────────────────────────────────────────────────────

/** Annule une demande de suppression (le titulaire a changé d'avis) : le compte est réactivé. */
export async function cancelAccountDeletion(userId: string): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  await db.update(profiles).set({ deletion_requested_at: null, is_active: true }).where(eq(profiles.id, userId));
  await logAudit({ actor: admin.id, target: userId, action: 'suppression_annulee' });
  return { error: null };
}

/** Purge immédiate d'un compte dont la suppression a été demandée. */
export async function purgeRequestedAccount(userId: string): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const [p] = await db.select({ requested: profiles.deletion_requested_at }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!p?.requested) return { error: 'Ce compte n’a pas demandé sa suppression.' };
  try {
    await purgeAccountNow(userId);
    await logAudit({ actor: admin.id, target: userId, action: 'compte_purge' });
    return { error: null };
  } catch (e) {
    console.error('[purge]', userId, e);
    return { error: 'La suppression a échoué : rien n’a été effacé. Réessayez ou consultez les journaux.' };
  }
}
