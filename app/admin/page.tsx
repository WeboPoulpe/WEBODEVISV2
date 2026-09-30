'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getAdminOverview, type AdminOverview } from '@/server/admin';
import { cardCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { REQUEST_KIND, REQUEST_STATUS } from './labels';

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  useEffect(() => { getAdminOverview().then(setData); }, []);

  const figures: { label: string; value: number | undefined; hint: string; dark?: boolean }[] = [
    { label: 'Demandes à traiter', value: data?.pendingRequests, hint: 'Reçues par le site', dark: true },
    { label: 'Comptes', value: data?.accounts, hint: data ? `${data.activeAccounts} actifs` : ' ' },
    { label: 'Nouveaux comptes', value: data?.newAccounts30d, hint: 'Sur 30 jours' },
    { label: 'Devis créés', value: data?.quotes, hint: data ? `${data.quotes30d} sur 30 jours` : ' ' },
  ];

  return (
    <div className="px-4 md:px-6 pb-8">
      <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight mb-5">Vue d’ensemble</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {figures.map((f) => (
          <div key={f.label} className={cn('rounded-2xl p-4 sm:p-5', f.dark ? 'bg-forest text-white' : 'bg-white border border-gray-200')}>
            <p className={cn('text-sm', f.dark ? 'text-white/70' : 'text-gray-600')}>{f.label}</p>
            {data
              ? <p className="font-display text-[32px] font-bold tabular-nums leading-none mt-4">{f.value}</p>
              : <div className={cn('h-8 w-14 rounded-lg mt-4 animate-pulse', f.dark ? 'bg-white/15' : 'bg-gray-100')} />}
            <p className={cn('text-sm mt-2', f.dark ? 'text-white/60' : 'text-gray-500')}>{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className={cn(cardCls, 'overflow-hidden')}>
          <header className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Dernières demandes</h2>
            <Link href="/admin/demandes" className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">Toutes<ArrowRight className="h-4 w-4" /></Link>
          </header>
          {data && data.recentRequests.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-gray-500">Aucune demande pour le moment. Elles arrivent par le formulaire de contact du site.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(data?.recentRequests ?? []).map((r) => (
                <li key={r.id}>
                  <Link href="/admin/demandes" className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-gray-900 truncate">{r.name}{r.company ? `, ${r.company}` : ''}</span>
                      <span className="block text-sm text-gray-500">{REQUEST_KIND[r.kind] ?? r.kind}, le {day(r.created_at)}</span>
                    </span>
                    <span className={cn(pill, REQUEST_STATUS[r.status]?.cls)}>{REQUEST_STATUS[r.status]?.label ?? r.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn(cardCls, 'overflow-hidden')}>
          <header className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Derniers comptes</h2>
            <Link href="/admin/comptes" className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">Tous<ArrowRight className="h-4 w-4" /></Link>
          </header>
          <ul className="divide-y divide-gray-100">
            {(data?.recentAccounts ?? []).map((a) => (
              <li key={a.id}>
                <Link href={`/admin/comptes?compte=${a.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-gray-900 truncate">{a.name}</span>
                    <span className="block text-sm text-gray-500 truncate">{a.email}</span>
                  </span>
                  <span className="text-sm text-gray-500 whitespace-nowrap">{day(a.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
