'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Loader2, Wallet, Receipt, Percent, Calculator } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  quoteId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Service { name: string; quantity: number; unitPrice: number; isFree?: boolean; isOption?: boolean; removed?: boolean; isPageBreak?: boolean; [key: string]: any; }

export default function FinanceSheet({ open, onClose, quoteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [vatRate, setVatRate] = useState(20);
  const [costMap, setCostMap] = useState<Record<string, number>>({});           // key → unit cost
  const [catalogIds, setCatalogIds] = useState<Record<string, string>>({});     // key → prestation id
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [extraCosts, setExtraCosts] = useState<{ id: string; label: string; amount: number }[]>([]);

  useEffect(() => {
    if (!open || !quoteId) return;
    setLoading(true);
    const sb = createClient();
    sb.from('quotes').select('services, vat_rate').eq('id', quoteId).single()
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        const svcs = Array.isArray(data.services) ? data.services as Service[] : [];
        setServices(svcs.filter((s) => !s.isPageBreak && s.name));
        setVatRate(data.vat_rate ?? 20);

        const { data: prestations } = await sb.from('prestations').select('id, name, cost_price');
        const map: Record<string, number> = {};
        const ids: Record<string, string> = {};
        (prestations || []).forEach((p: { id: string; name: string; cost_price: number | null }) => {
          const key = (p.name || '').trim().toLowerCase();
          if (key) {
            map[key] = p.cost_price ?? 0;
            ids[key] = p.id;
          }
        });
        setCostMap(map);
        setCatalogIds(ids);
        setLoading(false);
      });
  }, [open, quoteId]);

  const keyOf = (name: string) => (name || '').trim().toLowerCase();
  const costFor = (name: string) => costMap[keyOf(name)] || 0;
  const isInCatalog = (name: string) => catalogIds[keyOf(name)] !== undefined;

  const startEdit = (name: string) => {
    if (!isInCatalog(name)) return;
    const key = keyOf(name);
    setEditingKey(key);
    setEditValue(String(costMap[key] || ''));
  };

  const saveEdit = async (name: string) => {
    const key = keyOf(name);
    const id = catalogIds[key];
    if (!id) { setEditingKey(null); return; }
    const parsed = parseFloat((editValue || '').replace(',', '.'));
    const newCost = isNaN(parsed) ? 0 : parsed;
    setSavingKey(key);
    const sb = createClient();
    await sb.from('prestations').update({ cost_price: newCost }).eq('id', id);
    setCostMap((prev) => ({ ...prev, [key]: newCost }));
    setEditingKey(null);
    setSavingKey(null);
  };

  const cancelEdit = () => { setEditingKey(null); setEditValue(''); };

  if (!open) return null;

  // Calculations
  const activeServices = services.filter((s) => !s.removed);
  const ca_ht = activeServices.reduce((sum, s) => sum + (s.isFree ? 0 : s.quantity * s.unitPrice), 0);
  const totalCost = activeServices.reduce((sum, s) => sum + s.quantity * costFor(s.name), 0);
  const extraTotal = extraCosts.reduce((sum, e) => sum + e.amount, 0);
  const totalChargesHT = totalCost + extraTotal;
  const margeHT = ca_ht - totalChargesHT;
  const margePercent = ca_ht > 0 ? (margeHT / ca_ht) * 100 : 0;
  const tva = ca_ht * (vatRate / 100);
  const ca_ttc = ca_ht + tva;

  const addExtra = () => setExtraCosts((prev) => [...prev, { id: crypto.randomUUID(), label: '', amount: 0 }]);
  const removeExtra = (id: string) => setExtraCosts((prev) => prev.filter((e) => e.id !== id));
  const updateExtra = (id: string, key: 'label' | 'amount', value: string | number) => {
    setExtraCosts((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e));
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex-shrink-0">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Gestion financière</h2>
              <p className="text-[10px] text-gray-400">Marge & rentabilité du devis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">
                    <Receipt className="h-3 w-3" />
                    Chiffre d&apos;affaires
                  </div>
                  <p className="text-xl font-bold text-blue-900 tabular-nums">{formatCurrency(ca_ht)}</p>
                  <p className="text-[10px] text-blue-600 mt-1">HT · TTC: {formatCurrency(ca_ttc)}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">
                    <Calculator className="h-3 w-3" />
                    Charges
                  </div>
                  <p className="text-xl font-bold text-amber-900 tabular-nums">{formatCurrency(totalChargesHT)}</p>
                  <p className="text-[10px] text-amber-600 mt-1">Coûts revient + extras</p>
                </div>
                <div className={`bg-gradient-to-br ${margeHT >= 0 ? 'from-emerald-50 to-emerald-100/50 border-emerald-200' : 'from-red-50 to-red-100/50 border-red-200'} border rounded-xl p-4`}>
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2 ${margeHT >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {margeHT >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    Marge brute
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${margeHT >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>{formatCurrency(margeHT)}</p>
                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${margeHT >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    <Percent className="h-2.5 w-2.5" />
                    {margePercent.toFixed(1)}% du CA
                  </p>
                </div>
              </div>

              {/* Détails par prestation */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Détail par prestation</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_70px_90px_70px_70px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    <span>Prestation</span>
                    <span className="text-right">Vente</span>
                    <span className="text-right">Coût</span>
                    <span className="text-right">Marge</span>
                    <span className="text-right">%</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {activeServices.map((svc, idx) => {
                      const sale = svc.isFree ? 0 : svc.quantity * svc.unitPrice;
                      const unitCost = costFor(svc.name);
                      const cost = svc.quantity * unitCost;
                      const m = sale - cost;
                      const pct = sale > 0 ? (m / sale) * 100 : 0;
                      const hasCost = unitCost > 0;
                      const inCatalog = isInCatalog(svc.name);
                      const key = keyOf(svc.name);
                      const isEditing = editingKey === key;
                      const isSaving = savingKey === key;
                      return (
                        <div key={idx} className="grid grid-cols-[1fr_70px_90px_70px_70px] gap-2 px-4 py-2.5 items-center text-xs">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{svc.name}</p>
                            <p className="text-[10px] text-gray-400">{svc.quantity} × {formatCurrency(svc.unitPrice)}{svc.isOption ? ' · Option' : ''}{svc.isFree ? ' · Inclus' : ''}</p>
                          </div>
                          <span className="text-right tabular-nums text-gray-900">{formatCurrency(sale)}</span>
                          {/* COÛT — éditable inline si la presta est au catalogue */}
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(svc.name)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.currentTarget.blur(); }
                                  else if (e.key === 'Escape') cancelEdit();
                                }}
                                placeholder="0.00"
                                className="w-full text-right text-xs px-1.5 py-1 border border-amber-400 rounded focus:outline-none focus:ring-2 focus:ring-amber-300"
                              />
                              <span className="text-[10px] text-gray-400">/u</span>
                            </div>
                          ) : inCatalog ? (
                            <button
                              onClick={() => startEdit(svc.name)}
                              title={hasCost ? `${formatCurrency(unitCost)} × ${svc.quantity} (cliquer pour modifier)` : 'Cliquer pour saisir le coût unitaire'}
                              className={`text-right tabular-nums hover:bg-amber-50 hover:ring-1 hover:ring-amber-300 rounded px-1.5 py-0.5 transition-all w-full ${
                                isSaving ? 'opacity-50' : ''
                              } ${hasCost ? 'text-amber-700' : 'text-gray-300 italic hover:text-amber-600 hover:not-italic'}`}
                            >
                              {hasCost ? formatCurrency(cost) : '+ ajouter'}
                            </button>
                          ) : (
                            <span title="Cette ligne n'est pas dans votre catalogue — créez-la d'abord pour pouvoir saisir un coût" className="text-right tabular-nums text-gray-300 italic">—</span>
                          )}
                          <span className={`text-right tabular-nums font-semibold ${hasCost ? (m >= 0 ? 'text-emerald-700' : 'text-red-600') : 'text-gray-300'}`}>{hasCost ? formatCurrency(m) : '—'}</span>
                          <span className={`text-right tabular-nums text-[10px] ${hasCost ? (m >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-300'}`}>{hasCost ? `${pct.toFixed(0)}%` : '—'}</span>
                        </div>
                      );
                    })}
                    {activeServices.length === 0 && (
                      <p className="px-4 py-6 text-center text-xs text-gray-400 italic">Aucune prestation</p>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 italic mt-2">💡 Cliquez sur la colonne <strong className="text-amber-600 not-italic">Coût</strong> pour saisir le prix de revient unitaire HT (sauvegardé sur la prestation, partagé avec tous tes devis).</p>
              </div>

              {/* Frais additionnels */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Frais additionnels</h3>
                  <button onClick={addExtra} className="text-xs text-[#9c27b0] hover:underline font-medium">+ Ajouter</button>
                </div>
                <div className="space-y-2">
                  {extraCosts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun frais additionnel. Ajoutez personnel, transport, frais fixes…</p>
                  ) : (
                    extraCosts.map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <input
                          value={e.label}
                          onChange={(ev) => updateExtra(e.id, 'label', ev.target.value)}
                          placeholder="Ex: Personnel supplémentaire"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                        />
                        <input
                          type="number" min={0} step={0.01}
                          value={e.amount || ''}
                          onChange={(ev) => updateExtra(e.id, 'amount', parseFloat(ev.target.value) || 0)}
                          placeholder="0.00"
                          className="w-28 text-sm text-right border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                        />
                        <button onClick={() => removeExtra(e.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Synthèse */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Synthèse</h3>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Chiffre d&apos;affaires HT</span><span className="font-semibold tabular-nums">{formatCurrency(ca_ht)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Coût des prestations</span><span className="text-amber-700 tabular-nums">- {formatCurrency(totalCost)}</span></div>
                {extraTotal > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Frais additionnels</span><span className="text-amber-700 tabular-nums">- {formatCurrency(extraTotal)}</span></div>
                )}
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span className="text-gray-900">Marge brute estimée</span>
                  <span className={`tabular-nums ${margeHT >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(margeHT)} ({margePercent.toFixed(1)}%)</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
