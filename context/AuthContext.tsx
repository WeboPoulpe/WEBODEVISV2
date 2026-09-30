'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { getMyProfile, registerUser } from '@/server/auth';

// ── Profile type (mirrors existing app profiles table) ──────────────────────
export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  company_name: string | null;
  logo_url: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  company_website: string | null;
  cgv: string | null;
  subscription_type: string | null;
  parent_user_id: string | null;
  can_view_all_company_data: boolean;
  has_completed_onboarding: boolean | null;
  default_vat_rate: number | null;
  /** Options activées pour le compte (voir lib/modules.ts). */
  modules: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
}

// ── Context type ─────────────────────────────────────────────────────────────
interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  /** Un administrateur a ouvert ce compte depuis l'espace d'administration. */
  actingAsAdmin: boolean;
  /** Ouvre le compte d'un client (administrateurs), ou en ressort avec null. */
  actAs: (userId: string | null) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthState({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);

  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  // Objet stable tant que l'utilisateur ne change pas : évite de relancer les effets qui en dépendent.
  const userRef = useRef<AuthUser | null>(null);
  if (!userId) userRef.current = null;
  else if (userRef.current?.id !== userId) userRef.current = { id: userId, email: userEmail ?? '' };
  const user = userRef.current;

  const fetchProfile = useCallback(async () => {
    setProfile((await getMyProfile()) as Profile | null);
  }, []);

  useEffect(() => {
    if (userId) fetchProfile();
    else setProfile(null);
  }, [userId, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const res = await nextAuthSignIn('credentials', { redirect: false, email, password });
    return { error: res?.error ?? null };
  };

  const signUp = (email: string, password: string, firstName: string, lastName: string) =>
    registerUser({ email, password, firstName, lastName });

  const actAs = async (targetId: string | null) => {
    await update({ actAs: targetId });
  };

  const signOut = async () => {
    await nextAuthSignOut({ redirect: false });
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading: status === 'loading', actingAsAdmin: !!session?.actingAsAdmin, actAs, signIn, signUp, signOut, refreshProfile: fetchProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <AuthState>{children}</AuthState>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
