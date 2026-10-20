'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { quoteVatBreakdown, resolveGuestSplit } from '@/lib/quoteTotals';
import { catalogKey, quoteCost, staffCost, type StaffRow } from '@/lib/costing';

// Marge d'un devis : chiffre d'affaires HT, coûts par poste (prestations, frais annexes, personnel), marge brute.
// Coût d'une ligne : prix de revient de la prestation du catalogue de même nom, sinon celui porté par la ligne.
// Personnel : heures faites × taux des extras de l'événement (colonnes de la migration 0023, lues à part :
// tant que la base ne les a pas, le poste est simplement absent).

interface Props {
  open: boolean;
  onClose: () => void;
  quoteId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Service { name: string; quantity: number; unitPrice: number; isFree?: boolean; isOption?: boolean; removed?: boolean; isPageBreak?: boolean; [key: string]: any; }

interface Staff {
  /** Les colonnes existent en base. */
  available: boolean;
  cost: number;
  /** Extras de l'événement (missions non refusées). */
  missions: number;
  /** Missions sans heures ou sans taux : leur coût n'est pas compté. */
  incomplete: number;
}

const pct = (n: number | null) => (n == null ? '–' : `${String(n).replace('.', ',')} %`);

export default function FinanceSheet({ open, onClose, quoteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [vatRate, setVatRate] = useState(20);
  const [guests, setGuests] = useState({ adults: 0, children: 0 });
  const [costMap, setCostMap] = useState<Record<string, number>>({});           // clé → coût unitaire
  const [catalogIds, setCatalogIds] = useState<Record<string, string>>({});     // clé → id de la prestation
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [extraCosts, setExtraCosts] = useState<{ id: string; label: string; amount: number }[]>([]);
  const [staff, setStaff] = useState<Staff>({ available: false, cost: 0, missions: 0, incomplete: 0 });

  useEffect(() => {
    if (!open || !quoteId) return;
    setLoading(true);
    const sb = createClient();
    sb.from('quotes').select('services, vat_rate, extra_costs, guest_count, guest_count_adults, guest_count_children').eq('id', quoteId).single()
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        const svcs = Array.isArray(data.services) ? data.services as Service[] : [];
        setServices(svcs.filter((s) => !s.isPageBreak && s.name));
        setVatRate(data.vat_rate ?? 20);
        setGuests(resolveGuestSplit(data.guest_count, data.guest_count_adults, data.guest_count_children));
        setExtraCosts(Array.isArray(data.extra_costs)
          ? (data.extra_costs as { id: string; label: string; amount: number }[])
          : []);

        const [{ data: prestations }, missions] = await Promise.all([
          sb.from('prestations').select('id, name, cost_price'),
          sb.from('event_extras').select('status, arrival_time, departure_time, hours_worked, hourly_rate, extra:extras(hourly_rate)').eq('quote_id', quoteId),
        ]);
        const map: Record<string, number> = {};
        const ids: Record<string, string> = {};
        (prestations || []).forEach((p: { id: string; name: string; cost_price: number | string | null }) => {
          const key = catalogKey(p.name);
          if (key) {
            map[key] = Number(p.cost_price ?? 0) || 0;
            ids[key] = p.id;
          }
        });
        setCostMap(map);
        setCatalogIds(ids);

        // Colonnes absentes (migration pas encore appliquée) : pas de poste « personnel ».
        if (missions.error) setStaff({ available: false, cost: 0, missions: 0, incomplete: 0 });
        else {
          type Row = { status: string | null; arrival_time: string | null; departure_time: string | null; hours_worked: unknown; hourly_rate: unknown; extra: { hourly_rate: unknown } | null };
          const rows: StaffRow[] = ((missions.data ?? []) as Row[]).filter((r) => r.status !== 'refuse').map((r) => ({
            status: r.status, arrival_time: r.arrival_time, departure_time: r.departure_time, hours_worked: r.hours_worked as StaffRow['hours_worked'],
            hourly_rate: r.hourly_rate as StaffRow['hourly_rate'], extra_rate: (r.extra?.hourly_rate ?? null) as StaffRow['extra_rate'],
          }));
          setStaff({
            available: true,
            cost: staffCost(rows),
            missions: rows.length,
            incomplete: rows.filter((r) => staffCost([r]) === 0).length,
          });
        }
        setLoading(false);
      });
  }, [open, quoteId]);

  // Persiste les frais additionnels (débounce).
  useEffect(() => {
    if (loading || !open || !quoteId) return;
    const t = setTimeout(() => {
      // La requête ne part que si on attend son résultat.
      createClient().from('quotes').update({ extra_costs: extraCosts }).eq('id', quoteId)
        .then(({ error }) => { if (error) console.error('Frais additionnels non enregistrés :', error.message); });
    }, 600);
    return () => clearTimeout(t);
  }, [extraCosts, loading, open, quoteId]);

  const catalog = useMemo(() => new Map(Object.entries(costMap)), [costMap]);
  const isInCatalog = (name: string) => catalogIds[catalogKey(name)] !== undefined;

  const startEdit = (name: string) => {
    if (!isInCatalog(name)) return;
    const key = catalogKey(name);
    setEditingKey(key);
    setEditValue(String(costMap[key] || ''));
  };

  const saveEdit = async (name: string) => {
    const key = catalogKey(name);
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

  // Options comprises, comme dans le détail des lignes ci-dessous.
  const result = quoteCost({
    services, catalog, extraCosts, staffCost: staff.cost,
    adults: guests.adults, children: guests.children, includeOptions: true,
  });
  const ca_ht = result.revenueHT;
  const m = result.margin;
  const positive = m.amount >= 0;
  // TTC au taux de chaque ligne (sinon celui du devis), options comprises comme le CA HT.
  const ca_ttc = quoteVatBreakdown(services.filter((s) => !s.removed), vatRate, guests.adults, guests.children, { includeOptions: true }).ttc;

  const addExtra = () => setExtraCosts((prev) => [...prev, { id: crypto.randomUUID(), label: '', amount: 0 }]);
  const removeExtra = (id: string) => setExtraCosts((prev) => prev.filter((e) => e.id !== id));
  const updateExtra = (id: string, key: 'label' | 'amount', value: string | number) => {
    setExtraCosts((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e));
  };

  const posts: { label: string; amount: number; hint?: string }[] = [
    { label: 'Prestations (prix de revient)', amount: result.materialCost },
    { label: 'Frais annexes', amount: result.extraCost },
    ...(staff.available ? [{
      label: 'Personnel (extras)', amount: result.staffCost,
      hint: staff.missions === 0
        ? 'Aucun extra sur cet événement'
        : staff.incomplete > 0 ? `${staff.incomplete} extra${staff.incomplete > 1 ? 's' : ''} sans heures ou sans taux, non compté${staff.incomplete > 1 ? 's' : ''}` : undefined,
    }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-primary-50 text-primary rounded-xl flex-shrink-0">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Marge du devis</h2>
              <p className="text-sm text-gray-500">Chiffre d’affaires, coûts et marge brute, hors taxes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Chiffres clés */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="finance-kpis">
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-sm text-gray-600">Chiffre d’affaires HT</p>
                  <p className="font-display text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatCurrency(ca_ht)}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{formatCurrency(ca_ttc)} TTC</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-sm text-gray-600">Coûts</p>
                  <p className="font-display text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatCurrency(result.totalCost)}</p>
                  <p className="text-sm text-gray-500 mt-0.5">Prestations, frais{staff.available ? ', personnel' : ''}</p>
                </div>
                <div className={`border rounded-2xl p-4 ${positive ? 'bg-sage-100/50 border-gray-200' : 'bg-danger/5 border-danger/30'}`}>
                  <p className="text-sm text-gray-600">Marge brute</p>
                  <p className={`font-display text-2xl font-bold tabular-nums mt-1 ${positive ? 'text-gray-900' : 'text-danger'}`}>{formatCurrency(m.amount)}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {pct(m.rate)} du CA{m.coefficient != null && <>, coefficient {String(m.coefficient).replace('.', ',')}</>}
                  </p>
                </div>
              </div>

              {!result.hasCost && ca_ht > 0 && (
                <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[15px] text-amber-900">
                  Aucun coût n’est renseigné : la marge affichée est le chiffre d’affaires. Saisissez le coût des prestations ci-dessous.
                </p>
              )}

              {/* Coûts par poste */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Coûts par poste</h3>
                <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
                  {posts.map((p) => (
                    <li key={p.label} className="flex items-baseline justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-[15px] text-gray-800">{p.label}</span>
                        {p.hint && <span className="block text-sm text-gray-500">{p.hint}</span>}
                      </span>
                      <span className="font-display font-semibold tabular-nums whitespace-nowrap text-gray-900">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Détail par prestation */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Détail par prestation</h3>
                <div className="border border-gray-200 rounded-2xl overflow-x-auto"><div className="min-w-[460px]">
                  <div className="grid grid-cols-[1fr_70px_90px_70px_50px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span>Prestation</span>
                    <span className="text-right">Vente</span>
                    <span className="text-right">Coût</span>
                    <span className="text-right">Marge</span>
                    <span className="text-right">%</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {result.lines.map((line, idx) => {
                      const hasCost = line.unitCost != null;
                      const lm = line.sale - line.cost;
                      const lp = line.sale > 0 ? (lm / line.sale) * 100 : 0;
                      const inCatalog = isInCatalog(line.name);
                      const key = catalogKey(line.name);
                      const isEditing = editingKey === key;
                      const isSaving = savingKey === key;
                      return (
                        <div key={idx} className="grid grid-cols-[1fr_70px_90px_70px_50px] gap-2 px-4 py-2.5 items-center text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{line.name}</p>
                            <p className="text-xs text-gray-500">{line.quantity} × {formatCurrency(line.unitPrice)}{line.isOption ? ', option' : ''}{line.isFree ? ', offert' : ''}</p>
                          </div>
                          <span className="text-right tabular-nums text-gray-900">{formatCurrency(line.sale)}</span>
                          {/* Coût : modifiable sur place si la prestation est au catalogue */}
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(line.name)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.currentTarget.blur(); }
                                  else if (e.key === 'Escape') cancelEdit();
                                }}
                                placeholder="0.00"
                                aria-label={`Coût unitaire de ${line.name}`}
                                className="w-full text-right text-sm px-1.5 py-1 border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <span className="text-xs text-gray-400">/u</span>
                            </div>
                          ) : inCatalog ? (
                            <button
                              onClick={() => startEdit(line.name)}
                              title={hasCost ? `${formatCurrency(line.unitCost!)} × ${line.quantity} (toucher pour modifier)` : 'Toucher pour saisir le coût unitaire'}
                              className={`text-right tabular-nums hover:bg-primary-50 hover:ring-1 hover:ring-primary-300 rounded px-1.5 py-0.5 transition-all w-full ${
                                isSaving ? 'opacity-50' : ''
                              } ${hasCost ? 'text-gray-900' : 'text-gray-400 italic hover:text-primary hover:not-italic'}`}
                            >
                              {hasCost ? formatCurrency(line.cost) : '+ ajouter'}
                            </button>
                          ) : hasCost ? (
                            <span className="text-right tabular-nums text-gray-900">{formatCurrency(line.cost)}</span>
                          ) : (
                            <span title="Cette ligne n’est pas dans votre catalogue : créez-la d’abord pour pouvoir saisir un coût" className="text-right tabular-nums text-gray-300 italic">–</span>
                          )}
                          <span className={`text-right tabular-nums font-semibold ${hasCost ? (lm >= 0 ? 'text-gray-900' : 'text-danger') : 'text-gray-300'}`}>{hasCost ? formatCurrency(lm) : '–'}</span>
                          <span className={`text-right tabular-nums text-xs ${hasCost ? (lm >= 0 ? 'text-gray-600' : 'text-danger') : 'text-gray-300'}`}>{hasCost ? `${lp.toFixed(0)}%` : '–'}</span>
                        </div>
                      );
                    })}
                    {result.lines.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-gray-400 italic">Aucune prestation</p>
                    )}
                  </div>
                </div></div>
                <p className="text-sm text-gray-500 mt-2">Touchez la colonne Coût pour saisir le prix de revient unitaire HT. Il est enregistré sur la prestation et sert à tous vos devis.</p>
              </div>

              {/* Frais annexes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Frais annexes</h3>
                  <button onClick={addExtra} className="min-h-10 text-sm text-primary hover:underline font-medium">+ Ajouter</button>
                </div>
                <div className="space-y-2">
                  {extraCosts.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucun frais annexe. Ajoutez transport, location, frais fixes…</p>
                  ) : (
                    extraCosts.map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <input
                          value={e.label}
                          onChange={(ev) => updateExtra(e.id, 'label', ev.target.value)}
                          placeholder="Ex : transport"
                          aria-label="Libellé du frais"
                          className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                        <input
                          type="number" min={0} step={0.01}
                          value={e.amount || ''}
                          onChange={(ev) => updateExtra(e.id, 'amount', parseFloat(ev.target.value) || 0)}
                          placeholder="0.00"
                          aria-label="Montant HT du frais"
                          className="w-28 text-sm text-right border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                        <button onClick={() => removeExtra(e.id)} className="p-2 text-gray-300 hover:text-danger hover:bg-danger/5 rounded" aria-label="Retirer ce frais">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {staff.available && (
                  <p className="text-sm text-gray-500 mt-2">Le personnel est compté d’après les heures des extras, dans l’onglet Extras de l’événement.</p>
                )}
              </div>

              {/* Synthèse */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Chiffre d’affaires HT</span><span className="font-semibold tabular-nums">{formatCurrency(ca_ht)}</span></div>
                {posts.filter((p) => p.amount > 0).map((p) => (
                  <div key={p.label} className="flex justify-between text-sm"><span className="text-gray-600">{p.label}</span><span className="tabular-nums">- {formatCurrency(p.amount)}</span></div>
                ))}
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between gap-3 text-sm font-bold">
                  <span className="text-gray-900">Marge brute estimée</span>
                  <span className={`tabular-nums text-right ${positive ? 'text-gray-900' : 'text-danger'}`}>{formatCurrency(m.amount)} ({pct(m.rate)})</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
