'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, Loader2, Plus, Trash2, Search, X, Eye,
  User, CalendarDays, ChefHat, Settings2, Scissors, PencilLine, Check, LayoutTemplate,
  AlertTriangle, ClipboardCopy,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { generateQuoteHtml } from '@/lib/generateQuoteHtml';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ServiceLine {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  category?: string;
  isCustom?: boolean;
  isPageBreak?: boolean;
}

interface ClientInfo {
  type: 'particulier' | 'entreprise';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  companyName: string;
  contactName: string;
}

interface EventInfo {
  eventType: string;
  eventDate: string;
  guestCount: number;
  eventLocation: string;
}

interface Options {
  vatRate: number;
  hidePrice: boolean;
  remarks: string;
  images: string[];
}

type QuoteTemplate = 'standard' | 'mariage' | 'business';

interface Props {
  quoteId: string;
  initialStatus: string;
  initialTemplate: string;
  initialClient: ClientInfo;
  initialEvent: EventInfo;
  initialServices: ServiceLine[];
  initialOptions: Options;
  /** True when the quote already has a saved WeboWord (content_html) */
  hasContentHtml?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function totalHT(services: ServiceLine[]) {
  return services
    .filter((s) => !s.isPageBreak)
    .reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
}

const EVENT_TYPES = ['Mariage', 'Anniversaire', 'Cocktail', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'];
const VAT_RATES   = [20, 10, 5.5, 0];
const TEMPLATES: { key: QuoteTemplate; label: string }[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'mariage',  label: 'Mariage'  },
  { key: 'business', label: 'Business' },
];

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors';

// ── Catalog combobox ──────────────────────────────────────────────────────────
interface CatalogItem { id: string; name: string; unit_price: number; category: string | null; description: string | null; }

function PrestationSearch({
  value, onNameChange, onSelect,
}: { value: string; onNameChange: (v: string) => void; onSelect: (p: CatalogItem) => void }) {
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const { data } = await createClient().from('prestations').select('id, name, unit_price, category, description').ilike('name', `%${q}%`).limit(8);
      if (data?.length) { setResults(data); setOpen(true); } else { setResults([]); setOpen(false); }
    }, 300);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          className="w-full text-sm border border-gray-200 rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
          placeholder="Chercher dans le catalogue…"
          value={value}
          onChange={(e) => { onNameChange(e.target.value); search(e.target.value); }}
          onFocus={() => value && results.length > 0 && setOpen(true)}
        />
        {value && <button type="button" onMouseDown={() => { onNameChange(''); setResults([]); setOpen(false); }} className="absolute right-2 text-gray-300 hover:text-gray-500"><X className="h-3.5 w-3.5" /></button>}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id} onMouseDown={() => { onSelect(p); setResults([]); setOpen(false); }} className="px-3 py-2.5 cursor-pointer hover:bg-[#9c27b0]/5 border-b border-gray-50 last:border-0">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-gray-900 font-medium">{p.name}</p>
                <span className="text-xs text-gray-500 tabular-nums">{formatCurrency(p.unit_price)}</span>
              </div>
              {p.category && <span className="text-[10px] text-[#9c27b0] bg-[#f3e5f5] px-1.5 py-0.5 rounded">{p.category}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Service row ───────────────────────────────────────────────────────────────
function ServiceRow({
  service, onUpdate, onRemove,
}: { service: ServiceLine; onUpdate: (field: string, value: string | number) => void; onRemove: () => void }) {
  const [showDesc, setShowDesc] = useState(service.isCustom || !!service.description);
  const base = 'text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors';

  if (service.isPageBreak) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100">
        <div className="flex-1 border-t border-dashed border-[#9c27b0]/25" />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Scissors className="h-3 w-3 text-[#9c27b0]/40" />
          <span className="text-[9px] font-semibold text-[#9c27b0]/50 uppercase tracking-[0.18em]">Saut de page</span>
        </div>
        <div className="flex-1 border-t border-dashed border-[#9c27b0]/25" />
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="grid grid-cols-[1fr_64px_90px_78px_52px] gap-2 px-3 py-2 items-center">
        {service.isCustom ? (
          <div className="relative">
            <input
              className={`${base} w-full px-2.5 py-1.5 border-dashed border-[#9c27b0]/40`}
              placeholder="Titre de la prestation…"
              value={service.name}
              onChange={(e) => onUpdate('name', e.target.value)}
            />
          </div>
        ) : (
          <PrestationSearch
            value={service.name}
            onNameChange={(v) => onUpdate('name', v)}
            onSelect={(p) => {
              onUpdate('name', p.name);
              onUpdate('unitPrice', p.unit_price);
              onUpdate('category', p.category ?? '');
              onUpdate('description', p.description ?? '');
              if (p.description) setShowDesc(true);
            }}
          />
        )}
        <input
          type="number" min={1}
          className={`${base} px-2 py-1.5 text-center w-full`}
          value={service.quantity}
          onChange={(e) => onUpdate('quantity', parseFloat(e.target.value) || 1)}
        />
        <input
          type="number" min={0} step={0.01}
          className={`${base} px-2 py-1.5 text-right w-full`}
          value={service.unitPrice}
          onChange={(e) => onUpdate('unitPrice', parseFloat(e.target.value) || 0)}
        />
        <span className="text-sm font-semibold text-gray-900 text-right tabular-nums">
          {formatCurrency(service.quantity * service.unitPrice)}
        </span>
        <div className="flex gap-0.5 justify-end">
          {!service.isCustom && (
            <button
              title={showDesc ? 'Masquer la description' : 'Afficher la description'}
              onClick={() => setShowDesc((v) => !v)}
              className={`p-1 rounded-lg transition-colors ${showDesc ? 'text-[#9c27b0] bg-[#f3e5f5]' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
            >
              <PencilLine className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {showDesc && (
        <div className="px-3 pb-2 -mt-1">
          <textarea
            rows={1}
            value={service.description ?? ''}
            onChange={(e) => onUpdate('description', e.target.value)}
            placeholder="Description gastronomique (visible sur le devis)…"
            className="w-full text-xs text-gray-600 italic border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 placeholder:not-italic placeholder:text-gray-400 transition-colors"
            onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
          />
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="w-6 h-6 bg-[#f3e5f5] rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-[#9c27b0]" />
        </div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Live preview (generateQuoteHtml) ──────────────────────────────────────────
function useLiveHtml(
  template: QuoteTemplate,
  client: ClientInfo,
  event: EventInfo,
  services: ServiceLine[],
  options: Options,
  profile: { company_name?: string | null } | null,
) {
  const clientName = client.type === 'particulier'
    ? `${client.firstName} ${client.lastName}`.trim()
    : client.companyName;

  return useMemo(
    () => generateQuoteHtml(
      {
        companyName:   profile?.company_name ?? 'Votre entreprise',
        clientName:    clientName || 'Client',
        clientEmail:   client.email   || null,
        clientPhone:   client.phone   || null,
        clientAddress: client.address || null,
        eventType:     event.eventType     || null,
        eventDate:     event.eventDate     || null,
        eventLocation: event.eventLocation || null,
        guestCount:    event.guestCount    || null,
        services: services
          .filter((s) => !s.isPageBreak)
          .map((s) => ({
            name:         s.name,
            description:  s.description,
            quantity:     s.quantity,
            unitPrice:    s.unitPrice,
          })),
        vatRate:   options.vatRate,
        remarks:   options.remarks   || null,
        hidePrice: options.hidePrice,
      },
      { template },
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, client, event, services, options, profile?.company_name],
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function QuoteInlineEditor({
  quoteId, initialStatus, initialTemplate,
  initialClient, initialEvent, initialServices, initialOptions,
  hasContentHtml = false,
}: Props) {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [client,   setClient]   = useState<ClientInfo>(initialClient);
  const [event,    setEvent]    = useState<EventInfo>(initialEvent);
  const [services, setServices] = useState<ServiceLine[]>(initialServices);
  const [options,  setOptions]  = useState<Options>(initialOptions);
  const [template, setTemplate] = useState<QuoteTemplate>((initialTemplate as QuoteTemplate) ?? 'standard');

  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [webowordModal, setWebowordModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Services helpers ─────────────────────────────────────────────────────────
  const addService = () => setServices((prev) => [
    ...prev, { id: crypto.randomUUID(), name: '', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const addCustom = () => setServices((prev) => [
    ...prev, { id: crypto.randomUUID(), name: '', description: '', quantity: 1, unitPrice: 0, isCustom: true },
  ]);
  const addPageBreak = () => setServices((prev) => [
    ...prev, { id: crypto.randomUUID(), name: '', quantity: 0, unitPrice: 0, isPageBreak: true },
  ]);
  const removeService = (id: string) => setServices((prev) => prev.filter((s) => s.id !== id));
  const updateService = (id: string, field: string, value: string | number) =>
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));

  // ── Totals ───────────────────────────────────────────────────────────────────
  const ht     = totalHT(services);
  const vatAmt = ht * (options.vatRate / 100);
  const ttc    = ht + vatAmt;

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setSaving(true); setError(null); setSaved(false);
    const supabase = createClient();

    const payload = {
      client_first_name:   client.firstName,
      client_last_name:    client.lastName,
      client_name:         client.type === 'particulier'
        ? `${client.firstName} ${client.lastName}`.trim()
        : client.companyName,
      client_email:        client.email,
      client_phone:        client.phone,
      client_address:      client.address,
      client_type:         client.type,
      company_name:        client.companyName || null,
      contact_person_name: client.contactName || null,
      event_type:          event.eventType,
      event_date:          event.eventDate || null,
      event_location:      event.eventLocation || null,
      guest_count:         event.guestCount,
      services,
      total_amount:        ttc,
      vat_rate:            options.vatRate,
      hide_price:          options.hidePrice,
      remarks:             options.remarks || null,
      images:              options.images,
      template,
      user_id:             user.id,
    };

    const { error: err } = await supabase.from('quotes').update(payload).eq('id', quoteId);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Régénérer WeboWord (save + clear content_html, then open WeboWord) ───────
  const handleRegenerateWeboWord = async () => {
    if (!user) return;
    setSaving(true); setError(null);
    const ht2   = totalHT(services);
    const ttc2  = ht2 + ht2 * (options.vatRate / 100);
    const payload = {
      client_first_name:   client.firstName,
      client_last_name:    client.lastName,
      client_name:         client.type === 'particulier'
        ? `${client.firstName} ${client.lastName}`.trim()
        : client.companyName,
      client_email:        client.email,
      client_phone:        client.phone,
      client_address:      client.address,
      client_type:         client.type,
      company_name:        client.companyName || null,
      contact_person_name: client.contactName || null,
      event_type:          event.eventType,
      event_date:          event.eventDate || null,
      event_location:      event.eventLocation || null,
      guest_count:         event.guestCount,
      services,
      total_amount:        ttc2,
      vat_rate:            options.vatRate,
      hide_price:          options.hidePrice,
      remarks:             options.remarks || null,
      images:              options.images,
      template,
      user_id:             user.id,
      content_html:        null, // clear → WeboWord will regenerate
    };
    const { error: err } = await createClient().from('quotes').update(payload).eq('id', quoteId);
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.push(`/devis/${quoteId}/modifier?mode=weboword`);
  };

  // ── Copy service to clipboard ─────────────────────────────────────────────
  const copyService = (s: ServiceLine) => {
    const text = [
      s.name,
      s.description ? s.description : null,
      `Qté : ${s.quantity}  ·  PU : ${formatCurrency(s.unitPrice)}  ·  Total : ${formatCurrency(s.quantity * s.unitPrice)}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const liveHtml = useLiveHtml(template, client, event, services, options, profile);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left — editor ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-28">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Modifier le devis</h1>
            <div className="flex items-center gap-2">
              {/* Mobile preview button */}
              <button
                onClick={() => setPreviewOpen(true)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Eye className="h-4 w-4" />
                Aperçu
              </button>
              {/* WeboWord button */}
              <button
                onClick={() => hasContentHtml ? setWebowordModal(true) : router.push(`/devis/${quoteId}/modifier?mode=weboword`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#9c27b0] border border-[#9c27b0]/30 rounded-xl hover:bg-[#f3e5f5] transition-colors"
              >
                <LayoutTemplate className="h-4 w-4" />
                WeboWord
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Enregistré !' : 'Enregistrer'}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {/* ── Client ── */}
          <Section icon={User} title="Client">
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setClient((c) => ({ ...c, type: 'particulier' }))}
                  className={cn('flex-1 py-2 text-sm font-medium rounded-xl border transition-colors', client.type === 'particulier' ? 'bg-[#9c27b0] text-white border-[#9c27b0]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                >Particulier</button>
                <button
                  onClick={() => setClient((c) => ({ ...c, type: 'entreprise' }))}
                  className={cn('flex-1 py-2 text-sm font-medium rounded-xl border transition-colors', client.type === 'entreprise' ? 'bg-[#9c27b0] text-white border-[#9c27b0]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                >Entreprise</button>
              </div>
              {client.type === 'entreprise' && (
                <input value={client.companyName} onChange={(e) => setClient((c) => ({ ...c, companyName: e.target.value }))} placeholder="Nom de l'entreprise" className={inputCls} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <input value={client.firstName} onChange={(e) => setClient((c) => ({ ...c, firstName: e.target.value }))} placeholder="Prénom" className={inputCls} />
                <input value={client.lastName}  onChange={(e) => setClient((c) => ({ ...c, lastName: e.target.value  }))} placeholder="Nom"    className={inputCls} />
              </div>
              <input type="email" value={client.email}   onChange={(e) => setClient((c) => ({ ...c, email:   e.target.value }))} placeholder="Email"     className={inputCls} />
              <input type="tel"   value={client.phone}   onChange={(e) => setClient((c) => ({ ...c, phone:   e.target.value }))} placeholder="Téléphone" className={inputCls} />
              <input             value={client.address}  onChange={(e) => setClient((c) => ({ ...c, address: e.target.value }))} placeholder="Adresse"   className={inputCls} />
            </div>
          </Section>

          {/* ── Événement ── */}
          <Section icon={CalendarDays} title="Événement">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <select value={event.eventType} onChange={(e) => setEvent((ev) => ({ ...ev, eventType: e.target.value }))} className={inputCls}>
                  <option value="">— Type d'événement —</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <input
                type="date" value={event.eventDate}
                onChange={(e) => setEvent((ev) => ({ ...ev, eventDate: e.target.value }))}
                className={inputCls}
              />
              <input
                type="number" min={1} value={event.guestCount}
                onChange={(e) => setEvent((ev) => ({ ...ev, guestCount: parseInt(e.target.value) || 1 }))}
                placeholder="Nb. convives" className={inputCls}
              />
              <div className="col-span-2">
                <input
                  value={event.eventLocation}
                  onChange={(e) => setEvent((ev) => ({ ...ev, eventLocation: e.target.value }))}
                  placeholder="Lieu de l'événement (salle, château…)"
                  className={inputCls}
                />
              </div>
            </div>
          </Section>

          {/* ── Prestations ── */}
          <Section icon={ChefHat} title="Prestations">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">{services.filter((s) => !s.isPageBreak).length} ligne{services.filter((s) => !s.isPageBreak).length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-1.5">
                {services.length > 0 && (
                  <button onClick={addPageBreak} title="Saut de page" className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#9c27b0]/70 border border-dashed border-[#9c27b0]/30 rounded-lg hover:bg-[#f3e5f5]/50 transition-colors">
                    <Scissors className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Saut de page</span>
                  </button>
                )}
                <button onClick={addCustom} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <PencilLine className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ligne libre</span>
                </button>
                <button onClick={addService} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#9c27b0] border border-[#9c27b0]/40 rounded-lg hover:bg-[#9c27b0]/5 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </div>
            </div>

            {/* Table header */}
            {services.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-visible">
                <div className="grid grid-cols-[1fr_64px_90px_78px_52px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide rounded-t-xl">
                  <span>Désignation</span>
                  <span className="text-center">Qté</span>
                  <span className="text-right">PU HT</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {services.map((s) => (
                  <ServiceRow
                    key={s.id} service={s}
                    onUpdate={(field, value) => updateService(s.id, field, value)}
                    onRemove={() => removeService(s.id)}
                  />
                ))}
              </div>
            )}

            {services.length === 0 && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-10 text-center">
                <p className="text-sm text-gray-400 mb-3">Aucune prestation — commencez par en ajouter</p>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={addService} className="text-xs px-3 py-1.5 bg-[#9c27b0] text-white rounded-lg hover:bg-[#7b1fa2] transition-colors">Depuis le catalogue</button>
                  <button onClick={addCustom}  className="text-xs px-3 py-1.5 border border-dashed border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">Ligne libre</button>
                </div>
              </div>
            )}

            {/* Totals */}
            {services.filter((s) => !s.isPageBreak).length > 0 && (
              <div className="mt-4 ml-auto w-fit min-w-[200px] bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-1.5">
                <div className="flex justify-between gap-6 text-sm text-gray-600"><span>Sous-total HT</span><span className="tabular-nums">{formatCurrency(ht)}</span></div>
                <div className="flex justify-between gap-6 text-sm text-gray-600"><span>TVA ({options.vatRate}%)</span><span className="tabular-nums">{formatCurrency(vatAmt)}</span></div>
                <div className="border-t border-gray-200 pt-1.5 flex justify-between gap-6 text-sm font-bold text-gray-900"><span>Total TTC</span><span className="tabular-nums">{formatCurrency(ttc)}</span></div>
              </div>
            )}
          </Section>

          {/* ── Options ── */}
          <Section icon={Settings2} title="Options">
            <div className="space-y-4">
              {/* Template */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modèle de document</p>
                <div className="flex gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTemplate(t.key)}
                      className={cn('flex-1 py-2 text-sm font-medium rounded-xl border transition-colors', template === t.key ? 'bg-[#9c27b0] text-white border-[#9c27b0]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* VAT */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Taux de TVA</p>
                <div className="flex gap-2">
                  {VAT_RATES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setOptions((o) => ({ ...o, vatRate: r }))}
                      className={cn('flex-1 py-2 text-sm font-medium rounded-xl border transition-colors', options.vatRate === r ? 'bg-[#9c27b0] text-white border-[#9c27b0]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Remarques</p>
                <textarea
                  value={options.remarks}
                  onChange={(e) => setOptions((o) => ({ ...o, remarks: e.target.value }))}
                  placeholder="Conditions, allergènes, mentions légales…"
                  rows={3}
                  className={inputCls + ' resize-none'}
                />
              </div>

              {/* Hide price */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.hidePrice}
                  onChange={(e) => setOptions((o) => ({ ...o, hidePrice: e.target.checked }))}
                  className="w-4 h-4 accent-[#9c27b0] rounded"
                />
                <span className="text-sm text-gray-600">Masquer les prix sur le document</span>
              </label>
            </div>
          </Section>

          {/* Bottom save bar */}
          <div className="sticky bottom-0 -mx-4 px-4 pb-4 pt-3 bg-white/90 backdrop-blur border-t border-gray-100 flex items-center justify-between gap-3">
            <button onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Retour
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? 'Enregistré !' : 'Enregistrer le devis'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right — live preview (desktop) ── */}
      <div className="hidden lg:flex print:!flex flex-col w-[400px] flex-shrink-0 border-l border-gray-200 print:border-0 bg-white sticky top-0 h-screen print:h-auto print:!static overflow-hidden print:overflow-visible">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <Eye className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 flex-1">Aperçu en direct · WeboWord</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          <div
            style={{ width: '794px', zoom: 0.45, transformOrigin: 'top left' }}
            dangerouslySetInnerHTML={{ __html: liveHtml }}
          />
        </div>
      </div>

      {/* ── WeboWord sync modal ── */}
      {webowordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

            {/* Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Ouvrir WeboWord</h3>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Ce devis contient des <strong>modifications WeboWord personnalisées</strong>.
                Les nouvelles prestations ajoutées ici ne seront pas intégrées automatiquement.
              </p>
            </div>

            {/* Services clipboard */}
            {services.filter((s) => !s.isPageBreak).length > 0 && (
              <div className="p-5 pb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Prestations à copier dans WeboWord
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {services.filter((s) => !s.isPageBreak).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => copyService(s)}
                      className={cn(
                        'w-full text-left px-3 py-2 border rounded-xl transition-all group',
                        copiedId === s.id
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-gray-200 hover:border-[#9c27b0]/40 hover:bg-[#f3e5f5]/30',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.name || '(sans nom)'}</p>
                          {s.description && (
                            <p className="text-xs text-gray-500 truncate">{s.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-400 tabular-nums">
                            {s.quantity} × {formatCurrency(s.unitPrice)}
                          </span>
                          {copiedId === s.id
                            ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                            : <ClipboardCopy className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#9c27b0] transition-colors" />
                          }
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Cliquez sur une ligne pour la copier dans le presse-papiers, puis collez-la dans WeboWord.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="p-5 flex flex-col gap-2">
              <Link
                href={`/devis/${quoteId}/modifier?mode=weboword`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
              >
                <LayoutTemplate className="h-4 w-4" />
                Ouvrir WeboWord (garder mes éditions)
              </Link>
              <button
                onClick={handleRegenerateWeboWord}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Régénérer WeboWord (perdre mes éditions)
              </button>
              <button
                onClick={() => setWebowordModal(false)}
                className="text-sm text-gray-400 hover:text-gray-600 text-center py-1 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile preview modal ── */}
      {previewOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-[#9c27b0]" />
                <span className="font-semibold text-gray-900 text-sm">Aperçu du devis</span>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
              <div
                style={{ width: '794px', zoom: 0.42, transformOrigin: 'top left' }}
                dangerouslySetInnerHTML={{ __html: liveHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
