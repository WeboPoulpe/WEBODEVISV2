'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
    setTimeout(() => router.push('/login'), 3000);
  };

  if (success) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <span className="text-2xl">✓</span>
        </div>
        <p className="text-sm font-semibold text-gray-900">Compte créé avec succès !</p>
        <p className="text-xs text-gray-500">Vérifiez votre email pour confirmer votre compte. Redirection vers la connexion…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jean"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Dupont"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Adresse email</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          required
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Minimum 6 caractères</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : 'Créer mon compte'}
      </button>
    </form>
  );
}
