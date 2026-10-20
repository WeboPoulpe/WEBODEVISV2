'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { ACCOUNTING_ACCOUNTS, PERIOD_LABELS, periodDates, type PeriodPreset } from '@/lib/accountingExport';
import { frDate } from '@/lib/invoiceMentions';
import { cn } from '@/lib/utils';

type Format = 'csv' | 'fec';
type Content = 'factures' | 'paiements';
type Choice = PeriodPreset | 'libre';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const chip = (on: boolean) => cn('h-10 px-3.5 rounded-xl border text-sm font-medium transition-colors',
  on ? 'bg-primary-100 border-primary-200 text-primary' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300');

function Choices<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(([key, text]) => (
          <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)} className={chip(value === key)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

/** Nom du fichier annoncé par le serveur (Content-Disposition). */
const fileNameOf = (res: Response, fallback: string) => /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallback;

// Export pour le comptable : factures et avoirs ou paiements en CSV (Excel), ou tout au format FEC.
export default function AccountingExportModal({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState<Choice>('mois_precedent');
  const [custom, setCustom] = useState(() => periodDates('mois', todayIso()));
  const [format, setFormat] = useState<Format>('csv');
  const [content, setContent] = useState<Content>('factures');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const { from, to } = choice === 'libre' ? custom : periodDates(choice, todayIso());
  const invalid = !from || !to || from > to;

  const download = async () => {
    if (invalid) { setError('Choisissez une date de début avant la date de fin.'); return; }
    setBusy(true); setError(null); setDone(null);
    try {
      const params = new URLSearchParams({ format, from, to, type: content });
      const res = await fetch(`/api/factures/export?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setError(body?.error ?? 'L’export n’a pas pu être préparé. Réessayez dans un instant.');
        return;
      }
      const count = Number(res.headers.get('X-Export-Count') ?? 0);
      const sirenMissing = res.headers.has('X-Siren-Manquant');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = fileNameOf(res, format === 'fec' ? 'FEC.txt' : 'export.csv');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const what = format === 'fec' ? (count > 1 ? `${count} écritures` : `${count} écriture`)
        : content === 'paiements' ? (count > 1 ? `${count} paiements` : `${count} paiement`)
        : (count > 1 ? `${count} factures et avoirs` : `${count} facture ou avoir`);
      setDone(count === 0
        ? 'Fichier téléchargé, mais rien sur cette période : vérifiez les dates.'
        : `Fichier téléchargé : ${what} du ${frDate(from)} au ${frDate(to)}.${sirenMissing ? ' Votre SIRET n’est pas renseigné dans Paramètres : remplacez « SIREN » au début du nom du fichier par votre n° SIREN.' : ''}`);
    } catch {
      setError('L’export n’a pas pu être préparé. Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const a = ACCOUNTING_ACCOUNTS;
  return (
    <Modal title="Export comptable" onClose={onClose} wide
      footer={<>
        <button onClick={onClose} className={btnGhost}>Fermer</button>
        <button onClick={download} disabled={busy || invalid} className={btnPrimary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Télécharger
        </button>
      </>}>
      <div className="space-y-5 pb-3">
        {error && <p role="alert" className={errorCls}>{error}</p>}
        {done && <p role="status" className="text-sm text-gray-800 bg-sage-100 rounded-xl px-4 py-3">{done}</p>}

        <div>
          <Choices label="Période" value={choice} onChange={(v) => { setChoice(v); setDone(null); }}
            options={(Object.keys(PERIOD_LABELS) as Choice[]).map((k) => [k, PERIOD_LABELS[k]])} />
          {choice === 'libre' ? (
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 mt-3">
              <div>
                <label htmlFor="exp-from" className={labelCls}>Du</label>
                <input id="exp-from" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label htmlFor="exp-to" className={labelCls}>Au</label>
                <input id="exp-to" type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className={inputCls} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 mt-2">Du {frDate(from)} au {frDate(to)} inclus.</p>
          )}
        </div>

        <Choices label="Format" value={format} onChange={(v) => { setFormat(v); setDone(null); }}
          options={[['csv', 'CSV (Excel)'], ['fec', 'FEC']]} />

        {format === 'csv' ? (
          <>
            <Choices label="Contenu" value={content} onChange={(v) => { setContent(v); setDone(null); }}
              options={[['factures', 'Factures et avoirs'], ['paiements', 'Paiements']]} />
            <p className="text-sm text-gray-600">
              {content === 'factures'
                ? 'Une ligne par facture ou avoir émis sur la période : date, numéro, client, montants HT et TVA par taux, TTC, statut, réglé et reste à payer, facture d’origine d’un avoir, n° de devis. Les brouillons ne sont pas exportés.'
                : 'Une ligne par paiement reçu sur la période : date, montant, moyen de paiement, facture et client.'}
              {' '}Le fichier s’ouvre directement dans Excel.
            </p>
          </>
        ) : (
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              Le fichier des écritures comptables, au format officiel, que votre comptable importe dans son logiciel.
              Il contient les factures et avoirs émis sur la période (journal des ventes {a.salesJournal.code}) et les paiements reçus (journal de banque {a.bankJournal.code}).
            </p>
            <p>Comptes utilisés, à ajuster par votre comptable à l’import si les siens sont différents :</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Clients : {a.customers.num}, avec un compte par client (C + nom)</li>
              <li>Prestations : {a.sales[20]} (TVA 20 %), {a.sales[10]} (10 %), {a.sales[5.5]} (5,5 %), {a.sales[0]} (sans TVA)</li>
              <li>TVA collectée : {a.vat[20]} (20 %), {a.vat[10]} (10 %), {a.vat[5.5]} (5,5 %)</li>
              <li>Banque : {a.bank.num}</li>
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
