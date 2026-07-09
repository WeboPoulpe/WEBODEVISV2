'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User, Package, Calendar, Palette, Image as ImageIcon,
  X, Search, Loader2, Check, Plus, Trash2, Wand2, ChevronLeft,
  Save, Printer, Download, GripVertical, LayoutTemplate,
} from 'lucide-react';
import { PhotoBuilder } from './weboword/PhotoBuilder';
import { DEFAULT_TRANSFORM } from './weboword/weboword.types';
import type { CoverPageConfig, PhotosPageConfig } from './weboword/weboword.types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { lineTotalHT, resolveGuestSplit } from '@/lib/quoteTotals';
import { refreshFinancialsInHtml } from '@/lib/weboFinancials';

type PanelKey = 'client' | 'services' | 'event' | 'style' | 'images' | 'cover' | 'photos';

interface Props {
  quoteId: string;
  activePanel: PanelKey | null;
  onClose: () => void;
  onApplied: () => void; // Called after any save — parent triggers reload
  // Editor actions (top bar moved here)
  onSave?: () => void;
  onPrint?: () => void;
  onSavePdf?: () => void;
  // Menu width (gastro card)
  menuWidth?: string;
  onMenuWidthChange?: (w: string) => void;
  coverConfig?: CoverPageConfig;
  onCoverChange?: (c: CoverPageConfig) => void;
  photosConfig?: PhotosPageConfig;
  onPhotosChange?: (c: PhotosPageConfig) => void;
}

const MENU_WIDTHS = [
  { label: 'Étroit', value: '280px' },
  { label: 'Normal', value: '400px' },
  { label: 'Large', value: '560px' },
  { label: 'Plein', value: '100%' },
];

interface Client { id: string; first_name: string | null; last_name: string | null; email: string; phone: string | null; company_name: string | null; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Service { name: string; quantity: number; unitPrice: number; isFree?: boolean; isOption?: boolean; removed?: boolean; description?: string | null; photo_url?: string; [key: string]: any; }

export default function WeboWordSidePanels({ quoteId, activePanel, onClose, onApplied, menuWidth, onMenuWidthChange, coverConfig, onCoverChange, photosConfig, onPhotosChange }: Props) {
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
  const [guestAdults, setGuestAdults] = useState('');
  const [guestChildren, setGuestChildren] = useState('');
  const [remarks, setRemarks] = useState('');
  const [vatRate, setVatRate] = useState(20);
  const [hidePrice, setHidePrice] = useState(false);
  const [template, setTemplate] = useState<'standard' | 'mariage' | 'business'>('standard');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [services, setServices] = useState<Service[]>([]);
  // Empreinte des champs qui alimentent le bloc financier, capturée au chargement.
  // Sert à ne rafraîchir le tableau/totaux du document QUE s'ils ont réellement changé.
  const initialFinancials = useRef<string>('');

  // Client picker
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Prestation catalog picker
  const [prestationSearch, setPrestationSearch] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prestationResults, setPrestationResults] = useState<any[]>([]);
  const [showPrestationPicker, setShowPrestationPicker] = useState(false);

  // ── Saved templates (cover + photos) — localStorage ──
  type SavedTemplate<T> = { id: string; name: string; config: T }
  const [savedCoverTemplates, setSavedCoverTemplates] = useState<SavedTemplate<CoverPageConfig>[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('weboword_cover_templates') ?? '[]') } catch { return [] }
  })
  const [savedPhotosTemplates, setSavedPhotosTemplates] = useState<SavedTemplate<PhotosPageConfig>[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('weboword_photos_templates') ?? '[]') } catch { return [] }
  })
  const [saveCoverName, setSaveCoverName] = useState('')
  const [savePhotosName, setSavePhotosName] = useState('')
  const [showSaveCoverInput, setShowSaveCoverInput] = useState(false)
  const [showSavePhotosInput, setShowSavePhotosInput] = useState(false)

  function saveCoverTemplate() {
    if (!coverConfig || !saveCoverName.trim()) return
    const tpl: SavedTemplate<CoverPageConfig> = { id: crypto.randomUUID(), name: saveCoverName.trim(), config: { ...coverConfig } }
    const next = [...savedCoverTemplates, tpl]
    setSavedCoverTemplates(next)
    localStorage.setItem('weboword_cover_templates', JSON.stringify(next))
    setSaveCoverName('')
    setShowSaveCoverInput(false)
  }

  function deleteCoverTemplate(id: string) {
    const next = savedCoverTemplates.filter(t => t.id !== id)
    setSavedCoverTemplates(next)
    localStorage.setItem('weboword_cover_templates', JSON.stringify(next))
  }

  function savePhotosTemplate() {
    if (!photosConfig || !savePhotosName.trim()) return
    const tpl: SavedTemplate<PhotosPageConfig> = { id: crypto.randomUUID(), name: savePhotosName.trim(), config: { ...photosConfig } }
    const next = [...savedPhotosTemplates, tpl]
    setSavedPhotosTemplates(next)
    localStorage.setItem('weboword_photos_templates', JSON.stringify(next))
    setSavePhotosName('')
    setShowSavePhotosInput(false)
  }

  function deletePhotosTemplate(id: string) {
    const next = savedPhotosTemplates.filter(t => t.id !== id)
    setSavedPhotosTemplates(next)
    localStorage.setItem('weboword_photos_templates', JSON.stringify(next))
  }

  // Drag & drop reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [editingServicePhotoIdx, setEditingServicePhotoIdx] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };
  const onDragLeave = () => setDragOverIdx(null);
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    setServices((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  // ── Load data when panel opens ──
  useEffect(() => {
    if (!activePanel) return;
    setLoading(true);
    supabase.from('quotes')
      .select('client_name, client_email, client_phone, client_address, event_type, event_date, event_location, guest_count, guest_count_adults, guest_count_children, services, remarks, vat_rate, hide_price, template, language')
      .eq('id', quoteId).single()
      .then(({ data }) => {
        if (data) {
          const loadedClientName = data.client_name || '';
          const loadedClientEmail = data.client_email || '';
          const loadedClientPhone = data.client_phone || '';
          const loadedClientAddress = data.client_address || '';
          const loadedEventType = data.event_type || '';
          const loadedEventDate = data.event_date || '';
          const loadedEventLocation = data.event_location || '';
          const loadedGuestCount = data.guest_count ? String(data.guest_count) : '';
          const loadedGuestAdults = data.guest_count_adults ? String(data.guest_count_adults) : '';
          const loadedGuestChildren = data.guest_count_children ? String(data.guest_count_children) : '';
          const loadedRemarks = data.remarks || '';
          const loadedVatRate = data.vat_rate ?? 20;
          const loadedHidePrice = data.hide_price ?? false;
          const loadedTemplate = (data.template as 'standard' | 'mariage' | 'business') || 'standard';
          const loadedLanguage = (data.language as 'fr' | 'en') || 'fr';
          const loadedServices = Array.isArray(data.services) ? data.services.filter((s: Service) => !s.isPageBreak) : [];

          setClientName(loadedClientName);
          setClientEmail(loadedClientEmail);
          setClientPhone(loadedClientPhone);
          setClientAddress(loadedClientAddress);
          setEventType(loadedEventType);
          setEventDate(loadedEventDate);
          setEventLocation(loadedEventLocation);
          setGuestCount(loadedGuestCount);
          setGuestAdults(loadedGuestAdults);
          setGuestChildren(loadedGuestChildren);
          setRemarks(loadedRemarks);
          setVatRate(loadedVatRate);
          setHidePrice(loadedHidePrice);
          setTemplate(loadedTemplate);
          setLanguage(loadedLanguage);
          setServices(loadedServices);

          initialFinancials.current = JSON.stringify({
            services: loadedServices, guestCount: loadedGuestCount, guestAdults: loadedGuestAdults,
            guestChildren: loadedGuestChildren, vatRate: loadedVatRate, hidePrice: loadedHidePrice,
            template: loadedTemplate, language: loadedLanguage,
          });
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
      .select('id, name, unit_price, child_unit_price, category, description, is_option, gastro_card_html, gastro_card_html_en')
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
      childUnitPrice: p.child_unit_price ?? null,
      category: p.category,
      gastroCardHtml: p.gastro_card_html,
      gastroCardHtmlEn: p.gastro_card_html_en,
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

    // Compute total_amount (TTC) from services — HORS options (montant de référence,
    // cohérent avec l'éditeur et generateQuoteHtml ; les options sont facultatives).
    // Tient compte du prix enfant « au couvert » via le helper partagé.
    const { adults, children } = resolveGuestSplit(
      parseInt(guestCount) || null,
      parseInt(guestAdults) || null,
      parseInt(guestChildren) || null,
    );
    const ht = services.reduce((sum, s) => {
      if (s.removed || s.isFree || s.isOption || s.isPageBreak) return sum;
      return sum + lineTotalHT(s, adults, children);
    }, 0);
    const totalTtc = ht * (1 + vatRate / 100);

    // ⚠️ On NE régénère JAMAIS tout le document WeboWord : le texte mis en forme
    // (page de garde, carte gastronomique, prose manuelle) est préservé.
    const updatePayload: Record<string, unknown> = {
      client_name: clientName.trim() || '',
      client_first_name: cFirst || null,
      client_last_name: cLast || null,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      client_address: clientAddress || null,
      event_type: eventType || '',
      event_date: eventDate || new Date().toISOString().slice(0, 10),
      event_location: eventLocation || '',
      guest_count: parseInt(guestCount) || (parseInt(guestAdults) + parseInt(guestChildren) || 1),
      guest_count_adults: parseInt(guestAdults) || null,
      guest_count_children: parseInt(guestChildren) || 0,
      remarks: remarks || null,
      vat_rate: vatRate,
      hide_price: hidePrice,
      total_amount: totalTtc > 0 ? totalTtc : null,
      template,
      language,
      services,
    };

    // Si les données financières ont changé (ajout/suppr/qté/prix d'une prestation,
    // couverts, TVA…), on met à jour UNIQUEMENT le bloc tableau + totaux du document
    // existant : la prestation ajoutée apparaît dans le tableau, totaux recalculés,
    // le reste du texte reste intact.
    const currentFin = JSON.stringify({
      services, guestCount, guestAdults, guestChildren, vatRate, hidePrice, template, language,
    });
    if (currentFin !== initialFinancials.current) {
      const { data: cur } = await supabase.from('quotes')
        .select('content_html, selected_font').eq('id', quoteId).maybeSingle();
      if (cur?.content_html) {
        const updated = refreshFinancialsInHtml(
          cur.content_html as string,
          {
            companyName: '',
            clientName: '',
            guestCount: parseInt(guestCount) || null,
            guestCountAdults: parseInt(guestAdults) || null,
            guestCountChildren: parseInt(guestChildren) || null,
            services: services.map((s) => ({
              name: s.name,
              description: s.description ?? null,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              childUnitPrice: (s.childUnitPrice as number | null | undefined) ?? null,
              isFree: s.isFree,
              isOption: s.isOption,
              removed: s.removed,
            })),
            vatRate,
            hidePrice,
            language,
          },
          { template, font: (cur.selected_font as string | null) ?? undefined },
        );
        if (updated) updatePayload.content_html = updated;
      }
    }

    const { error } = await supabase.from('quotes').update(updatePayload).eq('id', quoteId);

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
            {activePanel === 'cover' && <><LayoutTemplate className="h-4 w-4 text-[#9c27b0]" /><h2 className="font-semibold text-gray-900 text-sm">Page de garde</h2></>}
            {activePanel === 'photos' && <><ImageIcon className="h-4 w-4 text-[#9c27b0]" /><h2 className="font-semibold text-gray-900 text-sm">Page photos</h2></>}
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

                  {/* Services list — drag & drop reorder */}
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    {services.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-4">Aucune prestation</p>
                    ) : (
                      <>
                        <p className="text-[10px] text-gray-400 italic">💡 Glissez les prestations pour réordonner</p>
                        {services.map((svc, idx) => (
                        <div
                          key={svc.id || idx}
                          draggable
                          onDragStart={(e) => onDragStart(e, idx)}
                          onDragOver={(e) => onDragOver(e, idx)}
                          onDragLeave={onDragLeave}
                          onDrop={(e) => onDrop(e, idx)}
                          onDragEnd={onDragEnd}
                          className={cn(
                            'border rounded-xl p-3 space-y-2 transition-all',
                            svc.removed ? 'bg-red-50/30 opacity-50' : 'bg-white',
                            dragIdx === idx && 'opacity-30 scale-95',
                            dragOverIdx === idx && dragIdx !== idx && 'border-[#9c27b0] border-2 shadow-lg scale-[1.02]',
                          )}
                        >
                          <div className="flex items-start gap-1">
                            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-[#9c27b0] mt-1.5 flex-shrink-0" title="Glisser pour réordonner">
                              <GripVertical className="h-4 w-4" />
                            </div>
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
                          {/* Photo per prestation */}
                          <div className="mt-2 flex items-center gap-2">
                            {svc.photo_url ? (
                              <div className="relative w-12 h-12 rounded overflow-hidden border">
                                <img src={svc.photo_url} className="w-full h-full object-cover" alt="" />
                                <button
                                  onClick={() => setEditingServicePhotoIdx(idx)}
                                  className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                                >Modifier</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingServicePhotoIdx(idx)}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 border border-dashed border-gray-200 rounded px-2 py-1"
                              >
                                + Photo
                              </button>
                            )}
                          </div>
                        </div>
                        ))}
                      </>
                    )}
                  </div>
                  {editingServicePhotoIdx !== null && (
                    <PhotoBuilder
                      initial={services[editingServicePhotoIdx]?.photo_url
                        ? { id: String(editingServicePhotoIdx), url: services[editingServicePhotoIdx].photo_url!, transform: DEFAULT_TRANSFORM }
                        : undefined
                      }
                      frameAspect={1}
                      onApply={(photo) => {
                        setServices(prev => prev.map((s, i) => i === editingServicePhotoIdx ? { ...s, photo_url: photo.url } : s))
                        setEditingServicePhotoIdx(null)
                      }}
                      onClose={() => setEditingServicePhotoIdx(null)}
                    />
                  )}
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
                  <div><label className={labelCls}>Date</label><input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>👤 Adultes</label><input type="number" min={0} value={guestAdults} onChange={(e) => { setGuestAdults(e.target.value); setGuestCount(String((parseInt(e.target.value) || 0) + (parseInt(guestChildren) || 0))); }} className={inputCls} placeholder="120" /></div>
                    <div><label className={labelCls}>🧒 Enfants</label><input type="number" min={0} value={guestChildren} onChange={(e) => { setGuestChildren(e.target.value); setGuestCount(String((parseInt(guestAdults) || 0) + (parseInt(e.target.value) || 0))); }} className={inputCls} placeholder="0" /></div>
                  </div>
                  <p className="text-[10px] text-gray-400 italic -mt-2">Total couverts : {(parseInt(guestAdults) || 0) + (parseInt(guestChildren) || 0)}</p>
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
                        { key: 'standard', label: 'Standard', color: '#9c27b0', gradient: 'linear-gradient(135deg,#6a1080,#9c27b0,#ab47bc)' },
                        { key: 'mariage', label: 'Mariage', color: '#c8956c', gradient: 'linear-gradient(135deg,#8b5a2b,#c8956c,#e2b99a)' },
                        { key: 'business', label: 'Business', color: '#1e293b', gradient: 'linear-gradient(135deg,#0f172a,#1e293b,#334155)' },
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

                  {/* Language */}
                  <div className="border-t border-gray-100 pt-3">
                    <label className={labelCls}>Langue du devis</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => setLanguage('fr')}
                        className={cn('py-2 px-2 text-xs font-semibold rounded-lg border-2 transition-all flex items-center justify-center gap-1.5',
                          language === 'fr' ? 'border-[#9c27b0] bg-[#faf5ff] text-[#9c27b0]' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                        🇫🇷 Français
                      </button>
                      <button onClick={() => setLanguage('en')}
                        className={cn('py-2 px-2 text-xs font-semibold rounded-lg border-2 transition-all flex items-center justify-center gap-1.5',
                          language === 'en' ? 'border-[#9c27b0] bg-[#faf5ff] text-[#9c27b0]' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                        🇬🇧 English
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 italic mt-1.5">Cartes gastronomiques affichées dans cette langue (si dispo).</p>
                  </div>

                  {/* Carte gastronomique width */}
                  {onMenuWidthChange && (
                    <div className="border-t border-gray-100 pt-3">
                      <label className={labelCls}>Largeur carte gastronomique</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {MENU_WIDTHS.map((w) => (
                          <button key={w.value} onClick={() => onMenuWidthChange(w.value)}
                            className={cn('py-1.5 px-2 text-xs font-medium rounded-lg border transition-all',
                              menuWidth === w.value ? 'bg-[#9c27b0] text-white border-[#9c27b0]' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live preview */}
                  <div className="border-t border-gray-100 pt-3">
                    <label className={labelCls}>Aperçu</label>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                      {(() => {
                        const tpl = { standard: { color: '#9c27b0', bg: '#faf5ff', border: '#e9d5ff', font: 'Georgia,serif', gradient: 'linear-gradient(135deg,#6a1080,#9c27b0,#ab47bc)' },
                                      mariage:  { color: '#c8956c', bg: '#fffdf7', border: '#f5e6d3', font: '"Playfair Display",serif', gradient: 'linear-gradient(135deg,#8b5a2b,#c8956c,#e2b99a)' },
                                      business: { color: '#1e293b', bg: '#f8fafc', border: '#e2e8f0', font: 'Montserrat,sans-serif', gradient: 'linear-gradient(135deg,#0f172a,#1e293b,#334155)' } }[template];
                        return (
                          <div style={{ fontFamily: tpl.font, fontSize: 9 }}>
                            {/* Mini header */}
                            <div style={{ background: tpl.gradient, padding: '12px 10px', borderRadius: 4, marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'white', fontWeight: 700, fontSize: 10 }}>VOTRE ENTREPRISE</span>
                                <span style={{ color: 'white', border: '1px solid rgba(255,255,255,0.5)', padding: '2px 8px', fontSize: 8, borderRadius: 2, letterSpacing: 1 }}>DEVIS</span>
                              </div>
                            </div>
                            {/* Mini info blocks */}
                            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                              <div style={{ flex: 1, background: tpl.bg, border: `1px solid ${tpl.border}`, padding: 4, borderRadius: 3 }}>
                                <p style={{ fontSize: 6, color: tpl.color, fontWeight: 700, margin: 0, letterSpacing: 1 }}>CLIENT</p>
                                <p style={{ fontSize: 8, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>Nom Client</p>
                              </div>
                              <div style={{ flex: 1, background: tpl.bg, border: `1px solid ${tpl.border}`, padding: 4, borderRadius: 3 }}>
                                <p style={{ fontSize: 6, color: tpl.color, fontWeight: 700, margin: 0, letterSpacing: 1 }}>ÉVÉNEMENT</p>
                                <p style={{ fontSize: 8, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>Mariage</p>
                              </div>
                            </div>
                            {/* Mini table header */}
                            <div style={{ background: tpl.gradient, padding: '4px 6px', color: 'white', fontWeight: 700, fontSize: 8, borderRadius: 3, display: 'flex', justifyContent: 'space-between' }}>
                              <span>Désignation</span><span>Total HT</span>
                            </div>
                            {/* Mini table rows */}
                            <div style={{ padding: '4px 6px', fontSize: 8, borderBottom: `1px solid ${tpl.border}`, display: 'flex', justifyContent: 'space-between', color: '#1a1a1a' }}>
                              <span style={{ fontWeight: 700 }}>Cocktail</span><span>800 €</span>
                            </div>
                            <div style={{ padding: '4px 6px', fontSize: 8, display: 'flex', justifyContent: 'space-between', color: '#1a1a1a' }}>
                              <span style={{ fontWeight: 700 }}>Repas</span><span>1 200 €</span>
                            </div>
                            {/* Mini total */}
                            <div style={{ background: tpl.bg, border: `1px solid ${tpl.border}`, padding: 6, borderRadius: 3, marginTop: 6, textAlign: 'right' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: tpl.color }}>Total TTC: 2 400 €</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 italic">Les couleurs, polices, taille de texte et autres styles sont disponibles dans la barre d&apos;outils en haut du WeboWord.</p>
                </>
              )}

              {/* IMAGES PANEL */}
              {activePanel === 'images' && (
                <p className="text-xs text-gray-400 italic text-center py-8">Gestion des images — à venir</p>
              )}

              {/* COVER PANEL */}
              {activePanel === 'cover' && coverConfig && onCoverChange && (
                <div className="flex flex-col gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={coverConfig.enabled}
                      onChange={e => onCoverChange({ ...coverConfig, enabled: e.target.checked })}
                      className="w-4 h-4 accent-[#9c27b0]" />
                    <span className="text-sm text-gray-700">Activer la page de garde</span>
                  </label>

                  {coverConfig.enabled && (
                    <>
                      <div className="flex rounded-lg border overflow-hidden text-sm">
                        <button
                          onClick={() => onCoverChange({ ...coverConfig, mode: 'template' })}
                          className={`flex-1 py-2 font-medium transition-colors ${coverConfig.mode === 'template' ? 'bg-[#9c27b0] text-white' : 'hover:bg-gray-50'}`}>
                          Templates
                        </button>
                        <button
                          onClick={() => onCoverChange({ ...coverConfig, mode: 'builder' })}
                          className={`flex-1 py-2 font-medium transition-colors ${coverConfig.mode === 'builder' ? 'bg-[#9c27b0] text-white' : 'hover:bg-gray-50'}`}>
                          Builder libre
                        </button>
                      </div>

                      {coverConfig.mode === 'builder' && (
                        <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">
                          Utilisez le canevas A4 visible dans le document pour construire votre page de garde librement.
                        </p>
                      )}

                      {coverConfig.mode === 'template' && (
                        <>
                          <div>
                            <p className={labelCls}>Template</p>
                            <div className="grid grid-cols-2 gap-2">
                              {(['mariage', 'gastronomique', 'business', 'provence', 'luxe'] as const).map(t => (
                                <button key={t}
                                  onClick={() => onCoverChange({ ...coverConfig, template: t })}
                                  className={`py-2 px-3 rounded-lg border text-sm capitalize transition-colors ${coverConfig.template === t ? 'bg-[#faf5ff] border-[#9c27b0] text-[#9c27b0] font-medium' : 'hover:bg-gray-50'}`}>
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>

                          {[
                            { key: 'clientName', label: 'Nom du client', placeholder: 'M. et Mme Dupont', type: 'text' },
                            { key: 'address', label: 'Lieu / adresse', placeholder: 'Château de Versailles', type: 'text' },
                            { key: 'eventDate', label: 'Date', placeholder: '', type: 'date' },
                            { key: 'title', label: 'Titre', placeholder: 'Proposition gastronomique', type: 'text' },
                            { key: 'subtitle', label: 'Sous-titre', placeholder: 'Mariage — 120 couverts', type: 'text' },
                          ].map(({ key, label, placeholder, type }) => (
                            <div key={key}>
                              <label className={labelCls}>{label}</label>
                              <input
                                type={type}
                                value={(coverConfig as unknown as Record<string, string>)[key] ?? ''}
                                placeholder={placeholder}
                                onChange={e => onCoverChange({ ...coverConfig, [key]: e.target.value })}
                                className={inputCls}
                              />
                            </div>
                          ))}
                        </>
                      )}

                      {/* Saved templates */}
                      <div className="border-t pt-4 mt-2">
                        <p className={labelCls}>Modèles enregistrés</p>
                        {savedCoverTemplates.length === 0 && (
                          <p className="text-xs text-gray-400 italic mb-2">Aucun modèle enregistré</p>
                        )}
                        {savedCoverTemplates.map(tpl => (
                          <div key={tpl.id} className="flex items-center gap-2 mb-1.5">
                            <button
                              onClick={() => onCoverChange({ ...tpl.config, enabled: coverConfig.enabled })}
                              className="flex-1 text-left text-sm py-1.5 px-2.5 rounded-lg border hover:bg-purple-50 hover:border-purple-300 transition-colors truncate"
                            >
                              {tpl.name}
                            </button>
                            <button onClick={() => deleteCoverTemplate(tpl.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {showSaveCoverInput ? (
                          <div className="flex gap-2 mt-2">
                            <input
                              autoFocus
                              value={saveCoverName}
                              onChange={e => setSaveCoverName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveCoverTemplate(); if (e.key === 'Escape') setShowSaveCoverInput(false) }}
                              placeholder="Nom du modèle…"
                              className={inputCls + ' flex-1'}
                            />
                            <button onClick={saveCoverTemplate} disabled={!saveCoverName.trim()} className="px-3 py-1.5 bg-[#9c27b0] text-white text-sm rounded-lg disabled:opacity-50">
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setShowSaveCoverInput(true)} className="flex items-center gap-1.5 text-sm text-[#9c27b0] hover:text-[#7b1fa2] mt-1">
                            <Save className="w-3.5 h-3.5" /> Enregistrer comme modèle
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* PHOTOS PANEL */}
              {activePanel === 'photos' && photosConfig && onPhotosChange && (
                <div className="flex flex-col gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={photosConfig.enabled}
                      onChange={e => onPhotosChange({ ...photosConfig, enabled: e.target.checked })}
                      className="w-4 h-4 accent-[#9c27b0]" />
                    <span className="text-sm text-gray-700">Activer la page photos</span>
                  </label>
                  {photosConfig.enabled && (
                    <>
                      <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">
                        Gérez vos photos directement dans la page photos en bas du document.
                      </p>

                      {/* Saved photos templates */}
                      <div className="border-t pt-4 mt-2">
                        <p className={labelCls}>Modèles enregistrés</p>
                        {savedPhotosTemplates.length === 0 && (
                          <p className="text-xs text-gray-400 italic mb-2">Aucun modèle enregistré</p>
                        )}
                        {savedPhotosTemplates.map(tpl => (
                          <div key={tpl.id} className="flex items-center gap-2 mb-1.5">
                            <button
                              onClick={() => onPhotosChange({ ...tpl.config, enabled: photosConfig.enabled })}
                              className="flex-1 text-left text-sm py-1.5 px-2.5 rounded-lg border hover:bg-purple-50 hover:border-purple-300 transition-colors truncate"
                            >
                              {tpl.name}
                            </button>
                            <button onClick={() => deletePhotosTemplate(tpl.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {showSavePhotosInput ? (
                          <div className="flex gap-2 mt-2">
                            <input
                              autoFocus
                              value={savePhotosName}
                              onChange={e => setSavePhotosName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') savePhotosTemplate(); if (e.key === 'Escape') setShowSavePhotosInput(false) }}
                              placeholder="Nom du modèle…"
                              className={inputCls + ' flex-1'}
                            />
                            <button onClick={savePhotosTemplate} disabled={!savePhotosName.trim()} className="px-3 py-1.5 bg-[#9c27b0] text-white text-sm rounded-lg disabled:opacity-50">
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setShowSavePhotosInput(true)} className="flex items-center gap-1.5 text-sm text-[#9c27b0] hover:text-[#7b1fa2] mt-1">
                            <Save className="w-3.5 h-3.5" /> Enregistrer comme modèle
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
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
          {activePanel !== 'cover' && activePanel !== 'photos' && (
            <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Appliquer
            </button>
          )}
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
    { key: 'cover', icon: LayoutTemplate, label: 'Page de garde' },
    { key: 'photos', icon: ImageIcon, label: 'Page photos' },
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
