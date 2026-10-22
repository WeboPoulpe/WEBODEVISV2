'use client';

// Un devis à formules ne passe pas « validé » (ou acompte, payé) sans formule : courses, production, marges et
// factures ne sauraient pas quoi compter. Au passage, la fenêtre demande celle que le client a prise et la
// retient (chooseQuoteFormula). Toutes les façons de changer le statut passent par gate().

import { useCallback, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { CONFIRMED_STATUSES, type QuoteStatus } from '@/lib/quoteStatus';
import { formulaPending, parseFormulas, type QuoteFormula } from '@/lib/quoteFormulas';
import { formulaTotals, quoteDefaultRate, resolveGuestSplit, type VatLine } from '@/lib/quoteTotals';
import { chooseQuoteFormula } from '@/server/quoteFormulas';

const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

/** Ce qu'il faut d'un devis pour demander sa formule (services et convives : pour afficher les totaux). */
export interface GateQuote {
  id: string;
  formulas?: unknown;
  chosen_formula_id?: string | null;
  /** Nom affiché dans la fenêtre (client ou événement). */
  label?: string | null;
  services?: unknown;
  vat_rate?: number | string | null;
  guest_count?: number | null;
  guest_count_adults?: number | null;
  guest_count_children?: number | null;
}

interface Ask { quote: GateQuote; formulas: QuoteFormula[]; resolve: (id: string | null) => void }

export function useFormulaGate() {
  const { notify } = useFeedback();
  const [ask, setAsk] = useState<Ask | null>(null);

  /**
   * `ok` : le changement de statut peut se faire (pas de formule à choisir, ou choisie à l'instant : `chosen`).
   * Faux si la fenêtre est fermée sans choix ou si la formule n'a pas pu être retenue.
   */
  const gate = useCallback(async (quote: GateQuote, status: string): Promise<{ ok: boolean; chosen?: string }> => {
    if (!CONFIRMED_STATUSES.includes(status as QuoteStatus) || !formulaPending(quote)) return { ok: true };
    const formulas = parseFormulas(quote.formulas);
    const picked = await new Promise<string | null>((resolve) => setAsk({ quote, formulas, resolve }));
    setAsk(null);
    if (!picked) return { ok: false };
    const res = await chooseQuoteFormula(quote.id, picked).catch(() => ({ error: 'La formule n’a pas pu être retenue. Vérifiez votre connexion, puis réessayez.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return { ok: false }; }
    return { ok: true, chosen: picked };
  }, [notify]);

  const dialog = ask ? <FormulaDialog ask={ask} /> : null;
  return { gate, dialog };
}

function FormulaDialog({ ask }: { ask: Ask }) {
  const { quote, formulas, resolve } = ask;
  const [choice, setChoice] = useState<string | null>(null);
  const lines = Array.isArray(quote.services) ? (quote.services as VatLine[]) : null;
  const { adults, children } = resolveGuestSplit(quote.guest_count, quote.guest_count_adults, quote.guest_count_children);
  const totals = lines ? formulaTotals(lines, formulas, quoteDefaultRate(quote.vat_rate), adults, children) : [];
  const ttcOf = (id: string) => totals.find((t) => t.formula.id === id)?.totals.ttc;

  return (
    <Modal title="Quelle formule le client a-t-il choisie ?" onClose={() => resolve(null)}
      footer={
        <>
          <button type="button" onClick={() => resolve(null)} className={btnSecondary}>Annuler</button>
          <button type="button" onClick={() => resolve(choice)} disabled={!choice} className={cn(btnPrimary, 'disabled:opacity-50')}>Valider avec cette formule</button>
        </>
      }>
      <p className="text-[15px] text-gray-600 mb-3">
        {quote.label ? <>Le devis « {quote.label} » propose plusieurs formules. </> : 'Ce devis propose plusieurs formules. '}
        Les courses, la production, les marges et les factures suivront celle que vous retenez.
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Formule retenue</legend>
        {formulas.map((f) => {
          const ttc = ttcOf(f.id);
          return (
            <label key={f.id} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer', choice === f.id ? 'border-primary bg-primary-50' : 'border-gray-200 hover:bg-gray-50')}>
              <input type="radio" name="gate-formula" value={f.id} checked={choice === f.id} onChange={() => setChoice(f.id)} className="accent-primary" />
              <span className="flex-1 text-[15px] font-medium text-gray-900">{f.name}</span>
              {ttc != null && <span className="text-sm tabular-nums text-gray-600">{euros(ttc)} TTC</span>}
            </label>
          );
        })}
      </fieldset>
    </Modal>
  );
}
