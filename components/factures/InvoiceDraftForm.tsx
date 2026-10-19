'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { Party } from '@/server/invoices';
import { lineHT, type InvoiceLine } from '@/lib/invoices';
import { VAT_RATES, vatLabel } from '@/lib/vat';
import { cn, formatCurrency } from '@/lib/utils';
import { btnSecondary, cardCls, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { parseAmount } from './PaymentModal';

// Formulaire d'un brouillon : lignes, client, date de la prestation, notes. Les nombres restent du texte
// pendant la saisie (virgule acceptée) et sont convertis pour l'aperçu et l'enregistrement.

export interface EditLine { key: string; label: string; description: string; quantity: string; unitPrice: string; vatRate: number }

export interface DraftState {
  lines: EditLine[];
  buyer: Party;
  serviceDate: string;
  notes: string;
}

let seq = 0;
const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;
const numText = (n: number) => (Number.isFinite(n) ? String(n).replace('.', ',') : '');

export function toEditLines(lines: InvoiceLine[]): EditLine[] {
  return lines.map((l) => ({ key: newKey(), label: l.label, description: l.description ?? '', quantity: numText(l.quantity), unitPrice: numText(l.unitPrice), vatRate: l.vatRate }));
}

export function toInvoiceLines(lines: EditLine[]): InvoiceLine[] {
  return lines.map((l) => ({
    label: l.label.trim(),
    description: l.description.trim() || null,
    quantity: parseAmount(l.quantity || '0'),
    unitPrice: parseAmount(l.unitPrice || '0'),
    vatRate: l.vatRate,
  }));
}

export function emptyLine(vatRate: number): EditLine {
  return { key: newKey(), label: '', description: '', quantity: '1', unitPrice: '', vatRate };
}

const small = 'w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 transition-colors';

export default function InvoiceDraftForm({ value, onChange }: { value: DraftState; onChange: (next: DraftState) => void }) {
  const setLine = (key: string, patch: Partial<EditLine>) =>
    onChange({ ...value, lines: value.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const removeLine = (key: string) => onChange({ ...value, lines: value.lines.filter((l) => l.key !== key) });
  const addLine = () => onChange({ ...value, lines: [...value.lines, emptyLine(value.lines.at(-1)?.vatRate ?? VAT_RATES[0])] });
  const setBuyer = (patch: Partial<Party>) => onChange({ ...value, buyer: { ...value.buyer, ...patch } });

  return (
    <div className="space-y-4">
      {/* Lignes */}
      <section className={cn(cardCls, 'p-4 sm:p-5')} aria-labelledby="lines-title">
        <h2 id="lines-title" className="text-lg font-semibold text-gray-900">Lignes de la facture</h2>
        <p className="text-sm text-gray-500 mt-0.5">Reprises du devis. Ajustez-les si besoin : un montant négatif sert de déduction.</p>
        <ol className="mt-4 space-y-3">
          {value.lines.map((l, i) => {
            const total = lineHT({ quantity: parseAmount(l.quantity || '0'), unitPrice: parseAmount(l.unitPrice || '0') });
            return (
              <li key={l.key} className="rounded-2xl bg-gray-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`label-${l.key}`} className="sr-only">Désignation de la ligne {i + 1}</label>
                    <input id={`label-${l.key}`} value={l.label} onChange={(e) => setLine(l.key, { label: e.target.value })}
                      placeholder="Désignation" className={cn(small, 'font-medium', !l.label.trim() && 'border-danger/40')} />
                  </div>
                  <button type="button" onClick={() => removeLine(l.key)} className={iconBtnDanger} aria-label={`Supprimer la ligne ${l.label || i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <label htmlFor={`desc-${l.key}`} className="sr-only">Description de la ligne {i + 1}</label>
                <textarea id={`desc-${l.key}`} value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} rows={1}
                  placeholder="Description (facultatif)" className={cn(small, 'h-auto min-h-11 py-2.5 resize-y text-sm')} />
                <div className="grid grid-cols-2 min-[440px]:grid-cols-[1fr_1.3fr_1fr] gap-2">
                  <div>
                    <label htmlFor={`qty-${l.key}`} className="block text-xs text-gray-600 mb-1">Quantité</label>
                    <input id={`qty-${l.key}`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} className={cn(small, 'tabular-nums')} />
                  </div>
                  <div>
                    <label htmlFor={`pu-${l.key}`} className="block text-xs text-gray-600 mb-1">Prix unitaire HT (€)</label>
                    <input id={`pu-${l.key}`} inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} className={cn(small, 'tabular-nums')} />
                  </div>
                  <div className="col-span-2 min-[440px]:col-span-1">
                    <label htmlFor={`vat-${l.key}`} className="block text-xs text-gray-600 mb-1">TVA</label>
                    <select id={`vat-${l.key}`} value={l.vatRate} onChange={(e) => setLine(l.key, { vatRate: Number(e.target.value) })} className={small}>
                      {[...new Set<number>([...VAT_RATES, l.vatRate])].map((r) => <option key={r} value={r}>{vatLabel(r)}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-right text-sm text-gray-600">Total HT <span className="font-semibold text-gray-900 tabular-nums">{Number.isFinite(total) ? formatCurrency(total) : '–'}</span></p>
              </li>
            );
          })}
        </ol>
        <button type="button" onClick={addLine} className={cn(btnSecondary, 'mt-3 w-full sm:w-auto')}><Plus className="h-4 w-4" />Ajouter une ligne</button>
      </section>

      {/* Client */}
      <section className={cn(cardCls, 'p-4 sm:p-5 space-y-3')} aria-labelledby="buyer-title">
        <h2 id="buyer-title" className="text-lg font-semibold text-gray-900">Client</h2>
        <label className="flex items-center gap-3 min-h-10 cursor-pointer text-[15px] text-gray-700">
          <input type="checkbox" checked={!!value.buyer.isCompany} onChange={(e) => setBuyer({ isCompany: e.target.checked })} className="w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
          <span>Client professionnel <span className="text-gray-500">(entreprise, association, collectivité)</span></span>
        </label>
        <div>
          <label htmlFor="buyer-name" className={labelCls}>Nom{value.buyer.isCompany ? ' de l’entreprise' : ''}</label>
          <input id="buyer-name" value={value.buyer.name} onChange={(e) => setBuyer({ name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label htmlFor="buyer-address" className={labelCls}>Adresse{value.buyer.isCompany ? '' : <span className="font-normal text-gray-500"> (facultatif)</span>}</label>
          <textarea id="buyer-address" rows={2} value={value.buyer.address ?? ''} onChange={(e) => setBuyer({ address: e.target.value })} className={cn(inputCls, 'h-auto py-3 resize-none')} />
        </div>
        <div>
          <label htmlFor="buyer-email" className={labelCls}>Email <span className="font-normal text-gray-500">(facultatif)</span></label>
          <input id="buyer-email" type="email" value={value.buyer.email ?? ''} onChange={(e) => setBuyer({ email: e.target.value })} className={inputCls} />
        </div>
        {value.buyer.isCompany && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="buyer-siret" className={labelCls}>SIRET</label>
              <input id="buyer-siret" inputMode="numeric" value={value.buyer.siret ?? ''} onChange={(e) => setBuyer({ siret: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="buyer-vat" className={labelCls}>N° TVA <span className="font-normal text-gray-500">(facultatif)</span></label>
              <input id="buyer-vat" value={value.buyer.vatNumber ?? ''} onChange={(e) => setBuyer({ vatNumber: e.target.value })} className={inputCls} />
            </div>
          </div>
        )}
      </section>

      {/* Prestation et notes */}
      <section className={cn(cardCls, 'p-4 sm:p-5 space-y-3')} aria-labelledby="more-title">
        <h2 id="more-title" className="text-lg font-semibold text-gray-900">Prestation et notes</h2>
        <div>
          <label htmlFor="service-date" className={labelCls}>Date de la prestation</label>
          <input id="service-date" type="date" value={value.serviceDate} onChange={(e) => onChange({ ...value, serviceDate: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label htmlFor="notes" className={labelCls}>Notes sur la facture <span className="font-normal text-gray-500">(facultatif)</span></label>
          <textarea id="notes" rows={3} value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })}
            placeholder="Un mot pour le client, une référence de commande…" className={cn(inputCls, 'h-auto py-3 resize-none')} />
        </div>
      </section>
    </div>
  );
}
