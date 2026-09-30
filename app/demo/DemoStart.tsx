'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { authButton, authError } from '@/components/auth/AuthShell';

export default function DemoStart() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const start = async () => {
    setLoading(true);
    setError(false);
    const res = await signIn('demo', { redirect: false });
    if (res?.ok && !res.error) {
      // Rechargement complet : la session de démonstration remplace une éventuelle session ouverte.
      window.location.assign('/');
      return;
    }
    setError(true);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      {error && <p role="alert" className={authError}>La démonstration n’est pas disponible pour le moment. Réessayez dans quelques minutes.</p>}
      <button onClick={start} disabled={loading} className={authButton}>
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        Ouvrir la démonstration
      </button>
    </div>
  );
}
