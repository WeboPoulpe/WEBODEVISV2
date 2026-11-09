'use client';

// Lien protégé par un code : le lecteur le saisit une fois, la brochure s'ouvre (30 jours dans ce navigateur).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { unlockBrochure } from '@/server/brochures';

export default function CodeGate({ token }: { token: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="min-h-[100dvh] bg-[#EDE6DA] flex items-center justify-center px-4">
      <form className="w-full max-w-sm rounded-2xl bg-[#FBF7F0] p-6 text-center text-[#1C2621] shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError(null);
          const res = await unlockBrochure(token, code).catch(() => ({ error: 'Vérifiez votre connexion, puis réessayez.' }));
          setBusy(false);
          if (res.error) { setError(res.error); return; }
          router.refresh();
        }}>
        <Lock className="mx-auto h-8 w-8 text-[#B4502D]" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold" style={{ fontFamily: 'Georgia, serif' }}>Brochure protégée</h1>
        <p className="mt-1 text-sm text-[#5b5b55]">Saisissez le code reçu avec le lien. <span lang="en">Enter the code you received.</span></p>
        <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code d’accès" autoComplete="one-time-code"
          className="mt-4 w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-[#B4502D]" />
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy || !code.trim()} className="mt-4 w-full rounded-lg bg-[#B4502D] px-3 py-2.5 font-semibold text-white disabled:opacity-60">
          {busy ? '…' : 'Ouvrir la brochure'}
        </button>
      </form>
    </main>
  );
}
