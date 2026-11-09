'use client';

// Les pages du Studio en images, pour Instagram (publication 4:5, story 9:16, carré) ou en page entière. Chaque
// image est fabriquée dans le navigateur à partir de la page telle qu'elle s'affiche (html-to-image) : la page est
// posée au centre, le fond de la page (ou sa photo pleine page, floutée) remplit le reste.

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import type { ResolvedStudioPage } from '@/lib/brochureStudio';
import { FramedPhoto } from '../PhotoText';
import { backdropOf } from './StudioBook';
import { StudioPageView } from './StudioPage';
import { PageThumb } from './StudioPanels';

const FORMATS = [
  { id: 'post', label: 'Publication 4:5', w: 1080, h: 1350 },
  { id: 'story', label: 'Story 9:16', w: 1080, h: 1920 },
  { id: 'square', label: 'Carré 1:1', w: 1080, h: 1080 },
  { id: 'page', label: 'Page entière', w: 1080, h: 1527 },
] as const;
type Format = (typeof FORMATS)[number];

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brochure';

/** Une page posée dans le format choisi, à la taille réelle de l'image (hors écran). */
function Frame({ page, format, language }: { page: ResolvedStudioPage; format: Format; language: 'fr' | 'en' }) {
  const pw = Math.min(format.w, format.h / 1.414);
  const backdrop = backdropOf(page);
  return (
    <div style={{ width: format.w, height: format.h, background: page.bg, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {backdrop && (
        <div style={{ position: 'absolute', inset: 0, filter: 'blur(28px) brightness(.85)', transform: 'scale(1.15)', opacity: backdrop.opacity / 100 }}>
          <FramedPhoto url={backdrop.url} frame={backdrop.frame} />
        </div>
      )}
      <div style={{ position: 'relative', width: pw, height: pw * 1.414, containerType: 'inline-size' }}>
        <StudioPageView page={page} language={language} />
      </div>
    </div>
  );
}

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

/** Attend que polices et photos soient chargées dans un nœud. */
async function ready(node: HTMLElement) {
  await document.fonts?.ready;
  await Promise.all([...node.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  await new Promise((r) => setTimeout(r, 150));
}

export default function InstagramExport({ pages, name, language, onClose }: { pages: ResolvedStudioPage[]; name: string; language: 'fr' | 'en'; onClose: () => void }) {
  const { notify } = useFeedback();
  const [format, setFormat] = useState<Format>(FORMATS[0]);
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const [rendering, setRendering] = useState<number | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const list = pages.map((p, i) => ({ p, i })).filter(({ p }) => !p.form);
  const waiter = useRef<(() => void) | null>(null);
  useEffect(() => { waiter.current?.(); waiter.current = null; }, [rendering]);

  /** Fabrique l'image d'une page : la pose hors écran, attend qu'elle soit prête, la photographie. */
  const shoot = async (i: number): Promise<string> => {
    await new Promise<void>((r) => { waiter.current = r; setRendering(i); });
    const node = holder.current?.firstElementChild as HTMLElement | null;
    if (!node) throw new Error('page absente');
    await ready(node);
    return toPng(node, { width: format.w, height: format.h, pixelRatio: 1, cacheBust: true });
  };
  const one = async (i: number) => {
    setBusy(i);
    try { download(await shoot(i), `${slug(name)}-${format.id}-page-${i + 1}.png`); }
    catch { notify('L’image n’a pas pu être faite (une photo hébergée ailleurs peut bloquer l’export). Réessayez.', { tone: 'error' }); }
    finally { setBusy(null); setRendering(null); }
  };
  const all = async () => {
    setBusy('all');
    try {
      for (const { i } of list) {
        download(await shoot(i), `${slug(name)}-${format.id}-page-${i + 1}.png`);
        await new Promise((r) => setTimeout(r, 300));
      }
      notify(`${list.length} images téléchargées.`, { tone: 'success' });
    } catch { notify('Une image n’a pas pu être faite. Réessayez.', { tone: 'error' }); }
    finally { setBusy(null); setRendering(null); }
  };

  return (
    <Modal title="Images pour Instagram" onClose={onClose} wide
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Fermer</button>
        <button type="button" onClick={all} disabled={busy !== null || !list.length} className={btnPrimary}>
          {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Tout télécharger ({list.length})
        </button>
      </>}>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Format">
        {FORMATS.map((f) => (
          <button key={f.id} type="button" aria-pressed={format.id === f.id} onClick={() => setFormat(f)}
            className={cn('rounded-lg border px-3 py-1.5 text-sm', format.id === f.id ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-gray-500">Images de {format.w} × {format.h} px. La page du formulaire n’est pas exportée. Sur Instagram, un carrousel de publications 4:5 se feuillette comme la brochure.</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {list.map(({ p, i }) => (
          <li key={p.id}>
            <button type="button" onClick={() => one(i)} disabled={busy !== null} title="Télécharger cette image"
              className="group relative block w-full overflow-hidden rounded-lg border border-gray-200 hover:ring-2 hover:ring-primary disabled:opacity-60">
              <div className="flex items-center justify-center" style={{ aspectRatio: `${format.w} / ${format.h}`, background: p.bg }}>
                <div style={{ width: `${Math.min(100, (format.h / 1.414 / format.w) * 100)}%` }}><PageThumb page={p} language={language} /></div>
              </div>
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11px] text-white">
                {busy === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Page {i + 1}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* La page à photographier, hors de l'écran, à sa taille réelle. */}
      <div ref={holder} aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
        {rendering !== null && pages[rendering] && <Frame page={pages[rendering]} format={format} language={language} />}
      </div>
    </Modal>
  );
}
