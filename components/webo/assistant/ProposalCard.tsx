'use client';

// Carte d'une action proposée par Webo : récapitulatif, puis Valider / Modifier / Annuler. Seul « Valider » écrit.

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import { useWallet } from '@/components/webo/WalletContext';
import { decideProposal } from '@/server/webo/execute';
import type { ProposalView } from '@/server/webo/chat';

export default function ProposalCard({ proposal, onModify, onChange }: {
  proposal: ProposalView;
  /** « Modifier » : le traiteur dit à Webo ce qu'il faut changer. */
  onModify: (title: string) => void;
  onChange: (next: ProposalView) => void;
}) {
  const { notify } = useFeedback();
  const { refresh } = useWallet();
  const [busy, setBusy] = useState<'accept' | 'cancel' | null>(null);
  const { summary } = proposal;
  const titleId = `proposal-${proposal.id}`;

  const decide = async (decision: 'accept' | 'cancel') => {
    setBusy(decision);
    const res = await decideProposal(proposal.id, decision).catch(() => ({ error: 'L’action n’a pas pu être faite. Vérifiez votre connexion.' }));
    setBusy(null);
    if (res.error) {
      notify(res.error, { tone: 'error' });
      if (decision === 'accept') onChange({ ...proposal, status: 'failed', result: { error: res.error } });
      return;
    }
    onChange({ ...proposal, status: decision === 'accept' ? 'done' : 'cancelled', result: 'result' in res && res.result ? res.result : null });
    if (decision === 'accept') void refresh();
  };

  return (
    <article aria-labelledby={titleId} className="mt-2 rounded-xl border border-[#E6DFD3] bg-white p-3 text-sm shadow-sm">
      <h3 id={titleId} className="font-semibold text-gray-900">{summary.title}</h3>
      <dl className="mt-2 space-y-1">
        {summary.fields.map((f) => (
          <div key={f.label} className="flex gap-2">
            <dt className="w-24 flex-shrink-0 text-gray-500">{f.label}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-line break-words text-gray-900">{f.value}</dd>
          </div>
        ))}
      </dl>
      {summary.lines && summary.lines.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 border-y border-gray-100">
          {summary.lines.map((l, i) => (
            <li key={i} className="flex items-baseline gap-2 py-1.5">
              <span className="min-w-0 flex-1"><span className="text-gray-900">{l.label}</span><span className="block text-xs text-gray-500">{l.detail}</span></span>
              <span className="tabular-nums text-gray-900">{l.amount}</span>
            </li>
          ))}
        </ul>
      )}
      {summary.total && <p className="mt-2 text-right font-semibold text-gray-900">{summary.total}</p>}
      {summary.note && <p className="mt-2 text-xs text-gray-500">{summary.note}</p>}

      <div className="mt-3">
        {proposal.status === 'proposed' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={() => decide('accept')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
              {busy === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider
            </button>
            <button type="button" disabled={!!busy} onClick={() => onModify(summary.title)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 font-medium text-gray-800 hover:border-gray-300 disabled:opacity-50">Modifier</button>
            <button type="button" disabled={!!busy} onClick={() => decide('cancel')}
              className="h-9 rounded-lg px-3 font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50">Annuler</button>
          </div>
        )}
        {proposal.status === 'done' && (
          <p className="flex flex-wrap items-center gap-2 font-medium text-forest">
            <Check className="h-4 w-4" /> Fait
            {proposal.result?.href && <Link href={proposal.result.href} className="text-primary underline underline-offset-2">{proposal.result.label ?? 'Ouvrir'}</Link>}
          </p>
        )}
        {proposal.status === 'cancelled' && <p className="flex items-center gap-1.5 text-gray-500"><X className="h-4 w-4" /> Annulée</p>}
        {proposal.status === 'failed' && <p className={cn('text-danger')}>Pas fait : {proposal.result?.error ?? 'erreur'}</p>}
      </div>
    </article>
  );
}
