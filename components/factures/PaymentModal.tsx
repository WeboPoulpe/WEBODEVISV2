'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { recordPayment } from '@/server/invoices';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/invoices';
import { cn, formatCurrency } from '@/lib/utils';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** « 1 250,50 » ou « 1250.5 » → 1250.5 */
export const parseAmount = (s: string) => Number(s.replace(/\s| | /g, '').replace(',', '.'));

// Enregistrer un règlement reçu : date du jour et reste à payer proposés.
export default function PaymentModal({ invoiceId, remaining, onClose, onSaved }: {
  invoiceId: string;
  remaining: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paidOn, setPaidOn] = useState(todayIso);
  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2).replace('.', ',') : '');
  const [method, setMethod] = useState<PaymentMethod>('virement');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = parseAmount(amount);
  const over = Number.isFinite(value) && value > remaining + 0.005;

  const submit = async () => {
    if (!(value > 0)) { setError('Indiquez le montant reçu.'); return; }
    setSaving(true); setError(null);
    const res = await recordPayment(invoiceId, { paidOn, amount: value, method, note })
      .catch(() => ({ error: 'Le paiement n’a pas pu être enregistré. Réessayez dans un instant.' }));
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onSaved();
  };

  return (
    <Modal title="Enregistrer un paiement" onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={submit} disabled={saving} className={btnPrimary}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer le paiement</button>
      </>}>
      <div className="space-y-4 pb-3">
        {error && <p role="alert" className={errorCls}>{error}</p>}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pay-date" className={labelCls}>Reçu le</label>
            <input id="pay-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pay-amount" className={labelCls}>Montant reçu (€)</label>
            <input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(inputCls, 'tabular-nums')} />
          </div>
        </div>
        <p className={cn('text-sm', over ? 'text-danger' : 'text-gray-500')}>
          {over ? `C’est plus que le reste à payer (${formatCurrency(remaining)}). Vérifiez le montant.` : `Reste à payer : ${formatCurrency(remaining)}.`}
        </p>
        <div>
          <p className={labelCls}>Mode de paiement</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode de paiement">
            {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                className={cn('h-10 px-3.5 rounded-xl border text-sm font-medium transition-colors',
                  method === m ? 'bg-primary-100 border-primary-200 text-primary' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300')}>
                {PAYMENT_METHODS[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="pay-note" className={labelCls}>Note <span className="font-normal text-gray-500">(facultatif)</span></label>
          <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="N° de chèque, référence du virement…" className={inputCls} />
        </div>
      </div>
    </Modal>
  );
}
