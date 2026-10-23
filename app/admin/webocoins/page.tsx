'use client';

// Admin des WeboCoins : les comptes d'un mois (pièces dépensées, coût réel chez Anthropic, valeur, marge), les
// entreprises (solde, dépense, allocation propre, pièces offertes, historique) et les réglages.

import { useCallback, useEffect, useState } from 'react';
import { Gift, Loader2, ScrollText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { monthKeyParis } from '@/lib/webocoins';
import WeboCoin from '@/components/webo/WeboCoin';
import {
  adminGetWeboSettings, adminGiftCoins, adminLedger, adminSetMonthlyOverride, adminSetWeboSettings, weboStats,
  type WeboCompanyStats, type WeboStats,
} from '@/server/adminWebo';
import type { WeboSettings } from '@/server/settings';
import type { LedgerRow } from '@/server/weboWallet';

const nf = new Intl.NumberFormat('fr-FR');
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

/** Les douze derniers mois, le plus récent d'abord. */
function lastMonths(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => monthKeyParis(new Date(now.getFullYear(), now.getMonth() - i, 15)));
}
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

const SETTING_FIELDS: { key: keyof WeboSettings; label: string; hint: string; step?: number }[] = [
  { key: 'monthlyCoins', label: 'Pièces offertes chaque mois', hint: 'Par entreprise, sauf réglage propre au compte' },
  { key: 'translationPrice', label: 'Prix d’une fiche traduite', hint: 'En pièces' },
  { key: 'actionCoefficient', label: 'Coefficient des actions au coût', hint: 'Coût réel × coefficient (assistant, plus tard)', step: 0.1 },
  { key: 'translationCap', label: 'Traductions Webo par mois', hint: 'Au plus, par entreprise' },
  { key: 'lowBalance', label: 'Alerte de solde bas', hint: 'En dessous, la pastille passe en terracotta' },
  { key: 'usdEur', label: 'Taux dollar → euro', hint: 'Pour les comptes de cette page', step: 0.01 },
];

export default function AdminWeboCoinsPage() {
  const { notify } = useFeedback();
  const months = lastMonths();
  const [month, setMonth] = useState(months[0]);
  const [stats, setStats] = useState<WeboStats | null>(null);
  const [settings, setSettings] = useState<WeboSettings | null>(null);
  const [gifting, setGifting] = useState<WeboCompanyStats | null>(null);
  const [history, setHistory] = useState<{ company: WeboCompanyStats; rows: LedgerRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setStats(await weboStats(month)); } catch { setError('Les comptes n’ont pas pu être chargés.'); }
  }, [month]);
  useEffect(() => { setStats(null); void load(); }, [load]);
  useEffect(() => { adminGetWeboSettings().then(setSettings).catch(() => setError('Les réglages n’ont pas pu être chargés.')); }, []);

  const saveSetting = async (key: keyof WeboSettings, value: number) => {
    const res = await adminSetWeboSettings({ [key]: value }).catch(() => ({ error: 'Le réglage n’a pas été enregistré.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    setSettings(await adminGetWeboSettings());
    notify('Réglage enregistré.', { tone: 'success' });
  };
  const saveOverride = async (c: WeboCompanyStats, raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value === c.override) return;
    const res = await adminSetMonthlyOverride(c.companyId, value).catch(() => ({ error: 'Le réglage n’a pas été enregistré.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    notify('Allocation mise à jour : elle s’applique au prochain mois.', { tone: 'success' });
    void load();
  };

  return (
    <div className="px-4 md:px-6 pb-8 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <h1 className="flex items-center gap-2 text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight"><WeboCoin size={30} /> WeboCoins</h1>
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois" className={cn(inputCls, 'w-auto h-11 capitalize')}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      {!stats ? (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Pièces dépensées', `${nf.format(stats.spentCoins)} W`, `${nf.format(stats.spentFromMonth)} du mois · ${nf.format(stats.spentFromKept)} gardées`],
              ['Coût réel', eur(stats.costEur), usd(stats.costUsd)],
              ['Valeur des pièces', eur(stats.valueEur), '1 pièce = 1 centime'],
              ['Marge théorique', eur(stats.marginEur), 'Pièces encore toutes offertes'],
            ].map(([label, value, hint]) => (
              <div key={label} className={cn(cardCls, 'p-4')}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
                <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Entreprises</h2>
          <div className={cn(cardCls, 'overflow-x-auto')}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 font-semibold">Entreprise</th>
                  <th className="px-4 py-3 font-semibold text-right">Solde</th>
                  <th className="px-4 py-3 font-semibold text-right">Dépensé</th>
                  <th className="px-4 py-3 font-semibold text-right">Coût réel</th>
                  <th className="px-4 py-3 font-semibold">Pièces par mois</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.companies.map((c) => (
                  <tr key={c.companyId}>
                    <td className="px-4 py-2.5 text-gray-900">{c.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(c.balance)} W</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(c.spent)} W</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{usd(c.costUsd)}</td>
                    <td className="px-4 py-2.5">
                      <input type="number" min={0} defaultValue={c.override ?? ''} placeholder={settings ? `${settings.monthlyCoins} (général)` : ''}
                        aria-label={`Pièces par mois pour ${c.name}`} onBlur={(e) => saveOverride(c, e.target.value)}
                        className="h-9 w-36 rounded-lg border border-gray-200 px-2 text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setGifting(c)} aria-label={`Offrir des pièces à ${c.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary"><Gift className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Historique de ${c.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary"
                          onClick={async () => setHistory({ company: c, rows: (await adminLedger(c.companyId, 0)).rows })}><ScrollText className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Réglages</h2>
      <section className={cn(cardCls, 'grid gap-4 p-5 sm:grid-cols-2')}>
        {!settings ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : SETTING_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className={labelCls}>{f.label}</span>
            <input type="number" min={0} step={f.step ?? 1} defaultValue={settings[f.key]} key={`${f.key}-${settings[f.key]}`}
              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== settings[f.key]) void saveSetting(f.key, v); }}
              className={cn(inputCls, 'h-11')} />
            <span className="mt-1 block text-xs text-gray-500">{f.hint}</span>
          </label>
        ))}
      </section>

      {gifting && <GiftModal company={gifting} onClose={() => setGifting(null)} onDone={() => { setGifting(null); void load(); }} />}
      {history && (
        <Modal title={`Historique · ${history.company.name}`} onClose={() => setHistory(null)} wide>
          {history.rows.length === 0 ? <p className="text-sm text-gray-500">Aucun mouvement.</p> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {history.rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{r.reason}</span>
                  <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
                  <span className="w-16 text-right font-semibold tabular-nums">{r.coins > 0 ? '+' : '−'}{nf.format(Math.abs(r.coins))} W</span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}

function GiftModal({ company, onClose, onDone }: { company: WeboCompanyStats; onClose: () => void; onDone: () => void }) {
  const { notify } = useFeedback();
  const [coins, setCoins] = useState('100');
  const [reason, setReason] = useState('Geste commercial');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const res = await adminGiftCoins(company.companyId, Number(coins), reason).catch(() => ({ error: 'Les pièces n’ont pas pu être offertes.' }));
    setBusy(false);
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    notify(`${coins} WeboCoins offerts à ${company.name}.`, { tone: 'success' });
    onDone();
  };
  return (
    <Modal title={`Offrir des pièces à ${company.name}`} onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
        <button type="button" onClick={submit} disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Offrir</button>
      </>}>
      <div className="space-y-4">
        <label className="block">
          <span className={labelCls}>Nombre de pièces</span>
          <input type="number" min={1} max={100000} value={coins} onChange={(e) => setCoins(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Motif (visible dans l’historique du traiteur)</span>
          <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </label>
        <p className="text-xs text-gray-500">Pièces gardées : elles ne périment pas, et passent après les pièces du mois.</p>
      </div>
    </Modal>
  );
}
