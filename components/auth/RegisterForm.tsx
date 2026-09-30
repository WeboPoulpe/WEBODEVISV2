'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authButton, authError, authInput, authLabel } from './AuthShell';

export default function RegisterForm() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères'); return; }

    setLoading(true);
    setError(null);

    const { error } = await signUp(email, password, firstName, lastName);

    if (error) {
      setError(error.includes('already registered') ? 'Cet email est déjà utilisé' : error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push('/login'), 1500);
  };

  if (success) {
    return (
      <div className="rounded-2xl bg-sage-100 p-6">
        <div className="w-10 h-10 rounded-full bg-sage text-white flex items-center justify-center">
          <Check className="h-5 w-5" />
        </div>
        <p className="mt-4 font-semibold text-gray-900">Compte créé avec succès !</p>
        <p className="text-sm text-gray-600 mt-1">Vous pouvez maintenant vous connecter. Redirection vers la connexion…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="register-first" className={authLabel}>Prénom</label>
          <input id="register-first" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className={authInput} />
        </div>
        <div>
          <label htmlFor="register-last" className={authLabel}>Nom</label>
          <input id="register-last" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className={authInput} />
        </div>
      </div>

      <div>
        <label htmlFor="register-email" className={authLabel}>Adresse email</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          required
          className={authInput}
        />
      </div>

      <div>
        <label htmlFor="register-password" className={authLabel}>Mot de passe</label>
        <div className="relative">
          <input
            id="register-password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={`${authInput} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900"
          >
            {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">6 caractères minimum</p>
      </div>

      {error && <p role="alert" className={authError}>{error}</p>}

      <button type="submit" disabled={loading} className={authButton}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : 'Créer mon compte'}
      </button>
    </form>
  );
}
