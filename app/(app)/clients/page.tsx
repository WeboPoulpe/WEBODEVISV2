'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Users, Building2, User, Mail, Phone, FileText, Star,
  TrendingUp, StickyNote, Save, Loader2, CalendarDays, ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import Sheet, { SheetTabs } from '@/components/ui/Sheet';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  customer_type: 'particulier' | 'entreprise';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  notes?: string | null;
  quote_count?: number;
}

interface QuoteSummary {
  id: string;
  event_type: string;
  event_date: string | null;
  total_amount: number | null;
  status: string;
  created_at: string;
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ quotes }: { quotes: QuoteSummary[] }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return { label: d.toLocaleDateString('fr-FR', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), total: 0 };
  });
  // Only count accepted quotes for real revenue
  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted');
  acceptedQuotes.forEach((q) => {
    if (!q.total_amount) return;
    const d = new Date(q.created_at);
    const slot = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (slot) slot.total += q.total_amount;
  });
  const max = Math.max(...months.map((m) => m.total), 1);
  const totalCA = acceptedQuotes.reduce((s, q) => s + (q.total_amount ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">CA généré (6 derniers mois)</p>
        <p className="text-sm font-bold text-[#9c27b0]">{formatCurrency(totalCA)}</p>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 64 }}>
        {months.map((m) => {
          const pct = (m.total / max) * 100;
          return (
            <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center justify-end gap-1 group h-full">
              <div className="w-full flex items-end" style={{ height: 48 }}>
                <div
                  className="w-full bg-[#9c27b0]/25 rounded-t hover:bg-[#9c27b0]/60 transition-colors cursor-default relative group/bar"
                  style={{ height: `${Math.max(pct, m.total > 0 ? 12 : 2)}%`, minHeight: m.total > 0 ? 4 : 2 }}
                  title={m.total > 0 ? formatCurrency(m.total) : 'Aucun'}
                >
                  {m.total > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-[#9c27b0] font-medium whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none">
                      {formatCurrency(m.total)}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[9px] text-gray-400">{m.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Envoyé',     cls: 'bg-blue-50 text-blue-700' },
  accepted: { label: 'Accepté',    cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Refusé',     cls: 'bg-red-50 text-red-700' },
  pending:  { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
};

// ── Customer CRM Sheet ─────────────────────────────────────────────────────────
function CustomerSheet({
  customer, onClose, onUpdated,
}: {
  customer: Customer; onClose: () => void; onUpdated: (c: Customer) => void;
}) {
  const [tab, setTab] = useState<'infos' | 'notes' | 'historique'>('infos');
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form, setForm] = useState({ ...customer });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  const name = customer.customer_type === 'entreprise'
    ? customer.company_name
    : `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();

  useEffect(() => {
    if (tab !== 'historique' || quotes.length > 0) return;
    setLoadingQuotes(true);
    createClient()
      .from('quotes')
      .select('id, event_type, event_date, total_amount, status, created_at')
      .eq('client_email', customer.email)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setQuotes(data ?? []); setLoadingQuotes(false); });
  }, [tab, customer.email, quotes.length]);

  const handleSaveInfos = async () => {
    setSaving(true);
    const { error } = await createClient().from('customers').update({
      customer_type: form.customer_type,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      company_name: form.company_name || null,
      email: form.email,
      phone: form.phone || null,
    }).eq('id', customer.id);
    setSaving(false);
    if (!error) {
      setSaveOk(true);
      onUpdated({ ...customer, ...form });
      setTimeout(() => setSaveOk(false), 2000);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await createClient().from('customers').update({ notes }).eq('id', customer.id);
    setSavingNotes(false);
  };

  const TABS = [{ key: 'infos', label: 'Infos' }, { key: 'notes', label: 'Notes' }, { key: 'historique', label: 'Historique' }];

  return (
    <Sheet open onClose={onClose} title={name || '—'} subtitle={customer.email} width="w-[520px]">
      <SheetTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as typeof tab)} />

      {tab === 'infos' && (
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {(['particulier', 'entreprise'] as const).map((t) => (
              <button key={t} onClick={() => setForm({ ...form, customer_type: t })}
                className={['flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors', form.customer_type === t ? 'bg-[#9c27b0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}>
                {t}
              </button>
            ))}
          </div>
          {form.customer_type === 'particulier' ? (
            <div className="grid grid-cols-2 gap-3">
              <SField label="Prénom" value={form.first_name ?? ''} onChange={(v) => setForm({ ...form, first_name: v })} />
              <SField label="Nom" value={form.last_name ?? ''} onChange={(v) => setForm({ ...form, last_name: v })} />
            </div>
          ) : (
            <SField label="Entreprise" value={form.company_name ?? ''} onChange={(v) => setForm({ ...form, company_name: v })} />
          )}
          <SField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <SField label="Téléphone" value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
          <button onClick={handleSaveInfos} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Sauvegarde…' : saveOk ? '✓ Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
      )}

      {tab === 'notes' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <StickyNote className="h-4 w-4 text-[#9c27b0]" />
            <span>Notes commerciales — suivi, relances, contexte</span>
          </div>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={12}
            placeholder={'Appel du 12/03 — Intéressé par un package mariage.\nRappeler en juin pour confirmer la date.\nContact via Instagram…'}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors leading-relaxed"
          />
          <button onClick={handleSaveNotes} disabled={savingNotes}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors">
            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingNotes ? 'Sauvegarde…' : 'Sauvegarder les notes'}
          </button>
          <p className="text-[10px] text-gray-400">Nécessite une colonne <code className="bg-gray-100 px-1 rounded">notes</code> (text) dans la table <code className="bg-gray-100 px-1 rounded">customers</code>.</p>
        </div>
      )}

      {tab === 'historique' && (
        <div className="p-6 space-y-5">
          {loadingQuotes ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" /></div>
          ) : (
            <>
              <MiniBarChart quotes={quotes} />
              <div className="h-px bg-gray-100" />
              {quotes.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-4">Aucun devis pour ce client</p>
              ) : (
                <div className="space-y-2">
                  {quotes.map((q) => {
                    const st = STATUS_MAP[q.status] ?? STATUS_MAP.draft;
                    return (
                      <div key={q.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{q.event_type || '—'}</p>
                          {q.event_date && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <CalendarDays className="h-3 w-3" />{formatDate(q.event_date)}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                        {q.total_amount && (
                          <p className="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">{formatCurrency(q.total_amount)}</p>
                        )}
                        <Link href={`/devis/${q.id}/imprimer`} target="_blank" className="text-gray-300 hover:text-[#9c27b0] transition-colors flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ── Customer card ─────────────────────────────────────────────────────────────
function CustomerCard({ c, onOpen }: { c: Customer; onOpen: () => void }) {
  const isEntreprise = c.customer_type === 'entreprise';
  const displayName = isEntreprise ? c.company_name : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
  const isHabitual = (c.quote_count ?? 0) >= 3;

  return (
    <div onClick={onOpen} className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#9c27b0]/30 hover:shadow-sm transition-all cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={['w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', isEntreprise ? 'bg-blue-50' : 'bg-[#f3e5f5]'].join(' ')}>
          {isEntreprise ? <Building2 className="h-5 w-5 text-blue-500" /> : <User className="h-5 w-5 text-[#9c27b0]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{displayName || '—'}</p>
            {isHabitual && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full flex-shrink-0">
                <Star className="h-2.5 w-2.5" />Habitué
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 capitalize font-medium ${isEntreprise ? 'text-blue-500' : 'text-[#9c27b0]'}`}>{c.customer_type}</p>
        </div>
        <div className="flex-shrink-0 text-center">
          <div className={['w-10 h-10 rounded-xl flex flex-col items-center justify-center', (c.quote_count ?? 0) > 0 ? 'bg-[#f3e5f5]' : 'bg-gray-100'].join(' ')}>
            <FileText className={`h-3.5 w-3.5 ${(c.quote_count ?? 0) > 0 ? 'text-[#9c27b0]' : 'text-gray-400'}`} />
            <span className={`text-[10px] font-bold leading-none mt-0.5 ${(c.quote_count ?? 0) > 0 ? 'text-[#9c27b0]' : 'text-gray-400'}`}>{c.quote_count ?? 0}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">devis</p>
        </div>
      </div>
      <div className="mt-3.5 space-y-1.5">
        {c.email && <p className="flex items-center gap-2 text-sm text-gray-500 min-w-0"><Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" /><span className="truncate">{c.email}</span></p>}
        {c.phone && <p className="flex items-center gap-2 text-sm text-gray-500"><Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" /><span>{c.phone}</span></p>}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-[#9c27b0] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <TrendingUp className="h-3 w-3" />Ouvrir la fiche
        </span>
        <Link href={`/devis/nouveau?client=${c.id}`} onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium text-gray-500 hover:text-[#9c27b0] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="h-3 w-3" />Nouveau devis
        </Link>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 bg-gray-100 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-2/3" /><div className="h-3 bg-gray-100 rounded w-1/4" /></div>
        <div className="w-10 h-10 bg-gray-100 rounded-xl" />
      </div>
      <div className="mt-4 space-y-2"><div className="h-3 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
    </div>
  );
}

const FILTERS = ['Tous', 'Particuliers', 'Entreprises', 'Habitués'];

export default function ClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Tous');
  const [sheetCustomer, setSheetCustomer] = useState<Customer | null>(null);

  const loadCustomers = useCallback(async () => {
    const supabase = createClient();
    const { data: cust } = await supabase
      .from('customers')
      .select('id, customer_type, first_name, last_name, company_name, email, phone, notes')
      .order('created_at', { ascending: false });
    if (!cust) { setLoading(false); return; }
    const { data: counts } = await supabase.from('quotes').select('client_email');
    const countMap: Record<string, number> = {};
    counts?.forEach(({ client_email }) => {
      if (client_email) countMap[client_email] = (countMap[client_email] ?? 0) + 1;
    });
    setCustomers(cust.map((c) => ({ ...c, quote_count: countMap[c.email] ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = customers.filter((c) => {
    const name = c.customer_type === 'entreprise' ? (c.company_name ?? '') : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'Tous' ||
      (filter === 'Particuliers' && c.customer_type === 'particulier') ||
      (filter === 'Entreprises' && c.customer_type === 'entreprise') ||
      (filter === 'Habitués' && (c.quote_count ?? 0) >= 3);
    return matchSearch && matchFilter;
  });

  const habitualsCount = customers.filter((c) => (c.quote_count ?? 0) >= 3).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '…' : `${customers.length} client${customers.length !== 1 ? 's' : ''}`}
            {!loading && habitualsCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {habitualsCount} habitué{habitualsCount > 1 ? 's' : ''} ⭐</span>}
          </p>
        </div>
        <Link href="/clients/nouveau" className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors self-start sm:self-auto">
          <Plus className="h-4 w-4" />Nouveau client
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou email…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={['flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', filter === f ? 'bg-[#9c27b0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4"><Users className="h-8 w-8 text-gray-400" /></div>
          <p className="text-gray-500 font-medium mb-1">Aucun client trouvé</p>
          <p className="text-sm text-gray-400 mb-4">{search ? 'Essayez d\'autres termes.' : 'Ajoutez votre premier client pour commencer.'}</p>
          {!search && <Link href="/clients/nouveau" className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] transition-colors"><Plus className="h-4 w-4" />Ajouter un client</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => <CustomerCard key={c.id} c={c} onOpen={() => setSheetCustomer(c)} />)}
        </div>
      )}

      {sheetCustomer && (
        <CustomerSheet
          customer={sheetCustomer}
          onClose={() => setSheetCustomer(null)}
          onUpdated={(updated) => {
            setCustomers((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
            setSheetCustomer(updated);
          }}
        />
      )}
    </div>
  );
}

function SField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string; }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors" />
    </div>
  );
}
