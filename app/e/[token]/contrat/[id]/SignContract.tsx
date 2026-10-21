'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import SignaturePad, { type SignaturePadHandle } from '@/components/devis/SignaturePad';
import { signExtraContract } from '@/server/extraContractSign';

// Signature du contrat par l'extra : nom, case « lu et approuvé », signature au doigt.
export default function SignContract({ token, contractId, defaultName }: { token: string; contractId: string; defaultName: string }) {
  const router = useRouter();
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(defaultName);
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
      const res = await signExtraContract({ token, contractId, signerName: name, signature, accept: agree });
      if (res.error) { setError(res.error); return; }
      router.refresh();
    } catch {
      setError('Votre signature n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-3xl bg-white border border-gray-200 p-5 space-y-4" aria-labelledby="sign-title">
      <div>
        <h2 id="sign-title" className="font-display text-lg font-semibold text-gray-900">Signer mon contrat</h2>
        <p className="text-sm text-gray-600 mt-0.5">Votre signature est horodatée et transmise à votre employeur.</p>
      </div>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1.5">Prénom et nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required
          className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      </label>
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-1.5">Signature</span>
        <SignaturePad ref={pad} onChange={(empty) => setSigned(!empty)} />
      </div>
      <label className="flex items-start gap-3 text-[15px] text-gray-700">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
        <span>J’ai lu le contrat et j’en accepte les conditions. Lu et approuvé.</span>
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button type="submit" disabled={saving || !signed || !agree || name.trim().length < 2}
        className="inline-flex w-full items-center justify-center gap-2 h-12 px-5 rounded-2xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Je signe mon contrat
      </button>
    </form>
  );
}
