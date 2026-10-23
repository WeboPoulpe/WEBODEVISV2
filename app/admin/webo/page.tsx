'use client';

// Admin : les réponses de Webo notées 👎 par les traiteurs, avec la question posée, pour améliorer les consignes.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cardCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { adminWeboDownvotes, type Downvote } from '@/server/webo/admin';

export default function AdminWeboPage() {
  const [rows, setRows] = useState<Downvote[] | null>(null);
  useEffect(() => { adminWeboDownvotes().then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="px-4 md:px-6 pb-8 max-w-4xl">
      <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight mb-1">Webo</h1>
      <p className="text-sm text-gray-500 mb-5">Les réponses notées « à revoir » par les traiteurs, les plus récentes d’abord. Elles servent à corriger les consignes de Webo et à enrichir ses tests (scripts/webo-eval.ts).</p>
      {rows === null ? <div className="flex justify-center py-10 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : rows.length === 0 ? <p className={cn(cardCls, 'p-5 text-sm text-gray-500')}>Aucune réponse notée à revoir pour l’instant.</p>
        : (
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={`${r.conversationId}-${i}`} className={cn(cardCls, 'p-4 text-sm')}>
                <p className="text-xs text-gray-500">{r.company} · {new Date(r.at).toLocaleString('fr-FR')}{r.agent ? ` · ${r.agent}` : ''}</p>
                <p className="mt-2 text-gray-900"><span className="font-semibold">Question :</span> {r.question}</p>
                <p className="mt-1 whitespace-pre-line text-gray-700"><span className="font-semibold text-gray-900">Webo :</span> {r.answer}</p>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
