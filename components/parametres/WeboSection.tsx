'use client';

// Paramètres : le solde de WeboCoins (lien vers « Mes WeboCoins ») et le mode de traduction des prestations de
// l'entreprise : gratuite (MyMemory) ou par Webo, 1 pièce la fiche.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import WeboCoin from '@/components/webo/WeboCoin';
import { useWallet } from '@/components/webo/WalletContext';
import { setTranslationMode } from '@/server/weboWalletActions';
import { deleteWeboMemory, listWeboMemories } from '@/server/webo/memory';

const MODES = [
  { value: 'webo' as const, label: 'Webo', hint: '1 WeboCoin la fiche · fiche entière, mise en forme gardée, vocabulaire de cuisine' },
  { value: 'free' as const, label: 'Gratuite', hint: 'Service gratuit, phrase par phrase · des morceaux peuvent rester en français' },
];

export default function WeboSection() {
  const { wallet, refresh } = useWallet();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [memories, setMemories] = useState<{ id: string; text: string }[] | null>(null);
  useEffect(() => { listWeboMemories().then(setMemories).catch(() => setMemories([])); }, []);
  const forget = async (id: string) => {
    const res = await deleteWeboMemory(id).catch(() => ({ error: 'Pas effacée. Réessayez.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    setMemories((m) => (m ?? []).filter((x) => x.id !== id));
  };

  const choose = async (mode: 'webo' | 'free') => {
    if (!wallet || wallet.mode === mode) return;
    setBusy(true);
    const res = await setTranslationMode(mode).catch(() => ({ error: 'Le réglage n’a pas pu être enregistré.' }));
    setBusy(false);
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    await refresh();
  };

  return (
    <section aria-labelledby="webo-title" className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><WeboCoin size={16} /></div>
        <div>
          <h2 id="webo-title" className="font-semibold text-gray-900 text-sm">Webo et WeboCoins</h2>
          <p className="text-xs text-gray-400">Webo, l’IA de WeboDevis, se paie en WeboCoins : 200 offerts chaque mois</p>
        </div>
      </div>
      <div className="p-6 space-y-5">
        <Link href="/parametres/webocoins" className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-gray-300">
          <WeboCoin size={22} />
          <span className="flex-1 text-sm text-gray-800">
            {wallet ? <><strong className="tabular-nums">{new Intl.NumberFormat('fr-FR').format(wallet.total)}</strong> WeboCoins</> : 'Mes WeboCoins'}
          </span>
          <span className="text-sm text-primary">Mes WeboCoins</span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Traduction des prestations en anglais</p>
          <div role="group" aria-label="Traduction des prestations" className="grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => {
              const on = wallet?.mode === m.value;
              return (
                <button key={m.value} type="button" aria-pressed={on} disabled={busy || !wallet} onClick={() => choose(m.value)}
                  className={cn('rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60',
                    on ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300')}>
                  <span className={cn('flex items-center gap-1.5 text-sm font-semibold', on ? 'text-primary' : 'text-gray-900')}>
                    {m.value === 'webo' && <WeboCoin size={14} />}{m.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">{m.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">Vous pourrez toujours changer au moment de traduire. Sans assez de WeboCoins, la traduction se fait en gratuit.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Ce que Webo retient</p>
          {memories === null ? null : memories.length === 0 ? (
            <p className="text-sm text-gray-500">Rien pour l’instant. Quand vous lui dites une habitude (« acompte toujours à 40 % »), Webo vous propose de la retenir.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" aria-label="Ce que Webo retient">
              {memories.map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-gray-800">{m.text}</span>
                  <button type="button" onClick={() => forget(m.id)} aria-label={`Oublier « ${m.text} »`} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
