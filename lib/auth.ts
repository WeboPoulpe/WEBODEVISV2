import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, users } from '@/db/schema';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email et mot de passe',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(credentials.email))).limit(1);
        if (!user) return null;
        if (!(await bcrypt.compare(credentials.password, user.password_hash))) return null;

        // Un compte désactivé par un administrateur ne peut plus se connecter.
        const [profile] = await db.select({ is_active: profiles.is_active }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
        if (profile && !profile.is_active) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
