import crypto from 'node:crypto';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, users } from '@/db/schema';
import { DEMO_USER_ID } from '@/lib/demo';
import { readTicket } from '@/server/tickets';
import { logAudit } from './audit';
import { clearLoginFailures, clientIp, isLoginBlocked, recordLoginFailure, TOO_MANY_ATTEMPTS } from './loginThrottle';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Empreinte courte du mot de passe enregistré : quand il change, les sessions ouvertes avant sont fermées. */
export const passwordTag = (hash: string) => crypto.createHash('sha256').update(hash).digest('base64url').slice(0, 16);

// Une session est revérifiée en base au plus toutes les 5 minutes : compte désactivé, supprimé ou mot de passe changé.
const RECHECK_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    // Démonstration : pas de mot de passe, mais un ticket signé, remis après le formulaire de /demo
    // (voir server/demo.ts). Le compte n'existe que si ses données ont été créées.
    CredentialsProvider({
      id: 'demo',
      name: 'Démonstration',
      credentials: { ticket: { label: 'Ticket', type: 'text' } },
      async authorize(credentials) {
        if (readTicket<{ k: string }>(credentials?.ticket)?.k !== 'demo') return null;
        const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, DEMO_USER_ID)).limit(1);
        return user ?? null;
      },
    }),
    CredentialsProvider({
      name: 'Email et mot de passe',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const email = normalizeEmail(credentials.email);
        const ip = clientIp(req?.headers);
        // Trop d'échecs récents : refusé avant même de vérifier le mot de passe (le message s'affiche tel quel).
        // Si le compteur est illisible (base en cours de mise à jour), la connexion reste possible.
        if (await isLoginBlocked(email, ip).catch(() => false)) throw new Error(TOO_MANY_ATTEMPTS);
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user || !(await bcrypt.compare(credentials.password, user.password_hash))) {
          await recordLoginFailure(email, ip).catch((e) => console.error('[connexion] compteur', e));
          return null;
        }
        await clearLoginFailures(email).catch(() => {});

        // Un compte désactivé par un administrateur ne peut plus se connecter.
        const [profile] = await db.select({ is_active: profiles.is_active }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
        if (profile && !profile.is_active) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.checkedAt = 0;
      }

      // Un administrateur ouvre le compte d'un client (ou en ressort). La demande vient du navigateur :
      // le rôle est donc relu en base à chaque fois, à partir du compte d'origine.
      if (trigger === 'update' && session && 'actAs' in session) {
        const adminId = (token.adminId as string | undefined) ?? token.sub;
        if (session.actAs === null) {
          if (token.adminId) {
            await logAudit({ actor: token.adminId as string, target: token.sub ?? null, action: 'sortie_compte_client' });
            token.sub = token.adminId as string;
            token.email = token.adminEmail as string;
            delete token.adminId;
            delete token.adminEmail;
          }
        } else if (typeof session.actAs === 'string' && adminId && session.actAs !== adminId) {
          const [admin] = await db.select({ role: profiles.role, is_active: profiles.is_active, email: profiles.email })
            .from(profiles).where(eq(profiles.id, adminId)).limit(1);
          const [target] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, session.actAs)).limit(1);
          if (admin?.role === 'admin' && admin.is_active && target) {
            token.adminEmail = (token.adminEmail as string | undefined) ?? admin.email;
            token.adminId = adminId;
            token.sub = target.id;
            await logAudit({ actor: adminId, target: target.id, action: 'entree_compte_client', details: { email: target.email } });
            token.email = target.email;
          }
        }
      }

      // La personne réellement connectée (l'administrateur quand il est entré dans le compte d'un client).
      const realId = (token.adminId as string | undefined) ?? token.sub;
      if (realId && Date.now() - ((token.checkedAt as number | undefined) ?? 0) > RECHECK_MS) {
        const [account] = await db.select({ hash: users.password_hash, active: profiles.is_active })
          .from(users).leftJoin(profiles, eq(profiles.id, users.id)).where(eq(users.id, realId)).limit(1);
        const tag = account ? passwordTag(account.hash) : null;
        // Session fermée : plus d'identifiant, et le middleware renvoie vers la connexion.
        if (!account || account.active === false || (token.pw && token.pw !== tag)) return { revoked: true };
        token.pw = tag;
        token.checkedAt = Date.now();
        // Dernière activité du compte (pas celle d'un administrateur entré dans le compte d'un client).
        if (!token.adminId) {
          await db.update(profiles).set({ last_seen_at: new Date().toISOString() }).where(eq(profiles.id, realId)).catch(() => {});
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      session.actingAsAdmin = !!token.adminId;
      return session;
    },
  },
};
