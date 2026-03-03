'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDevis } from '@/context/DevisContext';
import { ArrowRight, Search, X, Plus, User, Building2, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Sheet from '@/components/ui/Sheet';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CustomerResult {
  id: string;
  customer_type: 'particulier' | 'entreprise';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
}

interface Props {
  onNext: () => void;
}

// ── Client search combobox ────────────────────────────────────────────────────
function ClientCombobox({
  onSelect,
}: {
  onSelect: (c: CustomerResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('customers')
        .select('id, customer_type, first_name, last_name, company_name, email, phone')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      setResults(data ?? []);
      setOpen(true);
      setSearching(false);
    }, 300);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        {searching
          ? <Loader2 className="absolute left-3 h-4 w-4 text-[#9c27b0] animate-spin pointer-events-none" />
          : <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
        }
        <input
          className="w-full pl-10 pr-9 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors placeholder:text-gray-400"
          placeholder="Rechercher un client par nom, entreprise ou email…"
          value={query}
          onChange={handleChange}
          onFocus={() => query && results.length > 0 && setOpen(true)}
        />
        {query && (
          <button
            type="button"
            onMouseDown={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-3 text-gray-300 hover:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <ul className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-400 italic">Aucun client trouvé</li>
          ) : (
            results.map((c) => {
              const name = c.customer_type === 'entreprise'
                ? c.company_name
                : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
              return (
                <li
                  key={c.id}
                  onMouseDown={() => { onSelect(c); setOpen(false); setQuery(''); }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#9c27b0]/5 border-b border-gray-50 last:border-0 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.customer_type === 'entreprise' ? 'bg-blue-50' : 'bg-[#f3e5f5]'}`}>
                    {c.customer_type === 'entreprise'
                      ? <Building2 className="h-4 w-4 text-blue-500" />
                      : <User className="h-4 w-4 text-[#9c27b0]" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{name || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

// ── Selected client card ──────────────────────────────────────────────────────
function SelectedClientCard({
  customer,
  onClear,
}: {
  customer: CustomerResult;
  onClear: () => void;
}) {
  const name = customer.customer_type === 'entreprise'
    ? customer.company_name
    : `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();

  return (
    <div className="flex items-center gap-3 p-4 bg-[#f3e5f5]/40 border border-[#9c27b0]/20 rounded-xl">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${customer.customer_type === 'entreprise' ? 'bg-blue-100' : 'bg-[#f3e5f5]'}`}>
        {customer.customer_type === 'entreprise'
          ? <Building2 className="h-5 w-5 text-blue-500" />
          : <User className="h-5 w-5 text-[#9c27b0]" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate">{name || '—'}</p>
          <CheckCircle2 className="h-4 w-4 text-[#9c27b0] flex-shrink-0" />
        </div>
        <p className="text-sm text-gray-500 truncate">{customer.email}</p>
        {customer.phone && <p className="text-xs text-gray-400">{customer.phone}</p>}
      </div>
      <button
        onClick={onClear}
        className="text-xs text-gray-500 hover:text-gray-700 underline flex-shrink-0"
      >
        Changer
      </button>
    </div>
  );
}

// ── New client form (inside sheet) ────────────────────────────────────────────
function NewClientForm({
  onCreated,
}: {
  onCreated: (c: CustomerResult) => void;
}) {
  const [type, setType] = useState<'particulier' | 'entreprise'>('particulier');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!email.trim()) { setError('L\'email est requis'); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.from('customers').insert([{
      customer_type: type,
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: companyName || null,
      email,
      phone: phone || null,
    }]).select().single();

    setSaving(false);
    if (err) { setError(err.message); return; }
    if (data) onCreated(data as CustomerResult);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Type toggle */}
      <div className="flex gap-2">
        {(['particulier', 'entreprise'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={['flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors', type === t ? 'bg-[#9c27b0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {type === 'particulier' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" value={firstName} onChange={setFirstName} placeholder="Jean" />
          <Field label="Nom" value={lastName} onChange={setLastName} placeholder="Dupont" />
        </div>
      ) : (
        <Field label="Nom de l'entreprise" value={companyName} onChange={setCompanyName} placeholder="SARL Dupont" />
      )}

      <Field label="Email *" type="email" value={email} onChange={setEmail} placeholder="jean@exemple.fr" />
      <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="06 00 00 00 00" />

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {saving ? 'Enregistrement…' : 'Créer le client'}
      </button>
    </div>
  );
}

// ── Main step ─────────────────────────────────────────────────────────────────
export default function StepClientEvent({ onNext }: Props) {
  const { state, dispatch } = useDevis();
  const { clientInfo, eventInfo } = state;

  type InputMode = 'search' | 'manual' | 'selected';
  const [mode, setMode] = useState<InputMode>('search');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const setEvent = (field: string, value: string | number) =>
    dispatch({ type: 'UPDATE_EVENT', payload: { [field]: value } });
  const setClient = (field: string, value: string) =>
    dispatch({ type: 'UPDATE_CLIENT', payload: { [field]: value } });

  const handleSelectCustomer = (c: CustomerResult) => {
    setSelectedCustomer(c);
    setMode('selected');
    dispatch({
      type: 'UPDATE_CLIENT',
      payload: {
        type: c.customer_type,
        firstName: c.first_name ?? '',
        lastName: c.last_name ?? '',
        companyName: c.company_name ?? '',
        email: c.email,
        phone: c.phone ?? '',
        contactName: '',
      },
    });
  };

  const handleClear = () => {
    setSelectedCustomer(null);
    setMode('search');
    dispatch({
      type: 'UPDATE_CLIENT',
      payload: { firstName: '', lastName: '', companyName: '', email: '', phone: '', contactName: '' },
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* ── Client ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Client</h2>
          {mode !== 'selected' && (
            <button
              onClick={() => setMode(mode === 'manual' ? 'search' : 'manual')}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 underline"
            >
              {mode === 'manual' ? 'Rechercher existant' : 'Saisir manuellement'}
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* ── Mode: selected ── */}
        {mode === 'selected' && selectedCustomer && (
          <SelectedClientCard customer={selectedCustomer} onClear={handleClear} />
        )}

        {/* ── Mode: search ── */}
        {mode === 'search' && (
          <div className="space-y-3">
            <ClientCombobox onSelect={handleSelectCustomer} />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">ou</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button
              onClick={() => setSheetOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-[#9c27b0]/30 rounded-xl text-sm font-medium text-[#9c27b0] hover:bg-[#9c27b0]/5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Créer un nouveau client
            </button>
          </div>
        )}

        {/* ── Mode: manual ── */}
        {mode === 'manual' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            {/* Type toggle */}
            <div className="flex gap-2">
              {(['particulier', 'entreprise'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setClient('type', t)}
                  className={['px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors', clientInfo.type === t ? 'bg-[#9c27b0] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clientInfo.type === 'particulier' ? (
                <>
                  <Field label="Prénom *" value={clientInfo.firstName} onChange={(v) => setClient('firstName', v)} placeholder="Jean" />
                  <Field label="Nom *" value={clientInfo.lastName} onChange={(v) => setClient('lastName', v)} placeholder="Dupont" />
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <Field label="Entreprise *" value={clientInfo.companyName} onChange={(v) => setClient('companyName', v)} placeholder="SARL Dupont" />
                  </div>
                  <Field label="Contact" value={clientInfo.contactName} onChange={(v) => setClient('contactName', v)} placeholder="Jean Dupont" />
                </>
              )}
              <Field label="Email *" type="email" value={clientInfo.email} onChange={(v) => setClient('email', v)} placeholder="jean@exemple.fr" />
              <Field label="Téléphone" value={clientInfo.phone} onChange={(v) => setClient('phone', v)} placeholder="06 00 00 00 00" />
              <div className="sm:col-span-2">
                <Field label="Adresse de prestation" value={clientInfo.address} onChange={(v) => setClient('address', v)} placeholder="12 rue de la Paix, Paris" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Événement ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Événement</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Type d'événement *"
            value={eventInfo.eventType}
            onChange={(v) => setEvent('eventType', v)}
            placeholder="Mariage, anniversaire…"
          />
          <Field
            label="Date *"
            type="date"
            value={eventInfo.eventDate}
            onChange={(v) => setEvent('eventDate', v)}
          />
          <Field
            label="Nombre d'invités"
            type="number"
            value={eventInfo.guestCount > 0 ? String(eventInfo.guestCount) : ''}
            onChange={(v) => setEvent('guestCount', parseInt(v) || 0)}
            placeholder="50"
          />
          <div className="sm:col-span-2">
            <Field
              label="Lieu de l'événement"
              value={eventInfo.eventLocation}
              onChange={(v) => setEvent('eventLocation', v)}
              placeholder="Château de Versailles, Paris 16e…"
            />
          </div>
        </div>
      </section>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] transition-colors"
        >
          Suivant
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Sheet: Nouveau client ─────────────────────────────────── */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Nouveau client"
        subtitle="Le client sera enregistré dans votre base"
        width="w-[440px]"
      >
        <NewClientForm
          onCreated={(c) => {
            handleSelectCustomer(c);
            setSheetOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}

// ── Shared field ──────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
      />
    </div>
  );
}
