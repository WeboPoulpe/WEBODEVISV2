'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authButton, authError, authInput, authLabel } from '@/components/auth/AuthShell';
import { acceptInvitation } from '@/server/team';

export default function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const { signIn } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await acceptInvitation({ token, firstName, lastName, password });
      if (res.error !== null) { setError(res.error); return; }
      const login = await signIn(res.email, password);
      if (login.error) { router.push('/login'); return; }
      router.push('/');
      router.refresh();
    } catch {
      setError('Votre accès n’a pas pu être créé. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={authLabel}>Adresse email</label>
        <input value={email} readOnly className={`${authInput} bg-gray-50 text-gray-500`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="inv-first" className={authLabel}>Prénom</label>
          <input id="inv-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required className={authInput} />
        </div>
        <div>
          <label htmlFor="inv-last" className={authLabel}>Nom</label>
          <input id="inv-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={authInput} />
        </div>
      </div>
      <div>
        <label htmlFor="inv-pwd" className={authLabel}>Mot de passe (8 caractères au moins)</label>
        <div className="relative">
          <input id="inv-pwd" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} className={`${authInput} pr-12`} />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {error && <p className={authError} role="alert">{error}</p>}
      <button type="submit" disabled={loading} className={authButton}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Créer mon accès'}
      </button>
    </form>
  );
}
