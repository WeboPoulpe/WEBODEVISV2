'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Heart, PartyPopper, UtensilsCrossed, Wine, Music, Briefcase,
  CalendarDays, Users, Eye, Pencil, Search, Filter, Printer, Trash2, LayoutTemplate,
  LayoutGrid, List, Columns3, StickyNote, Save, Loader2, TrendingUp, CalendarRange, Copy,
  BookCopy, Library, X, UploadCloud, FileText, Download, Wallet, ChevronDown, FolderInput, Folder, MoreHorizontal, Send,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import DateBlock from '@/components/ui/DateBlock';
import StatusPill from '@/components/ui/StatusPill';
import { btnGhost, btnPrimary, btnSecondary, iconBtn, iconBtnDanger, pill } from '@/components/ui/kit';
import Sheet, { SheetTabs } from '@/components/ui/Sheet';
import { useAuth } from '@/context/AuthContext';
import ImportDevisModal from '@/components/devis/ImportDevisModal';
import FinanceSheet from '@/components/devis/FinanceSheet';
import { lineTotalHT, resolveGuestSplit } from '@/lib/quoteTotals';
import { sanitizeHtml } from '@/lib/sanitize';
import { PENDING_STATUSES, CONFIRMED_STATUSES, REJECTED_STATUSES } from '@/lib/quoteStatus';
import { QuoteFolder, descendantIds, folderCounts, folderPathLabel } from '@/lib/quoteFolders';
import FolderBar, { DragItem } from '@/components/devis/FolderBar';
import TemplateThumb from '@/components/devis/TemplateThumb';
import SendQuoteModal from '@/components/devis/SendQuoteModal';
import { inputCls, labelCls, errorCls } from '@/components/ui/kit';
import MoveToFolderModal from '@/components/devis/MoveToFolderModal';
import DuplicateQuoteModal from '@/components/devis/DuplicateQuoteModal';

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuoteService {
  name: string;
  quantity: number;
  unitPrice: number;
  childUnitPrice?: number | null;
  isFree?: boolean;
  isOption?: boolean;
  isPageBreak?: boolean;
}

interface Quote {
  id: string;
  client_name: string;
  /** Nom interne du devis (visible uniquement par le traiteur). Fallback = client_name. */
  internal_name?: string | null;
  event_type: string;
  event_date: string | null;
  guest_count: number | null;
  guest_count_adults?: number | null;
  guest_count_children?: number | null;
  status: string;
  total_amount: number | null;
  vat_rate?: number | null;
  created_at: string;
  user_id: string | null;       // null on true V1 devis (old system)
  owner_user_id: string | null;
  services: QuoteService[] | null;
  imported?: boolean | null;
  imported_file_url?: string | null;
  imported_file_name?: string | null;
  prospect_id?: string | null;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_email?: string | null;
  /** Dossier de rangement (null = racine) */
  folder_id?: string | null;
}
type ViewMode = 'list' | 'pipeline';
type Scope = 'encours' | 'confirmes' | 'refuses' | 'prospects';

/** Colonnes chargées pour la liste des devis (une seule source de vérité). */
// ⚠️ Doit rester UN littéral d'une seule pièce : supabase-js infère le type des lignes
// depuis la chaîne elle-même (une concaténation casse l'inférence).
const QUOTE_COLUMNS = 'id, client_name, internal_name, event_type, event_date, guest_count, guest_count_adults, guest_count_children, status, total_amount, vat_rate, created_at, user_id, owner_user_id, services, imported, imported_file_url, imported_file_name, prospect_id, client_first_name, client_last_name, client_email, folder_id';
/** Mêmes colonnes sans folder_id — utilisé tant que la migration lot E n'est pas appliquée. */
const QUOTE_COLUMNS_LEGACY = 'id, client_name, internal_name, event_type, event_date, guest_count, guest_count_adults, guest_count_children, status, total_amount, vat_rate, created_at, user_id, owner_user_id, services, imported, imported_file_url, imported_file_name, prospect_id, client_first_name, client_last_name, client_email';

/**
 * Charge les devis de l'utilisateur. Si la colonne `folder_id` n'existe pas encore
 * (migration lot E non appliquée), on retombe sur l'ancienne sélection au lieu de
 * casser toute la page.
 */
async function loadQuotes(supabase: ReturnType<typeof createClient>, userId: string): Promise<Quote[]> {
  const filter = `user_id.eq.${userId},owner_user_id.eq.${userId}`;
  const res = await supabase.from('quotes').select(QUOTE_COLUMNS).or(filter).order('created_at', { ascending: false });
  if (!res.error) return (res.data ?? []) as unknown as Quote[];
  console.warn('[devis] Dossiers indisponibles (migration lot E à appliquer ?) :', res.error.message);
  const legacy = await supabase.from('quotes').select(QUOTE_COLUMNS_LEGACY).or(filter).order('created_at', { ascending: false });
  return (legacy.data ?? []) as unknown as Quote[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
/** Nom affiché du devis côté traiteur : nom interne s'il existe, sinon nom du client. */
function quoteDisplayName(q: { internal_name?: string | null; client_name?: string | null }): string {
  return (q.internal_name && q.internal_name.trim()) || q.client_name || '—';
}

function computeQuoteTotal(quote: {
  total_amount: number | null;
  vat_rate?: number | null;
  guest_count?: number | null;
  guest_count_adults?: number | null;
  guest_count_children?: number | null;
  services: QuoteService[] | null;
}): number | null {
  // Calcule depuis les services (exclut gratuits, options et retirés) — montant HORS options,
  // en tenant compte du prix enfant « au couvert ».
  if (Array.isArray(quote.services) && quote.services.length > 0) {
    const { adults, children } = resolveGuestSplit(quote.guest_count, quote.guest_count_adults, quote.guest_count_children);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const services = quote.services as any[];
    const ht = services.reduce((sum, s) => {
      if (s.removed || s.isFree || s.isOption || s.isPageBreak) return sum;
      return sum + lineTotalHT(s, adults, children);
    }, 0);
    if (ht > 0) return ht * (1 + (quote.vat_rate ?? 20) / 100); // TTC au vrai taux de TVA du devis
  }
  // Fallback to total_amount in DB
  return quote.total_amount;
}

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_ICONS: Record<string, React.ElementType> = {
  mariage: Heart, anniversaire: PartyPopper, dîner: UtensilsCrossed, diner: UtensilsCrossed,
  cocktail: Wine, soirée: Music, soiree: Music, conférence: Briefcase,
  conference: Briefcase, séminaire: Briefcase, seminaire: Briefcase,
};
const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; column: string; colBorder: string }> = {
  nouveau:         { label: 'Nouveau',          dot: 'bg-sky-400',     badge: 'bg-sky-50 text-sky-700',         column: 'bg-sky-50/40',     colBorder: 'border-sky-200'     },
  broch_envoyee:   { label: 'Brochure envoyée', dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600',    column: 'bg-slate-50/40',   colBorder: 'border-slate-200'   },
  devis_a_faire:   { label: 'Devis à faire',    dot: 'bg-yellow-400',  badge: 'bg-yellow-50 text-yellow-700',   column: 'bg-yellow-50/40',  colBorder: 'border-yellow-200'  },
  devis_envoye:    { label: 'Devis envoyé',     dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700',     column: 'bg-amber-50/40',   colBorder: 'border-amber-200'   },
  rdv_deg_a_venir: { label: 'RDV/Dég à venir',  dot: 'bg-violet-400',  badge: 'bg-violet-50 text-violet-700',   column: 'bg-violet-50/40',  colBorder: 'border-violet-200'  },
  rdv_deg_fait:    { label: 'RDV/Dég fait',     dot: 'bg-primary-400',  badge: 'bg-primary-50 text-primary-700',   column: 'bg-primary-50/40',  colBorder: 'border-primary-200'  },
  devis_final:     { label: 'Devis final',      dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-700',   column: 'bg-orange-50/40',  colBorder: 'border-orange-200'  },
  valide:          { label: 'Validé',           dot: 'bg-teal-400',    badge: 'bg-teal-50 text-teal-700',       column: 'bg-teal-50/40',    colBorder: 'border-teal-200'    },
  acompte:         { label: 'Acompte reçu',     dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700', column: 'bg-emerald-50/40', colBorder: 'border-emerald-200' },
  paye:            { label: 'Payé',             dot: 'bg-green-500',   badge: 'bg-green-50 text-green-700',     column: 'bg-green-50/40',   colBorder: 'border-green-200'   },
  refus_client:    { label: 'Refus client',     dot: 'bg-red-300',     badge: 'bg-red-50 text-red-600',         column: 'bg-red-50/40',     colBorder: 'border-red-200'     },
  refus_traiteur:  { label: 'Refus traiteur',   dot: 'bg-rose-400',    badge: 'bg-rose-50 text-rose-700',       column: 'bg-rose-50/40',    colBorder: 'border-rose-200'    },
};
const PIPELINE_ORDER = ['nouveau', 'broch_envoyee', 'devis_a_faire', 'devis_envoye', 'rdv_deg_a_venir', 'rdv_deg_fait', 'devis_final', 'valide', 'acompte', 'paye', 'refus_client', 'refus_traiteur'];
function getEventIcon(eventType: string): React.ElementType {
  return EVENT_ICONS[eventType.toLowerCase().trim()] ?? CalendarDays;
}

// ── V1 badge ──────────────────────────────────────────────────────────────────
function V1Badge() {
  return (
    <span
      title="Devis créé dans l'ancienne version (V1). Pour une utilisation optimale, effectuez vos modifications dans l'ancien système."
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-help flex-shrink-0"
    >
      V1
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.devis_a_faire;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
    </span>
  );
}

// ── Prospect lite (non convertis affichés dans la colonne Nouveau) ────────────
interface ProspectLite {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  status: string;
}

// ── Prospect mini-card (vue Pipeline) ────────────────────────────────────────
function ProspectMiniCard({ p, onStatus, onConvert }: { p: ProspectLite; onStatus: (id: string, s: string) => void; onConvert: (id: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn(pill, 'bg-primary-100 text-primary')}>Prospect</span>
        <p className="text-sm font-semibold text-gray-900 truncate">{p.first_name} {p.last_name}</p>
      </div>
      <p className="text-xs text-gray-600 truncate">{[p.event_type, p.event_date ? formatDate(p.event_date) : null].filter(Boolean).join(', ') || 'Demande sans détail'}</p>
      <div className="flex items-center gap-1 mt-2">
        <select value={p.status} onChange={(e) => onStatus(p.id, e.target.value)} aria-label="Statut du prospect" className="text-xs border border-gray-200 rounded-lg px-1.5 h-8 flex-1 min-w-0">
          {PIPELINE_ORDER.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <button onClick={() => onConvert(p.id)} className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-2 h-8 hover:bg-primary-50">Créer le devis</button>
      </div>
    </div>
  );
}

// ── Prospect search result type ───────────────────────────────────────────────
interface ProspectResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  event_type: string | null;
  status: string;
}

// ── Commercial Sheet ──────────────────────────────────────────────────────────
function DevisSheet({
  quote, onClose, onStatusChange, onDelete, onDuplicate, onProspectLinked, onRenamed, folderLabel, onMoveFolder,
}: {
  quote: Quote; onClose: () => void; onStatusChange: (id: string, status: string) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void; onProspectLinked: (quoteId: string, prospectId: string) => void; onRenamed: (id: string, name: string | null) => void; folderLabel: string; onMoveFolder: () => void;
}) {
  const [tab, setTab] = useState<'apercu' | 'suivi'>('apercu');
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  // Les notes de suivi vivent dans la colonne internal_notes du devis.
  useEffect(() => {
    createClient().from('quotes').select('internal_notes').eq('id', quote.id).maybeSingle()
      .then(({ data }) => setNotes(data?.internal_notes ?? ''));
  }, [quote.id]);
  const [savingNotes, setSavingNotes] = useState(false);
  const [internalName, setInternalName] = useState(quote.internal_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const saveInternalName = async () => {
    const value = internalName.trim() || null;
    if (value === (quote.internal_name ?? null)) return; // rien changé
    setSavingName(true);
    const { error } = await createClient().from('quotes').update({ internal_name: value }).eq('id', quote.id);
    setSavingName(false);
    if (error) { alert('Erreur : ' + error.message); return; }
    onRenamed(quote.id, value);
  };
  const [status, setStatus] = useState(quote.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<ProspectResult[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [prospectId, setProspectId] = useState(quote.prospect_id ?? null);

  const Icon = getEventIcon(quote.event_type || '');

  const handleStatusChange = async (s: string) => {
    setSavingStatus(true);
    const supabase = createClient();
    await supabase.from('quotes').update({ status: s }).eq('id', quote.id);
    if (prospectId) {
      await supabase.from('prospect_requests').update({ status: s }).eq('id', prospectId);
    }
    setSavingStatus(false);
    setStatus(s);
    onStatusChange(quote.id, s);
  };

  const searchProspects = async (q: string) => {
    setLinkSearch(q);
    if (!q.trim()) { setLinkResults([]); return; }
    setLinkLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('prospect_requests')
      .select('id, first_name, last_name, email, event_type, status')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(6);
    setLinkResults(data ?? []);
    setLinkLoading(false);
  };

  const linkProspect = async (pid: string) => {
    const supabase = createClient();
    await supabase.from('quotes').update({ prospect_id: pid }).eq('id', quote.id);
    await supabase.from('prospect_requests').update({ status }).eq('id', pid);
    setProspectId(pid);
    setLinkOpen(false);
    setLinkSearch('');
    setLinkResults([]);
    onProspectLinked(quote.id, pid);
  };

  return (
    <Sheet open onClose={onClose} title={quoteDisplayName(quote)} subtitle={quote.event_type} width="w-[480px]">
      <SheetTabs tabs={[{ key: 'apercu', label: 'Aperçu' }, { key: 'suivi', label: 'Suivi commercial' }]}
        active={tab} onChange={(k) => setTab(k as typeof tab)} />

      {tab === 'apercu' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-primary-50/30 rounded-xl border border-primary/10">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{quote.event_type || '—'}</p>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                {quote.event_date && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(quote.event_date)}</span>}
                {quote.guest_count && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{quote.guest_count} couverts</span>}
              </div>
            </div>
          </div>
          {/* Nom interne du devis (visible uniquement par le traiteur) */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nom du devis (interne)</p>
            <div className="relative">
              <input
                value={internalName}
                onChange={(e) => setInternalName(e.target.value)}
                onBlur={saveInternalName}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder={quote.client_name || 'Nom du client'}
                className="w-full px-3 py-2 pr-16 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              {savingName && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Non visible sur le devis client. Vide = nom du client par défaut.</p>
          </div>
          {/* Dossier de rangement */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dossier</p>
            <button
              onClick={onMoveFolder}
              className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <FolderInput className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <span className="flex-1 text-left truncate">{folderLabel || 'Aucun dossier (racine)'}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">Déplacer…</span>
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Statut{prospectId && <span className="ml-2 text-[10px] font-normal text-primary normal-case">sync prospection activée</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {PIPELINE_ORDER.map((s) => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <button key={s} onClick={() => handleStatusChange(s)} disabled={savingStatus}
                    className={['px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border', status === s ? `${cfg.badge} border-current` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'].join(' ')}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Lien / rattachement prospect */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prospection liée</p>
            {prospectId ? (
              <div className="flex items-center gap-2 p-3 bg-primary-50/40 rounded-xl border border-primary/10">
                <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">Prospection rattachée</p>
                  <p className="text-[10px] text-gray-400">Statuts synchronisés automatiquement</p>
                </div>
                <Link href="/prospects" className="text-xs font-medium text-primary hover:underline flex-shrink-0">
                  Voir →
                </Link>
              </div>
            ) : (
              <div>
                {!linkOpen ? (
                  <button
                    onClick={() => setLinkOpen(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Users className="h-4 w-4" />
                    Rattacher une prospection…
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        autoFocus
                        value={linkSearch}
                        onChange={(e) => searchProspects(e.target.value)}
                        placeholder="Nom, email du prospect…"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                    {linkLoading && <p className="text-xs text-center text-gray-400 py-2">Recherche…</p>}
                    {!linkLoading && linkResults.length > 0 && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                        {linkResults.map((p) => (
                          <button key={p.id} onClick={() => linkProspect(p.id)}
                            className="flex items-start gap-3 w-full px-3 py-2.5 hover:bg-primary-50/40 text-left transition-colors">
                            <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Users className="h-3 w-3 text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                              <p className="text-xs text-gray-400 truncate">{p.email}{p.event_type ? ` · ${p.event_type}` : ''}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {!linkLoading && linkSearch && linkResults.length === 0 && (
                      <p className="text-xs text-center text-gray-400 py-2">Aucun résultat</p>
                    )}
                    <button onClick={() => { setLinkOpen(false); setLinkSearch(''); setLinkResults([]); }}
                      className="text-xs text-gray-400 hover:text-gray-600 w-full text-center py-1">
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Prestations */}
          {Array.isArray(quote.services) && quote.services.filter((s: QuoteService) => !s.isPageBreak && s.name).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prestations</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {(quote.services as QuoteService[]).filter((s) => !s.isPageBreak && s.name).map((s, i) => (
                  <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 ${s.isOption ? 'bg-amber-50/60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm ${s.isOption ? 'text-amber-800' : 'text-gray-900'}`}>{s.name}</span>
                      {s.isOption && <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">OPTION</span>}
                      {s.isFree && <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">INCLUS</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">x{s.quantity}</span>
                      <span className={`text-sm font-medium tabular-nums ${s.isFree ? 'text-gray-400 line-through' : s.isOption ? 'text-amber-600' : 'text-gray-900'}`}>
                        {s.isFree ? 'Inclus' : formatCurrency(s.quantity * s.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => { const t = computeQuoteTotal(quote); return t ? (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">Total TTC</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(t)}</span>
            </div>
          ) : null; })()}
          {/* Gérer l'événement */}
          <Link
            href={`/evenements/${quote.id}`}
            className={[
              'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors',
              ['valide', 'acompte', 'paye'].includes(status)
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-gray-200 text-gray-500 hover:bg-gray-50',
            ].join(' ')}
          >
            <CalendarRange className="h-4 w-4" />
            {['valide', 'acompte', 'paye'].includes(status) ? "Gérer l'événement" : "Préparer l'événement"}
          </Link>
          <div className="flex gap-2 pt-2">
            <Link href={`/devis/${quote.id}/imprimer`} target="_blank"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Printer className="h-4 w-4" />PDF
            </Link>
            <button onClick={() => { onDuplicate(quote.id); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-primary/30 rounded-xl text-sm font-medium text-primary hover:bg-primary-50 transition-colors">
              <Copy className="h-4 w-4" />Dupliquer
            </button>
            <Link href={`/devis/${quote.id}/modifier`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors">
              <Pencil className="h-4 w-4" />Éditer
            </Link>
          </div>
          {(['nouveau', 'devis_a_faire', 'broch_envoyee'].includes(status) || quote.imported) && (
            <button
              onClick={() => { onDelete(quote.id); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors mt-1"
            >
              <Trash2 className="h-4 w-4" />{quote.imported ? 'Supprimer cet import' : 'Supprimer ce brouillon'}
            </button>
          )}
        </div>
      )}

      {tab === 'suivi' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <StickyNote className="h-4 w-4 text-primary" />
            <span>Notes de suivi — relances, appels, échanges</span>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={10}
            placeholder={'Relance du 15/03 — message laissé en VM.\nÀ rappeler mardi matin.\nClient hésitant sur le nombre de couverts…'}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors leading-relaxed"
          />
          <button onClick={async () => { setSavingNotes(true); const { error } = await createClient().from('quotes').update({ internal_notes: notes }).eq('id', quote.id); setSavingNotes(false); setNotesError(error ? 'Les notes n’ont pas pu être enregistrées. Réessayez.' : null); }} disabled={savingNotes}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingNotes ? 'Sauvegarde…' : 'Sauvegarder les notes'}
          </button>
          {notesError && <p role="alert" className="text-sm text-danger">{notesError}</p>}
        </div>
      )}
    </Sheet>
  );
}

// ── Ligne de devis ────────────────────────────────────────────────────────────
function QuoteRow({ quote, onOpen, onMenu, onDragStart, onDragEnd, dragging, folderLabel }: {
  quote: Quote; onOpen: () => void; onMenu: () => void; onDragStart: (item: DragItem) => void; onDragEnd: () => void; dragging: boolean; folderLabel: string;
}) {
  const total = computeQuoteTotal(quote);
  return (
    <li
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', quote.id); onDragStart({ type: 'quote', id: quote.id }); }}
      onDragEnd={onDragEnd}
      className={cn('flex items-center gap-1 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 transition-colors', dragging && 'opacity-40')}
    >
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left rounded-2xl">
        {quote.event_date
          ? <DateBlock iso={quote.event_date} />
          : <div className="w-14 h-14 rounded-xl border border-dashed border-gray-300 flex-shrink-0" aria-hidden />}
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{quoteDisplayName(quote)}</span>
            {quote.imported && <span className={cn(pill, 'bg-gray-100 text-gray-600 flex-shrink-0')}>Importé</span>}
            {!quote.user_id && <V1Badge />}
          </span>
          <span className="block text-sm text-gray-600 truncate mt-0.5">
            <span className="capitalize">{quote.event_type || 'Événement'}</span>
            {quote.guest_count ? `, ${quote.guest_count} couverts` : ''}
            {folderLabel ? `, dossier ${folderLabel}` : ''}
          </span>
          <span className="flex items-center gap-2 mt-2 lg:hidden">
            <StatusPill status={quote.status} />
            {total ? <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(total)}</span> : null}
          </span>
        </span>
        <span className="hidden lg:block w-40 flex-shrink-0"><StatusPill status={quote.status} /></span>
        <span className="hidden lg:block w-36 flex-shrink-0 text-right font-display font-bold text-gray-900 tabular-nums">
          {total ? formatCurrency(total) : <span className="font-sans font-normal text-gray-400">Non chiffré</span>}
        </span>
      </button>
      <button onClick={onMenu} className={cn(iconBtn, 'mr-2')} aria-label={`Actions pour ${quoteDisplayName(quote)}`}>
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </li>
  );
}

// ── Ligne de prospect (demande pas encore transformée en devis) ───────────────
function ProspectRow({ p, onStatus, onConvert }: { p: ProspectLite; onStatus: (id: string, s: string) => void; onConvert: (id: string) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-3 sm:p-4 bg-white border border-gray-200 rounded-2xl">
      {p.event_date
        ? <DateBlock iso={p.event_date} />
        : <div className="w-14 h-14 rounded-xl border border-dashed border-gray-300 flex-shrink-0" aria-hidden />}
      <div className="flex-1 min-w-[160px]">
        <p className="font-semibold text-gray-900 truncate">{p.first_name} {p.last_name}</p>
        <p className="text-sm text-gray-600 truncate first-letter:uppercase">
          {[p.event_type, p.guest_count ? `${p.guest_count} couverts` : null].filter(Boolean).join(', ') || p.email}
        </p>
      </div>
      <select value={p.status} onChange={(e) => onStatus(p.id, e.target.value)} aria-label="Statut du prospect"
        className="h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900">
        {PIPELINE_ORDER.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
      </select>
      <button onClick={() => onConvert(p.id)} className={btnSecondary}>Créer le devis</button>
    </li>
  );
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
function PipelineView({
  quotes, prospects, onStatusChange, onOpenSheet, onDuplicate, onProspectStatus, onConvertProspect, onMove,
}: {
  quotes: Quote[]; prospects: ProspectLite[]; onStatusChange: (id: string, s: string) => void; onOpenSheet: (q: Quote) => void; onDuplicate: (id: string) => void; onProspectStatus: (id: string, s: string) => void; onConvertProspect: (id: string) => void; onMove: (q: Quote) => void;
}) {
  // useRef for draggingId so async handleDrop always reads the current value
  // (avoids stale closure bug when the React re-render hasn't happened yet on fast drags)
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null); // UI only (opacity)
  const [draggingOver, setDraggingOver] = useState<string | null>(null);

  const handleDrop = async (targetStatus: string) => {
    const id = draggingIdRef.current;
    if (!id) return;
    const supabase = createClient();
    const { error } = await supabase.from('quotes').update({ status: targetStatus }).eq('id', id);
    if (!error) {
      const quote = quotes.find((q) => q.id === id);
      if (quote?.prospect_id) {
        await supabase.from('prospect_requests').update({ status: targetStatus }).eq('id', quote.prospect_id);
      }
      onStatusChange(id, targetStatus);
    }
    draggingIdRef.current = null;
    setDraggingId(null);
    setDraggingOver(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 md:-mx-6 px-4 md:px-6" style={{ minHeight: 400 }}>
      {PIPELINE_ORDER.map((statusKey) => {
        const cfg = STATUS_CONFIG[statusKey];
        const col = quotes.filter((q) => q.status === statusKey);
        const colTotal = col.reduce((s, q) => s + (computeQuoteTotal(q) ?? 0), 0);
        const isOver = draggingOver === statusKey;

        return (
          <div key={statusKey}
            className={['flex-shrink-0 w-64 rounded-2xl border-2 transition-all duration-150', cfg.column, isOver ? 'border-primary/50 scale-[1.01]' : cfg.colBorder].join(' ')}
            onDragOver={(e) => { e.preventDefault(); setDraggingOver(statusKey); }}
            onDragLeave={(e) => {
              // Only clear when actually leaving the column (not when entering a child)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingOver(null);
            }}
            onDrop={(e) => { e.preventDefault(); handleDrop(statusKey); }}
          >
            <div className="px-3 pt-3 pb-2 border-b border-black/5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-bold text-gray-700">{cfg.label}</span>
                <span className="text-xs font-medium text-gray-400 bg-white/70 px-1.5 py-0.5 rounded-full">{col.length}</span>
              </div>
              {colTotal > 0 && (
                <p className="text-[10px] font-semibold text-gray-500 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-2.5 w-2.5" />{formatCurrency(colTotal)}
                </p>
              )}
            </div>
            <div className="p-2 space-y-2 min-h-[100px]">
              {prospects.filter((p) => p.status === statusKey).map((p) => (
                <ProspectMiniCard key={p.id} p={p} onStatus={onProspectStatus} onConvert={onConvertProspect} />
              ))}
              {col.map((q) => {
                const Icon = getEventIcon(q.event_type || '');
                return (
                  <div key={q.id} draggable
                    onDragStart={() => { draggingIdRef.current = q.id; setDraggingId(q.id); }}
                    onDragEnd={() => { draggingIdRef.current = null; setDraggingId(null); setDraggingOver(null); }}
                    className={['bg-white border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all select-none', draggingId === q.id ? 'opacity-40' : ''].join(' ')}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{quoteDisplayName(q)}</p>
                        <p className="text-[10px] text-gray-500 capitalize truncate">{q.event_type || '—'}</p>
                      </div>
                    </div>
                    {q.event_date && <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-1.5"><CalendarDays className="h-2.5 w-2.5" />{formatDate(q.event_date)}</p>}
                    <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-100">
                      {(() => { const t = computeQuoteTotal(q); return t ? <p className="text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(t)}</p> : <span />; })()}
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onOpenSheet(q)} title="Aperçu" className="p-1 text-gray-300 hover:text-primary hover:bg-primary-50 rounded transition-colors"><Eye className="h-3 w-3" /></button>
                        <Link href={`/devis/${q.id}/imprimer`} target="_blank" title="PDF" className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"><Printer className="h-3 w-3" /></Link>
                        <button onClick={() => onDuplicate(q.id)} title="Dupliquer" className="p-1 text-gray-300 hover:text-primary hover:bg-primary-50 rounded transition-colors"><Copy className="h-3 w-3" /></button>
                        <button onClick={() => onMove(q)} title="Déplacer vers un dossier" className="p-1 text-gray-300 hover:text-primary hover:bg-primary-50 rounded transition-colors"><FolderInput className="h-3 w-3" /></button>
                        <Link href={`/devis/${q.id}/modifier?mode=weboword`} title="Éditer" className="p-1 text-gray-300 hover:text-primary hover:bg-primary-50 rounded transition-colors"><Pencil className="h-3 w-3" /></Link>
                      </div>
                    </div>
                  </div>
                );
              })}
              {col.length === 0 && !isOver && (
                <div className="border-2 border-dashed border-gray-200/70 rounded-xl h-14 flex items-center justify-center">
                  <span className="text-[10px] text-gray-300">Déposer ici</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DevisPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [prospects, setProspects] = useState<ProspectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scope, setScope] = useState<Scope>('encours');
  const [menuQuote, setMenuQuote] = useState<Quote | null>(null);
  // Envoi du devis au client par email
  const [sendQuote, setSendQuote] = useState<Quote | null>(null);
  const [sort, setSort] = useState<'recent' | 'event' | 'amount' | 'client'>('recent');
  const [view, setView] = useState<ViewMode>('list');
  const [sheetQuote, setSheetQuote] = useState<Quote | null>(null);
  const [dupModal, setDupModal] = useState<{ open: boolean; quoteId: string | null; saving: boolean; templateName: string }>({ open: false, quoteId: null, saving: false, templateName: '' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [templates, setTemplates] = useState<{ id: string; name: string; template: string; created_at: string; services: any[]; remarks: string | null; vat_rate: number; hide_price: boolean }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creatingFromTpl, setCreatingFromTpl] = useState<string | null>(null);
  const [previewTpl, setPreviewTpl] = useState<{ id: string; name: string; template: string; content_html: string | null } | null>(null);
  // Documents des modèles, pour leurs vignettes : chargés à l'ouverture de la fenêtre, pas avec la page.
  const [tplDocs, setTplDocs] = useState<Record<string, string | null> | null>(null);
  const [renamingTpl, setRenamingTpl] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [importModal, setImportModal] = useState(false);
  const [editImportId, setEditImportId] = useState<string | null>(null);
  const [financeQuoteId, setFinanceQuoteId] = useState<string | null>(null);

  // ── Dossiers ───────────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<QuoteFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [moveQuote, setMoveQuote] = useState<Quote | null>(null);
  // useRef pour que les handlers de drop lisent toujours la valeur courante
  const dragItemRef = useRef<DragItem>(null);
  const [dragItem, setDragItem] = useState<DragItem>(null);

  const startDrag = useCallback((item: DragItem) => { dragItemRef.current = item; setDragItem(item); }, []);
  const endDrag = useCallback(() => { dragItemRef.current = null; setDragItem(null); }, []);

  // Dossier courant dans l'URL (?dossier=…) — survit au rafraîchissement et au retour arrière
  useEffect(() => {
    const read = () => setCurrentFolder(new URLSearchParams(window.location.search).get('dossier'));
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  const navigateFolder = useCallback((id: string | null) => {
    setCurrentFolder(id);
    window.history.pushState({}, '', id ? `/devis?dossier=${id}` : '/devis');
  }, []);

  // Lien périmé (?dossier=… supprimé entre-temps) → retour à la racine
  useEffect(() => {
    if (loading || !currentFolder) return;
    if (folders.some((f) => f.id === currentFolder)) return;
    setCurrentFolder(null);
    window.history.replaceState({}, '', '/devis');
  }, [loading, folders, currentFolder]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      loadQuotes(supabase, user.id),
      supabase.from('devis_templates')
        .select('id, name, template, created_at, services, remarks, vat_rate, hide_price')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('quote_folders')
        .select('id, name, parent_id, color, icon, created_at')
        .eq('owner_user_id', user.id)
        .order('name', { ascending: true }),
    ]).then(async ([quoteRows, tplRes, foldersRes]) => {
      try {
        setQuotes(quoteRows);
        setTemplates(tplRes.data ?? []);
        // Table absente (migration lot E non appliquée) → liste vide, la page reste utilisable
        setFolders((foldersRes.data ?? []) as unknown as QuoteFolder[]);

        // Prospects non liés à un devis
        const linkedProspectIds = new Set(
          quoteRows.map((q) => q.prospect_id).filter(Boolean)
        );
        const { data: tokenRows } = await supabase
          .from('user_prospect_tokens').select('token').eq('user_id', user.id);
        const myTokens = (tokenRows ?? []).map((r: { token: string }) => r.token);
        let pq = supabase
          .from('prospect_requests')
          .select('id, first_name, last_name, email, event_type, event_date, guest_count, status')
          .order('created_at', { ascending: false });
        pq = myTokens.length > 0
          ? pq.or(`owner_user_id.eq.${user.id},user_token.in.(${myTokens.join(',')})`)
          : pq.eq('owner_user_id', user.id);
        const { data: prospectRows } = await pq;
        setProspects(((prospectRows ?? []) as ProspectLite[]).filter((p) => !linkedProspectIds.has(p.id)));
      } finally {
        setLoading(false);
      }
    });
  }, [user]);

  // Create a devis from a template
  // Un modèle passe par le parcours de création : événement et client d'abord, puis le document part du modèle,
  // rempli et adapté au nombre de couverts.
  const createFromTemplate = useCallback((tplId: string) => {
    router.push(`/devis/nouveau?modele=${tplId}${currentFolder ? `&dossier=${currentFolder}` : ''}`);
  }, [router, currentFolder]);

  const deleteTemplate = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce modèle ?')) return;
    await createClient().from('devis_templates').delete().eq('id', id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setPreviewTpl(null);
  }, []);

  // Vignettes des modèles : leurs documents sont chargés en une fois, à la première ouverture de la fenêtre.
  useEffect(() => {
    if (!showTemplates || tplDocs !== null || !user) return;
    createClient().from('devis_templates').select('id, content_html').eq('user_id', user.id)
      .then(({ data }) => setTplDocs(Object.fromEntries(((data ?? []) as { id: string; content_html: string | null }[]).map((t) => [t.id, t.content_html]))));
  }, [showTemplates, tplDocs, user]);

  const openPreview = useCallback(async (tplId: string) => {
    const { data } = await createClient().from('devis_templates').select('id, name, template, content_html').eq('id', tplId).single();
    if (data) setPreviewTpl(data);
  }, []);

  const renameTemplate = useCallback(async (id: string, newName: string) => {
    if (!newName.trim()) { setRenamingTpl(null); return; }
    await createClient().from('devis_templates').update({ name: newName.trim() }).eq('id', id);
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, name: newName.trim() } : t));
    setRenamingTpl(null);
  }, []);

  const handleStatusChange = useCallback((id: string, status: string) => {
    setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, status } : q));
    setSheetQuote((prev) => prev?.id === id ? { ...prev, status } : prev);
  }, []);

  const handleProspectLinked = useCallback((id: string, pid: string) => {
    setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, prospect_id: pid } : q));
    setSheetQuote((prev) => prev?.id === id ? { ...prev, prospect_id: pid } : prev);
  }, []);

  const handleProspectStatus = useCallback(async (id: string, status: string) => {
    setProspects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    await createClient().from('prospect_requests').update({ status }).eq('id', id);
  }, []);

  const handleConvertProspect = useCallback((id: string) => {
    router.push(`/prospects?convert=${id}`);
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce devis ? Cette action est irréversible.')) return;
    await createClient().from('quotes').delete().eq('id', id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    setSheetQuote((prev) => prev?.id === id ? null : prev);
  }, []);

  // Open duplication modal
  const handleDuplicate = useCallback((id: string) => {
    setDupModal({ open: true, quoteId: id, saving: false, templateName: '' });
  }, []);

  // ── Actions sur les dossiers ───────────────────────────────────────────────
  const createFolder = useCallback(async ({ name, color, icon, parentId }: { name: string; color: string; icon: string; parentId: string | null }) => {
    if (!user) return;
    const { data, error } = await createClient()
      .from('quote_folders')
      .insert({ owner_user_id: user.id, name, color, icon, parent_id: parentId })
      .select('id, name, parent_id, color, icon, created_at')
      .single();
    if (error) { alert('Impossible de créer le dossier : ' + error.message); return; }
    if (data) setFolders((prev) => [...prev, data as QuoteFolder]);
  }, [user]);

  const updateFolder = useCallback(async (id: string, patch: { name: string; color: string; icon: string }) => {
    const { error } = await createClient().from('quote_folders').update(patch).eq('id', id);
    if (error) { alert('Impossible de modifier le dossier : ' + error.message); return; }
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  /** Supprime un dossier SANS supprimer son contenu : devis et sous-dossiers remontent au parent. */
  const deleteFolder = useCallback(async (id: string) => {
    const supabase = createClient();
    const parentId = folders.find((f) => f.id === id)?.parent_id ?? null;
    const [subRes, quoteRes] = await Promise.all([
      supabase.from('quote_folders').update({ parent_id: parentId }).eq('parent_id', id),
      supabase.from('quotes').update({ folder_id: parentId }).eq('folder_id', id),
    ]);
    if (subRes.error || quoteRes.error) {
      alert('Impossible de vider le dossier : ' + (subRes.error?.message || quoteRes.error?.message));
      return;
    }
    const { error } = await supabase.from('quote_folders').delete().eq('id', id);
    if (error) { alert('Impossible de supprimer le dossier : ' + error.message); return; }
    setFolders((prev) => prev.filter((f) => f.id !== id).map((f) => (f.parent_id === id ? { ...f, parent_id: parentId } : f)));
    setQuotes((prev) => prev.map((q) => (q.folder_id === id ? { ...q, folder_id: parentId } : q)));
    if (currentFolder === id) navigateFolder(parentId);
  }, [folders, currentFolder, navigateFolder]);

  const moveQuoteToFolder = useCallback(async (quoteId: string, folderId: string | null) => {
    const previous = quotes.find((q) => q.id === quoteId)?.folder_id ?? null;
    if (previous === folderId) return;
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, folder_id: folderId } : q)));
    setSheetQuote((prev) => (prev && prev.id === quoteId ? { ...prev, folder_id: folderId } : prev));
    const { error } = await createClient().from('quotes').update({ folder_id: folderId }).eq('id', quoteId);
    if (error) {
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, folder_id: previous } : q)));
      alert('Impossible de déplacer le devis : ' + error.message);
    }
  }, [quotes]);

  const moveFolderTo = useCallback(async (folderId: string, targetId: string | null) => {
    // Garde-fou : jamais dans soi-même ni dans sa propre descendance
    if (targetId && descendantIds(folders, folderId).has(targetId)) return;
    const previous = folders.find((f) => f.id === folderId)?.parent_id ?? null;
    if (previous === targetId) return;
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, parent_id: targetId } : f)));
    const { error } = await createClient().from('quote_folders').update({ parent_id: targetId }).eq('id', folderId);
    if (error) {
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, parent_id: previous } : f)));
      alert('Impossible de déplacer le dossier : ' + error.message);
    }
  }, [folders]);

  const handleDropInto = useCallback((target: string | null) => {
    const item = dragItemRef.current;
    endDrag();
    if (!item) return;
    if (item.type === 'quote') moveQuoteToFolder(item.id, target);
    else moveFolderTo(item.id, target);
  }, [endDrag, moveQuoteToFolder, moveFolderTo]);

  // ── Portée du dossier courant ──────────────────────────────────────────────
  const searching = search.trim().length > 0;
  const scopeIds = useMemo(() => descendantIds(folders, currentFolder), [folders, currentFolder]);
  const folderCountMap = useMemo(() => folderCounts(folders, quotes.map((q) => q.folder_id)), [folders, quotes]);
  /** La recherche est volontairement globale : elle traverse tous les dossiers. */
  const inFolderScope = useCallback(
    (q: Quote) => searching || !currentFolder || (q.folder_id ? scopeIds.has(q.folder_id) : false),
    [searching, currentFolder, scopeIds],
  );
  const folderLabelOf = useCallback(
    (q: Quote) => folderPathLabel(folders, q.folder_id ?? null),
    [folders],
  );

  // ── Filtres ────────────────────────────────────────────────────────────────
  const needle = search.trim().toLowerCase();
  /** Devis du dossier ouvert qui correspondent à la recherche (tous statuts). */
  const base = useMemo(() => quotes.filter((q) => {
    if (!inFolderScope(q)) return false;
    if (!needle) return true;
    return [q.internal_name, q.client_name, q.client_first_name, q.client_last_name, q.client_email, q.event_type]
      .filter(Boolean).join(' ').toLowerCase().includes(needle);
  }), [quotes, inFolderScope, needle]);

  // Les prospects ne se rangent pas en dossier : ils n'apparaissent qu'à la racine (ou en recherche).
  const scopedProspects = useMemo(() => (currentFolder && !searching ? [] : prospects).filter((p) =>
    !needle || [p.first_name, p.last_name, p.email, p.event_type ?? ''].join(' ').toLowerCase().includes(needle)),
  [prospects, currentFolder, searching, needle]);

  const SCOPES: { key: Scope; label: string; statuses: string[] }[] = [
    { key: 'encours', label: 'En cours', statuses: PENDING_STATUSES },
    { key: 'confirmes', label: 'Confirmés', statuses: CONFIRMED_STATUSES },
    { key: 'refuses', label: 'Refusés', statuses: REJECTED_STATUSES },
    { key: 'prospects', label: 'Prospects', statuses: [] },
  ];
  const countOf = (s: typeof SCOPES[number]) => (s.key === 'prospects' ? scopedProspects.length : base.filter((q) => s.statuses.includes(q.status)).length);
  const activeScope = SCOPES.find((s) => s.key === scope)!;

  const sortFn = (a: Quote, b: Quote) => {
    switch (sort) {
      case 'recent': return (b.created_at || '').localeCompare(a.created_at || '');
      case 'event':  return (a.event_date || '9999').localeCompare(b.event_date || '9999');
      case 'amount': return (computeQuoteTotal(b) ?? 0) - (computeQuoteTotal(a) ?? 0);
      case 'client': return quoteDisplayName(a).localeCompare(quoteDisplayName(b), 'fr');
      default: return 0;
    }
  };
  const listed = base
    .filter((q) => activeScope.statuses.includes(q.status) && (!statusFilter || q.status === statusFilter))
    .sort(sortFn);

  const controlCls = 'h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100';
  const segment = (active: boolean) => cn('h-9 px-3 sm:px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900');

  return (
    <div className="px-4 md:px-6 pb-8">
      {/* Titre et actions de la page */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight">Devis</h1>
          <p className="text-sm text-gray-600 mt-1">{loading ? 'Chargement…' : `${quotes.length} devis au total`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden md:flex p-1 rounded-xl bg-gray-200/70" role="tablist" aria-label="Affichage">
            <button role="tab" aria-selected={view === 'list'} onClick={() => setView('list')} className={segment(view === 'list')}>Liste</button>
            <button role="tab" aria-selected={view === 'pipeline'} onClick={() => setView('pipeline')} className={segment(view === 'pipeline')}>Pipeline</button>
          </div>
          {templates.length > 0 && (
            <button onClick={() => setShowTemplates(true)} className={btnSecondary}><Library className="h-4 w-4" />Partir d’un modèle</button>
          )}
          <button onClick={() => setImportModal(true)} className={btnSecondary} title="Ajouter un devis fait dans un autre logiciel">
            <UploadCloud className="h-4 w-4" />Importer
          </button>
          {/* À la racine, « Nouveau devis » est dans l'en-tête (ou le bouton + sur téléphone). */}
          {currentFolder && (
            <Link href={`/devis/nouveau?dossier=${currentFolder}`} className={btnPrimary}><Plus className="h-4 w-4" />Nouveau dans ce dossier</Link>
          )}
        </div>
      </div>

      {/* Recherche, statut, tri */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer par client ou événement" aria-label="Filtrer les devis"
            className={cn(controlCls, 'w-full pl-10')} />
        </div>
        {view === 'list' && scope !== 'prospects' && (
          <>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Statut" className={cn(controlCls, 'flex-1 sm:flex-none min-w-0')}>
              <option value="">Tous les statuts</option>
              {activeScope.statuses.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Tri" className={cn(controlCls, 'flex-1 sm:flex-none min-w-0')}>
              <option value="recent">Plus récents</option>
              <option value="event">Date d’événement</option>
              <option value="amount">Montant</option>
              <option value="client">Nom A-Z</option>
            </select>
          </>
        )}
      </div>

      {/* Dossiers */}
      {!loading && <FolderBar
        folders={folders}
        currentId={currentFolder}
        counts={folderCountMap}
        totalCount={quotes.length}
        dragItem={dragItem}
        onNavigate={navigateFolder}
        onCreate={createFolder}
        onUpdate={updateFolder}
        onDelete={deleteFolder}
        onDropInto={handleDropInto}
        onDragStart={startDrag}
        onDragEnd={endDrag}
      />}

      {searching && currentFolder && (
        <p className="mb-3 text-sm text-gray-600">La recherche porte sur tous les dossiers, pas seulement celui qui est ouvert.</p>
      )}

      {view === 'pipeline' ? (
        <PipelineView quotes={base} prospects={scopedProspects} onStatusChange={handleStatusChange} onOpenSheet={(q) => setSheetQuote(q)} onDuplicate={handleDuplicate} onProspectStatus={handleProspectStatus} onConvertProspect={handleConvertProspect} onMove={(q) => setMoveQuote(q)} />
      ) : (
        <>
          {/* Volets */}
          <div className="flex p-1 mb-3 rounded-xl bg-gray-200/70 overflow-x-auto scrollbar-none sm:w-fit" role="tablist" aria-label="Devis affichés">
            {SCOPES.map((s) => (
              <button key={s.key} role="tab" aria-selected={scope === s.key} onClick={() => { setScope(s.key); setStatusFilter(''); }} className={cn(segment(scope === s.key), 'flex-1 sm:flex-none')}>
                {s.label} <span className="text-gray-500 tabular-nums">{loading ? '' : countOf(s)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <ul className="space-y-2.5">{[0, 1, 2, 3].map((i) => <li key={i} className="h-[84px] rounded-2xl bg-white border border-gray-200 animate-pulse" />)}</ul>
          ) : scope === 'prospects' ? (
            scopedProspects.length === 0 ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-6 py-10 text-center">
                <p className="font-semibold text-gray-900">Aucune demande en attente</p>
                <p className="text-sm text-gray-600 mt-1">Les demandes reçues par votre formulaire en ligne arrivent ici, jusqu’à ce que vous en fassiez un devis.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {scopedProspects.map((p) => <ProspectRow key={p.id} p={p} onStatus={handleProspectStatus} onConvert={handleConvertProspect} />)}
              </ul>
            )
          ) : listed.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-200 px-6 py-10 text-center">
              <p className="font-semibold text-gray-900">
                {needle ? 'Aucun devis ne correspond' : currentFolder ? 'Ce dossier ne contient aucun devis de ce type' : `Aucun devis ${activeScope.label.toLowerCase()}`}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {needle ? 'Essayez un autre nom, ou regardez dans un autre volet.' : 'Glissez un devis sur un dossier pour le ranger, ou créez-en un nouveau.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {listed.map((q) => (
                <QuoteRow key={q.id} quote={q} onOpen={() => setSheetQuote(q)} onMenu={() => setMenuQuote(q)}
                  onDragStart={startDrag} onDragEnd={endDrag} dragging={dragItem?.type === 'quote' && dragItem.id === q.id}
                  folderLabel={currentFolder ? '' : folderLabelOf(q)} />
              ))}
            </ul>
          )}
        </>
      )}

      {/* ── Actions d'un devis ─────────────────────────────────────────── */}
      {menuQuote && (() => {
        const q = menuQuote;
        const close = () => setMenuQuote(null);
        const item = 'w-full flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-gray-900 hover:bg-gray-50 text-left';
        const deletable = ['nouveau', 'devis_a_faire', 'broch_envoyee'].includes(q.status) || !!q.imported;
        return (
          <Modal title={quoteDisplayName(q)} onClose={close}>
            <div className="pb-3 space-y-0.5">
              {q.imported && q.imported_file_url ? (
                <a href={q.imported_file_url} target="_blank" rel="noopener noreferrer" onClick={close} className={item}><FileText className="h-5 w-5 text-gray-500" />Ouvrir le document importé</a>
              ) : (
                <Link href={`/devis/${q.id}/modifier?mode=weboword`} className={item}><Pencil className="h-5 w-5 text-gray-500" />Modifier le devis</Link>
              )}
              {(CONFIRMED_STATUSES as string[]).includes(q.status) && (
                <Link href={`/evenements/${q.id}`} className={item}><CalendarRange className="h-5 w-5 text-gray-500" />Préparer l’événement</Link>
              )}
              {!q.imported && <button onClick={() => { close(); setSendQuote(q); }} className={item}><Send className="h-5 w-5 text-gray-500" />Envoyer au client</button>}
              <Link href={`/devis/${q.id}/imprimer`} target="_blank" onClick={close} className={item}><Printer className="h-5 w-5 text-gray-500" />Imprimer ou enregistrer en PDF</Link>
              <button onClick={() => { close(); handleDuplicate(q.id); }} className={item}><Copy className="h-5 w-5 text-gray-500" />Dupliquer</button>
              <button onClick={() => { close(); setFinanceQuoteId(q.id); }} className={item}><Wallet className="h-5 w-5 text-gray-500" />Marge et coûts</button>
              <button onClick={() => { close(); setMoveQuote(q); }} className={item}><FolderInput className="h-5 w-5 text-gray-500" />Déplacer vers un dossier</button>
              {q.imported && <button onClick={() => { close(); setEditImportId(q.id); }} className={item}><UploadCloud className="h-5 w-5 text-gray-500" />Modifier l’import</button>}
              {deletable && <button onClick={() => { close(); handleDelete(q.id); }} className={cn(item, 'text-danger')}><Trash2 className="h-5 w-5" />Supprimer</button>}
            </div>
          </Modal>
        );
      })()}

      {/* ── Envoi au client ────────────────────────────────────────────── */}
      {sendQuote && (
        <SendQuoteModal
          quote={{ id: sendQuote.id, client_email: sendQuote.client_email ?? null, event_type: sendQuote.event_type, event_date: sendQuote.event_date }}
          companyName={profile?.company_name}
          onClose={() => setSendQuote(null)}
          onSent={({ status, to }) => {
            if (status) handleStatusChange(sendQuote.id, status);
            setQuotes((prev) => prev.map((q) => (q.id === sendQuote.id ? { ...q, client_email: to } : q)));
          }}
        />
      )}

      {/* ── Modèles enregistrés ────────────────────────────────────────── */}
      {showTemplates && (
        <Modal title="Partir d’un modèle" onClose={() => setShowTemplates(false)} wide>
          <ul className="pb-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            {templates.map((tpl) => {
              const count = Array.isArray(tpl.services) ? tpl.services.filter((s: { name?: string; isPageBreak?: boolean }) => s.name && !s.isPageBreak).length : 0;
              return (
                <li key={tpl.id} className="flex flex-col p-2.5 rounded-2xl bg-gray-50">
                  <TemplateThumb
                    html={tplDocs?.[tpl.id]}
                    lines={Array.isArray(tpl.services) ? tpl.services.filter((s: { name?: string; isPageBreak?: boolean }) => s.name && !s.isPageBreak).map((s: { name: string }) => s.name) : []}
                    loading={tplDocs === null}
                    label={`Aperçu de ${tpl.name}`}
                    onClick={() => { setShowTemplates(false); openPreview(tpl.id); }}
                  />
                  <div className="mt-2.5 px-0.5">
                  {renamingTpl === tpl.id ? (
                    <input autoFocus value={renameName} onChange={(e) => setRenameName(e.target.value)} onBlur={() => renameTemplate(tpl.id, renameName)}
                      onKeyDown={(e) => { if (e.key === 'Enter') renameTemplate(tpl.id, renameName); if (e.key === 'Escape') setRenamingTpl(null); }}
                      aria-label="Nom du modèle" className={cn(controlCls, 'w-full')} />
                  ) : (
                    <p className="font-semibold text-gray-900 break-words">{tpl.name}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-0.5">{count} prestation{count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-0.5 mt-auto pt-2">
                    <button onClick={() => createFromTemplate(tpl.id)} disabled={creatingFromTpl === tpl.id} className={cn(btnPrimary, 'h-10 px-4 flex-1 min-w-0')}>
                      {creatingFromTpl === tpl.id && <Loader2 className="h-4 w-4 animate-spin" />}Utiliser
                    </button>
                    <button onClick={() => { setRenamingTpl(tpl.id); setRenameName(tpl.name); }} className={iconBtn} aria-label={`Renommer ${tpl.name}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => deleteTemplate(tpl.id)} className={iconBtnDanger} aria-label={`Supprimer ${tpl.name}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}

      {sheetQuote && (
        <DevisSheet quote={sheetQuote} onClose={() => setSheetQuote(null)} onStatusChange={handleStatusChange} onDelete={handleDelete} onDuplicate={handleDuplicate} onProspectLinked={handleProspectLinked}
          folderLabel={folderLabelOf(sheetQuote)}
          onMoveFolder={() => setMoveQuote(sheetQuote)}
          onRenamed={(id, name) => {
            setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, internal_name: name } : q));
            setSheetQuote((prev) => prev && prev.id === id ? { ...prev, internal_name: name } : prev);
          }} />
      )}

      {/* ── Déplacer un devis vers un dossier ─────────────────────────── */}
      <MoveToFolderModal
        open={moveQuote !== null}
        folders={folders}
        currentFolderId={moveQuote?.folder_id ?? null}
        quoteName={moveQuote ? quoteDisplayName(moveQuote) : ''}
        onClose={() => setMoveQuote(null)}
        onMove={(folderId) => { if (moveQuote) return moveQuoteToFolder(moveQuote.id, folderId); }}
      />

      {/* ── Duplication modal ─────────────────────────────────────────────── */}
      {/* ── Template preview sheet ─────────────────────────────────────── */}
      {/* ── Finance sheet (gestion financière du devis) ────────────────── */}
      <FinanceSheet
        open={financeQuoteId !== null}
        quoteId={financeQuoteId}
        onClose={() => setFinanceQuoteId(null)}
      />

      {/* ── Import devis modal (création + édition) ──────────────────── */}
      <ImportDevisModal
        open={importModal || editImportId !== null}
        editQuoteId={editImportId}
        folderId={currentFolder}
        onClose={() => { setImportModal(false); setEditImportId(null); }}
        onCreated={() => {
          // Reload quotes
          if (!user) return;
          loadQuotes(createClient(), user.id).then(setQuotes);
        }}
      />

      {previewTpl && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPreviewTpl(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-primary-50 rounded-xl flex-shrink-0">
                  <Library className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 text-sm truncate">{previewTpl.name}</h2>
                  <p className="text-[10px] text-gray-400 capitalize">{previewTpl.template}</p>
                </div>
              </div>
              <button onClick={() => setPreviewTpl(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
              {previewTpl.content_html ? (
                <div
                  className="bg-white shadow-sm rounded-xl p-6 min-h-full"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewTpl.content_html) }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm italic">
                  Pas d&apos;aperçu disponible
                </div>
              )}
            </div>
            <div className="flex justify-between gap-2 px-6 py-4 border-t border-gray-100">
              <Link href={`/devis/templates/${previewTpl.id}/edit`}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Pencil className="h-4 w-4" />
                Modifier
              </Link>
              <button
                onClick={() => { createFromTemplate(previewTpl.id); setPreviewTpl(null); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
              >
                <Plus className="h-4 w-4" />
                Créer un devis
              </button>
            </div>
          </div>
        </div>
      )}

      {dupModal.open && dupModal.quoteId && user && (
        <DuplicateQuoteModal quoteId={dupModal.quoteId} userId={user.id} onClose={() => setDupModal({ open: false, quoteId: null, saving: false, templateName: '' })} />
      )}
    </div>
  );
}
