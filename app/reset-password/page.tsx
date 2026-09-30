'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthShell, { authButton, authError, authInfo, authInput, authLabel } from '@/components/auth/AuthShell';
import { resetPassword } from '@/server/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Le jeton de réinitialisation est porté par le lien reçu par email.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    if (!token) { setError('Lien de réinitialisation incomplet. Refaites une demande depuis la page de connexion.'); return; }
    setLoading(true);
    const { error: err } = await resetPassword(token, password);
    setLoading(false);
    if (err) { setError(err); return; }
    setDone(true);
    setTimeout(() => { router.push('/login'); }, 1500);
  };

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisissez le mot de passe que vous utiliserez désormais."
      footer={<Link href="/login" className="font-medium text-primary hover:underline">Retour à la connexion</Link>}
    >
      {done ? (
        <p role="status" className={authInfo}>Mot de passe mis à jour. Redirection vers la connexion…</p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="reset-password" className={authLabel}>Nouveau mot de passe</label>
            <div className="relative">
              <input
                id="reset-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${authInput} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="reset-confirm" className={authLabel}>Confirmer le mot de passe</label>
            <input
              id="reset-confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={authInput}
            />
          </div>

          {error && <p role="alert" className={authError}>{error}</p>}

          <button type="submit" disabled={loading || !password || !confirm} className={authButton}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mise à jour…</> : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
