'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Heart, PartyPopper, UtensilsCrossed, Wine, Music, Briefcase,
  CalendarDays, Users, Eye, Pencil, Search, Filter, Printer, Trash2, LayoutTemplate,
  LayoutGrid, List, Columns3, StickyNote, Save, Loader2, ArrowRight, TrendingUp, CalendarRange, Copy,
  BookCopy, Library, X, UploadCloud, FileText, Download, Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatCurrency } from '@/lib/utils';
import Sheet, { SheetTabs } from '@/components/ui/Sheet';
import { useAuth } from '@/context/AuthContext';
import ImportDevisModal from '@/components/devis/ImportDevisModal';
import FinanceSheet from '@/components/devis/FinanceSheet';

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuoteService {
  name: string;
  quantity: number;
  unitPrice: number;
  isFree?: boolean;
  isOption?: boolean;
  isPageBreak?: boolean;
}

interface Quote {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string | null;
  guest_count: number | null;
  status: string;
  total_amount: number | null;
  created_at: string;
  user_id: string | null;       // null on true V1 devis (old system)
  owner_user_id: string | null;
  services: QuoteService[] | null;
  imported?: boolean | null;
  imported_file_url?: string | null;
  imported_file_name?: string | null;
}
type ViewMode = 'grid' | 'table' | 'pipeline';

// ── Helpers ────────────────────────────────────────────────────────────────────
function computeQuoteTotal(quote: { total_amount: number | null; services: QuoteService[] | null }): number | null {
  // Calculate from services (excludes free + removed)
  if (Array.isArray(quote.services) && quote.services.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const services = quote.services as any[];
    const ht = services.reduce((sum, s) => {
      if (s.removed || s.isFree || s.isPageBreak) return sum;
      return sum + (s.quantity || 0) * (s.unitPrice || 0);
    }, 0);
    if (ht > 0) return ht * 1.2; // TTC = HT × 1.20 (default VAT)
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
  draft:    { label: 'En attente',  dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600',      column: 'bg-gray-50',       colBorder: 'border-gray-200' },
  pending:  { label: 'En attente',  dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700',     column: 'bg-amber-50/40',   colBorder: 'border-amber-200' },
  sent:     { label: 'Envoyé',      dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700',       column: 'bg-blue-50/40',    colBorder: 'border-blue-200' },
  accepted: { label: 'Accepté',     dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', column: 'bg-emerald-50/40', colBorder: 'border-emerald-200' },
  rejected: { label: 'Refusé',      dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700',         column: 'bg-red-50/40',     colBorder: 'border-red-200' },
};
const PIPELINE_ORDER = ['draft', 'pending', 'sent', 'accepted', 'rejected'];
const STATUSES = ['Tous', 'En attente', 'Envoyé', 'Accepté', 'Refusé'];
const STATUS_VALUES: Record<string, string> = {
  'En attente': 'draft', Envoyé: 'sent', Accepté: 'accepted', Refusé: 'rejected',
};

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
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
    </span>
  );
}

// ── Commercial Sheet ──────────────────────────────────────────────────────────
function DevisSheet({
  quote, onClose, onStatusChange, onDelete, onDuplicate,
}: {
  quote: Quote; onClose: () => void; onStatusChange: (id: string, status: string) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void;
}) {
  const [tab, setTab] = useState<'apercu' | 'suivi'>('apercu');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [status, setStatus] = useState(quote.status);
  const [savingStatus, setSavingStatus] = useState(false);

  const Icon = getEventIcon(quote.event_type || '');

  const handleStatusChange = async (s: string) => {
    setSavingStatus(true);
    await createClient().from('quotes').update({ status: s }).eq('id', quote.id);
    setSavingStatus(false);
    setStatus(s);
    onStatusChange(quote.id, s);
  };

  return (
    <Sheet open onClose={onClose} title={quote.client_name || 'Devis'} subtitle={quote.event_type} width="w-[480px]">
      <SheetTabs tabs={[{ key: 'apercu', label: 'Aperçu' }, { key: 'suivi', label: 'Suivi commercial' }]}
        active={tab} onChange={(k) => setTab(k as typeof tab)} />

      {tab === 'apercu' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#f3e5f5]/30 rounded-xl border border-[#9c27b0]/10">
            <div className="w-12 h-12 bg-[#9c27b0]/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon className="h-6 w-6 text-[#9c27b0]" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{quote.event_type || '—'}</p>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                {quote.event_date && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(quote.event_date)}</span>}
                {quote.guest_count && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{quote.guest_count} couverts</span>}
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Statut</p>
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
              status === 'accepted'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-gray-200 text-gray-500 hover:bg-gray-50',
            ].join(' ')}
          >
            <CalendarRange className="h-4 w-4" />
            {status === 'accepted' ? "Gérer l'événement" : "Préparer l'événement"}
          </Link>
          <div className="flex gap-2 pt-2">
            <Link href={`/devis/${quote.id}/imprimer`} target="_blank"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Printer className="h-4 w-4" />PDF
            </Link>
            <button onClick={() => { onDuplicate(quote.id); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[#9c27b0]/30 rounded-xl text-sm font-medium text-[#9c27b0] hover:bg-[#f3e5f5] transition-colors">
              <Copy className="h-4 w-4" />Dupliquer
            </button>
            <Link href={`/devis/${quote.id}/modifier`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#9c27b0] text-white rounded-xl text-sm font-medium hover:bg-[#7b1fa2] transition-colors">
              <Pencil className="h-4 w-4" />Éditer
            </Link>
          </div>
          {(status === 'draft' || quote.imported) && (
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
            <StickyNote className="h-4 w-4 text-[#9c27b0]" />
            <span>Notes de suivi — relances, appels, échanges</span>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={10}
            placeholder={'Relance du 15/03 — message laissé en VM.\nÀ rappeler mardi matin.\nClient hésitant sur le nombre de couverts…'}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors leading-relaxed"
          />
          <button onClick={async () => { setSavingNotes(true); await createClient().from('quotes').update({ notes }).eq('id', quote.id); setSavingNotes(false); }} disabled={savingNotes}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors">
            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingNotes ? 'Sauvegarde…' : 'Sauvegarder les notes'}
          </button>
          <p className="text-[10px] text-gray-400">Nécessite une colonne <code className="bg-gray-100 px-1 rounded">notes</code> (text) dans <code className="bg-gray-100 px-1 rounded">quotes</code>.</p>
        </div>
      )}
    </Sheet>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function QuoteCard({ quote, onOpenSheet, onDelete, onDuplicate, onOpenFinance, onEditImport }: { quote: Quote; onOpenSheet: () => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void; onOpenFinance: (id: string) => void; onEditImport: (id: string) => void }) {
  const Icon = getEventIcon(quote.event_type || '');
  return (
    <div className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#9c27b0]/30 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#f3e5f5] flex items-center justify-center flex-shrink-0 group-hover:bg-[#9c27b0] transition-colors">
            <Icon className="h-5 w-5 text-[#9c27b0] group-hover:text-white transition-colors" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{quote.client_name || '—'}</p>
            <p className="text-sm text-gray-500 capitalize truncate">{quote.event_type || 'Événement'}</p>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          {quote.imported && (
            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Importé</span>
          )}
          {!quote.user_id && <V1Badge />}
        </div>
      </div>
      {quote.imported && quote.imported_file_url && (
        <a href={quote.imported_file_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 hover:bg-amber-100 transition-colors">
          <Download className="h-3 w-3" />
          <span className="truncate flex-1">{quote.imported_file_name || 'Document original'}</span>
        </a>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm text-gray-500">
        {quote.event_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-gray-400" />{formatDate(quote.event_date)}</span>}
        {quote.guest_count && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-gray-400" />{quote.guest_count} couvert{quote.guest_count > 1 ? 's' : ''}</span>}
      </div>
      <div className="pt-3 border-t border-gray-100 space-y-2.5">
        <div className="flex items-center justify-between">
          {(() => { const t = computeQuoteTotal(quote); return t ? (
            <p className="font-bold text-gray-900 text-base">{formatCurrency(t)}<span className="text-xs font-normal text-gray-400 ml-1">TTC</span></p>
          ) : <p className="text-sm text-gray-400 italic">—</p>; })()}
          <StatusBadge status={quote.status} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onOpenSheet} title="Aperçu"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Eye className="h-3.5 w-3.5" />Aperçu
          </button>
          <Link href={`/devis/${quote.id}/imprimer`} target="_blank" title="PDF"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Printer className="h-3.5 w-3.5" />
          </Link>
          <button onClick={() => onDuplicate(quote.id)} title="Dupliquer"
            className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onOpenFinance(quote.id)} title="Gestion financière"
            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
            <Wallet className="h-3.5 w-3.5" />
          </button>
          {quote.imported && quote.imported_file_url ? (
            <a href={quote.imported_file_url} target="_blank" rel="noopener noreferrer" title="Ouvrir le document importé"
              className="p-1.5 text-[#9c27b0]/50 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors">
              <FileText className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Link href={`/devis/${quote.id}/modifier?mode=weboword`} title="WeboWord"
              className="p-1.5 text-[#9c27b0]/50 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors">
              <LayoutTemplate className="h-3.5 w-3.5" />
            </Link>
          )}
          {quote.imported && (
            <button onClick={() => onEditImport(quote.id)} title="Modifier l'import (prix, fichier, infos)"
              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {(quote.status === 'draft' || quote.imported) && (
            <button onClick={() => onDelete(quote.id)} title="Supprimer"
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────
function TableView({ quotes, onOpenSheet, onDelete, onDuplicate }: { quotes: Quote[]; onOpenSheet: (q: Quote) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Événement</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Date</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Montant TTC</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{q.client_name || '—'}</td>
              <td className="px-4 py-3 text-gray-600 capitalize">{q.event_type || '—'}</td>
              <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{q.event_date ? formatDate(q.event_date) : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {!q.user_id && <V1Badge />}
                  <StatusBadge status={q.status} />
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums hidden sm:table-cell">{(() => { const t = computeQuoteTotal(q); return t ? formatCurrency(t) : '—'; })()}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => onDuplicate(q.id)} title="Dupliquer" className="p-1.5 text-gray-300 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                  {q.status === 'draft' && (
                    <button onClick={() => onDelete(q.id)} title="Supprimer" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                  <button onClick={() => onOpenSheet(q)} className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                  <Link href={`/devis/${q.id}/imprimer`} target="_blank" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="PDF"><Printer className="h-3.5 w-3.5" /></Link>
                  <Link href={`/devis/${q.id}/modifier?mode=weboword`} className="p-1.5 text-[#9c27b0]/50 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors" title="Ouvrir dans WeboWord"><LayoutTemplate className="h-3.5 w-3.5" /></Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
function PipelineView({
  quotes, onStatusChange, onOpenSheet,
}: {
  quotes: Quote[]; onStatusChange: (id: string, s: string) => void; onOpenSheet: (q: Quote) => void;
}) {
  // useRef for draggingId so async handleDrop always reads the current value
  // (avoids stale closure bug when the React re-render hasn't happened yet on fast drags)
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null); // UI only (opacity)
  const [draggingOver, setDraggingOver] = useState<string | null>(null);

  const handleDrop = async (targetStatus: string) => {
    const id = draggingIdRef.current;
    if (!id) return;
    const { error } = await createClient().from('quotes').update({ status: targetStatus }).eq('id', id);
    if (!error) onStatusChange(id, targetStatus);
    draggingIdRef.current = null;
    setDraggingId(null);
    setDraggingOver(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6" style={{ minHeight: 400 }}>
      {PIPELINE_ORDER.map((statusKey) => {
        const cfg = STATUS_CONFIG[statusKey];
        const col = quotes.filter((q) => q.status === statusKey);
        const colTotal = col.reduce((s, q) => s + (computeQuoteTotal(q) ?? 0), 0);
        const isOver = draggingOver === statusKey;

        return (
          <div key={statusKey}
            className={['flex-shrink-0 w-64 rounded-2xl border-2 transition-all duration-150', cfg.column, isOver ? 'border-[#9c27b0]/50 scale-[1.01]' : cfg.colBorder].join(' ')}
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
              {col.map((q) => {
                const Icon = getEventIcon(q.event_type || '');
                return (
                  <div key={q.id} draggable
                    onDragStart={() => { draggingIdRef.current = q.id; setDraggingId(q.id); }}
                    onDragEnd={() => { draggingIdRef.current = null; setDraggingId(null); setDraggingOver(null); }}
                    className={['bg-white border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[#9c27b0]/30 transition-all select-none', draggingId === q.id ? 'opacity-40' : ''].join(' ')}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-[#f3e5f5] flex items-center justify-center flex-shrink-0">
                        <Icon className="h-3.5 w-3.5 text-[#9c27b0]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{q.client_name || '—'}</p>
                        <p className="text-[10px] text-gray-500 capitalize truncate">{q.event_type || '—'}</p>
                      </div>
                    </div>
                    {q.event_date && <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-1.5"><CalendarDays className="h-2.5 w-2.5" />{formatDate(q.event_date)}</p>}
                    <div className="flex items-center justify-between mt-1">
                      {(() => { const t = computeQuoteTotal(q); return t ? <p className="text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(t)}</p> : <span />; })()}
                      <button onClick={() => onOpenSheet(q)} className="p-1 text-gray-300 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors">
                        <ArrowRight className="h-3 w-3" />
                      </button>
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

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-100 rounded-xl" />
        <div className="space-y-2 flex-1"><div className="h-4 bg-gray-100 rounded w-2/3" /><div className="h-3 bg-gray-100 rounded w-1/3" /></div>
        <div className="h-6 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
      <div className="border-t border-gray-100 pt-3 flex justify-between">
        <div className="h-5 bg-gray-100 rounded w-24" />
        <div className="h-7 bg-gray-100 rounded w-32" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DevisPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('Tous');
  const [view, setView] = useState<ViewMode>('grid');
  const [sheetQuote, setSheetQuote] = useState<Quote | null>(null);
  const [dupModal, setDupModal] = useState<{ open: boolean; quoteId: string | null; saving: boolean; templateName: string }>({ open: false, quoteId: null, saving: false, templateName: '' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [templates, setTemplates] = useState<{ id: string; name: string; template: string; created_at: string; services: any[]; remarks: string | null; vat_rate: number; hide_price: boolean }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creatingFromTpl, setCreatingFromTpl] = useState<string | null>(null);
  const [previewTpl, setPreviewTpl] = useState<{ id: string; name: string; template: string; content_html: string | null } | null>(null);
  const [renamingTpl, setRenamingTpl] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [importModal, setImportModal] = useState(false);
  const [editImportId, setEditImportId] = useState<string | null>(null);
  const [financeQuoteId, setFinanceQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('quotes')
        .select('id, client_name, event_type, event_date, guest_count, status, total_amount, created_at, user_id, owner_user_id, services, imported, imported_file_url, imported_file_name')
        .or(`user_id.eq.${user.id},owner_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      supabase.from('devis_templates')
        .select('id, name, template, created_at, services, remarks, vat_rate, hide_price')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]).then(([quotesRes, tplRes]) => {
      setQuotes(quotesRes.data ?? []);
      setTemplates(tplRes.data ?? []);
      setLoading(false);
    });
  }, [user]);

  // Create a devis from a template
  const createFromTemplate = useCallback(async (tplId: string) => {
    if (!user) return;
    setCreatingFromTpl(tplId);
    const supabase = createClient();
    const { data: tpl } = await supabase.from('devis_templates').select('*').eq('id', tplId).single();
    if (!tpl) { setCreatingFromTpl(null); return; }

    // Build payload — match exact columns from quotes table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      user_id: user.id,
      owner_user_id: user.id,
      client_name: '',
      status: 'draft',
      services: tpl.services || [],
      content_html: tpl.content_html || null,
      template: tpl.template || 'standard',
      selected_font: tpl.selected_font || null,
      selected_font_size: tpl.selected_font_size || 12,
      remarks: tpl.remarks || null,
      vat_rate: tpl.vat_rate ?? 20,
      hide_price: tpl.hide_price ?? false,
      event_type: '',
      event_date: new Date().toISOString().slice(0, 10),
      event_location: '',
      guest_count: 1,
    };

    const res = await supabase.from('quotes').insert(payload).select('id').single();
    if (res.error) {
      console.error('Erreur création devis depuis template:', res.error.message, res.error.code);
      alert('Erreur: ' + res.error.message);
    }
    setCreatingFromTpl(null);
    if (res.data) router.push(`/devis/${res.data.id}/modifier?mode=weboword`);
  }, [user, router]);

  const deleteTemplate = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce modèle ?')) return;
    await createClient().from('devis_templates').delete().eq('id', id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setPreviewTpl(null);
  }, []);

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

  // Perform duplication (simple or with template save)
  const executeDuplicate = useCallback(async (saveAsTemplate: boolean) => {
    if (!dupModal.quoteId || !user) return;
    setDupModal((m) => ({ ...m, saving: true }));
    const supabase = createClient();
    const { data } = await supabase
      .from('quotes')
      .select('services, event_type, event_date, event_location, guest_count, remarks, vat_rate, hide_price, template, images, content_html, selected_font, selected_font_size')
      .eq('id', dupModal.quoteId)
      .single();
    if (!data) { setDupModal((m) => ({ ...m, saving: false })); return; }

    // Save as template if requested
    if (saveAsTemplate && dupModal.templateName.trim()) {
      await supabase.from('devis_templates').insert({
        user_id: user.id,
        name: dupModal.templateName.trim(),
        services: data.services || [],
        content_html: data.content_html || null,
        template: data.template || 'standard',
        selected_font: data.selected_font || null,
        selected_font_size: data.selected_font_size || 12,
        remarks: data.remarks || null,
        vat_rate: data.vat_rate ?? 20,
        hide_price: data.hide_price ?? false,
      });
    }

    // Create new quote with content_html preserved
    const dupPayload = {
      user_id: user.id,
      owner_user_id: user.id,
      client_name: '',
      status: 'draft',
      services: data.services || [],
      content_html: data.content_html || null,
      selected_font: data.selected_font || null,
      selected_font_size: data.selected_font_size || 12,
      template: data.template || 'standard',
      event_type: data.event_type || '',
      event_date: data.event_date || new Date().toISOString().slice(0, 10),
      event_location: data.event_location || '',
      guest_count: data.guest_count || 1,
      remarks: data.remarks || null,
      vat_rate: data.vat_rate ?? 20,
      hide_price: data.hide_price ?? false,
      images: data.images || [],
    };
    const res = await supabase.from('quotes').insert(dupPayload).select('id').single();
    if (res.error) {
      console.error('Erreur duplication:', res.error.message);
      alert('Erreur: ' + res.error.message);
    }
    const newQuote = res.data;

    setDupModal({ open: false, quoteId: null, saving: false, templateName: '' });

    if (newQuote) {
      // Go directly to WeboWord with the duplicated content
      router.push(`/devis/${newQuote.id}/modifier?mode=weboword`);
    }
  }, [dupModal.quoteId, dupModal.templateName, user, router]);

  const filtered = quotes.filter((q) => {
    const matchSearch = !search || q.client_name?.toLowerCase().includes(search.toLowerCase()) || q.event_type?.toLowerCase().includes(search.toLowerCase());
    // Hide rejected quotes by default — only show them when filter is explicitly "Refusé"
    const isRejected = q.status === 'rejected' || q.status === 'refuse_client' || q.status === 'refuse_traiteur';
    if (isRejected && activeStatus !== 'Refusé') return false;
    const matchStatus = activeStatus === 'Tous' || q.status === STATUS_VALUES[activeStatus];
    return matchSearch && matchStatus;
  });

  const VIEW_BUTTONS: { mode: ViewMode; Icon: React.ElementType; label: string }[] = [
    { mode: 'grid', Icon: LayoutGrid, label: 'Grille' },
    { mode: 'table', Icon: List, label: 'Tableau' },
    { mode: 'pipeline', Icon: Columns3, label: 'Pipeline' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mes devis</h1>
          <p className="text-sm text-gray-500 mt-0.5">{loading ? '…' : `${quotes.length} devis au total`}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View selector */}
          <div className="flex items-center gap-0.5 bg-gray-100 p-1 rounded-xl">
            {VIEW_BUTTONS.map(({ mode, Icon, label }) => (
              <button key={mode} onClick={() => setView(mode)} title={label}
                className={['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', view === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setImportModal(true)}
            title="Importer un devis déjà fait dans un autre logiciel"
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            <span className="hidden sm:inline">Importer</span>
          </button>
          <Link href="/devis/nouveau"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors">
            <Plus className="h-4 w-4" />Nouveau
          </Link>
        </div>
      </div>

      {/* ── Templates section ──────────────────────────────────────────── */}
      {templates.length > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#9c27b0] transition-colors mb-3"
          >
            <Library className="h-4 w-4" />
            Mes modèles ({templates.length})
            <span className={`text-xs transition-transform ${showTemplates ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showTemplates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {templates.map((tpl) => {
                const svcCount = Array.isArray(tpl.services) ? tpl.services.length : 0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const svcNames = Array.isArray(tpl.services) ? tpl.services.filter((s: any) => s.name && !s.isPageBreak).slice(0, 3) : [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const totalHt = Array.isArray(tpl.services) ? tpl.services.reduce((sum: number, s: any) => sum + (s.isFree ? 0 : (s.quantity || 0) * (s.unitPrice || 0)), 0) : 0;
                const templateLabel = tpl.template === 'mariage' ? 'Mariage' : tpl.template === 'business' ? 'Business' : 'Standard';
                const templateColor = tpl.template === 'mariage' ? 'text-amber-700 bg-amber-50' : tpl.template === 'business' ? 'text-slate-700 bg-slate-100' : 'text-[#9c27b0] bg-[#f3e5f5]';
                return (
                  <div key={tpl.id} className="group bg-gradient-to-br from-[#faf5ff] to-white border border-[#e9d5ff] rounded-xl p-4 hover:shadow-md hover:border-[#9c27b0]/40 transition-all cursor-pointer" onClick={() => renamingTpl !== tpl.id && openPreview(tpl.id)}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        {renamingTpl === tpl.id ? (
                          <input
                            autoFocus
                            value={renameName}
                            onChange={(e) => setRenameName(e.target.value)}
                            onBlur={() => renameTemplate(tpl.id, renameName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameTemplate(tpl.id, renameName);
                              if (e.key === 'Escape') setRenamingTpl(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-bold text-gray-900 w-full border border-[#9c27b0] rounded px-2 py-0.5 focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm font-bold text-gray-900 truncate">{tpl.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${templateColor}`}>{templateLabel}</span>
                          <span className="text-[10px] text-gray-400">{svcCount} prestation{svcCount > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setRenamingTpl(tpl.id); setRenameName(tpl.name); }} title="Renommer" className="p-1.5 text-gray-300 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteTemplate(tpl.id); }} title="Supprimer" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Preview of services */}
                    {svcNames.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {svcNames.map((s: any, i: number) => (
                          <p key={i} className="text-[11px] text-gray-500 truncate">
                            <span className="text-gray-300 mr-1">•</span>{s.name}
                          </p>
                        ))}
                        {svcCount > 3 && <p className="text-[10px] text-gray-400 italic">+{svcCount - 3} autres…</p>}
                      </div>
                    )}
                    {/* Total + CTA */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#e9d5ff]/50">
                      {totalHt > 0 ? (
                        <p className="text-xs font-bold text-gray-700 tabular-nums">{formatCurrency(totalHt)} <span className="text-[10px] font-normal text-gray-400">HT</span></p>
                      ) : <span />}
                      <button
                        onClick={(e) => { e.stopPropagation(); createFromTemplate(tpl.id); }}
                        disabled={creatingFromTpl === tpl.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9c27b0] border border-[#9c27b0]/30 rounded-lg hover:bg-[#9c27b0] hover:text-white transition-colors disabled:opacity-50"
                      >
                        {creatingFromTpl === tpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Utiliser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Search + filter */}
      {view !== 'pipeline' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par client ou événement…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setActiveStatus(s)}
                className={['flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', activeStatus === s ? 'bg-[#9c27b0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {view === 'pipeline' && (
        <div className="relative mb-5 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer par client…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors" />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 && view !== 'pipeline' ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4"><CalendarDays className="h-8 w-8 text-gray-400" /></div>
          <p className="text-gray-500 font-medium mb-1">Aucun devis trouvé</p>
          <p className="text-sm text-gray-400 mb-4">{search ? 'Essayez avec d\'autres termes.' : 'Créez votre premier devis pour commencer.'}</p>
          {!search && <Link href="/devis/nouveau" className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] transition-colors"><Plus className="h-4 w-4" />Créer un devis</Link>}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((q) => <QuoteCard key={q.id} quote={q} onOpenSheet={() => setSheetQuote(q)} onDelete={handleDelete} onDuplicate={handleDuplicate} onOpenFinance={(id) => setFinanceQuoteId(id)} onEditImport={(id) => setEditImportId(id)} />)}
        </div>
      ) : view === 'table' ? (
        <TableView quotes={filtered} onOpenSheet={(q) => setSheetQuote(q)} onDelete={handleDelete} onDuplicate={handleDuplicate} />
      ) : (
        <PipelineView quotes={filtered} onStatusChange={handleStatusChange} onOpenSheet={(q) => setSheetQuote(q)} />
      )}

      {sheetQuote && (
        <DevisSheet quote={sheetQuote} onClose={() => setSheetQuote(null)} onStatusChange={handleStatusChange} onDelete={handleDelete} onDuplicate={handleDuplicate} />
      )}

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
        onClose={() => { setImportModal(false); setEditImportId(null); }}
        onCreated={() => {
          // Reload quotes
          if (!user) return;
          createClient()
            .from('quotes')
            .select('id, client_name, event_type, event_date, guest_count, status, total_amount, created_at, user_id, owner_user_id, services, imported, imported_file_url, imported_file_name')
            .or(`user_id.eq.${user.id},owner_user_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setQuotes(data); });
        }}
      />

      {previewTpl && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPreviewTpl(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-[#f3e5f5] rounded-xl flex-shrink-0">
                  <Library className="h-4 w-4 text-[#9c27b0]" />
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
                  dangerouslySetInnerHTML={{ __html: previewTpl.content_html }}
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
                className="flex items-center gap-2 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Créer un devis
              </button>
            </div>
          </div>
        </div>
      )}

      {dupModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !dupModal.saving && setDupModal({ open: false, quoteId: null, saving: false, templateName: '' })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#f3e5f5] rounded-xl">
                  <Copy className="h-4 w-4 text-[#9c27b0]" />
                </div>
                <h2 className="font-semibold text-gray-900">Dupliquer le devis</h2>
              </div>
              <button onClick={() => !dupModal.saving && setDupModal({ open: false, quoteId: null, saving: false, templateName: '' })} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Option 1: Simple */}
              <button
                onClick={() => executeDuplicate(false)}
                disabled={dupModal.saving}
                className="w-full flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-[#9c27b0]/40 hover:bg-[#faf5ff] transition-all text-left group"
              >
                <div className="p-2.5 bg-gray-100 rounded-xl group-hover:bg-[#f3e5f5] transition-colors flex-shrink-0">
                  <Copy className="h-5 w-5 text-gray-500 group-hover:text-[#9c27b0] transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Duplication simple</p>
                  <p className="text-xs text-gray-500 mt-0.5">Crée une copie exacte du devis (mise en page WeboWord conservée). Vous pourrez modifier le client ensuite.</p>
                </div>
              </button>

              {/* Option 2: Save as template */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-amber-50 rounded-xl flex-shrink-0">
                    <Library className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Dupliquer + sauvegarder en modèle</p>
                    <p className="text-xs text-gray-500 mt-0.5">Crée une copie et enregistre ce devis comme modèle réutilisable dans votre bibliothèque.</p>
                  </div>
                </div>
                <input
                  value={dupModal.templateName}
                  onChange={(e) => setDupModal((m) => ({ ...m, templateName: e.target.value }))}
                  placeholder="Nom du modèle (ex: Menu Prestige 80 couverts)"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
                />
                <button
                  onClick={() => executeDuplicate(true)}
                  disabled={dupModal.saving || !dupModal.templateName.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
                >
                  {dupModal.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookCopy className="h-4 w-4" />}
                  Dupliquer + enregistrer modèle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
