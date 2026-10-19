'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, errorCls, inputCls } from '@/components/ui/kit';
import { createInvoiceDraft, quoteBillingSummary } from '@/server/invoices';
import { cn, formatCurrency } from '@/lib/utils';
import { parseAmount } from './PaymentModal';

type Kind = 'acompte' | 'solde' | 'facture';
type Summary = NonNullable<Awaited<ReturnType<typeof quoteBillingSummary>>>;

// Facturer un devis confirmé : acompte (pourcentage ou montant), solde, ou facture complète.
// Prépare un brouillon puis ouvre sa fiche, où l'on vérifie avant d'émettre.
export default function BillQuoteModal({ quoteId, quoteLabel, onClose }: { quoteId: string; quoteLabel: string; onClose: () => void }) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [kind, setKind] = useState<Kind>('acompte');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [percent, setPercent] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    quoteBillingSummary(quoteId).then((s) => {
      if (cancelled) return;
      setSummary(s);
      if (!s) return;
      setPercent(String(s.depositPercent).replace('.', ','));
      setKind(s.hasFinal ? 'acompte' : s.deposits > 0 ? 'solde' : 'acompte');
    }).catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [quoteId]);

  const s = summary;
  const left = s ? Math.max(0, Math.round((s.totalTTC - s.invoicedTTC) * 100) / 100) : 0;
  const why: Record<Kind, string | null> = s ? {
    acompte: s.hasFinal ? 'Le devis a déjà sa facture de solde.' : left <= 0 ? 'Tout le devis est déjà facturé.' : null,
    solde: s.hasFinal ? 'Le devis a déjà sa facture de solde.' : s.deposits === 0 ? 'Pas encore d’acompte facturé : faites plutôt une facture complète.' : null,
    facture: s.hasFinal ? 'Le devis a déjà sa facture.' : s.invoicedTTC > 0 ? 'Un acompte est déjà facturé : faites une facture de solde.' : null,
  } : { acompte: null, solde: null, facture: null };
  const nothingLeft = !!s && why.acompte && why.solde && why.facture;

  const pct = parseAmount(percent || '0');
  const amt = parseAmount(amount || '0');
  const depositTTC = mode === 'percent' ? Math.round(s ? s.totalTTC * pct : 0) / 100 : amt;
  const amountOf: Record<Kind, number> = { acompte: depositTTC, solde: left, facture: s?.totalTTC ?? 0 };

  const submit = async () => {
    if (!s || why[kind]) return;
    setSaving(true); setError(null);
    const input = kind === 'acompte'
      ? (mode === 'percent' ? { quoteId, kind, percent: pct } : { quoteId, kind, amountTTC: amt })
      : { quoteId, kind };
    const res = await createInvoiceDraft(input).catch(() => ({ error: 'La facture n’a pas pu être préparée. Réessayez dans un instant.' }));
    if (res.error) { setSaving(false); setError(res.error); return; }
    if ('id' in res) router.push(`/factures/${res.id}`);
  };

  const OPTIONS: { key: Kind; title: string; text: string }[] = [
    { key: 'acompte', title: 'Acompte', text: 'Une part du devis, avant l’événement.' },
    { key: 'solde', title: 'Solde', text: 'Tout le devis, moins les acomptes déjà facturés.' },
    { key: 'facture', title: 'Facture complète', text: 'Tout le devis en une seule facture.' },
  ];

  return (
    <Modal title="Facturer le devis" onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={submit} disabled={!s || !!why[kind] || saving || !(amountOf[kind] > 0)} className={btnPrimary}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Préparer la facture
        </button>
      </>}>
      <div className="pb-3 space-y-4">
        <p className="text-[15px] text-gray-700">{quoteLabel}</p>
        {error && <p role="alert" className={errorCls}>{error}</p>}
        {summary === undefined ? (
          <div className="space-y-2" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-50 animate-pulse" />)}</div>
        ) : summary === null ? (
          <p role="alert" className={errorCls}>Ce devis est introuvable, ou ses montants n’ont pas pu être lus.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-3 text-center">
              <div><dt className="text-xs text-gray-500">Devis TTC</dt><dd className="font-display text-sm min-[400px]:text-base font-bold tabular-nums text-gray-900">{formatCurrency(summary.totalTTC)}</dd></div>
              <div><dt className="text-xs text-gray-500">Déjà facturé</dt><dd className="font-display text-sm min-[400px]:text-base font-bold tabular-nums text-gray-900">{formatCurrency(summary.invoicedTTC)}</dd></div>
              <div><dt className="text-xs text-gray-500">Reste</dt><dd className="font-display text-sm min-[400px]:text-base font-bold tabular-nums text-primary">{formatCurrency(left)}</dd></div>
            </dl>

            {nothingLeft ? (
              <p className="text-[15px] text-gray-700">Ce devis est entièrement facturé. Pour corriger une facture, ouvrez-la dans Factures et établissez un avoir.</p>
            ) : (
              <div role="radiogroup" aria-label="Type de facture" className="space-y-2">
                {OPTIONS.map((o) => {
                  const disabled = !!why[o.key];
                  const selected = kind === o.key && !disabled;
                  return (
                    <div key={o.key} className={cn('rounded-2xl border transition-colors', selected ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white', disabled && 'opacity-60')}>
                      <button type="button" role="radio" aria-checked={selected} aria-disabled={disabled} disabled={disabled}
                        onClick={() => setKind(o.key)} className="w-full flex items-start gap-3 p-3 text-left disabled:cursor-not-allowed">
                        <span className={cn('mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center', selected ? 'border-primary' : 'border-gray-300')}>
                          {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-gray-900">{o.title}</span>
                            {!disabled && o.key !== 'acompte' && <span className="text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(amountOf[o.key])}</span>}
                          </span>
                          <span className="block text-sm text-gray-600">{why[o.key] ?? o.text}</span>
                        </span>
                      </button>
                      {o.key === 'acompte' && selected && (
                        <div className="px-3 pb-3 space-y-2">
                          <div className="flex p-1 rounded-xl bg-white border border-gray-200 w-fit" role="tablist" aria-label="Calcul de l’acompte">
                            {(['percent', 'amount'] as const).map((m) => (
                              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                                className={cn('h-9 px-3 rounded-lg text-sm font-medium', mode === m ? 'bg-primary-100 text-primary' : 'text-gray-600')}>
                                {m === 'percent' ? 'Pourcentage' : 'Montant TTC'}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {mode === 'percent' ? (
                              <>
                                <input aria-label="Pourcentage d’acompte" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} className={cn(inputCls, 'w-24 tabular-nums')} />
                                <span className="text-gray-700">%</span>
                                <span className="ml-auto text-sm text-gray-600">soit <strong className="tabular-nums text-gray-900">{formatCurrency(depositTTC)}</strong> TTC</span>
                              </>
                            ) : (
                              <>
                                <input aria-label="Montant de l’acompte TTC" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={cn(inputCls, 'w-36 tabular-nums')} />
                                <span className="text-gray-700">€ TTC</span>
                              </>
                            )}
                          </div>
                          {depositTTC > left + 0.01 && <p className="text-sm text-danger">C’est plus que le reste à facturer ({formatCurrency(left)}).</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!nothingLeft && <p className="text-sm text-gray-500">Un brouillon est préparé avec les lignes du devis : vous le vérifiez, puis vous l’émettez.</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
