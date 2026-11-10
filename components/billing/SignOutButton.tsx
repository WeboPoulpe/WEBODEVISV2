'use client';

import { useAuth } from '@/context/AuthContext';

/** « Se déconnecter » des écrans hors de l'app (écran de paiement). */
export default function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();
  return <button type="button" onClick={() => void signOut()} className={className}>Se déconnecter</button>;
}
