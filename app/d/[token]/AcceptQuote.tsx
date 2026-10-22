'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, PenLine } from 'lucide-react';
import SignaturePad, { type SignaturePadHandle } from '@/components/devis/SignaturePad';
import { acceptQuote, type PublicFormula } from '@/server/acceptance';
import { cn } from '@/lib/utils';

const frDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

// Bloc « Accepter ce devis » de la page client : replié en une invitation, puis le formulaire de signature.
// Devis à plusieurs formules : le client choisit la sienne (cartes côte à côte, l'une sous l'autre sur téléphone),
// puis signe pour elle. Une formule déjà retenue par le traiteur est simplement rappelée.
export default function AcceptQuote({ token, companyName, validUntil, isCompany, formulas = [], chosenFormulaId = null, hidePrice = false }: {
  token: string; companyName: string; validUntil: string | null; isCompany: boolean;
  formulas?: PublicFormula[]; chosenFormulaId?: string | null; hidePrice?: boolean;
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
  const fixed = formulas.find((f) => f.id === chosenFormulaId) ?? null;
  const [formulaId, setFormulaId] = useState<string | null>(fixed?.id ?? null);
  const picking = formulas.length > 0 && !fixed;
  const formula = formulas.find((f) => f.id === formulaId) ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (picking && !formula) { setError('Choisissez l’une des formules proposées.'); return; }
    const signature = pad.current?.toDataUrl();
    if (!signature) { setError('Signez dans le cadre prévu.'); return; }
    setSaving(true);
    try {
      const res = await acceptQuote({ token, signerName: name, signerRole: isCompany ? role : null, signature, acceptTerms: agree, formulaId: formula?.id ?? null });
      if (res.error) { setError(res.error); return; }
      router.refresh();
    } catch {
      setError('Votre accord n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full h-11 px-3 rounded-xl border border-gray-300 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

  // Les formules au choix : une carte par formule, avec son total.
  const choices = picking && (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-2">Votre formule</legend>
      <div className={cn('grid gap-3', formulas.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        {formulas.map((f) => {
          const on = f.id === formulaId;
          return (
            <label key={f.id} className={cn(
              'relative flex flex-col gap-1 p-4 rounded-xl border-2 cursor-pointer transition-colors',
              on ? 'border-primary bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300',
            )}>
              <input type="radio" name="formula" value={f.id} checked={on} onChange={() => { setFormulaId(f.id); setError(null); }} className="sr-only" />
              <span className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-semibold text-gray-900">{f.name}</span>
                <span aria-hidden className={cn('mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center', on ? 'border-primary bg-primary' : 'border-gray-300')}>
                  {on && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
              </span>
              {f.description && <span className="text-sm text-gray-600">{f.description}</span>}
              {!hidePrice && <span className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{euros(f.totalTTC)} <span className="text-xs font-normal text-gray-500">TTC</span></span>}
              {!hidePrice && f.perGuestTTC != null && <span className="text-sm tabular-nums text-gray-600">soit {euros(f.perGuestTTC)} par personne</span>}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">Le détail de chaque formule figure dans le devis ci-dessous.</p>
    </fieldset>
  );

  return (
    <section className="mx-4 sm:mx-auto sm:max-w-[210mm] my-4 sm:my-0 sm:mb-6 bg-white rounded-2xl border border-gray-200 print:hidden" aria-labelledby="accept-title">
      {!open ? (
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h2 id="accept-title" className="font-display text-lg font-semibold text-gray-900">
                {picking ? 'Choisissez votre formule' : 'Ce devis vous convient ?'}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {picking ? 'Choisissez la formule qui vous convient, puis donnez votre accord en signant du doigt ou à la souris.' : 'Donnez votre accord en ligne, en signant du doigt ou à la souris.'}
                {validUntil ? ` Proposition valable jusqu’au ${frDate(validUntil)}.` : ''}
              </p>
            </div>
            {!picking && (
              <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark transition-colors">
                <PenLine className="h-4 w-4" /> Accepter et signer
              </button>
            )}
          </div>
          {fixed && <p className="text-sm text-gray-700">Formule retenue : <span className="font-semibold">{fixed.name}</span>{!hidePrice && ` — ${euros(fixed.totalTTC)} TTC`}</p>}
          {choices}
          {picking && (
            <div className="flex sm:justify-end">
              <button onClick={() => setOpen(true)} disabled={!formula}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors">
                <PenLine className="h-4 w-4" /> {formula ? 'Accepter et signer' : 'Choisissez une formule'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <h2 id="accept-title" className="font-display text-lg font-semibold text-gray-900">Accepter le devis de {companyName}</h2>
            <p className="text-sm text-gray-600 mt-0.5">Votre accord est horodaté et transmis à {companyName}, qui vous enverra une confirmation par email.</p>
          </div>
          {formula && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-primary-50 border border-primary/20">
              <p className="text-sm text-gray-800">
                Formule choisie : <span className="font-semibold">{formula.name}</span>
                {!hidePrice && <span className="tabular-nums"> — {euros(formula.totalTTC)} TTC</span>}
              </p>
              {picking && <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline flex-shrink-0">Changer</button>}
            </div>
          )}
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
            <span>
              J’ai lu le devis et j’accepte la proposition{formula ? `, formule « ${formula.name} »,` : ''} ainsi que les conditions générales de vente qui y figurent. Bon pour accord.
            </span>
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-12 px-5 rounded-xl text-[15px] font-semibold text-gray-600 hover:bg-gray-50">Plus tard</button>
            <button type="submit" disabled={saving || !signed || !agree || name.trim().length < 2 || (picking && !formula)}
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
