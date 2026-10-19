'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, PenLine } from 'lucide-react';
import SignaturePad, { type SignaturePadHandle } from '@/components/devis/SignaturePad';
import { acceptQuote } from '@/server/acceptance';

const frDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Bloc « Accepter ce devis » de la page client : replié en une invitation, puis le formulaire de signature.
export default function AcceptQuote({ token, companyName, validUntil, isCompany }: {
  token: string; companyName: string; validUntil: string | null; isCompany: boolean;
}) {
  const router = useRouter();
  const pad = useRef<SignaturePadHandle>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [agree, setAgree] = useState(false);
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const signature = pad.current?.toDataUrl();
    if (!signature) { setError('Signez dans le cadre prévu.'); return; }
    setSaving(true);
    try {
      const res = await acceptQuote({ token, signerName: name, signerRole: isCompany ? role : null, signature, acceptTerms: agree });
      if (res.error) { setError(res.error); return; }
      router.refresh();
    } catch {
      setError('Votre accord n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full h-11 px-3 rounded-xl border border-gray-300 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

  return (
    <section className="mx-4 sm:mx-auto sm:max-w-[210mm] my-4 sm:my-0 sm:mb-6 bg-white rounded-2xl border border-gray-200 print:hidden" aria-labelledby="accept-title">
      {!open ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
          <div className="flex-1">
            <h2 id="accept-title" className="font-display text-lg font-semibold text-gray-900">Ce devis vous convient ?</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Donnez votre accord en ligne, en signant du doigt ou à la souris.
              {validUntil ? ` Proposition valable jusqu’au ${frDate(validUntil)}.` : ''}
            </p>
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark transition-colors">
            <PenLine className="h-4 w-4" /> Accepter et signer
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <h2 id="accept-title" className="font-display text-lg font-semibold text-gray-900">Accepter le devis de {companyName}</h2>
            <p className="text-sm text-gray-600 mt-0.5">Votre accord est horodaté et transmis à {companyName}, qui vous enverra une confirmation par email.</p>
          </div>
          <div className={isCompany ? 'grid sm:grid-cols-2 gap-3' : ''}>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Prénom et nom</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={field} placeholder="Jean Dupont" />
            </label>
            {isCompany && (
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Fonction</span>
                <input value={role} onChange={(e) => setRole(e.target.value)} autoComplete="organization-title" className={field} placeholder="Responsable des achats" />
              </label>
            )}
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Signature</span>
            <SignaturePad ref={pad} onChange={(empty) => setSigned(!empty)} />
          </div>
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
            <span>J’ai lu le devis et j’accepte la proposition ainsi que les conditions générales de vente qui y figurent. Bon pour accord.</span>
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-12 px-5 rounded-xl text-[15px] font-semibold text-gray-600 hover:bg-gray-50">Plus tard</button>
            <button type="submit" disabled={saving || !signed || !agree || name.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Je donne mon accord
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
