import 'server-only';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { profiles } from '@/db/schema';

export interface SessionUser {
  id: string;
  email: string;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Non connecté') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Utilisateur connecté, ou null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email };
}

/**
 * À appeler en tête de chaque fonction serveur : c'est ce qui remplace les règles RLS.
 * L'identifiant renvoyé est le seul auquel on peut se fier pour filtrer les données.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  const [profile] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (profile?.role !== 'admin') throw new UnauthorizedError('Réservé aux administrateurs');
  return user;
}
