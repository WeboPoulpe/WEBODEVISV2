// Frein aux essais de mots de passe : au-delà de 5 échecs en 15 minutes pour une adresse email (ou de 30 depuis
// une même connexion), la connexion est refusée un moment, même avec le bon mot de passe. Une connexion réussie
// remet le compteur de l'adresse à zéro. Email et IP ne sont gardés que sous forme d'empreinte.

import crypto from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { login_attempts } from '@/db/schema';

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_PER_EMAIL = 5;
export const MAX_PER_IP = 30;
export const TOO_MANY_ATTEMPTS = 'Trop de tentatives de connexion. Patientez un quart d’heure avant de réessayer, ou utilisez « Mot de passe oublié ».';

const hash = (v: string) => crypto.createHash('sha256').update(`${v}:${process.env.NEXTAUTH_SECRET ?? ''}`).digest('hex');

/** IP du visiteur d'après les en-têtes de la requête (première adresse de x-forwarded-for). */
export function clientIp(headers: Record<string, string | string[] | undefined> | undefined): string | null {
  const raw = headers?.['x-forwarded-for'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.split(',')[0].trim() || null;
}

export async function isLoginBlocked(email: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const [{ byEmail, byIp }] = await db.select({
    byEmail: sql<number>`count(*) filter (where ${login_attempts.email_hash} = ${hash(email)})::int`,
    byIp: ip ? sql<number>`count(*) filter (where ${login_attempts.ip_hash} = ${hash(ip)})::int` : sql<number>`0`,
  }).from(login_attempts).where(gt(login_attempts.created_at, since));
  return byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP;
}

export async function recordLoginFailure(email: string, ip: string | null): Promise<void> {
  await db.insert(login_attempts).values({ email_hash: hash(email), ip_hash: ip ? hash(ip) : null });
}

export async function clearLoginFailures(email: string): Promise<void> {
  await db.delete(login_attempts).where(eq(login_attempts.email_hash, hash(email)));
}

/** Nettoyage quotidien : les échecs de plus d'un jour ne servent plus. */
export async function purgeOldLoginAttempts(): Promise<void> {
  await db.delete(login_attempts).where(and(lt(login_attempts.created_at, new Date(Date.now() - 86400_000).toISOString())));
}
