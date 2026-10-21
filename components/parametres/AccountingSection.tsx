'use client';

// Paramètres : numéros de comptes et journaux de l'export comptable FEC (page Factures > Export comptable).

import { useEffect, useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { btnGhost, btnPrimary, errorCls } from '@/components/ui/kit';
import {
  ACCOUNT_RATES, ACCOUNTING_ACCOUNTS, accountRateLabel, accountsError, isDefaultAccounts, VAT_ACCOUNT_RATES,
  type AccountingAccounts, type AccountRate, type Journal, type VatAccountRate,
} from '@/lib/accountingExport';
import { getAccountingSettings, saveAccountingSettings, type AccountingSettings } from '@/server/accountingSettings';
import { cn } from '@/lib/utils';

const fieldCls = 'w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 tabular-nums focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500';

function AccountField({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <input id={id} value={value} inputMode="numeric" maxLength={12} disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} className={cn(fieldCls, 'w-32 sm:w-36 flex-shrink-0 font-mono')} />
    </label>
  );
}

function JournalField({ label, value, onChange, disabled }: { label: string; value: Journal; onChange: (j: Journal) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2 items-center">
      <input aria-label={`${label} : code`} value={value.code} maxLength={6} disabled={disabled}
        onChange={(e) => onChange({ ...value, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} className={cn(fieldCls, 'font-mono')} />
      <input aria-label={`${label} : libellé`} value={value.label} maxLength={60} disabled={disabled}
        onChange={(e) => onChange({ ...value, label: e.target.value })} className={fieldCls} />
    </div>
  );
}

export default function AccountingSection() {
  const [settings, setSettings] = useState<AccountingSettings | null>(null);
  const [a, setA] = useState<AccountingAccounts>(ACCOUNTING_ACCOUNTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    getAccountingSettings()
      .then((s) => {
        setSettings(s); setA(s.accounts);
        // Lien « Paramètres, Comptabilité » de la fenêtre d'export : la section arrive après le chargement.
        if (window.location.hash === '#comptabilite') requestAnimationFrame(() => document.getElementById('comptabilite')?.scrollIntoView({ block: 'start' }));
      })
      .catch(() => setError('Les comptes n’ont pas pu être chargés. Rechargez la page.'));
  }, []);

  const locked = !!settings && !settings.canEdit;
  const changed = !!settings && JSON.stringify(a) !== JSON.stringify(settings.accounts);
  const edit = (patch: Partial<AccountingAccounts>) => { setA((cur) => ({ ...cur, ...patch })); setDone(null); setError(null); };

  const save = async (reset: boolean) => {
    if (!reset) {
      const problem = accountsError(a);
      if (problem) { setError(problem); return; }
    }
    setBusy(true); setError(null); setDone(null);
    try {
      const res = await saveAccountingSettings(reset ? null : a);
      if (res.error || !res.accounts) { setError(res.error ?? 'Les comptes n’ont pas pu être enregistrés.'); return; }
      const accounts = res.accounts;
      setA(accounts);
      setSettings((s) => (s ? { ...s, accounts, isDefault: isDefaultAccounts(accounts) } : s));
      setDone(reset ? 'Comptes standards rétablis.' : 'Enregistré. Les prochains exports FEC utiliseront ces comptes.');
    } catch {
      setError('Les comptes n’ont pas pu être enregistrés. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="comptabilite" aria-labelledby="accounting-title" className="bg-white border border-gray-200 rounded-2xl overflow-hidden scroll-mt-24">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><Calculator className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 id="accounting-title" className="font-semibold text-gray-900 text-sm">Comptabilité</h2>
          <p className="text-xs text-gray-400">Numéros de comptes et journaux de l’export FEC, à reprendre de votre comptable</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {!settings && !error ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" /> : settings && (
          <>
            <p className="text-sm text-gray-600">
              Par défaut, l’export utilise les comptes standards du plan comptable. Si votre comptable en utilise d’autres,
              recopiez-les ici : chiffres uniquement, sans espace.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
              <fieldset className="space-y-2.5">
                <legend className="text-sm font-semibold text-gray-900 mb-2">Prestations vendues (classe 7)</legend>
                {ACCOUNT_RATES.map((r: AccountRate) => (
                  <AccountField key={r} id={`acc-sales-${r}`} label={r === '0' ? 'Sans TVA' : r === 'autre' ? 'Autre taux' : accountRateLabel(r)}
                    value={a.sales[r]} disabled={locked} onChange={(v) => edit({ sales: { ...a.sales, [r]: v } })} />
                ))}
              </fieldset>

              <fieldset className="space-y-2.5">
                <legend className="text-sm font-semibold text-gray-900 mb-2">TVA collectée (classe 4)</legend>
                {VAT_ACCOUNT_RATES.map((r: VatAccountRate) => (
                  <AccountField key={r} id={`acc-vat-${r}`} label={r === 'autre' ? 'Autre taux' : accountRateLabel(r)}
                    value={a.vat[r]} disabled={locked} onChange={(v) => edit({ vat: { ...a.vat, [r]: v } })} />
                ))}
              </fieldset>

              <fieldset className="space-y-2.5">
                <legend className="text-sm font-semibold text-gray-900 mb-2">Clients et encaissements</legend>
                <AccountField id="acc-customers" label="Clients" value={a.customers} disabled={locked} onChange={(v) => edit({ customers: v })} />
                <AccountField id="acc-bank" label="Banque" value={a.bank} disabled={locked} onChange={(v) => edit({ bank: v })} />
                <AccountField id="acc-cash" label="Caisse (espèces)" value={a.cash} disabled={locked} onChange={(v) => edit({ cash: v })} />
                <label className="flex items-start justify-between gap-4 cursor-pointer pt-2">
                  <span className="text-sm text-gray-700">
                    <span className="block font-medium text-gray-900">Un compte auxiliaire par client</span>
                    Chaque client a son sous-compte (C + son nom), pour suivre ce qu’il doit.
                  </span>
                  <input type="checkbox" role="switch" checked={a.auxPerCustomer} disabled={locked}
                    onChange={(e) => edit({ auxPerCustomer: e.target.checked })} className="sr-only peer" />
                  <span aria-hidden className="relative shrink-0 mt-0.5 w-11 h-6 rounded-full bg-gray-200 peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary-100 peer-disabled:opacity-50 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
                </label>
              </fieldset>

              <fieldset className="space-y-2.5">
                <legend className="text-sm font-semibold text-gray-900 mb-2">Journaux (code et libellé)</legend>
                <JournalField label="Ventes" value={a.salesJournal} disabled={locked} onChange={(j) => edit({ salesJournal: j })} />
                <JournalField label="Banque" value={a.bankJournal} disabled={locked} onChange={(j) => edit({ bankJournal: j })} />
                <JournalField label="Caisse" value={a.cashJournal} disabled={locked} onChange={(j) => edit({ cashJournal: j })} />
                <p className="text-xs text-gray-500">Les paiements en espèces vont au journal de caisse ; les autres au journal de banque.</p>
              </fieldset>
            </div>

            {locked ? (
              <p className="text-sm text-gray-400">Ce réglage est celui de votre entreprise : seul son titulaire ou un gérant peut le changer.</p>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {done && <p role="status" className="text-sm text-forest mr-auto">{done}</p>}
                <button onClick={() => save(true)} disabled={busy || (settings.isDefault && isDefaultAccounts(a))} className={btnGhost}>Revenir aux comptes standards</button>
                <button onClick={() => save(false)} disabled={busy || !changed} className={btnPrimary}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
                </button>
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>
    </section>
  );
}
