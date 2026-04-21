'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User, Package, Calendar, Palette, Image as ImageIcon,
  X, Search, Loader2, Check, Plus, Trash2, Wand2, ChevronLeft,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type PanelKey = 'client' | 'services' | 'event' | 'style' | 'images';

interface Props {
  quoteId: string;
  activePanel: PanelKey | null;
  onClose: () => void;
  onApplied: () => void; // Called after any save — parent triggers reload
}

interface Client { id: string; first_name: string | null; last_name: string | null; email: string; phone: string | null; company_name: string | null; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Service { name: string; quantity: number; unitPrice: number; isFree?: boolean; isOption?: boolean; removed?: boolean; description?: string | null; [key: string]: any; }

export default function WeboWordSidePanels({ quoteId, activePanel, onClose, onApplied }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Form state ──
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [vatRate, setVatRate] = useState(20);
  const [hidePrice, setHidePrice] = useState(false);
  const [template, setTemplate] = useState<'standard' | 'mariage' | 'business'>('standard');
  const [services, setServices] = useState<Service[]>([]);

  // Client picker
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Prestation catalog picker
  const [prestationSearch, setPrestationSearch] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prestationResults, setPrestationResults] = useState<any[]>([]);
  const [showPrestationPicker, setShowPrestationPicker] = useState(false);

  // ── Load data when panel opens ──
  useEffect(() => {
    if (!activePanel) return;
    setLoading(true);
    supabase.from('quotes')
      .select('client_name, client_email, client_phone, client_address, event_type, event_date, event_location, guest_count, services, remarks, vat_rate, hide_price, template')
      .eq('id', quoteId).single()
      .then(({ data }) => {
        if (data) {
          setClientName(data.client_name || '');
          setClientEmail(data.client_email || '');
          setClientPhone(data.client_phone || '');
          setClientAddress(data.client_address || '');
          setEventType(data.event_type || '');
          setEventDate(data.event_date || '');
          setEventLocation(data.event_location || '');
          setGuestCount(data.guest_count ? String(data.guest_count) : '');
          setRemarks(data.remarks || '');
          setVatRate(data.vat_rate ?? 20);
          setHidePrice(data.hide_price ?? false);
          setTemplate((data.template as 'standard' | 'mariage' | 'business') || 'standard');
          setServices(Array.isArray(data.services) ? data.services.filter((s: Service) => !s.isPageBreak) : []);
        }
        setLoading(false);
      });
  }, [activePanel, quoteId, supabase]);

  // ── Client search ──
  const searchClients = useCallback(async (q: string) => {
    setClientSearch(q);
    if (!q.trim() || q.length < 2) { setClientResults([]); setShowPicker(false); return; }
    const { data } = await supabase.from('customers')
      .select('id, first_name, last_name, email, phone, company_name')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
      .limit(6);
    setClientResults(data || []);
    setShowPicker(true);
  }, [supabase]);

  const selectClient = (c: Client) => {
    setClientName([c.first_name, c.last_name].filter(Boolean).join(' '));
    setClientEmail(c.email || '');
    setClientPhone(c.phone || '');
    setShowPicker(false);
    setClientSearch('');
  };

  // ── Prestation search ──
  const searchPrestations = useCallback(async (q: string) => {
    setPrestationSearch(q);
    if (!q.trim()) { setPrestationResults([]); setShowPrestationPicker(false); return; }
    const { data } = await supabase.from('prestations')
      .select('id, name, unit_price, category, description, is_option, gastro_card_html')
      .ilike('name', `%${q}%`)
      .limit(8);
    setPrestationResults(data || []);
    setShowPrestationPicker(true);
  }, [supabase]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addPrestation = (p: any) => {
    const newSvc: Service = {
      id: crypto.randomUUID(),
      name: p.name,
      description: p.description || '',
      quantity: parseInt(guestCount) || 1,
      unitPrice: p.unit_price,
      category: p.category,
      gastroCardHtml: p.gastro_card_html,
      isOption: !!p.is_option,
    };
    setServices((prev) => [...prev, newSvc]);
    setShowPrestationPicker(false);
    setPrestationSearch('');
  };

  const addCustomLine = () => {
    const newSvc: Service = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      isCustom: true,
    };
    setServices((prev) => [...prev, newSvc]);
  };

  // ── Save (all panels save all fields) ──
  const save = async () => {
    setSaving(true);
    const clientParts = clientName.trim().split(' ');
    const cFirst = clientParts[0] || '';
    const cLast = clientParts.slice(1).join(' ') || '';

    const { error } = await supabase.from('quotes').update({
      client_name: clientName.trim() || '',
      client_first_name: cFirst || null,
      client_last_name: cLast || null,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      client_address: clientAddress || null,
      event_type: eventType || '',
      event_date: eventDate || new Date().toISOString().slice(0, 10),
      event_location: eventLocation || '',
      guest_count: parseInt(guestCount) || 1,
      remarks: remarks || null,
      vat_rate: vatRate,
      hide_price: hidePrice,
      template,
      services,
      content_html: null, // Force regeneration
    }).eq('id', quoteId);

    setSaving(false);
    if (error) { alert('Erreur: ' + error.message); return; }
    onApplied();
  };

  if (!activePanel) return null;

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]';
  const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1';

  return (
    <>
      {/* Overlay — full screen but doesn't cover sidebar */}
      <div className="fixed inset-0 z-40 bg-black/20 print:hidden" style={{ left: 240 }} onClick={onClose} />

      {/* Panel — positioned right after the app sidebar */}
      <div className="fixed top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200 print:hidden" style={{ left: 240 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {activePanel === 'client' && <><User className="h-4 w-4 text-[#9c27b0]" /><h2 className="font-semibold text-gray-900 text-sm">Client</h2></>}
            {activePanel === 'services' && <><Package className="h-4 w-4 text-[#9c27b0]" /><h2 className="font-semibold text-gray-900 text-sm">Prestations</h2></>}
            {activePanel === 'event' && <><Calendar className="h-4 w-4 text-[#9c27b0]" /><h2 className="font-semibold text-gray-900 text-sm">Événement & Options</h2></>}
            {activePanel === 'style' && <><Palette className="h-4 w-4 text-[#9c27b0]" /><h2 className="font-semibold text-gray-900 text-sm">Style</h2></>}
            {activePanel === 'images' && <><ImageIcon className="h-4 w-4 text-[#9c27b0]" /><h2 className="font-semibold text-gray-900 text-sm">Images</h2></>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 text-[#9c27b0] animate-spin" /></div>
          ) : (
            <>
              {/* CLIENT PANEL */}
              {activePanel === 'client' && (
                <>
                  <div className="relative">
                    <label className={labelCls}>Rechercher un client</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        value={clientSearch}
                        onChange={(e) => searchClients(e.target.value)}
                        placeholder="Nom, email, entreprise…"
                        className={`${inputCls} pl-9 border-dashed border-[#9c27b0]/30 bg-[#faf5ff]`}
                      />
                    </div>
                    {showPicker && clientResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {clientResults.map((c) => (
                          <button key={c.id} onClick={() => selectClient(c)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#faf5ff] text-left border-b border-gray-50 last:border-0">
                            <div className="w-7 h-7 rounded-full bg-[#f3e5f5] flex items-center justify-center">
                              <span className="text-xs font-bold text-[#9c27b0]">{(c.first_name?.[0] || c.email[0]).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.company_name || c.email}</p>
                              <p className="text-[10px] text-gray-400 truncate">{c.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <div><label className={labelCls}>Nom complet</label><input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="Jean Dupont" /></div>
                    <div><label className={labelCls}>Email</label><input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputCls} placeholder="jean@email.com" /></div>
                    <div><label className={labelCls}>Téléphone</label><input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputCls} placeholder="06 12 34 56 78" /></div>
                    <div><label className={labelCls}>Adresse</label><input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className={inputCls} placeholder="12 rue des Lilas" /></div>
                  </div>
                </>
              )}

              {/* SERVICES PANEL */}
              {activePanel === 'services' && (
                <>
                  {/* Add prestation from catalog */}
                  <div className="relative">
                    <label className={labelCls}>Ajouter depuis le catalogue</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        value={prestationSearch}
                        onChange={(e) => searchPrestations(e.target.value)}
                        placeholder="Chercher une prestation…"
                        className={`${inputCls} pl-9 border-dashed border-[#9c27b0]/30 bg-[#faf5ff]`}
                      />
                    </div>
                    {showPrestationPicker && prestationResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                        {prestationResults.map((p) => (
                          <button key={p.id} onClick={() => addPrestation(p)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#faf5ff] text-left border-b border-gray-50 last:border-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{p.name}</p>
                              <p className="text-[10px] text-gray-400">{p.category || '—'}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-700">{p.unit_price}€</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={addCustomLine} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                    <Plus className="h-3.5 w-3.5" />
                    Ligne personnalisée
                  </button>

                  {/* Services list */}
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    {services.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-4">Aucune prestation</p>
                    ) : (
                      services.map((svc, idx) => (
                        <div key={svc.id || idx} className={`border rounded-xl p-3 space-y-2 ${svc.removed ? 'bg-red-50/30 opacity-50' : 'bg-white'}`}>
                          <div className="flex items-start gap-2">
                            <input
                              value={svc.name}
                              onChange={(e) => setServices((prev) => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                              placeholder="Nom de la prestation"
                              className={`${inputCls} text-xs font-medium flex-1`}
                            />
                            <button onClick={() => setServices((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <div>
                              <label className="text-[9px] text-gray-400">Qté</label>
                              <input type="number" min={1} value={svc.quantity}
                                onChange={(e) => setServices((prev) => prev.map((s, i) => i === idx ? { ...s, quantity: parseInt(e.target.value) || 1 } : s))}
                                className={`${inputCls} text-xs py-1 text-center`}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-gray-400">PU HT</label>
                              <input type="number" min={0} step={0.01} value={svc.unitPrice}
                                onChange={(e) => setServices((prev) => prev.map((s, i) => i === idx ? { ...s, unitPrice: parseFloat(e.target.value) || 0 } : s))}
                                className={`${inputCls} text-xs py-1 text-right`}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-gray-400">Statut</label>
                              <select
                                value={svc.removed ? 'removed' : svc.isFree ? 'free' : svc.isOption ? 'option' : 'normal'}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setServices((prev) => prev.map((s, i) => i === idx ? { ...s, removed: v === 'removed', isFree: v === 'free', isOption: v === 'option' } : s));
                                }}
                                className={`${inputCls} text-[10px] py-1`}
                              >
                                <option value="normal">Normal</option>
                                <option value="free">Inclus</option>
                                <option value="option">Option</option>
                                <option value="removed">Retiré</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* EVENT PANEL */}
              {activePanel === 'event' && (
                <>
                  <div><label className={labelCls}>Type d&apos;événement</label>
                    <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
                      <option value="">— Choisir —</option>
                      {['Mariage', 'Cocktail', 'Anniversaire', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Date</label><input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Couverts</label><input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Lieu</label><input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className={inputCls} placeholder="Château de Villebougis" /></div>
                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <div><label className={labelCls}>TVA (%)</label>
                      <select value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value))} className={inputCls}>
                        <option value={20}>20 %</option>
                        <option value={10}>10 %</option>
                        <option value={5.5}>5,5 %</option>
                        <option value={0}>0 %</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={hidePrice} onChange={(e) => setHidePrice(e.target.checked)} className="h-4 w-4 accent-[#9c27b0]" />
                      <span className="text-xs text-gray-600">Masquer les prix sur le devis</span>
                    </label>
                    <div><label className={labelCls}>Remarques</label>
                      <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputCls} placeholder="Notes additionnelles…" />
                    </div>
                  </div>
                </>
              )}

              {/* STYLE PANEL */}
              {activePanel === 'style' && (
                <>
                  <div><label className={labelCls}>Modèle</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'standard', label: 'Standard', color: '#9c27b0' },
                        { key: 'mariage', label: 'Mariage', color: '#c8956c' },
                        { key: 'business', label: 'Business', color: '#1e293b' },
                      ].map((t) => (
                        <button key={t.key} onClick={() => setTemplate(t.key as 'standard' | 'mariage' | 'business')}
                          className={cn('py-2 px-3 rounded-lg text-xs font-semibold border transition-all',
                            template === t.key ? 'border-gray-900 shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                          <span className="block w-4 h-4 rounded-full mx-auto mb-1" style={{ background: t.color }} />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 italic">Les autres options de style (couleurs, police, taille) sont disponibles directement dans la barre d&apos;outils du WeboWord.</p>
                </>
              )}

              {/* IMAGES PANEL */}
              {activePanel === 'images' && (
                <p className="text-xs text-gray-400 italic text-center py-8">Gestion des images — à venir</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4 inline mr-1" />
            Fermer
          </button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Appliquer
          </button>
        </div>
      </div>
    </>
  );
}

// Sidebar icon buttons (to be used in WeboWordEditor)
export function SidePanelIcons({ activePanel, onSelect }: { activePanel: PanelKey | null; onSelect: (p: PanelKey) => void }) {
  const items: { key: PanelKey; icon: typeof User; label: string }[] = [
    { key: 'client', icon: User, label: 'Client' },
    { key: 'services', icon: Package, label: 'Prestations' },
    { key: 'event', icon: Calendar, label: 'Événement' },
    { key: 'style', icon: Palette, label: 'Style' },
    { key: 'images', icon: ImageIcon, label: 'Images' },
  ];
  return (
    <div className="flex-shrink-0 w-14 bg-white border-r border-gray-200 flex flex-col items-center pt-4 gap-1 print:hidden">
      {items.map(({ key, icon: Icon, label }) => (
        <button key={key} onClick={() => onSelect(key)} title={label}
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-xl transition-all group relative',
            activePanel === key ? 'bg-[#9c27b0] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
          )}>
          <Icon className="h-4 w-4" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
