'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, Receipt, Search } from 'lucide-react';
import { listInvoices, type Invoice } from '@/server/invoices';
import { INVOICE_KIND_LABELS } from '@/lib/invoices';
import { invoicesCsv } from '@/lib/invoiceCsv';
import { frDate } from '@/lib/invoiceMentions';
import { useUrlAction } from '@/lib/useUrlAction';
import { cn, formatCurrency } from '@/lib/utils';
import { btnPrimary, btnSecondary, cardCls, errorCls, inputCls } from '@/components/ui/kit';
import InvoiceStatusPill, { invoiceStatusLabel } from '@/components/factures/InvoiceStatusPill';

type Filter = 'toutes' | 'brouillons' | 'a_encaisser' | 'en_retard' | 'payees' | 'avoirs';

/** Date du jour sur le poste de l'utilisateur, au format AAAA-MM-JJ. */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const remainingOf = (i: Invoice) => Math.max(0, Math.round((i.total_ttc - i.paid) * 100) / 100);
/** Facture émise qui attend encore un règlement (les avoirs ne s'encaissent pas). */
const isOpen = (i: Invoice) => i.kind !== 'avoir' && (i.status === 'emise' || i.status === 'payee_partiellement');
const isLate = (i: Invoice, today: string) => isOpen(i) && !!i.due_date && i.due_date < today;

const MATCH: Record<Filter, (i: Invoice, today: string) => boolean> = {
  toutes: () => true,
  brouillons: (i) => i.status === 'brouillon',
  a_encaisser: (i) => isOpen(i),
  en_retard: (i, today) => isLate(i, today),
  payees: (i) => i.kind !== 'avoir' && i.status === 'payee',
  avoirs: (i) => i.kind === 'avoir',
};

const FILTERS: [Filter, string][] = [
  ['toutes', 'Toutes'],
  ['brouillons', 'Brouillons'],
  ['a_encaisser', 'À encaisser'],
  ['en_retard', 'En retard'],
  ['payees', 'Payées'],
  ['avoirs', 'Avoirs'],
];

function Kpi({ label, value, hint, tone }: { label: string; value: string | null; hint?: string; tone?: 'danger' | 'forest' }) {
  return (
    <section className={cn('rounded-2xl p-4 sm:p-5', tone === 'forest' ? 'bg-forest text-white' : cn(cardCls))}>
      <h2 className={cn('text-sm', tone === 'forest' ? 'text-white/70' : 'text-gray-600')}>{label}</h2>
      <p className={cn('font-display text-[26px] sm:text-[30px] font-bold tabular-nums leading-tight mt-1 whitespace-nowrap', tone === 'danger' && value && value !== formatCurrency(0) && 'text-danger')}>
        {value ?? <span className="inline-block h-7 w-28 rounded-lg bg-current opacity-10 animate-pulse align-middle" />}
      </p>
      {hint && <p className={cn('text-sm mt-1', tone === 'forest' ? 'text-white/70' : 'text-gray-500')}>{hint}</p>}
    </section>
  );
}

function InvoiceRow({ inv, today }: { inv: Invoice; today: string }) {
  const late = isLate(inv, today);
  const remaining = remainingOf(inv);
  return (
    <li>
      <Link href={`/factures/${inv.id}`}
        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 transition-colors">
        <span className="hidden sm:flex w-11 h-11 rounded-xl bg-primary-50 text-primary items-center justify-center flex-shrink-0" aria-hidden>
          <Receipt className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-gray-900 truncate">{inv.buyer?.name || 'Client'}</span>
          <span className="block text-sm text-gray-600 truncate mt-0.5">
            {inv.number ? <span className="font-mono text-xs text-gray-700 mr-1.5">{inv.number}</span> : <span className="font-medium mr-1.5">Brouillon</span>}
            {INVOICE_KIND_LABELS[inv.kind]}
            {inv.quote_number ? `, devis ${inv.quote_number}` : ''}
          </span>
          <span className="block text-sm text-gray-500 mt-0.5">
            {inv.issue_date ? `Émise le ${frDate(inv.issue_date)}` : 'Pas encore émise'}
            {inv.due_date && inv.kind !== 'avoir' && (
              <>, <span className={cn(late && 'text-danger font-medium')}>{late ? 'échue le' : 'échéance'} {frDate(inv.due_date)}</span></>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 lg:hidden">
            <InvoiceStatusPill kind={inv.kind} status={inv.status} />
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(inv.total_ttc)}</span>
            {isOpen(inv) && remaining > 0 && remaining < inv.total_ttc && <span className="text-sm text-gray-600 tabular-nums">reste {formatCurrency(remaining)}</span>}
          </span>
        </span>
        <span className="hidden lg:block w-36 flex-shrink-0"><InvoiceStatusPill kind={inv.kind} status={inv.status} /></span>
        <span className="hidden lg:block w-32 flex-shrink-0 text-right text-sm tabular-nums">
          {isOpen(inv) ? <span className={cn('font-medium', late ? 'text-danger' : 'text-gray-900')}>{formatCurrency(remaining)}</span> : <span className="text-gray-400">–</span>}
        </span>
        <span className="hidden lg:block w-36 flex-shrink-0 text-right font-display font-bold text-gray-900 tabular-nums">{formatCurrency(inv.total_ttc)}</span>
      </Link>
    </li>
  );
}

export default function FacturesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('toutes');
  const [search, setSearch] = useState('');
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(todayIso());
    listInvoices()
      .then(setInvoices)
      .catch(() => { setInvoices([]); setError('Vos factures n’ont pas pu être chargées. Rechargez la page.'); });
  }, []);

  // Raccourcis du mégamenu (lib/navMega.ts).
  useUrlAction({ 'a-encaisser': () => setFilter('a_encaisser'), 'en-retard': () => setFilter('en_retard') });

  const loading = invoices === null;
  const all = useMemo(() => invoices ?? [], [invoices]);

  const kpis = useMemo(() => {
    if (loading) return null;
    const month = today.slice(0, 7);
    const open = all.filter(isOpen);
    const late = open.filter((i) => isLate(i, today));
    const cashed = all.flatMap((i) => i.payments).filter((p) => p.paid_on.startsWith(month));
    const sum = (list: Invoice[]) => list.reduce((s, i) => s + remainingOf(i), 0);
    return {
      open: sum(open), openCount: open.length,
      late: sum(late), lateCount: late.length,
      cashed: cashed.reduce((s, p) => s + p.amount, 0), cashedCount: cashed.length,
    };
  }, [all, loading, today]);

  const needle = search.trim().toLowerCase();
  const searched = useMemo(() => all.filter((i) => !needle
    || [i.number, i.buyer?.name, i.quote_number, i.credited_invoice_number].filter(Boolean).join(' ').toLowerCase().includes(needle)), [all, needle]);
  const listed = searched.filter((i) => MATCH[filter](i, today));
  const countOf = (f: Filter) => searched.filter((i) => MATCH[f](i, today)).length;

  const exportCsv = () => {
    const csv = invoicesCsv(listed, (i) => invoiceStatusLabel(i.kind, i.status));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `factures-${todayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-5">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight">Factures</h1>
          <p className="text-sm text-gray-600 mt-1">{loading ? 'Chargement…' : all.length === 0 ? 'Acomptes, soldes et avoirs de vos devis' : plural(all.length, 'facture au total', 'factures au total')}</p>
        </div>
        {all.length > 0 && (
          <button onClick={exportCsv} disabled={listed.length === 0} className={cn(btnSecondary, 'w-full sm:w-auto')}
            title="Les factures affichées, à ouvrir dans Excel ou à envoyer à votre comptable">
            <Download className="h-4 w-4" />Exporter (CSV)
          </button>
        )}
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Kpi tone="forest" label="À encaisser" value={kpis ? formatCurrency(kpis.open) : null}
          hint={kpis ? (kpis.openCount ? `${plural(kpis.openCount, 'facture émise', 'factures émises')}, TTC` : 'Rien en attente') : ' '} />
        <Kpi tone="danger" label="En retard" value={kpis ? formatCurrency(kpis.late) : null}
          hint={kpis ? (kpis.lateCount ? `${plural(kpis.lateCount, 'facture échue', 'factures échues')}, à relancer` : 'Aucune échéance dépassée') : ' '} />
        <Kpi label="Encaissé ce mois" value={kpis ? formatCurrency(kpis.cashed) : null}
          hint={kpis ? (kpis.cashedCount ? plural(kpis.cashedCount, 'paiement reçu', 'paiements reçus') : 'Aucun paiement ce mois-ci') : ' '} />
      </div>

      {!loading && all.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-12 text-center flex flex-col items-center')}>
          <span className="w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center mb-3" aria-hidden><Receipt className="h-6 w-6" /></span>
          <p className="font-semibold text-gray-900">Aucune facture pour le moment</p>
          <p className="text-sm text-gray-600 mt-1 max-w-md">
            On facture depuis un devis confirmé : ouvrez-le dans Devis, puis choisissez « Facturer ».
            Acompte, solde ou facture complète, les lignes et les montants sont repris du devis.
          </p>
          <Link href="/devis?action=confirmes" className={cn(btnPrimary, 'mt-5')}>Voir mes devis confirmés<ArrowRight className="h-4 w-4" /></Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="N° de facture, client ou n° de devis"
                aria-label="Rechercher une facture" className={cn(inputCls, 'pl-11')} />
            </div>
            <div className="flex p-1 rounded-xl bg-gray-200/70 overflow-x-auto scrollbar-none" role="tablist" aria-label="Factures affichées">
              {FILTERS.map(([key, label]) => {
                const n = loading ? 0 : countOf(key);
                return (
                  <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
                    className={cn('flex-shrink-0 h-10 px-3 sm:px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                      key === 'en_retard' && n > 0 && filter !== key && 'text-danger')}>
                    {label}{key !== 'toutes' && n > 0 && <span className="ml-1 text-gray-500 tabular-nums">{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <ul className="space-y-2.5">{[0, 1, 2, 3].map((i) => <li key={i} className="h-[92px] rounded-2xl bg-white border border-gray-200 animate-pulse" />)}</ul>
          ) : listed.length === 0 ? (
            <div className={cn(cardCls, 'px-6 py-10 text-center')}>
              <p className="font-semibold text-gray-900">{needle ? 'Aucune facture ne correspond' : 'Rien dans cette liste'}</p>
              <p className="text-sm text-gray-600 mt-1">{needle ? 'Essayez un autre nom ou un autre numéro, ou regardez dans « Toutes ».' : filter === 'en_retard' ? 'Aucune facture n’a dépassé son échéance. Bonne nouvelle.' : 'Choisissez un autre filtre pour voir vos factures.'}</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:flex items-center gap-4 px-4 pb-2 text-xs font-medium text-gray-500">
                <span className="w-11" /><span className="flex-1">Client et facture</span>
                <span className="w-36">Statut</span><span className="w-32 text-right">Reste à payer</span><span className="w-36 text-right">Montant TTC</span>
              </div>
              <ul className="space-y-2.5">{listed.map((i) => <InvoiceRow key={i.id} inv={i} today={today} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
