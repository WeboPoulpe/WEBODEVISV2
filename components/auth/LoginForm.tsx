'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { requestPasswordReset } from '@/server/auth';
import { authButton, authError, authInfo, authInput, authLabel } from './AuthShell';

export default function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const handleForgot = async () => {
    setError(null); setInfo(null);
    if (!email.trim()) { setError('Saisissez votre adresse email, puis choisissez « Mot de passe oublié ».'); return; }
    setResetting(true);
    const { error: err } = await requestPasswordReset(email);
    setResetting(false);
    if (err) { setError(err); return; }
    setInfo('Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé (pensez aux spams).');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Saisissez votre adresse email et votre mot de passe.'); return; }

    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);

    if (error) {
      const msg = error.toLowerCase();
      if (msg.includes('invalid login') || msg.includes('credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else {
        setError(error);
      }
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="login-email" className={authLabel}>Adresse email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          className={authInput}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="login-password" className="text-sm font-medium text-gray-700">Mot de passe</label>
          <button type="button" onClick={handleForgot} disabled={resetting} className="text-sm font-medium text-primary hover:underline disabled:opacity-60">
            {resetting ? 'Envoi…' : 'Mot de passe oublié ?'}
          </button>
        </div>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${authInput} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {error && <p role="alert" className={authError}>{error}</p>}
      {info && <p role="status" className={authInfo}>{info}</p>}

      <button type="submit" disabled={loading} className={authButton}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Connexion…</> : 'Se connecter'}
      </button>
    </form>
  );
}
