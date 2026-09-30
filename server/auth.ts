'use server';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { password_reset_tokens, profiles, users, type ProfileRow } from '@/db/schema';
import { normalizeEmail } from '@/lib/auth';
import { appOrigin, sendMail } from '@/lib/mail';
import { passwordResetEmail, welcomeEmail } from '@/lib/mail/templates';
import { getSessionUser } from './session';

const MIN_PASSWORD = 6;
const RESET_TTL_MS = 60 * 60 * 1000;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ error: string | null }> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Adresse email invalide' };
  if (input.password.length < MIN_PASSWORD) return { error: 'Le mot de passe doit faire au moins 6 caractères' };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: 'User already registered' };

  const password_hash = await bcrypt.hash(input.password, 10);
  await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, password_hash }).returning({ id: users.id });
    // Le rôle et l'état actif sont fixés ici, jamais par le navigateur.
    await tx.insert(profiles).values({
      id: user.id,
      email,
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      role: 'user',
      is_active: true,
      has_completed_onboarding: false,
    });
  });
  // L'email de bienvenue ne bloque pas l'inscription s'il ne part pas.
  await sendMail({ to: email, ...welcomeEmail({ firstName: input.firstName.trim() || null, appUrl: await appOrigin() }) });
  return { error: null };
}

/** Profil de l'utilisateur connecté (null si non connecté ou profil absent). */
export async function getMyProfile(): Promise<ProfileRow | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return profile ?? null;
}

/** Répond toujours sans erreur, que le compte existe ou non, pour ne pas révéler les emails inscrits. */
export async function requestPasswordReset(rawEmail: string): Promise<{ error: string | null }> {
  const email = normalizeEmail(rawEmail);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) return { error: null };

  const token = crypto.randomBytes(32).toString('base64url');
  await db.insert(password_reset_tokens).values({
    token_hash: hashToken(token),
    user_id: user.id,
    expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
  });

  const link = `${await appOrigin()}/reset-password?token=${token}`;
  return sendMail({ to: email, ...passwordResetEmail({ link }) });
}

export async function resetPassword(token: string, password: string): Promise<{ error: string | null }> {
  if (password.length < MIN_PASSWORD) return { error: 'Le mot de passe doit faire au moins 6 caractères.' };
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ user_id: password_reset_tokens.user_id })
    .from(password_reset_tokens)
    .where(and(
      eq(password_reset_tokens.token_hash, tokenHash),
      isNull(password_reset_tokens.used_at),
      gt(password_reset_tokens.expires_at, new Date().toISOString()),
    ))
    .limit(1);
  if (!row) return { error: 'Ce lien est invalide ou a expiré. Refaites une demande depuis la page de connexion.' };

  const password_hash = await bcrypt.hash(password, 10);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ password_hash }).where(eq(users.id, row.user_id));
    await tx.update(password_reset_tokens).set({ used_at: new Date().toISOString() }).where(eq(password_reset_tokens.token_hash, tokenHash));
  });
  return { error: null };
}
