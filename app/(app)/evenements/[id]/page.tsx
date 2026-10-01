'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, FileText, Loader2, MapPin, Pencil, Users, Wallet } from 'lucide-react';
import FinanceSheet from '@/components/devis/FinanceSheet';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';
import { QUOTE_STATUSES, quoteStatusLabel } from '@/lib/quoteStatus';
import Modal from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { btnGhost, btnPrimary, btnSecondary, cardCls, inputCls, labelCls } from '@/components/ui/kit';
import ChecklistTab from '@/components/evenements/ChecklistTab';
import MaterielTab from '@/components/evenements/MaterielTab';
import CoursesTab from '@/components/evenements/CoursesTab';
import ExtrasTab from '@/components/evenements/ExtrasTab';
import { ErrorBanner, type EventQuote } from '@/components/evenements/shared';

type Tab = 'checklist' | 'materiel' | 'courses' | 'extras';

const TABS: { key: Tab; label: string }[] = [
  { key: 'checklist', label: 'Checklist' },
  { key: 'materiel', label: 'Matériel' },
  { key: 'courses', label: 'Courses' },
  { key: 'extras', label: 'Extras' },
];

const QUOTE_SELECT =
  'id, client_name, event_type, event_date, event_location, guest_count, total_amount, status, services, checklist, event_materials, event_material_checks';

export default function EvenementPage() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<EventQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('checklist');
  // Lien d'une notification (« Paul a confirmé ») : ?onglet=extras ouvre directement l'équipe.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('onglet');
    if (wanted === 'checklist' || wanted === 'materiel' || wanted === 'courses' || wanted === 'extras') setTab(wanted);
  }, []);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [edit, setEdit] = useState<{ date: string; location: string; guests: string; status: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    createClient().from('quotes').select(QUOTE_SELECT).eq('id', id).maybeSingle().then(({ data }) => {
      setQuote(data as EventQuote | null);
      setLoading(false);
    });
  }, [id]);

  const patchQuote = useCallback((patch: Partial<EventQuote>) => setQuote((q) => (q ? { ...q, ...patch } : q)), []);

  const saveInfo = async () => {
    if (!quote || !edit) return;
    const guests = parseInt(edit.guests, 10);
    if (!edit.date) { setEditError('La date est obligatoire.'); return; }
    if (!(guests > 0)) { setEditError('Le nombre de couverts doit être supérieur à zéro.'); return; }
    setSaving(true);
    const values = { event_date: edit.date, event_location: edit.location.trim(), guest_count: guests, status: edit.status };
    const { error } = await createClient().from('quotes').update(values).eq('id', quote.id);
    setSaving(false);
    if (error) { setEditError('Les informations n’ont pas pu être enregistrées. Réessayez.'); return; }
    patchQuote(values);
    setEdit(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 text-gray-400 animate-spin" /></div>;
  }

  if (!quote) {
    return (
      <div className="px-4 md:px-6 pb-8">
        <div className={cn(cardCls, 'px-6 py-10 text-center')}>
          <p className="font-semibold text-gray-900">Événement introuvable</p>
          <p className="text-sm text-gray-600 mt-1">Il a peut-être été supprimé, ou il appartient à un autre compte.</p>
          <Link href="/evenements" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">Retour aux événements</Link>
        </div>
      </div>
    );
  }

  const date = quote.event_date
    ? new Date(quote.event_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const fact = 'flex items-center gap-2 text-[15px] text-gray-700';

  return (
    <div className="px-4 md:px-6 pb-8 space-y-3">
      <Link href="/evenements" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />Événements
      </Link>

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <header className={cn(cardCls, 'p-5 sm:p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={quote.status} />
              {quote.event_type && <span className="px-2.5 py-0.5 rounded-full bg-primary-100 text-primary text-xs font-medium capitalize">{quote.event_type}</span>}
            </div>
            <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight mt-2 break-words">{quote.client_name || 'Événement'}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
              {date && <p className={fact}><CalendarDays className="h-4 w-4 text-gray-500" /><span className="first-letter:uppercase">{date}</span></p>}
              {quote.event_location && <p className={fact}><MapPin className="h-4 w-4 text-gray-500" />{quote.event_location}</p>}
              {!!quote.guest_count && <p className={fact}><Users className="h-4 w-4 text-gray-500" />{quote.guest_count} couverts</p>}
            </div>
          </div>
          {quote.total_amount != null && (
            <p className="font-display text-[28px] font-bold text-gray-900 tabular-nums whitespace-nowrap">{formatCurrency(quote.total_amount)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <button
            onClick={() => { setEditError(null); setEdit({ date: quote.event_date?.slice(0, 10) ?? '', location: quote.event_location ?? '', guests: String(quote.guest_count ?? ''), status: quote.status }); }}
            className={btnSecondary}
          ><Pencil className="h-4 w-4" />Modifier</button>
          <button onClick={() => setFinanceOpen(true)} className={btnSecondary}><Wallet className="h-4 w-4" />Marge et coûts</button>
          <Link href={`/devis/${quote.id}/modifier`} className={btnSecondary}><FileText className="h-4 w-4" />Voir le devis</Link>
        </div>
      </header>

      {/* ── Onglets ─────────────────────────────────────────────────────────── */}
      <div className="flex p-1 rounded-xl bg-gray-200/70 sm:w-fit" role="tablist" aria-label="Préparation de l'événement">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn('flex-1 sm:flex-none h-10 px-3 sm:px-5 rounded-lg text-sm font-medium transition-colors', tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            {t.label}
          </button>
        ))}
      </div>

      <section className={cn(cardCls, 'p-4 sm:p-6')} role="tabpanel">
        {tab === 'checklist' && <ChecklistTab quote={quote} onChange={(checklist) => patchQuote({ checklist })} />}
        {tab === 'materiel' && <MaterielTab quote={quote} onChange={patchQuote} />}
        {tab === 'courses' && <CoursesTab quote={quote} />}
        {tab === 'extras' && <ExtrasTab quote={quote} />}
      </section>

      {edit && (
        <Modal
          title="Modifier l’événement"
          onClose={() => setEdit(null)}
          footer={<>
            <button onClick={() => setEdit(null)} className={btnGhost}>Annuler</button>
            <button onClick={saveInfo} disabled={saving} className={btnPrimary}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          </>}
        >
          <div className="space-y-4">
            <ErrorBanner message={editError} onClose={() => setEditError(null)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ev-date" className={labelCls}>Date</label>
                <input id="ev-date" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ev-guests" className={labelCls}>Couverts</label>
                <input id="ev-guests" type="number" inputMode="numeric" min="1" value={edit.guests} onChange={(e) => setEdit({ ...edit, guests: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="ev-location" className={labelCls}>Lieu</label>
              <input id="ev-location" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="Adresse ou nom du lieu" className={inputCls} />
            </div>
            <div>
              <label htmlFor="ev-status" className={labelCls}>Statut</label>
              <select id="ev-status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={inputCls}>
                {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}
              </select>
              <p className="text-sm text-gray-500 mt-2">Seuls les devis validés, avec acompte ou payés apparaissent dans les événements.</p>
            </div>
          </div>
        </Modal>
      )}

      <FinanceSheet open={financeOpen} quoteId={financeOpen ? quote.id : null} onClose={() => setFinanceOpen(false)} />
    </div>
  );
}
