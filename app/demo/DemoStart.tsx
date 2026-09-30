'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getDemoChallenge, requestDemoAccess, type DemoChallenge } from '@/server/demo';
import { authButton, authError, authInput, authLabel } from '@/components/auth/AuthShell';
import { cn } from '@/lib/utils';

// Parcours d'accès à la démonstration, en trois écrans courts : qui, où joindre, vérification.
// Les coordonnées arrivent dans l'espace d'administration (Demandes) ; la personne reçoit par email
// un lien pour revenir sans rien ressaisir.

const RETURN_KEY = 'webodevis_demo_access';
const STEPS = ['Vous', 'Vos coordonnées', 'Vérification'];

interface Saved { ticket: string; firstName: string }

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch { return null; }
}

export default function DemoStart() {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [answer, setAnswer] = useState('');
  const [website, setWebsite] = useState('');
  const [challenge, setChallenge] = useState<DemoChallenge | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  const enter = async (ticket: string) => {
    const res = await signIn('demo', { redirect: false, ticket });
    if (res?.ok && !res.error) {
      // Rechargement complet : la session de démonstration remplace une éventuelle session ouverte.
      window.location.assign('/');
      return true;
    }
    return false;
  };

  // Lien reçu par email (/demo?acces=…) : on entre directement. Sinon, un accès gardé par ce navigateur est proposé.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('acces');
    if (fromLink) {
      setBusy(true);
      enter(fromLink).then((ok) => {
        if (ok) return;
        setBusy(false);
        setError('Ce lien n’est plus valable. Remplissez le formulaire pour rouvrir la démonstration.');
      });
      return;
    }
    setSaved(readSaved());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { firstField.current?.focus({ preventScroll: true }); }, [step]);

  const loadChallenge = async () => { setAnswer(''); setChallenge(await getDemoChallenge()); };

  const next = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 0) {
      if (!firstName.trim() || !lastName.trim()) { setError('Indiquez votre prénom et votre nom.'); return; }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('L’adresse email n’est pas valide.'); return; }
      if (phone.replace(/\D/g, '').length < 9) { setError('Le numéro de téléphone n’est pas valide.'); return; }
      setStep(2);
      loadChallenge();
      return;
    }
    if (!challenge) return;
    setBusy(true);
    const res = await requestDemoAccess({ firstName, lastName, company, email, phone, answer, challenge: challenge.token, website })
      .catch(() => ({ error: 'L’ouverture a échoué. Réessayez dans un instant.' } as Awaited<ReturnType<typeof requestDemoAccess>>));
    if (res.error || !res.ticket) {
      setBusy(false);
      setError(res.error ?? 'L’ouverture a échoué. Réessayez dans un instant.');
      if (res.retryChallenge) loadChallenge();
      return;
    }
    try { localStorage.setItem(RETURN_KEY, JSON.stringify({ ticket: res.returnTicket, firstName: firstName.trim() })); } catch { /* stockage indisponible */ }
    if (!(await enter(res.ticket))) {
      setBusy(false);
      setError('La démonstration n’est pas disponible pour le moment. Réessayez dans quelques minutes.');
    }
  };

  const reopen = async () => {
    if (!saved) return;
    setBusy(true);
    setError(null);
    if (await enter(saved.ticket)) return;
    try { localStorage.removeItem(RETURN_KEY); } catch { /* rien */ }
    setSaved(null);
    setBusy(false);
  };

  if (saved) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] text-gray-700">Bon retour {saved.firstName}. Votre accès est toujours ouvert.</p>
        <button onClick={reopen} disabled={busy} className={authButton}>
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}Rouvrir la démonstration
        </button>
        <button onClick={() => setSaved(null)} className="w-full h-11 text-[15px] font-medium text-gray-600 hover:text-gray-900">Ce n’est pas moi</button>
      </div>
    );
  }

  return (
    <form onSubmit={next} noValidate className="space-y-5">
      <div>
        <p className="text-sm text-gray-500" aria-live="polite">Étape {step + 1} sur {STEPS.length} : {STEPS[step]}</p>
        <div className="flex gap-1.5 mt-2" aria-hidden>
          {STEPS.map((s, i) => <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-gray-200')} />)}
        </div>
      </div>

      {error && <p role="alert" className={authError}>{error}</p>}

      {step === 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="demo-first" className={authLabel}>Prénom</label>
              <input ref={firstField} id="demo-first" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={authInput} />
            </div>
            <div>
              <label htmlFor="demo-last" className={authLabel}>Nom</label>
              <input id="demo-last" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={authInput} />
            </div>
          </div>
          <div>
            <label htmlFor="demo-company" className={authLabel}>Entreprise <span className="font-normal text-gray-500">(facultatif)</span></label>
            <input id="demo-company" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className={authInput} />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div>
            <label htmlFor="demo-email" className={authLabel}>Email</label>
            <input ref={firstField} id="demo-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={authInput} />
          </div>
          <div>
            <label htmlFor="demo-phone" className={authLabel}>Téléphone</label>
            <input id="demo-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className={authInput} />
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <label htmlFor="demo-answer" className={authLabel}>{challenge?.question ?? 'Un instant…'}</label>
            <input ref={firstField} id="demo-answer" inputMode="numeric" autoComplete="off" maxLength={2} value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))} placeholder="Votre réponse, en chiffres" className={authInput} />
            <p className="text-sm text-gray-500 mt-2">Cette question écarte les robots.</p>
          </div>
          {/* Champ piège : invisible et hors tabulation pour une personne. */}
          <div aria-hidden className="absolute -left-[9999px] w-px h-px overflow-hidden">
            <label htmlFor="demo-website">Site web</label>
            <input id="demo-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        </>
      )}

      <button type="submit" disabled={busy || (step === 2 && (!challenge || !answer))} className={authButton}>
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        {step < 2 ? 'Continuer' : 'Ouvrir la démonstration'}
      </button>

      {step > 0 && (
        <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="w-full flex items-center justify-center gap-2 h-11 text-[15px] font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />Étape précédente
        </button>
      )}

      {step === 2 && (
        <p className="text-sm text-gray-500">
          Vos coordonnées nous servent à vous recontacter au sujet de WeboDevis, rien d’autre. Voir la page <Link href="/confidentialite" className="underline underline-offset-2 hover:text-gray-900">Confidentialité</Link>.
        </p>
      )}
    </form>
  );
}
