'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, Printer, Receipt, RotateCcw, Save, Send, Trash2, Wallet } from 'lucide-react';
import {
  createCreditNoteDraft, deleteInvoiceDraft, deletePayment, getInvoice, issueInvoice, listInvoices, updateInvoiceDraft,
  type Invoice,
} from '@/server/invoices';
import { invoiceTotals, PAYMENT_METHODS } from '@/lib/invoices';
import { frDate } from '@/lib/invoiceMentions';
import { cn, formatCurrency } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtnDanger } from '@/components/ui/kit';
import InvoiceDocument, { invoiceTitle, type InvoiceDocumentData } from '@/components/factures/InvoiceDocument';
import InvoiceStatusPill from '@/components/factures/InvoiceStatusPill';
import InvoiceDraftForm, { toEditLines, toInvoiceLines, type DraftState } from '@/components/factures/InvoiceDraftForm';
import PaymentModal from '@/components/factures/PaymentModal';

const FAILED = 'L’opération n’a pas abouti. Vérifiez votre connexion et réessayez.';

const draftFrom = (inv: Invoice): DraftState => ({
  lines: toEditLines(inv.lines),
  buyer: { ...inv.buyer },
  serviceDate: inv.service_date ?? '',
  notes: inv.notes ?? '',
});

/** Lignes enregistrables : sans les lignes vides, nombres illisibles ramenés à zéro pour l'aperçu. */
const savedLines = (d: DraftState) => toInvoiceLines(d.lines).filter((l) => l.label);
const previewLines = (d: DraftState) => savedLines(d).map((l) => ({
  ...l,
  quantity: Number.isFinite(l.quantity) ? l.quantity : 0,
  unitPrice: Number.isFinite(l.unitPrice) ? l.unitPrice : 0,
}));

export default function FacturePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'issue' | 'delete' | 'credit'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'issue' | 'delete' | 'credit'>(null);
  const [paying, setPaying] = useState(false);
  /** Avoir qui annule cette facture, s'il existe. */
  const [creditNote, setCreditNote] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    const inv = await getInvoice(id).catch(() => null);
    setInvoice(inv);
    if (inv?.status === 'brouillon') { setDraft(draftFrom(inv)); setDirty(false); }
    if (inv?.quote_id && inv.kind !== 'avoir' && inv.status === 'annulee') {
      const siblings = await listInvoices({ quoteId: inv.quote_id }).catch(() => []);
      setCreditNote(siblings.find((s) => s.credited_invoice_id === inv.id) ?? null);
    } else setCreditNote(null);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Prévenir avant de quitter un brouillon modifié sans l'enregistrer.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const preview: InvoiceDocumentData | null = useMemo(() => {
    if (!invoice) return null;
    if (invoice.status !== 'brouillon' || !draft) return invoice;
    const lines = previewLines(draft);
    const t = invoiceTotals(lines);
    return {
      ...invoice, lines, buyer: draft.buyer, service_date: draft.serviceDate || null, notes: draft.notes || null,
      total_ht: t.ht, total_vat: t.vat, total_ttc: t.ttc, vat_breakdown: t.byRate,
    };
  }, [invoice, draft]);

  const change = (next: DraftState) => { setDraft(next); setDirty(true); setNotice(null); };

  const save = async (): Promise<boolean> => {
    if (!draft) return false;
    setBusy('save'); setError(null);
    const res = await updateInvoiceDraft(id, {
      lines: savedLines(draft), buyer: draft.buyer, serviceDate: draft.serviceDate || null, notes: draft.notes,
    }).catch(() => ({ error: FAILED }));
    setBusy(null);
    if (res.error) { setError(res.error); return false; }
    setDirty(false);
    return true;
  };

  const onSave = async () => {
    if (await save()) { setNotice('Brouillon enregistré.'); await load(); }
  };

  const onIssue = async () => {
    if (dirty && !(await save())) { setConfirm(null); return; }
    setBusy('issue'); setError(null);
    const res = await issueInvoice(id).catch(() => ({ error: FAILED }));
    setBusy(null); setConfirm(null);
    if (res.error) { setError(res.error); return; }
    setNotice(`${invoice?.kind === 'avoir' ? 'Avoir émis' : 'Facture émise'} sous le n° ${'number' in res ? res.number : ''}.`);
    await load();
  };

  const onDelete = async () => {
    setBusy('delete'); setError(null);
    const res = await deleteInvoiceDraft(id).catch(() => ({ error: FAILED }));
    setBusy(null);
    if (res.error) { setConfirm(null); setError(res.error); return; }
    setDirty(false);
    router.push('/factures');
  };

  const onCredit = async () => {
    setBusy('credit'); setError(null);
    const res = await createCreditNoteDraft(id).catch(() => ({ error: FAILED }));
    setBusy(null); setConfirm(null);
    if (res.error) { setError(res.error); return; }
    if ('id' in res) router.push(`/factures/${res.id}`);
  };

  const onDeletePayment = async (paymentId: string, label: string) => {
    if (!window.confirm(`Supprimer le paiement de ${label} ? Le reste à payer sera recalculé.`)) return;
    setError(null);
    const res = await deletePayment(paymentId).catch(() => ({ error: FAILED }));
    if (res.error) { setError(res.error); return; }
    await load();
  };

  if (invoice === undefined) {
    return (
      <div className="px-4 md:px-6 pb-8 space-y-4" aria-busy>
        <div className="h-10 w-64 rounded-xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-[480px] rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    );
  }

  if (invoice === null) {
    return (
      <div className="px-4 md:px-6 pb-8">
        <div className={cn(cardCls, 'px-6 py-12 text-center')}>
          <p className="font-semibold text-gray-900">Cette facture est introuvable</p>
          <p className="text-sm text-gray-600 mt-1">Elle a peut-être été supprimée, ou elle appartient à un autre compte.</p>
          <Link href="/factures" className={cn(btnSecondary, 'mt-5')}><ArrowLeft className="h-4 w-4" />Retour aux factures</Link>
        </div>
      </div>
    );
  }

  const isDraft = invoice.status === 'brouillon';
  const isCredit = invoice.kind === 'avoir';
  const remaining = Math.max(0, Math.round((invoice.total_ttc - invoice.paid) * 100) / 100);
  const canPay = !isCredit && (invoice.status === 'emise' || invoice.status === 'payee_partiellement');
  const canCredit = !isCredit && !isDraft && invoice.status !== 'annulee';
  const late = canPay && !!invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10);
  const quoteLink = invoice.quote_id ? `/devis/${invoice.quote_id}/modifier?mode=weboword` : null;
  const word = isCredit ? 'l’avoir' : 'la facture';

  return (
    <div className="px-4 md:px-6 pb-8">
      {/* En-tête */}
      <Link href="/factures" className="inline-flex items-center gap-1.5 h-10 -ml-1 px-1 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />Factures
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">{invoiceTitle(invoice)}</h1>
            <InvoiceStatusPill kind={invoice.kind} status={invoice.status} />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {(draft?.buyer.name || invoice.buyer.name) ?? 'Client'}
            {invoice.quote_number && <>, devis {invoice.quote_number}</>}
            {preview && <>, <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(preview.total_ttc)} TTC</span></>}
          </p>
        </div>
        {isDraft ? (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={onSave} disabled={!dirty || busy !== null} className={cn(btnSecondary, 'flex-1 sm:flex-none')}>
              {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{dirty ? 'Enregistrer' : 'Enregistré'}
            </button>
            <button onClick={() => { setError(null); setConfirm('issue'); }} disabled={busy !== null} className={cn(btnPrimary, 'flex-1 sm:flex-none')}>
              <Send className="h-4 w-4" />{isCredit ? 'Émettre l’avoir' : 'Émettre la facture'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link href={`/factures/${invoice.id}/imprimer?auto`} target="_blank" className={cn(btnSecondary, 'flex-1 sm:flex-none')}>
              <Printer className="h-4 w-4" />Imprimer / PDF
            </Link>
            {canPay && (
              <button onClick={() => { setError(null); setPaying(true); }} className={cn(btnPrimary, 'flex-1 sm:flex-none')}>
                <Wallet className="h-4 w-4" />Enregistrer un paiement
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}
      {notice && !error && <p role="status" className="mb-4 text-sm text-forest bg-sage-100 rounded-xl px-4 py-3">{notice}</p>}

      {isDraft && draft ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            <InvoiceDraftForm value={draft} onChange={change} />
            <div className={cn(cardCls, 'p-4 sm:p-5')}>
              <p className="text-sm text-gray-600">
                Un brouillon n’a pas de numéro et se modifie librement. À l’émission, {word} reçoit son numéro, vos coordonnées
                sont reprises de Paramètres, et plus rien ne change.
              </p>
              <button onClick={() => { setError(null); setConfirm('delete'); }} disabled={busy !== null} className={cn(btnGhost, 'mt-2 -ml-3 text-danger hover:bg-danger/5')}>
                <Trash2 className="h-4 w-4" />Supprimer le brouillon
              </button>
            </div>
          </div>
          <section aria-label="Aperçu" className="min-w-0 xl:sticky xl:top-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Aperçu</h2>
            <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
              {preview && <InvoiceDocument invoice={preview} />}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <aside className="space-y-4 lg:order-2 min-w-0">
            {/* Où en est le règlement */}
            <section className={cn(cardCls, 'p-4 sm:p-5')} aria-labelledby="pay-title">
              <h2 id="pay-title" className="text-lg font-semibold text-gray-900">{isCredit ? 'Avoir' : 'Règlement'}</h2>
              <dl className="mt-3 space-y-2 text-[15px]">
                <div className="flex justify-between gap-3"><dt className="text-gray-600">Total TTC</dt><dd className="font-display font-bold tabular-nums">{formatCurrency(invoice.total_ttc)}</dd></div>
                {!isCredit && <>
                  <div className="flex justify-between gap-3"><dt className="text-gray-600">Déjà réglé</dt><dd className="tabular-nums">{formatCurrency(invoice.paid)}</dd></div>
                  {invoice.status !== 'annulee' && (
                    <div className="flex justify-between gap-3 pt-2 border-t border-gray-100">
                      <dt className="font-medium text-gray-900">Reste à payer</dt>
                      <dd className={cn('font-display text-lg font-bold tabular-nums', late ? 'text-danger' : 'text-gray-900')}>{formatCurrency(remaining)}</dd>
                    </div>
                  )}
                  {invoice.due_date && canPay && (
                    <p className={cn('text-sm', late ? 'text-danger font-medium' : 'text-gray-500')}>
                      {late ? `Échéance dépassée depuis le ${frDate(invoice.due_date)}.` : `À régler avant le ${frDate(invoice.due_date)}.`}
                    </p>
                  )}
                </>}
              </dl>

              {invoice.payments.length > 0 && (
                <>
                  <h3 className="mt-5 text-sm font-medium text-gray-500">Paiements reçus</h3>
                  <ul className="mt-2 divide-y divide-gray-100">
                    {invoice.payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] text-gray-900"><span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span> <span className="text-gray-600">par {PAYMENT_METHODS[p.method]?.toLowerCase() ?? p.method}</span></p>
                          <p className="text-sm text-gray-500 truncate">Le {frDate(p.paid_on)}{p.note ? `, ${p.note}` : ''}</p>
                        </div>
                        <button onClick={() => onDeletePayment(p.id, formatCurrency(p.amount))} className={iconBtnDanger} aria-label={`Supprimer le paiement de ${formatCurrency(p.amount)} du ${frDate(p.paid_on)}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {canPay && invoice.payments.length === 0 && <p className="mt-4 text-sm text-gray-500">Aucun paiement enregistré pour l’instant.</p>}
            </section>

            {/* Liens et correction */}
            <section className={cn(cardCls, 'p-2')} aria-label="Autres actions">
              {quoteLink && (
                <Link href={quoteLink} className="flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-gray-900 hover:bg-gray-50">
                  <FileText className="h-5 w-5 text-gray-500" />Voir le devis{invoice.quote_number ? ` n° ${invoice.quote_number}` : ''}
                </Link>
              )}
              {isCredit && invoice.credited_invoice_id && (
                <Link href={`/factures/${invoice.credited_invoice_id}`} className="flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-gray-900 hover:bg-gray-50">
                  <Receipt className="h-5 w-5 text-gray-500" />Facture annulée{invoice.credited_invoice_number ? ` n° ${invoice.credited_invoice_number}` : ''}
                </Link>
              )}
              {creditNote && (
                <Link href={`/factures/${creditNote.id}`} className="flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-gray-900 hover:bg-gray-50">
                  <Receipt className="h-5 w-5 text-gray-500" />{creditNote.number ? `Avoir n° ${creditNote.number}` : 'Brouillon d’avoir'}
                </Link>
              )}
              {canCredit && (
                <button onClick={() => { setError(null); setConfirm('credit'); }} disabled={busy !== null}
                  className="w-full flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-gray-900 hover:bg-gray-50 text-left">
                  <RotateCcw className="h-5 w-5 text-gray-500" />Établir un avoir
                </button>
              )}
              {canCredit && <p className="px-3 pb-2 text-sm text-gray-500">Une facture émise ne se modifie pas : pour la corriger ou l’annuler, on établit un avoir.</p>}
            </section>
          </aside>

          <section aria-label="Document" className="lg:order-1 min-w-0">
            <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
              {preview && <InvoiceDocument invoice={preview} />}
            </div>
          </section>
        </div>
      )}

      {/* ── Confirmations ─────────────────────────────────────────────── */}
      {confirm === 'issue' && (
        <Modal title={isCredit ? 'Émettre l’avoir ?' : 'Émettre la facture ?'} onClose={() => busy === null && setConfirm(null)}
          footer={<>
            <button onClick={() => setConfirm(null)} disabled={busy !== null} className={btnGhost}>Pas encore</button>
            <button onClick={onIssue} disabled={busy !== null} className={btnPrimary}>
              {busy !== null && <Loader2 className="h-4 w-4 animate-spin" />}{isCredit ? 'Émettre l’avoir' : 'Émettre la facture'}
            </button>
          </>}>
          <div className="pb-3 space-y-3 text-[15px] text-gray-700">
            <p className="font-semibold text-gray-900">
              {isCredit ? 'Une fois émis, l’avoir reçoit son numéro et ne peut plus être modifié.' : 'Une fois émise, la facture reçoit son numéro et ne peut plus être modifiée.'}
            </p>
            {isCredit && invoice.credited_invoice_number && <p>La facture n° {invoice.credited_invoice_number} sera marquée comme annulée.</p>}
            {preview && <p>Montant : <strong className="tabular-nums">{formatCurrency(preview.total_ttc)} TTC</strong>, pour {preview.buyer.name || 'le client'}.</p>}
            {dirty && <p>Vos dernières modifications seront enregistrées avant.</p>}
          </div>
        </Modal>
      )}

      {confirm === 'delete' && (
        <Modal title="Supprimer ce brouillon ?" onClose={() => busy === null && setConfirm(null)}
          footer={<>
            <button onClick={() => setConfirm(null)} disabled={busy !== null} className={btnGhost}>Garder</button>
            <button onClick={onDelete} disabled={busy !== null} className={cn(btnPrimary, 'bg-danger hover:bg-danger/90')}>
              {busy === 'delete' && <Loader2 className="h-4 w-4 animate-spin" />}Supprimer le brouillon
            </button>
          </>}>
          <p className="pb-3 text-[15px] text-gray-700">Le brouillon n’a pas encore de numéro : le supprimer ne laisse aucun trou dans la numérotation. Vous pourrez en préparer un autre depuis le devis.</p>
        </Modal>
      )}

      {confirm === 'credit' && (
        <Modal title="Établir un avoir ?" onClose={() => busy === null && setConfirm(null)}
          footer={<>
            <button onClick={() => setConfirm(null)} disabled={busy !== null} className={btnGhost}>Annuler</button>
            <button onClick={onCredit} disabled={busy !== null} className={btnPrimary}>
              {busy === 'credit' && <Loader2 className="h-4 w-4 animate-spin" />}Préparer l’avoir
            </button>
          </>}>
          <div className="pb-3 space-y-3 text-[15px] text-gray-700">
            <p>Un brouillon d’avoir va reprendre toutes les lignes de la facture n° {invoice.number}, en négatif.</p>
            <p>Vous pourrez le vérifier avant de l’émettre. C’est à l’émission de l’avoir que la facture sera annulée.</p>
            {invoice.paid > 0 && <p className="text-gray-900 font-medium">Cette facture a déjà reçu {formatCurrency(invoice.paid)} : pensez à rembourser le client ou à reporter ce montant.</p>}
          </div>
        </Modal>
      )}

      {paying && (
        <PaymentModal invoiceId={invoice.id} remaining={remaining} onClose={() => setPaying(false)}
          onSaved={async () => { setPaying(false); setNotice('Paiement enregistré.'); await load(); }} />
      )}
    </div>
  );
}
