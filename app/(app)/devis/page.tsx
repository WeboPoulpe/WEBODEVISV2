'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Plus, Heart, PartyPopper, UtensilsCrossed, Wine, Music, Briefcase,
  CalendarDays, Users, Eye, Pencil, Search, Filter, Printer, Trash2, LayoutTemplate,
  LayoutGrid, List, Columns3, StickyNote, Save, Loader2, ArrowRight, TrendingUp, CalendarRange,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatCurrency } from '@/lib/utils';
import Sheet, { SheetTabs } from '@/components/ui/Sheet';
import { useAuth } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
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
}
type ViewMode = 'grid' | 'table' | 'pipeline';

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_ICONS: Record<string, React.ElementType> = {
  mariage: Heart, anniversaire: PartyPopper, dîner: UtensilsCrossed, diner: UtensilsCrossed,
  cocktail: Wine, soirée: Music, soiree: Music, conférence: Briefcase,
  conference: Briefcase, séminaire: Briefcase, seminaire: Briefcase,
};
const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; column: string; colBorder: string }> = {
  draft:    { label: 'Brouillon',   dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600',      column: 'bg-gray-50',       colBorder: 'border-gray-200' },
  pending:  { label: 'En attente',  dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700',     column: 'bg-amber-50/40',   colBorder: 'border-amber-200' },
  sent:     { label: 'Envoyé',      dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700',       column: 'bg-blue-50/40',    colBorder: 'border-blue-200' },
  accepted: { label: 'Accepté',     dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', column: 'bg-emerald-50/40', colBorder: 'border-emerald-200' },
  rejected: { label: 'Refusé',      dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700',         column: 'bg-red-50/40',     colBorder: 'border-red-200' },
};
const PIPELINE_ORDER = ['draft', 'pending', 'sent', 'accepted', 'rejected'];
const STATUSES = ['Tous', 'Brouillon', 'Envoyé', 'Accepté', 'En attente', 'Refusé'];
const STATUS_VALUES: Record<string, string> = {
  Brouillon: 'draft', Envoyé: 'sent', Accepté: 'accepted', 'En attente': 'pending', Refusé: 'rejected',
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
  quote, onClose, onStatusChange, onDelete,
}: {
  quote: Quote; onClose: () => void; onStatusChange: (id: string, status: string) => void; onDelete: (id: string) => void;
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
          {quote.total_amount && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">Total TTC</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(quote.total_amount)}</span>
            </div>
          )}
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
            <Link href={`/devis/${quote.id}/modifier`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#9c27b0] text-white rounded-xl text-sm font-medium hover:bg-[#7b1fa2] transition-colors">
              <Pencil className="h-4 w-4" />Éditer
            </Link>
          </div>
          {status === 'draft' && (
            <button
              onClick={() => { onDelete(quote.id); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors mt-1"
            >
              <Trash2 className="h-4 w-4" />Supprimer ce brouillon
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
function QuoteCard({ quote, onOpenSheet, onDelete }: { quote: Quote; onOpenSheet: () => void; onDelete: (id: string) => void }) {
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!quote.user_id && <V1Badge />}
          <StatusBadge status={quote.status} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm text-gray-500">
        {quote.event_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-gray-400" />{formatDate(quote.event_date)}</span>}
        {quote.guest_count && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-gray-400" />{quote.guest_count} couvert{quote.guest_count > 1 ? 's' : ''}</span>}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {quote.total_amount ? (
          <p className="font-bold text-gray-900 text-base">{formatCurrency(quote.total_amount)}<span className="text-xs font-normal text-gray-400 ml-1">TTC</span></p>
        ) : <p className="text-sm text-gray-400 italic">—</p>}
        <div className="flex items-center gap-1">
          {quote.status === 'draft' && (
            <button onClick={() => onDelete(quote.id)} title="Supprimer le brouillon"
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onOpenSheet} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Eye className="h-3.5 w-3.5" />Aperçu
          </button>
          <Link href={`/devis/${quote.id}/imprimer`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Printer className="h-3.5 w-3.5" />PDF
          </Link>
          <Link href={`/devis/${quote.id}/modifier?mode=wizard`}
            title="Modifier les informations (client, prestations…)"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <Link href={`/devis/${quote.id}/modifier?mode=weboword`}
            title="Ouvrir dans WeboWord (éditeur visuel)"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-[#9c27b0] border border-[#9c27b0]/30 rounded-lg hover:bg-[#9c27b0]/5 transition-colors">
            <LayoutTemplate className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────
function TableView({ quotes, onOpenSheet, onDelete }: { quotes: Quote[]; onOpenSheet: (q: Quote) => void; onDelete: (id: string) => void }) {
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
              <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums hidden sm:table-cell">{q.total_amount ? formatCurrency(q.total_amount) : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  {q.status === 'draft' && (
                    <button onClick={() => onDelete(q.id)} title="Supprimer" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                  <button onClick={() => onOpenSheet(q)} className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                  <Link href={`/devis/${q.id}/imprimer`} target="_blank" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="PDF"><Printer className="h-3.5 w-3.5" /></Link>
                  <Link href={`/devis/${q.id}/modifier?mode=wizard`} className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors" title="Modifier les informations"><Pencil className="h-3.5 w-3.5" /></Link>
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
        const colTotal = col.reduce((s, q) => s + (q.total_amount ?? 0), 0);
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
                      {q.total_amount ? <p className="text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(q.total_amount)}</p> : <span />}
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
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('Tous');
  const [view, setView] = useState<ViewMode>('grid');
  const [sheetQuote, setSheetQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('quotes')
      .select('id, client_name, event_type, event_date, guest_count, status, total_amount, created_at, user_id, owner_user_id')
      .or(`user_id.eq.${user.id},owner_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setQuotes(data ?? []); setLoading(false); });
  }, [user]);

  const handleStatusChange = useCallback((id: string, status: string) => {
    setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, status } : q));
    setSheetQuote((prev) => prev?.id === id ? { ...prev, status } : prev);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce brouillon ? Cette action est irréversible.')) return;
    await createClient().from('quotes').delete().eq('id', id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    setSheetQuote((prev) => prev?.id === id ? null : prev);
  }, []);

  const filtered = quotes.filter((q) => {
    const matchSearch = !search || q.client_name?.toLowerCase().includes(search.toLowerCase()) || q.event_type?.toLowerCase().includes(search.toLowerCase());
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
          <Link href="/devis/nouveau"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors">
            <Plus className="h-4 w-4" />Nouveau
          </Link>
        </div>
      </div>

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
          {filtered.map((q) => <QuoteCard key={q.id} quote={q} onOpenSheet={() => setSheetQuote(q)} onDelete={handleDelete} />)}
        </div>
      ) : view === 'table' ? (
        <TableView quotes={filtered} onOpenSheet={(q) => setSheetQuote(q)} onDelete={handleDelete} />
      ) : (
        <PipelineView quotes={filtered} onStatusChange={handleStatusChange} onOpenSheet={(q) => setSheetQuote(q)} />
      )}

      {sheetQuote && (
        <DevisSheet quote={sheetQuote} onClose={() => setSheetQuote(null)} onStatusChange={handleStatusChange} onDelete={handleDelete} />
      )}
    </div>
  );
}
