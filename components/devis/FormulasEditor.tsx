'use client';

import { useState } from 'react';
import { Copy, Loader2, Plus, Trash2 } from 'lucide-react';
import { chooseQuoteFormula } from '@/server/quoteFormulas';
import { MAX_FORMULAS, newFormulaId, type QuoteFormula } from '@/lib/quoteFormulas';
import type { VatBreakdown } from '@/lib/quoteTotals';
import { useFeedback } from '@/components/ui/Feedback';

const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

// Formules au choix d'un devis, dans le panneau Prestations de l'éditeur : ajouter, dupliquer (avec ses lignes),
// renommer, supprimer une formule, voir son total et son prix par convive, et retenir celle du client quand il a
// donné son accord autrement qu'en ligne.
// Les lignes se rangent dans une formule depuis leur carte (liste « Formule »).
export default function FormulasEditor({ quoteId, formulas, onFormulasChange, onDuplicate, guests, totals, hidePrice, chosenFormulaId, dirty, onChosen }: {
  quoteId: string;
  formulas: QuoteFormula[];
  onFormulasChange: (next: QuoteFormula[]) => void;
  /** Nouvelle formule copiée de celle-ci, avec une copie de ses lignes. */
  onDuplicate: (f: QuoteFormula) => void;
  /** Convives (adultes et enfants), pour le prix par personne. */
  guests: number;
  /** Total de chaque formule (lignes communes comprises). */
  totals: { formula: QuoteFormula; totals: VatBreakdown }[];
  hidePrice: boolean;
  chosenFormulaId: string | null;
  /** Formules modifiées depuis le dernier enregistrement : il faut valider avant d'en retenir une. */
  dirty: boolean;
  onChosen: (id: string | null) => void;
}) {
  const { notify, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
  const ttcOf = (id: string) => totals.find((t) => t.formula.id === id)?.totals.ttc ?? 0;

  const add = () => onFormulasChange([...formulas, { id: newFormulaId(), name: `Formule ${formulas.length + 1}` }]);
  const update = (id: string, patch: Partial<QuoteFormula>) => onFormulasChange(formulas.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = async (f: QuoteFormula) => {
    const ok = await confirm({
      title: `Supprimer « ${f.name} » ?`,
      message: 'Ses lignes restent dans le devis et deviennent communes à toutes les formules.',
      confirmLabel: 'Supprimer', danger: true,
    });
    if (ok) onFormulasChange(formulas.filter((x) => x.id !== f.id));
  };

  const choose = async (id: string | null) => {
    if (id === chosenFormulaId) return;
    setBusy(true);
    try {
      let res = await chooseQuoteFormula(quoteId, id);
      // Devis signé en ligne : l'accord portait sur l'autre formule ; il faut le dire avant de le rendre caduc.
      if (res.needsResign) {
        const ok = await confirm({
          title: 'Le client a déjà signé ce devis',
          message: 'Son accord porte sur la formule qu’il a choisie. Si vous changez de formule, cet accord ne sera plus valable : le devis repasse « envoyé » et le client devra le signer de nouveau.',
          confirmLabel: 'Changer et faire re-signer',
          danger: true,
        });
        if (!ok) return;
        res = await chooseQuoteFormula(quoteId, id, { confirmResign: true });
      }
      if (res.error) { notify(res.error, { tone: 'error' }); return; }
      onChosen(id);
      const f = formulas.find((x) => x.id === id);
      notify(
        (f ? `Formule « ${f.name} » retenue : le devis prend son total.` : 'Plus de formule retenue : le client choisira en signant.')
          + (res.resigned ? ' Le devis est de nouveau à signer.' : ''),
        { tone: 'success' },
      );
    } catch {
      notify('La formule n’a pas pu être retenue. Vérifiez votre connexion et vos droits, puis réessayez.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2.5">
      <p className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Formules au choix</p>
      {formulas.length === 0 && (
        <p className="text-xs text-gray-500">
          Proposez plusieurs formules (par exemple Prestige et Tradition) : le client choisit la sienne en signant.
          Les lignes rangées dans aucune formule s’ajoutent à toutes.
        </p>
      )}
      {formulas.map((f) => (
        <div key={f.id} className="space-y-1">
          <div className="flex items-center gap-1.5">
            <input value={f.name} maxLength={80} onChange={(e) => update(f.id, { name: e.target.value })}
              placeholder="Nom de la formule" aria-label="Nom de la formule" className={`${inputCls} text-xs font-medium flex-1 py-1.5`} />
            {!hidePrice && (
              <span className="text-right leading-tight whitespace-nowrap">
                <span className="block text-xs font-semibold tabular-nums text-gray-700">{euros(ttcOf(f.id))}</span>
                {guests > 0 && <span className="block text-[10px] tabular-nums text-gray-500">{euros(ttcOf(f.id) / guests)} / pers.</span>}
              </span>
            )}
            {formulas.length < MAX_FORMULAS && (
              <button type="button" onClick={() => onDuplicate(f)} title="Dupliquer la formule, avec ses lignes" aria-label={`Dupliquer « ${f.name} »`} className="p-1 text-gray-300 hover:text-primary hover:bg-primary-50 rounded">
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={() => remove(f)} title="Supprimer la formule" className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <input value={f.description ?? ''} maxLength={300} onChange={(e) => update(f.id, { description: e.target.value })}
            placeholder="Description (facultatif)" aria-label="Description de la formule" className={`${inputCls} text-xs py-1`} />
        </div>
      ))}
      {formulas.length === 1 && <p className="text-xs text-amber-700">Ajoutez une deuxième formule pour laisser le choix au client.</p>}
      {formulas.length < MAX_FORMULAS && (
        <button type="button" onClick={add} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
          <Plus className="h-3.5 w-3.5" /> Ajouter une formule
        </button>
      )}
      {formulas.length > 0 && (
        <div className="pt-1 border-t border-gray-100">
          <label className="text-[10px] text-gray-500 flex items-center gap-1.5">
            Formule retenue {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          </label>
          <select value={chosenFormulaId ?? ''} disabled={dirty || busy} onChange={(e) => choose(e.target.value || null)}
            className={`${inputCls} text-xs py-1.5 disabled:bg-gray-50 disabled:text-gray-400`}>
            <option value="">À choisir par le client en signant</option>
            {formulas.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            {dirty
              ? 'Appliquez d’abord vos modifications pour pouvoir retenir une formule.'
              : 'Accord du client par téléphone ? Retenez sa formule ici : le devis, les factures et les courses suivent son total.'}
          </p>
        </div>
      )}
    </div>
  );
}
