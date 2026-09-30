'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Users, Building2, User, Mail, Phone, FileText, Star,
  TrendingUp, StickyNote, Save, Loader2, CalendarDays, ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isConfirmed } from '@/lib/quoteStatus';
import { formatCurrency, formatDate } from '@/lib/utils';
import Sheet, { SheetTabs } from '@/components/ui/Sheet';
import { useAuth } from '@/context/AuthContext';
import ContactsEditor from '@/components/clients/ContactsEditor';
import { listContacts, saveContacts, type ContactDraft } from '@/lib/customerContacts';
import { cn } from '@/lib/utils';
import { FilePlus2 } from 'lucide-react';
import { btnPrimary, cardCls, iconBtn, inputCls, pill } from '@/components/ui/kit';

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
  // Only count confirmed quotes for real revenue
  const acceptedQuotes = quotes.filter((q) => isConfirmed(q.status));
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
        <p className="text-sm font-bold text-primary">{formatCurrency(totalCA)}</p>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 64 }}>
        {months.map((m) => {
          const pct = (m.total / max) * 100;
          return (
            <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center justify-end gap-1 group h-full">
              <div className="w-full flex items-end" style={{ height: 48 }}>
                <div
                  className="w-full bg-primary/25 rounded-t hover:bg-primary/60 transition-colors cursor-default relative group/bar"
                  style={{ height: `${Math.max(pct, m.total > 0 ? 12 : 2)}%`, minHeight: m.total > 0 ? 4 : 2 }}
                  title={m.total > 0 ? formatCurrency(m.total) : 'Aucun'}
                >
                  {m.total > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-primary font-medium whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none">
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
  const { user } = useAuth();
  const [tab, setTab] = useState<'infos' | 'notes' | 'historique'>('infos');
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form, setForm] = useState({ ...customer });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editContacts, setEditContacts] = useState<ContactDraft[]>([]);

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

  useEffect(() => {
    if (customer.customer_type !== 'entreprise') return;
    listContacts(customer.id).then((rows) =>
      setEditContacts(rows.map((r) => ({
        id: r.id, name: r.name, role: r.role ?? '', email: r.email ?? '',
        phone: r.phone ?? '', notes: r.notes ?? '', is_primary: r.is_primary,
      }))),
    );
  }, [customer.id, customer.customer_type]);

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
    if (error) {
      setSaving(false);
      alert('Erreur lors de la sauvegarde : ' + error.message);
      return;
    }
    if (form.customer_type === 'entreprise' && user) {
      const res = await saveContacts(customer.id, user.id, editContacts);
      if (res.error) {
        setSaving(false);
        alert('Erreur lors de la sauvegarde des contacts : ' + res.error);
        return;
      }
    }
    setSaving(false);
    setSaveOk(true);
    onUpdated({ ...customer, ...form });
    setTimeout(() => setSaveOk(false), 2000);
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
                className={['flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors', form.customer_type === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}>
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
          {form.customer_type === 'entreprise' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Contacts</h3>
              <p className="text-xs text-gray-400 mb-3">Ajoutez les interlocuteurs (décideur, comptabilité…). Le contact principal alimente les champs de contact par défaut.</p>
              <ContactsEditor value={editContacts} onChange={setEditContacts} />
            </div>
          )}
          <button onClick={handleSaveInfos} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Sauvegarde…' : saveOk ? '✓ Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
      )}

      {tab === 'notes' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <StickyNote className="h-4 w-4 text-primary" />
            <span>Notes commerciales — suivi, relances, contexte</span>
          </div>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={12}
            placeholder={'Appel du 12/03 — Intéressé par un package mariage.\nRappeler en juin pour confirmer la date.\nContact via Instagram…'}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors leading-relaxed"
          />
          <button onClick={handleSaveNotes} disabled={savingNotes}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingNotes ? 'Sauvegarde…' : 'Sauvegarder les notes'}
          </button>
        </div>
      )}

      {tab === 'historique' && (
        <div className="p-6 space-y-5">
          {loadingQuotes ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
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
                        <Link href={`/devis/${q.id}/imprimer`} target="_blank" className="text-gray-300 hover:text-primary transition-colors flex-shrink-0">
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

// ── Ligne de la liste ─────────────────────────────────────────────────────────
function CustomerRow({ c, onOpen }: { c: Customer; onOpen: () => void }) {
  const isEntreprise = c.customer_type === 'entreprise';
  const displayName = (isEntreprise ? c.company_name : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()) || 'Sans nom';
  const initials = displayName.split(/\s+/).filter((w) => /^[\p{L}]/u.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  const count = c.quote_count ?? 0;

  return (
    <li className="flex items-center gap-1 pr-2 sm:pr-3 hover:bg-gray-50 transition-colors">
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 text-left pl-4 sm:pl-5 py-3.5">
        <span aria-hidden className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center flex-shrink-0">
          {isEntreprise ? <Building2 className="h-[18px] w-[18px]" /> : initials || <User className="h-[18px] w-[18px]" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{displayName}</span>
            {count >= 3 && <span className={cn(pill, 'bg-primary-50 text-primary-700')}>Habitué</span>}
          </span>
          <span className="block text-sm text-gray-500 truncate mt-0.5 lg:hidden">{c.email || c.phone || (isEntreprise ? 'Entreprise' : 'Particulier')}</span>
          <span className="hidden lg:block text-sm text-gray-500 mt-0.5">{isEntreprise ? 'Entreprise' : 'Particulier'}</span>
        </span>
        <span className="hidden lg:block w-64 text-sm text-gray-700 truncate">{c.email}</span>
        <span className="hidden xl:block w-32 text-sm text-gray-700 tabular-nums whitespace-nowrap">{c.phone}</span>
        <span className={cn('w-16 text-right text-sm whitespace-nowrap', count ? 'text-gray-900 font-medium' : 'text-gray-400')}>
          {count} devis
        </span>
      </button>
      <Link href={`/devis/nouveau?client=${c.id}`} className={iconBtn} aria-label={`Nouveau devis pour ${displayName}`} title="Nouveau devis">
        <FilePlus2 className="h-[18px] w-[18px]" />
      </Link>
    </li>
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
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? ' ' : `${customers.length} client${customers.length !== 1 ? 's' : ''}${habitualsCount > 0 ? `, dont ${habitualsCount} habitué${habitualsCount > 1 ? 's' : ''}` : ''}`}
          </p>
        </div>
        <Link href="/clients/nouveau" className={btnPrimary}>
          <Plus className="h-4 w-4" />Nouveau client
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou email" aria-label="Rechercher un client"
            className={cn(inputCls, 'pl-11')} />
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70 overflow-x-auto scrollbar-none" role="tablist" aria-label="Clients affichés">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn('flex-1 lg:flex-none flex-shrink-0 h-10 px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">{search || filter !== 'Tous' ? 'Aucun client ne correspond' : 'Aucun client pour le moment'}</p>
          <p className="text-sm text-gray-500 mb-5 max-w-sm">
            {search || filter !== 'Tous' ? 'Essayez un autre nom ou un autre filtre.' : 'Un client est créé à chaque nouveau devis. Vous pouvez aussi en ajouter un à la main.'}
          </p>
          {!search && filter === 'Tous' && <Link href="/clients/nouveau" className={btnPrimary}><Plus className="h-4 w-4" />Nouveau client</Link>}
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {filtered.map((c) => <CustomerRow key={c.id} c={c} onOpen={() => setSheetCustomer(c)} />)}
        </ul>
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
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
    </div>
  );
}
