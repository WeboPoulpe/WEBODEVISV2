'use client';

// Lecture d'une brochure du Studio, page par page : combien de lecteurs ont vu chaque page, combien de temps en
// moyenne, et jusqu'où ils vont (par rapport à la couverture). Les lectures faites par l'entreprise ne comptent pas.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnSecondary } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import type { ResolvedStudioPage } from '@/lib/brochureStudio';
import { getBrochurePageStats, resetBrochurePageStats } from '@/server/brochures';
import { PageThumb } from './StudioPanels';

const secs = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);

export default function StudioStats({ brochureId, pages, language, onClose }: { brochureId: string; pages: ResolvedStudioPage[]; language: 'fr' | 'en'; onClose: () => void }) {
  const { confirm, notify } = useFeedback();
  const [rows, setRows] = useState<{ pageId: string; views: number; ms: number }[] | null>(null);
  useEffect(() => {
    let alive = true;
    getBrochurePageStats(brochureId).then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [brochureId]);
  // Chaque page garde sa lecture même déplacée : elle est repérée par son identifiant.
  const byPage = new Map((rows ?? []).map((r) => [r.pageId, r]));
  const first = byPage.get(pages[0]?.id ?? '')?.views ?? 0;
  const max = Math.max(1, ...(rows ?? []).map((r) => r.views));
  const total = (rows ?? []).reduce((t, r) => t + r.ms, 0);
  const reset = async () => {
    if (!(await confirm({ title: 'Remettre la lecture à zéro ?', message: 'Les chiffres repartent de zéro, par exemple après un nouvel envoi.', confirmLabel: 'Remettre à zéro', danger: true }))) return;
    const r = await resetBrochurePageStats(brochureId);
    if (r.error) notify(r.error, { tone: 'error' }); else setRows([]);
  };
  return (
    <Modal title="Lecture page par page" onClose={onClose} wide
      footer={<>{rows?.length ? <button type="button" onClick={reset} className={btnSecondary}>Remettre à zéro</button> : null}<button type="button" onClick={onClose} className={btnSecondary}>Fermer</button></>}>
      {rows === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">Pas encore de lecture. Les chiffres apparaissent dès qu’un lecteur ouvre le lien (vos propres aperçus ne comptent pas).</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-600">Temps de lecture total : <strong>{secs(total)}</strong>. « Atteinte » : part des lecteurs de la couverture arrivés jusqu’à la page.</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-500"><th className="py-1 font-semibold">Page</th><th className="font-semibold">Vues</th><th className="font-semibold">Temps moyen</th><th className="font-semibold">Atteinte</th></tr></thead>
            <tbody>
              {pages.map((page, i) => {
                const r = byPage.get(page.id);
                const views = r?.views ?? 0;
                return (
                  <tr key={page.id} className="border-t border-gray-100">
                    <td className="py-1.5 pr-2 text-gray-700">
                      <span className="flex items-center gap-2">
                        <span className="block w-7 overflow-hidden rounded-sm ring-1 ring-gray-200"><PageThumb page={page} language={language} /></span>
                        {page.form ? 'Formulaire' : i + 1}
                      </span>
                    </td>
                    <td className="w-1/3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 rounded-full bg-primary" style={{ width: `${(views / max) * 100}%`, minWidth: views ? 4 : 0 }} />
                        <span className="tabular-nums text-gray-700">{views}</span>
                      </div>
                    </td>
                    <td className="tabular-nums text-gray-700">{views ? secs((r?.ms ?? 0) / views) : '—'}</td>
                    <td className="tabular-nums text-gray-700">{first ? `${Math.min(100, Math.round((views / first) * 100))} %` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">Une page déplacée garde ses chiffres ; une page ajoutée part de zéro.</p>
        </>
      )}
    </Modal>
  );
}
