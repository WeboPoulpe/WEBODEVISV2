'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bold, Italic, Underline, List, ListOrdered,
  Save, Printer, Loader2, Check, Palette, ArrowLeft,
  LayoutTemplate, Bell, Eye, EyeOff, Download, Wand2,
  PenLine, History, X, Search, Image as ImageIcon, ImagePlus, RefreshCw, ScrollText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { generateQuoteHtml } from '@/lib/generateQuoteHtml';
import { useAuth } from '@/context/AuthContext';
import WeboWordSidePanels from './WeboWordSidePanels';
import { CoverPage } from './weboword/CoverPage';
import { PhotosPage } from './weboword/PhotosPage';
import { PageBreakIndicator } from './weboword/PageBreakIndicator';
import { PhotoBlockPicker } from './weboword/PhotoBlock';
import {
  type CoverPageConfig, type PhotosPageConfig,
  DEFAULT_COVER_CONFIG, DEFAULT_PHOTOS_CONFIG,
} from './weboword/weboword.types';
import { buildCoverPageHtml, buildPhotosPageHtml, buildLogoHeaderHtml, buildCgvHtml } from './weboword/printHelpers';

type PanelKey = 'client' | 'services' | 'event' | 'style' | 'images' | 'cover' | 'photos';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  quoteId: string;
  initialHtml: string;
  /** Shown in toolbar breadcrumb only */
  clientName?: string;
  /** Called (wizard mode) when user clicks ← back */
  onBack?: () => void;
  /** Pre-selected font (from saved quote) */
  selectedFont?: string;
  /** Pre-selected font size in px (from saved quote) */
  selectedFontSize?: number;
}

// ── Gastronomic menu width options ────────────────────────────────────────────
const MENU_WIDTHS = [
  { label: 'Étroit',  value: '280px' },
  { label: 'Normal',  value: '400px' },
  { label: 'Large',   value: '560px' },
  { label: 'Plein',   value: '100%'  },
];

// ── Available fonts ────────────────────────────────────────────────────────────
const FONTS = [
  // System fonts
  { label: 'Georgia (défaut)', value: 'Georgia', google: false },
  { label: 'Times New Roman', value: 'Times New Roman', google: false },
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Helvetica', value: 'Helvetica', google: false },
  { label: 'Verdana', value: 'Verdana', google: false },
  { label: 'Courier New', value: 'Courier New', google: false },
  { label: 'Trebuchet MS', value: 'Trebuchet MS', google: false },
  { label: 'Garamond', value: 'Garamond', google: false },
  // Google Fonts — Serif élégantes
  { label: 'Playfair Display', value: 'Playfair Display', google: true },
  { label: 'Merriweather', value: 'Merriweather', google: true },
  { label: 'Lora', value: 'Lora', google: true },
  { label: 'Cormorant Garamond', value: 'Cormorant Garamond', google: true },
  { label: 'EB Garamond', value: 'EB Garamond', google: true },
  { label: 'Crimson Text', value: 'Crimson Text', google: true },
  { label: 'Libre Baskerville', value: 'Libre Baskerville', google: true },
  { label: 'Spectral', value: 'Spectral', google: true },
  // Google Fonts — Sans-serif modernes
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Open Sans', value: 'Open Sans', google: true },
  { label: 'Lato', value: 'Lato', google: true },
  { label: 'Poppins', value: 'Poppins', google: true },
  { label: 'Inter', value: 'Inter', google: true },
  { label: 'Raleway', value: 'Raleway', google: true },
  { label: 'Nunito', value: 'Nunito', google: true },
  { label: 'Source Sans 3', value: 'Source Sans 3', google: true },
  { label: 'Work Sans', value: 'Work Sans', google: true },
  // Google Fonts — Display & Script
  { label: 'Dancing Script', value: 'Dancing Script', google: true },
  { label: 'Great Vibes', value: 'Great Vibes', google: true },
  { label: 'Pinyon Script', value: 'Pinyon Script', google: true },
  { label: 'Cinzel', value: 'Cinzel', google: true },
  { label: 'Abril Fatface', value: 'Abril Fatface', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
  { label: 'Oswald', value: 'Oswald', google: true },
];

// ── Colour presets for the text-colour picker ─────────────────────────────────
const COLORS = [
  '#1a1a1a', '#9c27b0', '#7b1fa2', '#1565c0', '#2e7d32',
  '#c62828', '#FF2400', '#e65100', '#f9a825', '#ffffff',
];

// ── Small toolbar button ───────────────────────────────────────────────────────
function TB({
  onClick, title, active, children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        'p-1.5 rounded-lg transition-colors text-sm',
        active
          ? 'bg-[#9c27b0] text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      {children}
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────
function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0" />;
}

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200 print:hidden">
      <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
      {message}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const FONT_SIZES = [7, 8, 9, 10, 11, 12, 13, 14, 16, 18];
const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.2', value: '1.2' },
  { label: '1.4', value: '1.4' },
  { label: '1.6', value: '1.6' },
  { label: '1.8', value: '1.8' },
  { label: '2.0', value: '2' },
];

export default function WeboWordEditor({ quoteId, initialHtml, clientName, onBack, selectedFont: initFont, selectedFontSize: initSize }: Props) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const editorRef  = useRef<HTMLDivElement>(null);
  const colorInput = useRef<HTMLInputElement>(null);
  const initDone   = useRef(false);

  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const [showDesc,  setShowDesc]  = useState(true);
  const [font,      setFont]      = useState(initFont ?? 'Georgia');
  const [fontSize,  setFontSize]  = useState(initSize ?? 12);
  const [lineHeight, setLineHeight] = useState('1.4');
  const [adminModal, setAdminModal] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateMsgIdx, setCelebrateMsgIdx] = useState(0);
  const [companyAssets, setCompanyAssets] = useState<{ logo_url: string | null; cgv: string | null }>({ logo_url: null, cgv: null });

  // Carousel of compliments
  const CELEBRATE_MSGS = [
    "Bravo Francis, ça fonctionne champion ! 🏆",
    "T'es le boss du devis ! 💪",
    "Carton plein, mon Francis ! 🎯",
    "Le maître de la sauvegarde ! 👑",
    "Francis, tu dépotes ! 🚀",
    "ChampION du week-end ! 🥇",
    "On applaudit Francis ! 👏",
    "Magnifique, Francis ! ✨",
    "Trop fort le Francis ! 💯",
    "Francis, tu gères grave ! 🔥",
  ];

  // Cycle through messages while celebrating
  useEffect(() => {
    if (!celebrate) return;
    const interval = setInterval(() => {
      setCelebrateMsgIdx((i) => (i + 1) % CELEBRATE_MSGS.length);
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);

  // Load logo + CGV from profiles
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('profiles').select('logo_url').eq('id', user.id).maybeSingle();
      let cgv: string | null = null;
      try {
        const { data: c } = await supabase.from('profiles').select('cgv').eq('id', user.id).maybeSingle();
        cgv = c?.cgv ?? null;
      } catch { /* colonne cgv absente */ }
      setCompanyAssets({ logo_url: (data as { logo_url?: string | null } | null)?.logo_url ?? null, cgv });
    })();
  }, [user]);

  // Sync activePanel with URL query param (using window to avoid Suspense issue)
  useEffect(() => {
    // On ne synchronise l'URL → state QUE lorsque le paramètre ?panel change réellement.
    // Sinon le polling écrasait l'état posé par les boutons toolbar (cover/photos), qui
    // ne modifient pas l'URL → le panneau se refermait tout seul en ≤300 ms.
    let lastUrlPanel: string | null | undefined = undefined;
    const update = () => {
      if (typeof window === 'undefined') return;
      const p = new URLSearchParams(window.location.search).get('panel');
      if (p === lastUrlPanel) return; // URL inchangée → ne pas contrarier l'état local
      lastUrlPanel = p;
      if (p === 'client' || p === 'services' || p === 'event' || p === 'style' || p === 'images' || p === 'cover' || p === 'photos') {
        setActivePanel(p);
      } else {
        setActivePanel(null);
      }
    };
    update();
    window.addEventListener('popstate', update);
    const interval = setInterval(update, 300);
    return () => { window.removeEventListener('popstate', update); clearInterval(interval); };
  }, []);

  // Listen for action events from sidebar (Save / Print / PDF buttons)
  // Refs are updated on every render so listeners always call the latest version of each handler
  useEffect(() => {
    const onSaveEvt = () => handleSaveRef.current();
    const onPrintEvt = () => handlePrintRef.current();
    const onSavePdfEvt = () => handleSavePdfRef.current();
    window.addEventListener('weboword:save', onSaveEvt);
    window.addEventListener('weboword:print', onPrintEvt);
    window.addEventListener('weboword:savepdf', onSavePdfEvt);
    return () => {
      window.removeEventListener('weboword:save', onSaveEvt);
      window.removeEventListener('weboword:print', onPrintEvt);
      window.removeEventListener('weboword:savepdf', onSavePdfEvt);
    };
  }, []);
  const [adminFields, setAdminFields] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', eventType: '', eventDate: '', eventLocation: '', guestCount: '' });
  const [adminChanges, setAdminChanges] = useState<{ field: string; from: string; to: string }[]>([]);
  const [showChanges, setShowChanges] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<{ id: string; first_name: string | null; last_name: string | null; email: string; phone: string | null; company_name: string | null }[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [adminServices, setAdminServices] = useState<{ id: string; name: string; quantity: number; unitPrice: number; isFree?: boolean; isOption?: boolean; removed?: boolean }[]>([]);
  const [structureModal, setStructureModal] = useState<{
    open: boolean;
    items: { index: number; name: string; preview: string; selected: boolean }[];
    titleColor: string;
    titleBold: boolean;
    titleItalic: boolean;
    descItalic: boolean;
  }>({ open: false, items: [], titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true });
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [menuWidth, setMenuWidth] = useState('100%');
  const [coverConfig, setCoverConfig] = useState<CoverPageConfig>(DEFAULT_COVER_CONFIG);
  const [photosConfig, setPhotosConfig] = useState<PhotosPageConfig>(DEFAULT_PHOTOS_CONFIG);
  const [showPhotoBlockPicker, setShowPhotoBlockPicker] = useState(false);
  const [localDraft, setLocalDraft] = useState<{ html: string; savedAt: string } | null>(null);
  const savedRange = useRef<Range | null>(null);
  const handlePrintRef = useRef<() => void>(() => {});
  const handleSavePdfRef = useRef<() => void>(() => {});
  const handleSaveRef = useRef<() => void>(() => {});

  // ── Load Google Font when font changes ────────────────────────────────────
  useEffect(() => {
    const f = FONTS.find((x) => x.value === font);
    if (!f?.google) return;
    const id = `gfont-${font.replace(/\s+/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }, [font]);

  // ── Close font menu on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!showFontMenu) return;
    const handler = () => setShowFontMenu(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFontMenu]);

  // Inject initial HTML once + detect existing gastro-menu width
  // Also check for a localStorage draft newer than what the server gave us
  useEffect(() => {
    if (!initDone.current && editorRef.current) {
      const draftKey = `weboword_draft_${quoteId}`;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as { html: string; savedAt: string };
          // If draft exists and DB has no content (null→generated) or draft is recent, offer restore
          setLocalDraft(draft);
          editorRef.current.innerHTML = initialHtml;
        } else {
          editorRef.current.innerHTML = initialHtml;
        }
      } catch {
        editorRef.current.innerHTML = initialHtml;
      }
      initDone.current = true;
      const menu = editorRef.current.querySelector('.gastro-menu') as HTMLElement | null;
      if (menu) menu.style.maxWidth = '100%';
    }
  }, [initialHtml, quoteId]);

  // Autosave to localStorage every 30 seconds
  useEffect(() => {
    const draftKey = `weboword_draft_${quoteId}`;
    const interval = setInterval(() => {
      const html = editorRef.current?.innerHTML;
      if (!html || !initDone.current) return;
      try {
        localStorage.setItem(draftKey, JSON.stringify({ html, savedAt: new Date().toISOString() }));
      } catch { /* quota exceeded — ignore */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [quoteId]);

  // Apply fontSize + lineHeight directly to DOM so contentEditable sees it immediately
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${fontSize}px`;
      editorRef.current.style.lineHeight = lineHeight;
    }
  }, [fontSize, lineHeight]);

  // Load cover/photos configs from Supabase on mount
  useEffect(() => {
    async function loadConfigs() {
      const supabase = createClient();
      const { data } = await supabase
        .from('quotes')
        .select('cover_page_config, photos_page_config, client_name, client_address, event_date, event_location, event_type')
        .eq('id', quoteId)
        .single();
      if (data?.cover_page_config) {
        setCoverConfig(data.cover_page_config as CoverPageConfig);
      } else if (data) {
        // Pre-fill cover config from quote data on first use
        setCoverConfig(prev => ({
          ...prev,
          clientName: data.client_name || '',
          address: data.event_location || '',
          eventDate: data.event_date || '',
          title: data.event_type ? `Proposition — ${data.event_type}` : 'Proposition gastronomique',
          subtitle: data.event_location || '',
        }));
      }
      if (data?.photos_page_config) {
        setPhotosConfig(data.photos_page_config as PhotosPageConfig);
      }
    }
    loadConfigs();
  }, [quoteId]);

  // Apply menuWidth to .gastro-menu div (bake before save/print)
  const applyMenuWidth = (width: string) => {
    setMenuWidth(width);
    const menu = editorRef.current?.querySelector('.gastro-menu') as HTMLElement | null;
    if (menu) menu.style.maxWidth = width;
  };

  // ── Auto-structure descriptions ──────────────────────────────────────────────
  const openStructureModal = useCallback(() => {
    if (!editorRef.current) return;
    const descs = editorRef.current.querySelectorAll('.svc-desc');
    const items: { index: number; name: string; preview: string; selected: boolean }[] = [];
    descs.forEach((el, i) => {
      const raw = el.textContent || '';
      if (!raw.trim()) return;
      // Find the prestation name (previous sibling or parent's h3/strong)
      const parent = el.closest('div[style]') || el.parentElement;
      const nameEl = parent?.querySelector('h3, strong');
      const name = nameEl?.textContent || `Description ${i + 1}`;
      const alreadyStructured = el.querySelectorAll('p, li').length > 2;
      items.push({
        index: i,
        name,
        preview: raw.substring(0, 120) + (raw.length > 120 ? '…' : ''),
        selected: !alreadyStructured, // pre-check unstructured ones
      });
    });
    if (items.length === 0) {
      setToast('Aucune description trouvée à structurer');
      return;
    }
    setStructureModal({ open: true, items, titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true });
  }, []);

  const applyStructure = useCallback(() => {
    if (!editorRef.current) return;
    const descs = editorRef.current.querySelectorAll('.svc-desc');
    const { titleColor, titleBold, titleItalic, descItalic } = structureModal;
    const selectedIndices = new Set(structureModal.items.filter((it) => it.selected).map((it) => it.index));
    let changed = 0;
    descs.forEach((el, i) => {
      if (!selectedIndices.has(i)) return;
      const raw = el.textContent || '';
      if (!raw.trim()) return;

      // Also style the title (h3) of this prestation
      const parent = el.closest('div[style]') || el.parentElement;
      const titleEl = parent?.querySelector('h3') as HTMLElement | null;
      if (titleEl) {
        if (titleColor) titleEl.style.color = titleColor;
        titleEl.style.fontWeight = titleBold ? 'bold' : 'normal';
        titleEl.style.fontStyle = titleItalic ? 'italic' : 'normal';
      }

      const lines = raw
        .split(/\s+[-–]\s+/)
        .flatMap((s) => s.split(/\*{2,}/))
        .flatMap((s) => s.split(/\n+/))
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length <= 1) {
        // Even if only 1 line, apply italic style
        if (descItalic) (el as HTMLElement).style.fontStyle = 'italic';
        changed++;
        return;
      }
      const italic = descItalic ? 'font-style:italic;' : '';
      const html = lines
        .map((line) => {
          const priceMatch = line.match(/(\+?\d+€\/pers\.?)$/);
          if (priceMatch) {
            const before = line.slice(0, -priceMatch[0].length).trim();
            return `<p style="margin:2px 0;${italic}">${before} <strong>${priceMatch[0]}</strong></p>`;
          }
          return `<p style="margin:2px 0;${italic}">${line}</p>`;
        })
        .join('');
      el.innerHTML = html;
      changed++;
    });
    setStructureModal({ open: false, items: [], titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true });
    setToast(`${changed} description${changed > 1 ? 's' : ''} structurée${changed > 1 ? 's' : ''}`);
  }, [structureModal]);

  // ── Régénérer le document depuis les données du devis ───────────────────────
  // Reconstruit le texte WeboWord à partir des données actuelles (services, client,
  // couverts, prix enfant…). Explicite et destructif : remplace la mise en forme
  // manuelle. Aucune autre action ne régénère automatiquement.
  const regenerateDocument = useCallback(async () => {
    if (!confirm('Régénérer le document depuis les données du devis ?\n\n⚠️ La mise en forme manuelle actuelle du texte sera remplacée.')) return;
    setSaving(true);
    const supabase = createClient();
    const [{ data: q }, profRes] = await Promise.all([
      supabase.from('quotes')
        .select('client_name, client_first_name, client_last_name, client_email, client_phone, client_address, event_type, event_date, event_location, guest_count, guest_count_adults, guest_count_children, services, vat_rate, hide_price, remarks, template, language')
        .eq('id', quoteId).single(),
      user
        ? supabase.from('profiles').select('company_name').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!q) { setSaving(false); alert('Devis introuvable'); return; }

    const cName = (q.client_first_name && q.client_last_name)
      ? `${q.client_first_name} ${q.client_last_name}`.trim()
      : ((q.client_name as string | null) ?? '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svcs: any[] = Array.isArray(q.services) ? q.services : [];

    const fresh = generateQuoteHtml(
      {
        companyName: (profRes.data as { company_name?: string | null } | null)?.company_name ?? 'Votre entreprise',
        clientName: cName || 'Client',
        clientEmail: q.client_email ?? null,
        clientPhone: q.client_phone ?? null,
        clientAddress: q.client_address ?? null,
        eventType: q.event_type ?? null,
        eventDate: q.event_date ?? null,
        eventLocation: q.event_location ?? null,
        guestCount: q.guest_count ?? null,
        guestCountAdults: q.guest_count_adults ?? null,
        guestCountChildren: q.guest_count_children ?? null,
        services: svcs
          .filter((s) => !s.isPageBreak)
          .map((s) => ({
            name: s.name,
            description: s.description,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            childUnitPrice: s.childUnitPrice ?? null,
            hideDescOnPdf: s.hideDescOnPdf,
            isFree: s.isFree,
            isOption: s.isOption,
            removed: s.removed,
            gastroCardHtml: s.gastroCardHtml,
            gastroCardHtmlEn: s.gastroCardHtmlEn,
          })),
        vatRate: q.vat_rate ?? 20,
        remarks: q.remarks ?? null,
        hidePrice: q.hide_price ?? false,
        cgv: companyAssets.cgv,
        language: (q.language as 'fr' | 'en') ?? 'fr',
      },
      { template: (q.template as 'standard' | 'mariage' | 'business') ?? 'standard', font },
    );

    if (editorRef.current) editorRef.current.innerHTML = fresh;
    // Efface le brouillon local pour ne pas restaurer l'ancien texte au rechargement.
    try { localStorage.removeItem(`weboword_draft_${quoteId}`); } catch { /* ignore */ }
    setLocalDraft(null);
    setSaving(false);
    setToast('Document régénéré ✓ — pense à sauvegarder');
  }, [quoteId, user, companyAssets.cgv, font]);

  // ── Admin fields: load from database ────────────────────────────────────────
  const openAdminModal = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('quotes')
      .select('client_name, client_email, client_phone, client_address, event_type, event_date, event_location, guest_count, services')
      .eq('id', quoteId).single();
    if (data) {
      // Load services for editing
      const svcs = Array.isArray(data.services) ? data.services : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAdminServices(svcs.filter((s: any) => !s.isPageBreak && s.name).map((s: any) => ({
        id: s.id || crypto.randomUUID(),
        name: s.name,
        quantity: s.quantity || 1,
        unitPrice: s.unitPrice || 0,
        isFree: !!s.isFree,
        isOption: !!s.isOption,
        removed: false,
      })));
      setAdminFields({
        clientName: data.client_name || '',
        clientEmail: data.client_email || '',
        clientPhone: data.client_phone || '',
        clientAddress: data.client_address || '',
        eventType: data.event_type || '',
        eventDate: data.event_date || '',
        eventLocation: data.event_location || '',
        guestCount: data.guest_count ? String(data.guest_count) : '',
      });
    }
    setClientSearch('');
    setClientResults([]);
    setShowClientPicker(false);
    setAdminModal(true);
  }, [quoteId]);

  // ── Search clients ────────────────────────────────────────────────────────
  const searchClients = useCallback(async (q: string) => {
    setClientSearch(q);
    if (!q.trim() || q.length < 2) { setClientResults([]); setShowClientPicker(false); return; }
    const supabase = createClient();
    const { data } = await supabase.from('customers')
      .select('id, first_name, last_name, email, phone, company_name')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
      .limit(6);
    setClientResults(data || []);
    setShowClientPicker(true);
  }, []);

  const selectClient = useCallback((c: { first_name: string | null; last_name: string | null; email: string; phone: string | null }) => {
    setAdminFields((f) => ({
      ...f,
      clientName: [c.first_name, c.last_name].filter(Boolean).join(' '),
      clientEmail: c.email || '',
      clientPhone: c.phone || '',
    }));
    setShowClientPicker(false);
    setClientSearch('');
  }, []);

  // ── Admin fields: apply changes to DOM ────────────────────────────────────
  const applyAdminChanges = useCallback(async () => {
    if (!editorRef.current) return;
    const el = editorRef.current;
    const changes: { field: string; from: string; to: string }[] = [];

    // Find blocks
    const allBlocks = Array.from(el.querySelectorAll('div[style*="flex:1"]'));
    const clientBlock = allBlocks.find((b) => b.querySelector('p')?.textContent?.trim() === 'CLIENT') as HTMLElement | undefined;
    const eventBlock = allBlocks.find((b) => b.querySelector('p')?.textContent?.trim() === 'ÉVÉNEMENT') as HTMLElement | undefined;

    // Helper: update or create a <p> in a block
    const updateField = (block: HTMLElement | undefined, index: number, newVal: string, label: string) => {
      if (!block) return;
      const ps = Array.from(block.querySelectorAll('p'));
      const oldVal = ps[index]?.textContent?.trim() || '';
      if (oldVal !== newVal && (oldVal || newVal)) {
        changes.push({ field: label, from: oldVal, to: newVal });
        if (ps[index]) {
          ps[index].textContent = newVal;
        }
      }
    };

    // Update client name (index 1)
    updateField(clientBlock, 1, adminFields.clientName || 'À compléter', 'Nom client');

    // Client info lines (email, phone, address) - rebuild
    if (clientBlock) {
      const ps = Array.from(clientBlock.querySelectorAll('p'));
      // Remove old info lines (keep label + name)
      const toRemove = ps.slice(2);
      const oldInfos = toRemove.map((p) => p.textContent?.trim() || '');
      toRemove.forEach((p) => p.remove());
      // Add new info lines
      const newInfos: string[] = [];
      if (adminFields.clientEmail) newInfos.push(adminFields.clientEmail);
      if (adminFields.clientPhone) newInfos.push(adminFields.clientPhone);
      if (adminFields.clientAddress) newInfos.push(adminFields.clientAddress);
      newInfos.forEach((info) => {
        const p = document.createElement('p');
        p.style.cssText = 'color:#555;margin:0 0 2px;font-size:11px;';
        p.textContent = info;
        clientBlock.appendChild(p);
      });
      // Track changes
      const oldStr = oldInfos.join(', ');
      const newStr = newInfos.join(', ');
      if (oldStr !== newStr) changes.push({ field: 'Infos client', from: oldStr, to: newStr });
    }

    // Update event type (index 1)
    updateField(eventBlock, 1, adminFields.eventType || 'À préciser', 'Type événement');

    // Event info lines - rebuild
    if (eventBlock) {
      const evPs = Array.from(eventBlock.querySelectorAll('p'));
      const toRemoveEv = evPs.slice(2);
      const oldInfos = toRemoveEv.map((p) => p.textContent?.trim() || '');
      toRemoveEv.forEach((p) => p.remove());
      const newInfos: string[] = [];
      if (adminFields.eventDate) newInfos.push(`📅 ${adminFields.eventDate}`);
      if (adminFields.guestCount) newInfos.push(`👥 ${adminFields.guestCount} invité${parseInt(adminFields.guestCount) > 1 ? 's' : ''}`);
      if (adminFields.eventLocation) newInfos.push(`📍 ${adminFields.eventLocation}`);
      newInfos.forEach((info) => {
        const p = document.createElement('p');
        p.style.cssText = 'color:#555;margin:0 0 2px;font-size:11px;';
        p.textContent = info;
        eventBlock.appendChild(p);
      });
      const oldStr = oldInfos.join(', ');
      const newStr = newInfos.join(', ');
      if (oldStr !== newStr) changes.push({ field: 'Infos événement', from: oldStr, to: newStr });
    }

    // Update intro text (letter salutation)
    const introP = el.querySelector('div[style*="border-left:4px"] p');
    if (introP) {
      const name = adminFields.clientName || '';
      const evtType = adminFields.eventType || 'événement';
      const dateStr = adminFields.eventDate ? ` du ${adminFields.eventDate}` : '';
      const locStr = adminFields.eventLocation ? ` à ${adminFields.eventLocation}` : '';
      introP.innerHTML = `Madame, Monsieur ${name},<br><br>Nous vous remercions de votre confiance et avons le plaisir de vous soumettre notre proposition pour votre ${evtType}${dateStr}${locStr}. Vous trouverez ci-dessous le détail de nos prestations.`;
    }

    // Update gastro menu header (event type + date + location)
    const gastroHeader = el.querySelector('.gastro-header, .gastro-page div[style*="gradient"]');
    if (gastroHeader) {
      const ps = gastroHeader.querySelectorAll('p');
      // First p = event type + date
      if (ps[0]) {
        const datePart = adminFields.eventDate ? ` — ${adminFields.eventDate.toUpperCase()}` : '';
        ps[0].textContent = `${(adminFields.eventType || 'ÉVÉNEMENT').toUpperCase()}${datePart}`;
      }
      // h2 or second strong = "Menu de votre [Name]"
      const h2 = gastroHeader.querySelector('h2, em');
      if (h2 && adminFields.clientName) {
        h2.textContent = `Menu de votre ${adminFields.eventType || 'Réception'}`;
      }
      // Location
      const locP = Array.from(ps).find((p) => p.textContent?.includes('📍'));
      if (locP && adminFields.eventLocation) {
        locP.textContent = `📍 ${adminFields.eventLocation}`;
      }
    }

    // Save admin fields to database (quotes table)
    const supabase = createClient();
    const clientFullName = adminFields.clientName.trim();
    // Parse event_date: keep ISO if already ISO, otherwise store as-is
    const eventDateVal = adminFields.eventDate || new Date().toISOString().slice(0, 10);

    // Rebuild services array: match by name (IDs may not exist or differ)
    const { data: quoteData } = await supabase.from('quotes').select('services').eq('id', quoteId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origServices: any[] = Array.isArray(quoteData?.services) ? [...quoteData.services] : [];
    // Build a map by name for matching
    const svcByName = new Map(adminServices.map((s) => [s.name, s]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedServices = origServices.map((s: any) => {
      if (s.isPageBreak) return s;
      const edited = svcByName.get(s.name);
      if (!edited) return s;
      return { ...s, quantity: edited.quantity, unitPrice: edited.unitPrice, isFree: !!edited.isFree, isOption: !!edited.isOption, removed: !!edited.removed };
    });

    // Split name into first/last for the quote
    const nameParts = clientFullName.split(' ');
    const cFirstName = nameParts[0] || '';
    const cLastName = nameParts.slice(1).join(' ') || '';

    // ⚠️ On préserve content_html : les modifs admin (client, couverts, quantités)
    // sont enregistrées mais NE régénèrent PAS le texte WeboWord déjà mis en forme.
    // La régénération est explicite (bouton « Régénérer le document »).
    const { error: saveErr } = await supabase.from('quotes').update({
      client_name: clientFullName || '',
      client_first_name: cFirstName || null,
      client_last_name: cLastName || null,
      client_email: adminFields.clientEmail || null,
      client_phone: adminFields.clientPhone || null,
      client_address: adminFields.clientAddress || null,
      event_type: adminFields.eventType || '',
      event_date: eventDateVal,
      event_location: adminFields.eventLocation || '',
      guest_count: parseInt(adminFields.guestCount) || 1,
      services: updatedServices,
    }).eq('id', quoteId);

    if (saveErr) {
      alert('Erreur sauvegarde: ' + saveErr.message);
      setAdminModal(false);
      return;
    }

    // Upsert client in customers table
    if (clientFullName && adminFields.clientEmail) {
      const names = clientFullName.split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';
      const { data: existing } = await supabase.from('customers')
        .select('id').eq('email', adminFields.clientEmail.toLowerCase()).maybeSingle();
      if (existing) {
        await supabase.from('customers').update({
          first_name: firstName, last_name: lastName,
          phone: adminFields.clientPhone || null,
        }).eq('id', existing.id);
      } else {
        await supabase.from('customers').insert({
          first_name: firstName, last_name: lastName,
          email: adminFields.clientEmail.toLowerCase(),
          phone: adminFields.clientPhone || null,
          customer_type: 'particulier',
        });
      }
    }

    setAdminModal(false);
    window.location.href = `/devis/${quoteId}/modifier?mode=weboword&t=${Date.now()}`;
  }, [adminFields, adminServices, quoteId]);

  // ── Toolbar commands ─────────────────────────────────────────────────────────
  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
  }, []);

  // Titres / paragraphe : formatBlock seul ne « prend » pas visuellement car le
  // document a des font-size INLINE sur chaque élément (qui écrasent le rendu h1/h2/h3).
  // On applique donc explicitement taille/graisse en inline sur le bloc obtenu, et on
  // neutralise les font-size inline des enfants pour qu'ils héritent du titre.
  const applyHeading = useCallback((tag: 'H1' | 'H2' | 'H3' | 'P') => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('formatBlock', false, `<${tag.toLowerCase()}>`);
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== el) {
      if (node instanceof HTMLElement && /^(H1|H2|H3|P)$/.test(node.tagName)) break;
      node = node.parentNode;
    }
    if (!(node instanceof HTMLElement)) return;
    const spec: Record<string, [string, string, string]> = {
      H1: ['1.9em', '700', '14px 0 8px'],
      H2: ['1.5em', '700', '12px 0 6px'],
      H3: ['1.2em', '600', '10px 0 5px'],
      P:  ['1em',   '400', '0 0 8px'],
    };
    const [size, weight, margin] = spec[node.tagName];
    node.style.fontSize = size;
    node.style.fontWeight = weight;
    node.style.margin = margin;
    node.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((c) => { c.style.fontSize = 'inherit'; });
  }, []);

  const applyColor = (color: string) => exec('foreColor', color);
  const applyBg    = (color: string) => exec('hiliteColor', color);

  // Insère le bloc CGV (balisé data-webo-cgv) en fin de document s'il est absent.
  // La balise évite le doublon à l'impression/PDF (détection déjà en place).
  const insertCgv = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!companyAssets.cgv) { setToast('Aucune CGV enregistrée — ajoute-les dans Paramètres → CGV.'); return; }
    if (el.innerHTML.includes('data-webo-cgv') || (companyAssets.cgv && el.innerHTML.includes(companyAssets.cgv))) {
      setToast('Les CGV sont déjà présentes dans le document.');
      return;
    }
    const block = `<div data-webo-cgv="1" style="page-break-before:always;break-before:page;margin-top:24px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;"><div style="flex:1;height:1px;background:#e0e0e0;"></div><p style="font-size:9px;font-weight:bold;color:#9c27b0;text-transform:uppercase;letter-spacing:2px;margin:0;">Conditions Générales de Vente</p><div style="flex:1;height:1px;background:#e0e0e0;"></div></div><div style="font-size:10px;color:#555;line-height:1.6;">${companyAssets.cgv}</div></div>`;
    el.insertAdjacentHTML('beforeend', block);
    setToast('CGV ajoutées en fin de document ✓ — pense à sauvegarder');
  }, [companyAssets.cgv]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const html = editorRef.current?.innerHTML ?? '';
    setSaving(true); setError(null);
    const supabase = createClient();
    let { error: err } = await supabase
      .from('quotes')
      .update({ content_html: html, selected_font: font, selected_font_size: fontSize, cover_page_config: coverConfig, photos_page_config: photosConfig })
      .eq('id', quoteId);
    if (err?.message?.includes('selected_font_size') || err?.code === '42703') {
      const res = await supabase
        .from('quotes')
        .update({ content_html: html, selected_font: font, cover_page_config: coverConfig, photos_page_config: photosConfig })
        .eq('id', quoteId);
      err = res.error;
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    // Clear local draft — content is safely in DB
    try { localStorage.removeItem(`weboword_draft_${quoteId}`); } catch { /* ignore */ }
    setLocalDraft(null);
    setToast('Devis enregistré avec succès 🎉');
    // 🎊 Confetti explosion!
    triggerConfetti();
    // 🏆 Celebration popup (TROLL — à supprimer plus tard)
    setCelebrateMsgIdx(0);
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 6000);
  };

  // ── Confetti explosion ────────────────────────────────────────────────────
  const triggerConfetti = () => {
    const colors = ['#9c27b0', '#FF2400', '#FFD700', '#1565c0', '#2e7d32', '#FF6B6B', '#4ECDC4', '#FFE66D'];
    const count = 80;
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div');
      const size = Math.random() * 8 + 6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = Math.random() > 0.5 ? '50%' : '0';
      const startX = 50 + (Math.random() - 0.5) * 30; // Center spread
      const angle = (Math.random() - 0.5) * Math.PI; // -90° to +90°
      const velocity = 200 + Math.random() * 400;
      const tx = Math.cos(angle - Math.PI / 2) * velocity;
      const ty = Math.sin(angle - Math.PI / 2) * velocity - 200;

      confetti.style.cssText = `
        position:absolute;left:${startX}%;top:60%;
        width:${size}px;height:${size}px;background:${color};
        border-radius:${shape};
        transform:translate(-50%,-50%) rotate(${Math.random() * 360}deg);
        animation:confetti-fly 1.8s cubic-bezier(.2,.6,.4,1) forwards;
        --tx:${tx}px;--ty:${ty}px;--rot:${Math.random() * 720 - 360}deg;
      `;
      container.appendChild(confetti);
    }
    // Add keyframes if not present
    if (!document.getElementById('confetti-style')) {
      const style = document.createElement('style');
      style.id = 'confetti-style';
      style.textContent = `@keyframes confetti-fly { 0%{opacity:1;transform:translate(-50%,-50%) rotate(0deg);} 100%{opacity:0;transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty) + 600px)) rotate(var(--rot));} }`;
      document.head.appendChild(style);
    }
    setTimeout(() => container.remove(), 2000);
  };

  // ── Build print HTML (shared by print + PDF) ──────────────────────────────────
  const buildPrintHtml = () => {
    const content = editorRef.current?.innerHTML ?? '';
    const fontEntry = FONTS.find((x) => x.value === font);
    const fontImport = fontEntry?.google
      ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap">`
      : '';
    const coverHtml = buildCoverPageHtml(coverConfig)
    const photosHtml = buildPhotosPageHtml(photosConfig)
    const logoHtml = buildLogoHeaderHtml(companyAssets.logo_url)
    const cgvHtml = buildCgvHtml(companyAssets.cgv)
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Devis</title>
  ${fontImport}
  <style>
    @page { size: A4; margin: 0; }
    html, body { color-scheme: light; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { margin: 0; padding: 0; font-family: '${font}', Georgia, serif; font-size: ${fontSize}px; line-height: ${lineHeight}; background: #fff; }
    body * { min-height: 0 !important; }
    .screen-sep { visibility: hidden !important; height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; font-size: 0 !important; line-height: 0 !important; page-break-after: always !important; break-after: page !important; }
    .gastro-page { page-break-before: always !important; break-before: page !important; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    p, li { orphans: 2; widows: 2; }
    ul { list-style: disc outside; padding-left: 1.6em; margin: 6px 0; }
    ol { list-style: decimal outside; padding-left: 1.6em; margin: 6px 0; }
    li { display: list-item; }
    ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
  </style>
</head>
<body>
  ${coverHtml}
  ${coverHtml ? '' : logoHtml}
  <div style="padding:20mm;">${content}</div>
  ${photosHtml}
  ${(content.includes('data-webo-cgv') || (companyAssets.cgv && content.includes(companyAssets.cgv))) ? '' : cgvHtml}
  <script>
    var els = document.querySelectorAll('[style]');
    var sep = false;
    for (var i = 0; i < els.length; i++) {
      if (els[i].style.minHeight) els[i].style.minHeight = '0';
      if (els[i].classList.contains('screen-sep')) { els[i].style.display = 'none'; sep = true; }
      if (sep && els[i].style.marginTop && parseFloat(els[i].style.marginTop) < 0) els[i].style.marginTop = '24px';
    }
  </script>
</body>
</html>`;
  };

  // ── Print (WYSIWYG) ───────────────────────────────────────────────────────────
  const handlePrint = () => {
    const html = buildPrintHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); return; }
    win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 600); };
  };

  // ── Save PDF — uses browser print (reliable, no html2canvas issues) ─────────
  const handleSavePdf = () => {
    const content = editorRef.current?.innerHTML ?? '';
    if (!content) return;

    // Build a clean filename
    const safeName = (clientName ?? 'client').replace(/[^a-zA-ZÀ-ÿ0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 40);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const filename = `Devis-${safeName}-${dateStr}`;

    // Font import
    const fontEntry = FONTS.find((x) => x.value === font);
    const fontImport = fontEntry?.google
      ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap">`
      : '';

    const coverHtml = buildCoverPageHtml(coverConfig)
    const photosHtml = buildPhotosPageHtml(photosConfig)
    const logoHtml = buildLogoHeaderHtml(companyAssets.logo_url)
    const cgvHtml = buildCgvHtml(companyAssets.cgv)

    // Build a self-contained HTML document optimized for PDF printing
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  ${fontImport}
  <style>
    @page { size: A4; margin: 8mm 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; color-scheme: light; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: '${font}', Georgia, serif; font-size: ${fontSize}px; line-height: ${lineHeight}; color: #1a1a1a; }

    /* Page wrapper — compact padding */
    .pdf-wrap { padding: 6mm 10mm; }

    /* Kill min-height from old saved HTML (was 257mm, forces blank space) */
    .pdf-wrap * { min-height: 0 !important; }

    /* Hide separator text but force page break */
    .screen-sep { visibility: hidden !important; height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; font-size: 0 !important; line-height: 0 !important; page-break-after: always !important; break-after: page !important; }

    /* Gastro page also forces new page (for new HTML without .screen-sep) */
    .gastro-page { page-break-before: always !important; break-before: page !important; }

    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    p, li { orphans: 2; widows: 2; }
    ul { list-style: disc outside; padding-left: 1.6em; margin: 6px 0; }
    ol { list-style: decimal outside; padding-left: 1.6em; margin: 6px 0; }
    li { display: list-item; }

    ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
  </style>
</head>
<body>
  ${coverHtml}
  ${coverHtml ? '' : logoHtml}
  <div class="pdf-wrap">${content}</div>
  ${photosHtml}
  ${(content.includes('data-webo-cgv') || (companyAssets.cgv && content.includes(companyAssets.cgv))) ? '' : cgvHtml}
  <script>
    window.onload = function() {
      var els = document.querySelectorAll('[style]');
      var screenSepSeen = false;
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        // Kill min-height (old HTML: min-height:257mm)
        if (el.style.minHeight) el.style.minHeight = '0';
        // Track when we pass the screen separator
        if (el.classList.contains('screen-sep')) {
          el.style.display = 'none';
          screenSepSeen = true;
        }
        // After the separator, fix negative top margins (gastro header overlap)
        if (screenSepSeen && el.style.marginTop && parseFloat(el.style.marginTop) < 0) {
          el.style.marginTop = '24px';
        }
      }
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); return; }
    win.onafterprint = () => { URL.revokeObjectURL(url); };
  };

  // Keep refs up-to-date so the event listeners (registered once) always call the latest handler
  handleSaveRef.current = handleSave;
  handlePrintRef.current = handlePrint;
  handleSavePdfRef.current = handleSavePdf;

  return (
    <div className="flex flex-col h-full bg-slate-100 relative">

      {/* CSS: font override + font size + description toggle + gastro menu width */}
      <style>{`
        #weboword-sheet, #weboword-sheet * { font-family: '${font}', Georgia, serif !important; }
        #weboword-sheet { font-size: ${fontSize}px !important; line-height: ${lineHeight} !important; }
        ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
        .gastro-menu { max-width: ${menuWidth} !important; margin: 0 auto !important; }
      `}</style>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* 🏆 Celebration troll popup (à supprimer plus tard) */}
      {celebrate && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 pointer-events-none animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setCelebrate(false)} />
          <div
            className="relative pointer-events-auto bg-gradient-to-br from-[#ffe5f6] via-white to-[#fff5d4] rounded-[40px] shadow-2xl px-10 py-10 max-w-md w-full text-center animate-in zoom-in-95 duration-500"
            style={{ boxShadow: '0 0 60px 10px rgba(156, 39, 176, 0.4), 0 20px 50px rgba(0,0,0,0.3)' }}
          >
            <button onClick={() => setCelebrate(false)} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>

            {/* Animated trophy / photo */}
            <div className="mx-auto mb-6 relative" style={{ width: 160, height: 160 }}>
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-pink-500 animate-pulse"
                style={{ filter: 'blur(20px)', opacity: 0.6 }}
              />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-yellow-200 via-amber-300 to-orange-400 flex items-center justify-center text-8xl shadow-2xl border-4 border-white"
                style={{ animation: 'celebrate-bounce 0.8s ease-in-out infinite alternate' }}
              >
                🏆
              </div>
              {/* Stars floating around */}
              <span className="absolute -top-2 -left-2 text-2xl animate-ping" style={{ animationDuration: '1.5s' }}>⭐</span>
              <span className="absolute -bottom-2 -right-2 text-2xl animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.3s' }}>✨</span>
              <span className="absolute top-1/2 -right-4 text-2xl animate-bounce" style={{ animationDelay: '0.5s' }}>💫</span>
              <span className="absolute top-1/2 -left-4 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎊</span>
            </div>

            {/* Carousel message */}
            <div className="h-16 flex items-center justify-center overflow-hidden">
              <p
                key={celebrateMsgIdx}
                className="text-2xl font-black bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent px-4"
                style={{ animation: 'celebrate-slide 0.4s ease-out' }}
              >
                {CELEBRATE_MSGS[celebrateMsgIdx]}
              </p>
            </div>

            <p className="text-xs text-gray-400 mt-4 italic">Devis enregistré avec succès · Clique pour fermer</p>
          </div>

          <style>{`
            @keyframes celebrate-bounce {
              0% { transform: scale(1) rotate(-5deg); }
              100% { transform: scale(1.08) rotate(5deg); }
            }
            @keyframes celebrate-slide {
              0% { opacity: 0; transform: translateY(20px) scale(0.9); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}

      {/* ── Structure modal ─────────────────────────────────────────────────── */}
      {structureModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStructureModal({ open: false, items: [], titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-[#9c27b0]" />
                <h2 className="text-sm font-semibold text-gray-900">Structurer les descriptions</h2>
              </div>
              <button onClick={() => setStructureModal({ open: false, items: [], titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true })} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            <p className="px-5 pt-3 text-xs text-gray-500">Choisissez les descriptions à reformater et le style à appliquer :</p>

            {/* Style options */}
            <div className="mx-5 mt-3 p-3 bg-gray-50 rounded-xl space-y-2.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Style des titres</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Couleur :</span>
                  <div className="flex gap-1">
                    {['#9c27b0', '#c8956c', '#1e293b', '#1a1a1a', '#c62828', '#1565c0', '#2e7d32'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setStructureModal({ ...structureModal, titleColor: c })}
                        style={{ background: c }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${structureModal.titleColor === c ? 'border-gray-900 scale-110' : 'border-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={structureModal.titleBold} onChange={(e) => setStructureModal({ ...structureModal, titleBold: e.target.checked })} className="h-3 w-3 rounded accent-[#9c27b0]" />
                  <span className="text-xs text-gray-600 font-bold">Gras</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={structureModal.titleItalic} onChange={(e) => setStructureModal({ ...structureModal, titleItalic: e.target.checked })} className="h-3 w-3 rounded accent-[#9c27b0]" />
                  <span className="text-xs text-gray-600 italic">Italique</span>
                </label>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Style des descriptions</p>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={structureModal.descItalic} onChange={(e) => setStructureModal({ ...structureModal, descItalic: e.target.checked })} className="h-3 w-3 rounded accent-[#9c27b0]" />
                  <span className="text-xs text-gray-600 italic">Descriptions en italique</span>
                </label>
              </div>
              {/* Live preview */}
              <div className="border-t border-gray-200 pt-2">
                <p className="text-[10px] text-gray-400 mb-1">Aperçu :</p>
                <div className="bg-white rounded-lg p-2 border border-gray-200 text-center">
                  <p style={{ color: structureModal.titleColor, fontWeight: structureModal.titleBold ? 'bold' : 'normal', fontStyle: structureModal.titleItalic ? 'italic' : 'normal', fontSize: '13px' }}>
                    Nom de la prestation
                  </p>
                  <p style={{ fontStyle: structureModal.descItalic ? 'italic' : 'normal', fontSize: '11px', color: '#777' }}>
                    Description gastronomique du plat
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {structureModal.items.map((item, idx) => (
                <label key={item.index} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${item.selected ? 'border-[#9c27b0]/30 bg-[#faf5ff]' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => {
                      const updated = [...structureModal.items];
                      updated[idx] = { ...updated[idx], selected: e.target.checked };
                      setStructureModal({ ...structureModal, items: updated });
                    }}
                    className="mt-0.5 h-4 w-4 rounded accent-[#9c27b0] flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 italic">{item.preview}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => {
                  const allSelected = structureModal.items.every((it) => it.selected);
                  setStructureModal({ ...structureModal, items: structureModal.items.map((it) => ({ ...it, selected: !allSelected })) });
                }}
                className="text-xs text-[#9c27b0] hover:underline font-medium"
              >
                {structureModal.items.every((it) => it.selected) ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <div className="flex gap-2">
                <button onClick={() => setStructureModal({ open: false, items: [], titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true })} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button
                  onClick={applyStructure}
                  disabled={!structureModal.items.some((it) => it.selected)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Structurer ({structureModal.items.filter((it) => it.selected).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm print:hidden">

        {/* Error display (only when there's an error) */}
        {error && (
          <div className="px-4 py-1.5 bg-red-50 border-b border-red-100 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Formatting bar */}
        <div className="flex items-center gap-0.5 px-4 py-1.5 flex-wrap">
          <TB onClick={() => exec('bold')}           title="Gras (Ctrl+B)">
            <Bold className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('italic')}         title="Italique (Ctrl+I)">
            <Italic className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('underline')}      title="Souligné (Ctrl+U)">
            <Underline className="h-3.5 w-3.5" />
          </TB>

          <Sep />

          <TB onClick={() => exec('insertUnorderedList')} title="Liste à puces">
            <List className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('insertOrderedList')}   title="Liste numérotée">
            <ListOrdered className="h-3.5 w-3.5" />
          </TB>

          <Sep />

          {/* Heading buttons */}
          {(['H1', 'H2', 'H3'] as const).map((tag) => (
            <TB
              key={tag}
              onClick={() => applyHeading(tag)}
              title={`Titre ${tag}`}
            >
              <span className="font-bold text-xs leading-none">{tag}</span>
            </TB>
          ))}
          <TB onClick={() => applyHeading('P')} title="Paragraphe normal">
            <span className="text-xs leading-none">¶</span>
          </TB>

          <Sep />

          {/* Alignment */}
          <TB onClick={() => exec('justifyLeft')}   title="Aligner à gauche">
            <span className="text-xs font-mono">≡←</span>
          </TB>
          <TB onClick={() => exec('justifyCenter')} title="Centrer">
            <span className="text-xs font-mono">≡</span>
          </TB>
          <TB onClick={() => exec('justifyRight')}  title="Aligner à droite">
            <span className="text-xs font-mono">≡→</span>
          </TB>

          <Sep />

          {/* Text colour */}
          <div className="relative flex items-center">
            <button
              title="Couleur du texte"
              className="flex items-center gap-1 p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              onMouseDown={(e) => { e.preventDefault(); colorInput.current?.click(); }}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="text-[10px]">A</span>
            </button>
            {/* Colour presets */}
            <div className="flex items-center gap-0.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  title={c}
                  onMouseDown={(e) => { e.preventDefault(); applyColor(c); }}
                  style={{ background: c }}
                  className="w-4 h-4 rounded-sm border border-gray-300 hover:scale-110 transition-transform flex-shrink-0"
                />
              ))}
            </div>
            {/* Native colour input (hidden) */}
            <input
              ref={colorInput}
              type="color"
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              onChange={(e) => applyColor(e.target.value)}
            />
          </div>

          <Sep />

          {/* Highlight colour */}
          <div className="flex items-center gap-0.5">
            {['#fff9c4', '#e8f5e9', '#fce4ec', '#e3f2fd', 'transparent'].map((c) => (
              <button
                key={c}
                title={c === 'transparent' ? 'Effacer surlignage' : `Surligner ${c}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyBg(c === 'transparent' ? 'transparent' : c);
                }}
                style={{ background: c === 'transparent' ? '#fff' : c }}
                className="w-4 h-4 rounded-sm border border-gray-300 hover:scale-110 transition-transform flex-shrink-0 relative"
              >
                {c === 'transparent' && (
                  <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[9px] font-bold">×</span>
                )}
              </button>
            ))}
          </div>

          <Sep />

          {/* Description toggle */}
          <button
            onMouseDown={(e) => { e.preventDefault(); setShowDesc((v) => !v); }}
            title={showDesc ? 'Masquer les descriptions' : 'Afficher les descriptions'}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors border',
              showDesc
                ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                : 'border-[#9c27b0] text-[#9c27b0] bg-purple-50',
            )}
          >
            {showDesc
              ? <><Eye className="h-3.5 w-3.5" /><span className="hidden sm:inline">Descriptions</span></>
              : <><EyeOff className="h-3.5 w-3.5" /><span className="hidden sm:inline">Descriptions masquées</span></>}
          </button>

          {/* Auto-structure descriptions */}
          <button
            type="button"
            onClick={openStructureModal}
            title="Structurer automatiquement les descriptions (séparer par tirets, mettre en forme)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#9c27b0]/70 hover:bg-[#f3e5f5] hover:text-[#9c27b0] transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Structurer</span>
          </button>

          <Sep />

          {/* Font selector */}
          <div className="relative">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowFontMenu((v) => !v); }}
              title="Changer la police"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
              style={{ fontFamily: font }}
            >
              <span className="max-w-[90px] truncate">{font}</span>
              <span className="text-gray-400">▾</span>
            </button>
            {showFontMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[180px] max-h-72 overflow-y-auto py-1">
                {FONTS.map((f) => (
                  <button
                    key={f.value}
                    onMouseDown={(e) => { e.preventDefault(); setFont(f.value); setShowFontMenu(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-[#9c27b0]/5 transition-colors',
                      font === f.value && 'text-[#9c27b0] font-semibold',
                    )}
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Sep />

          {/* Font size selector */}
          <div className="flex items-center gap-0.5" title="Taille de police">
            <span className="text-[10px] text-gray-400 mr-0.5 hidden sm:inline">Taille :</span>
            <select
              value={fontSize}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="px-1.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30 cursor-pointer"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          </div>

          {/* Line height selector */}
          <div className="flex items-center gap-0.5" title="Interligne">
            <span className="text-[10px] text-gray-400 mr-0.5 hidden sm:inline">Interligne :</span>
            <select
              value={lineHeight}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setLineHeight(e.target.value)}
              className="px-1.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30 cursor-pointer"
            >
              {LINE_HEIGHTS.map((lh) => (
                <option key={lh.value} value={lh.value}>{lh.label}</option>
              ))}
            </select>
          </div>

          <Sep />
          <TB
            onClick={() => setActivePanel(activePanel === 'cover' ? null : 'cover')}
            title="Page de garde"
            active={activePanel === 'cover'}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
          </TB>
          <TB
            onClick={() => setActivePanel(activePanel === 'photos' ? null : 'photos')}
            title="Page photos"
            active={activePanel === 'photos'}
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </TB>
          <Sep />
          <TB
            onClick={() => {
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
              setShowPhotoBlockPicker(true);
            }}
            title="Insérer un bloc photo"
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </TB>
          <Sep />
          <TB
            onClick={insertCgv}
            title="Ajouter les CGV en fin de document"
          >
            <ScrollText className="h-3.5 w-3.5" />
          </TB>
          <TB
            onClick={regenerateDocument}
            title="Régénérer le document depuis les données du devis (remplace la mise en forme manuelle)"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </TB>

        </div>
      </div>

      {/* ── A4 workspace ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-8 px-4 print:p-0 print:overflow-visible">

        {/* Local draft restore banner */}
        {localDraft && (
          <div className="mx-auto mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm print:hidden" style={{ width: '210mm' }}>
            <span className="text-amber-600 font-medium flex-1">
              💾 Brouillon local trouvé — sauvegardé le {new Date(localDraft.savedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={() => {
                if (editorRef.current) editorRef.current.innerHTML = localDraft.html;
                setLocalDraft(null);
                setToast('Brouillon restauré — pense à sauvegarder !');
              }}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors flex-shrink-0"
            >
              Restaurer
            </button>
            <button
              onClick={() => {
                try { localStorage.removeItem(`weboword_draft_${quoteId}`); } catch { /* ignore */ }
                setLocalDraft(null);
              }}
              className="px-3 py-1.5 text-amber-600 hover:text-amber-800 flex-shrink-0"
            >
              Ignorer
            </button>
          </div>
        )}

        {/* Page de garde */}
        {coverConfig.enabled && (
          <>
            <div
              style={{ width: '210mm', minHeight: '297mm' }}
              className="mx-auto shadow-xl rounded-lg print:shadow-none print:rounded-none print:w-full relative overflow-hidden"
            >
              <CoverPage config={coverConfig} onChange={setCoverConfig} />
            </div>
            <PageBreakIndicator label="Page 2 — Devis" />
          </>
        )}

        {/* Devis editor (A4) */}
        <div
          style={{ width: '210mm' }}
          className="mx-auto bg-white shadow-xl rounded-lg print:shadow-none print:rounded-none print:w-full"
        >
          <style>{`
            #weboword-sheet,
            #weboword-sheet p,
            #weboword-sheet li,
            #weboword-sheet div,
            #weboword-sheet span,
            #weboword-sheet td,
            #weboword-sheet th {
              line-height: ${lineHeight} !important;
            }
            /* Restaure les puces/numéros (Tailwind preflight les supprime) */
            #weboword-sheet ul { list-style: disc outside !important; padding-left: 1.6em !important; margin: 6px 0 !important; }
            #weboword-sheet ol { list-style: decimal outside !important; padding-left: 1.6em !important; margin: 6px 0 !important; }
            #weboword-sheet li { display: list-item !important; }
            #weboword-sheet h1, #weboword-sheet h2, #weboword-sheet h3 { line-height: 1.25 !important; }
            @media print {
              .no-print { display: none !important; }
              #weboword-sheet {
                padding: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                min-height: 0 !important;
                width: 100% !important;
              }
              .screen-sep {
                border: none !important;
                background: transparent !important;
                color: transparent !important;
                height: 0 !important;
                overflow: hidden !important;
                font-size: 0 !important;
                line-height: 0 !important;
              }
            }
          `}</style>

          <div
            id="weboword-sheet"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            style={{ padding: '20mm', fontSize: `${fontSize}px`, lineHeight: lineHeight }}
            className="outline-none min-h-[120px] prose prose-sm max-w-none focus:ring-2 focus:ring-[#9c27b0]/20 rounded-lg"
            data-placeholder="Cliquez ici pour commencer à modifier votre devis…"
          />
        </div>

        {/* Page photos */}
        {photosConfig.enabled && (
          <>
            <PageBreakIndicator label="Page photos" />
            <div
              style={{ width: '210mm' }}
              className="mx-auto bg-white shadow-xl rounded-lg print:shadow-none print:rounded-none print:w-full p-8"
            >
              <PhotosPage config={photosConfig} onChange={setPhotosConfig} />
            </div>
          </>
        )}

        {/* Bottom padding */}
        <div className="h-12 print:hidden" />
      </div>

      {/* ── Side panel (Client / Services / Event / Style / Images) ────────── */}
      <WeboWordSidePanels
        quoteId={quoteId}
        activePanel={activePanel}
        menuWidth={menuWidth}
        onMenuWidthChange={(w) => applyMenuWidth(w)}
        coverConfig={coverConfig}
        onCoverChange={setCoverConfig}
        photosConfig={photosConfig}
        onPhotosChange={setPhotosConfig}
        onClose={() => {
          setActivePanel(null);
          // Remove panel query param
          const url = new URL(window.location.href);
          url.searchParams.delete('panel');
          window.history.replaceState(null, '', url.toString());
        }}
        onApplied={() => {
          setActivePanel(null);
          window.location.href = `/devis/${quoteId}/modifier?mode=weboword&t=${Date.now()}`;
        }}
      />

      {/* ── Admin edit modal ───────────────────────────────────────────────── */}
      {adminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAdminModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#f3e5f5] rounded-xl">
                  <PenLine className="h-4 w-4 text-[#9c27b0]" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">Informations administratives</h2>
                  <p className="text-[10px] text-gray-400">Modifie uniquement la partie administrative du devis</p>
                </div>
              </div>
              <button onClick={() => setAdminModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Client section */}
              <div>
                <p className="text-[10px] font-bold text-[#9c27b0] uppercase tracking-wider mb-3">Client</p>
                <div className="space-y-3">
                  {/* Client search */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rechercher un client existant</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        value={clientSearch}
                        onChange={(e) => searchClients(e.target.value)}
                        placeholder="Nom, email ou entreprise…"
                        className="w-full text-sm border border-dashed border-[#9c27b0]/30 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-[#faf5ff]"
                      />
                    </div>
                    {showClientPicker && clientResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {clientResults.map((c) => (
                          <button key={c.id} onClick={() => selectClient(c)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#faf5ff] transition-colors text-left border-b border-gray-50 last:border-0">
                            <div className="w-8 h-8 rounded-full bg-[#f3e5f5] flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-[#9c27b0]">{(c.first_name?.[0] || c.email[0]).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.company_name || c.email}</p>
                              <p className="text-[10px] text-gray-400 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showClientPicker && clientResults.length === 0 && clientSearch.length >= 2 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-3 text-center">
                        <p className="text-xs text-gray-400">Aucun client trouvé</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom complet</label>
                    <input
                      value={adminFields.clientName}
                      onChange={(e) => setAdminFields((f) => ({ ...f, clientName: e.target.value }))}
                      placeholder="Jean Dupont"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input
                        value={adminFields.clientEmail}
                        onChange={(e) => setAdminFields((f) => ({ ...f, clientEmail: e.target.value }))}
                        placeholder="jean@email.com"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                      <input
                        value={adminFields.clientPhone}
                        onChange={(e) => setAdminFields((f) => ({ ...f, clientPhone: e.target.value }))}
                        placeholder="06 12 34 56 78"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                    <input
                      value={adminFields.clientAddress}
                      onChange={(e) => setAdminFields((f) => ({ ...f, clientAddress: e.target.value }))}
                      placeholder="12 rue des Lilas, 75001 Paris"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                    />
                  </div>
                </div>
              </div>

              {/* Event section */}
              <div>
                <p className="text-[10px] font-bold text-[#9c27b0] uppercase tracking-wider mb-3">Événement</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select
                        value={adminFields.eventType}
                        onChange={(e) => setAdminFields((f) => ({ ...f, eventType: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      >
                        <option value="">— Choisir —</option>
                        {['Mariage', 'Cocktail', 'Anniversaire', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={adminFields.eventDate}
                        onChange={(e) => setAdminFields((f) => ({ ...f, eventDate: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de couverts</label>
                      <input
                        type="number"
                        min={1}
                        value={adminFields.guestCount}
                        onChange={(e) => {
                          const count = e.target.value;
                          setAdminFields((f) => ({ ...f, guestCount: count }));
                          // Auto-fill all service quantities with guest count
                          const n = parseInt(count) || 1;
                          setAdminServices((prev) => prev.map((s) => ({ ...s, quantity: n })));
                        }}
                        placeholder="120"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Lieu</label>
                      <input
                        value={adminFields.eventLocation}
                        onChange={(e) => setAdminFields((f) => ({ ...f, eventLocation: e.target.value }))}
                        placeholder="Château de Villebougis"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Prestations section */}
              <div>
                <p className="text-[10px] font-bold text-[#9c27b0] uppercase tracking-wider mb-3">Prestations (page financière)</p>
                <p className="text-[10px] text-gray-400 mb-2">Modifie le tableau financier uniquement. La carte gastronomique reste inchangée.</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_45px_55px_65px_55px] gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    <span>Prestation</span>
                    <span className="text-center">Qté</span>
                    <span className="text-center">PU</span>
                    <span className="text-center">Statut</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                    {adminServices.map((svc, idx) => (
                      <div key={svc.id} className={`grid grid-cols-[1fr_45px_55px_65px_55px] gap-1 px-3 py-2 items-center transition-colors ${svc.removed ? 'bg-red-50/50 opacity-50' : ''}`}>
                        <div className="min-w-0">
                          <p className={`text-xs font-medium truncate ${svc.removed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{svc.name}</p>
                        </div>
                        <input
                          type="number" min={1}
                          value={svc.quantity}
                          onChange={(e) => setAdminServices((prev) => prev.map((s, i) => i === idx ? { ...s, quantity: parseInt(e.target.value) || 1 } : s))}
                          disabled={svc.removed}
                          className="w-full text-[11px] text-center border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30 disabled:opacity-40"
                        />
                        <input
                          type="number" min={0} step={0.01}
                          value={svc.unitPrice}
                          onChange={(e) => setAdminServices((prev) => prev.map((s, i) => i === idx ? { ...s, unitPrice: parseFloat(e.target.value) || 0 } : s))}
                          disabled={svc.removed}
                          className="w-full text-[11px] text-right border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30 disabled:opacity-40"
                        />
                        <select
                          value={svc.removed ? 'removed' : svc.isFree ? 'free' : svc.isOption ? 'option' : 'normal'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAdminServices((prev) => prev.map((s, i) => i === idx ? {
                              ...s,
                              removed: v === 'removed',
                              isFree: v === 'free',
                              isOption: v === 'option',
                            } : s));
                          }}
                          className="text-[10px] border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30"
                        >
                          <option value="normal">Normal</option>
                          <option value="free">Inclus</option>
                          <option value="option">Option</option>
                          <option value="removed">Retiré</option>
                        </select>
                        <p className={`text-xs text-right tabular-nums ${svc.isFree ? 'text-emerald-600' : svc.removed ? 'text-gray-300 line-through' : 'text-gray-700'}`}>
                          {svc.isFree ? 'Inclus' : `${(svc.quantity * svc.unitPrice).toFixed(0)} €`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setAdminModal(false)} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button
                onClick={applyAdminChanges}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] transition-colors"
              >
                <Check className="h-4 w-4" />
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Changes history modal ──────────────────────────────────────────── */}
      {showChanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowChanges(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-amber-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Modifications apportées</h2>
              </div>
              <button onClick={() => setShowChanges(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {adminChanges.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucune modification</p>
              ) : (
                adminChanges.map((c, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-900 mb-1">{c.field}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-500 line-through bg-red-50 px-2 py-0.5 rounded truncate max-w-[45%]">{c.from || '(vide)'}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded truncate max-w-[45%]">{c.to || '(vide)'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-between">
              <button
                onClick={() => { setAdminChanges([]); setShowChanges(false); }}
                className="text-xs text-red-500 hover:underline"
              >
                Effacer l&#39;historique
              </button>
              <button onClick={() => setShowChanges(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo block picker modal */}
      {showPhotoBlockPicker && (
        <PhotoBlockPicker
          onInsert={html => {
            editorRef.current?.focus();
            if (savedRange.current) {
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(savedRange.current);
              savedRange.current = null;
            }
            document.execCommand('insertHTML', false, html);
            setShowPhotoBlockPicker(false);
          }}
          onClose={() => setShowPhotoBlockPicker(false)}
        />
      )}

    </div>
  );
}
