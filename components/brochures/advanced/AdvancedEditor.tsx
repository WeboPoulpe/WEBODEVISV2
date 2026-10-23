'use client';

// Éditeur avancé d'une brochure : bandeau des pages en haut, palette de blocs à gauche, la page en cours au centre
// (rendu réel, blocs sélectionnables et déplaçables), réglages du bloc ou de la page à droite. La mise en page
// (`layout`) est tenue par l'éditeur de brochure, qui l'enregistre.

import { useMemo, useState, type ReactNode } from 'react';
import { googleFontsHref } from '@/lib/quoteOutput';
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { useFeedback } from '@/components/ui/Feedback';
import type { BrochureCover, BrochureStyle, CatalogPrestation, PriceOptions } from '@/lib/brochure';
import {
  addBlock, addPage, duplicateBlock, duplicatePage, layoutFonts, moveBlock, movePage, newBlock, placeBlock, removeBlock, removePage,
  resolveLayout, updateBlock, updatePage, type Block, type BlockTarget, type BrochureLayout, type LayoutPage,
} from '@/lib/brochureLayout';
import BlockPage from '../BlockPage';
import { BrochurePageView, type BrochureCompany } from '../BrochurePages';
import PrestationPicker from '../PrestationPicker';
import BlockPalette, { type PaletteItem } from './BlockPalette';
import BlockSettings from './BlockSettings';
import PageSettings from './PageSettings';
import PagesStrip, { useOverflow } from './PagesStrip';

export interface AdvancedSettings {
  style: BrochureStyle;
  language: 'fr' | 'en';
  prices: Omit<PriceOptions, 'language'>;
  cover: BrochureCover;
  about: { html: string; photoUrl?: string | null };
}

const makeBlock = (key: PaletteItem, prestationId?: string): Block =>
  key === 'columns3' ? { ...(newBlock('columns') as Extract<Block, { type: 'columns' }>), count: 3, cols: [[], [], []] } : newBlock(key, prestationId);

/** Un bloc de la page, au premier niveau ou dans une colonne. */
const findBlock = (blocks: Block[], id: string | null): Block | null => {
  if (!id) return null;
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === 'columns') { const inner = findBlock(b.cols.flat(), id); if (inner) return inner; }
  }
  return null;
};

const ctl = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E6DFD3] bg-white text-gray-600 shadow-sm hover:text-primary';

export default function AdvancedEditor({ layout, onChange, catalog, company, settings }: {
  layout: BrochureLayout;
  onChange: (next: BrochureLayout) => void;
  catalog: CatalogPrestation[];
  company: BrochureCompany;
  settings: AdvancedSettings;
}) {
  const { confirm, notify } = useFeedback();
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const [pageId, setPageId] = useState<string | null>(layout.pages.find((p) => p.kind === 'blocks')?.id ?? layout.pages[0]?.id ?? null);
  const [blockId, setBlockId] = useState<string | null>(null);
  // Prestations à choisir pour un bloc Prestation posé (à la suite, ou à l'endroit visé).
  const [picking, setPicking] = useState<{ at?: BlockTarget } | null>(null);

  const page = layout.pages.find((p) => p.id === pageId) ?? null;
  const resolved = useMemo(
    () => resolveLayout(layout, byId, { ...settings.prices, language: settings.language, forEditor: true }),
    [layout, byId, settings.prices, settings.language],
  );
  const resolvedOf = (p: LayoutPage) => resolved[layout.pages.indexOf(p)];

  const renderPage = (p: LayoutPage): ReactNode => {
    const r = resolvedOf(p);
    if (!r) return null;
    const pub = p.kind === 'blocks' ? { kind: 'blocks' as const, background: r.background, font: r.font, blocks: r.blocks } : { kind: p.kind };
    return <BrochurePageView page={pub} style={settings.style} cover={settings.cover} company={company} language={settings.language} about={settings.about}
      formSlot={<p style={{ fontSize: '4cqw', color: '#5b5b55' }}>Formulaire de demande</p>} />;
  };

  const add = (key: PaletteItem, at?: BlockTarget) => {
    if (!page || page.kind !== 'blocks') return;
    if (key === 'prestation') { setPicking({ at }); return; }
    const block = makeBlock(key);
    onChange(addBlock(layout, page.id, block, at));
    setBlockId(block.id);
  };

  const onDrop = (at: BlockTarget, payload: string) => {
    if (!page) return;
    if (payload.startsWith('move:')) onChange(placeBlock(layout, payload.slice(5), { ...at, pageId: page.id }));
    else if (payload.startsWith('new:')) add(payload.slice(4) as PaletteItem, at);
  };

  const controls = (id: string) => (
    <div className="flex gap-1">
      <button type="button" className={ctl} aria-label="Monter le bloc" onClick={() => onChange(moveBlock(layout, id, -1))}><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" className={ctl} aria-label="Descendre le bloc" onClick={() => onChange(moveBlock(layout, id, 1))}><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" className={ctl} aria-label="Dupliquer le bloc" onClick={() => onChange(duplicateBlock(layout, id))}><Copy className="h-3.5 w-3.5" /></button>
      <button type="button" className={ctl} aria-label="Supprimer le bloc" onClick={() => { onChange(removeBlock(layout, id)); setBlockId(null); }}><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
    </div>
  );

  const addPageAfter = () => {
    const next = addPage(layout, 'blocks', pageId ?? undefined);
    onChange(next);
    setPageId(next.pages.find((p) => !layout.pages.some((q) => q.id === p.id))?.id ?? pageId);
    setBlockId(null);
  };
  const addSpecial = (kind: 'cover' | 'contact') => {
    const next = addPage(layout, kind, pageId ?? undefined);
    onChange(next);
    setPageId(next.pages.find((p) => !layout.pages.some((q) => q.id === p.id))?.id ?? pageId);
  };
  const removeSelected = async () => {
    if (!page || page.kind === 'form') return;
    const ok = await confirm({ title: 'Supprimer cette page ?', message: 'Ses blocs seront retirés de la brochure. Le catalogue ne change pas.', danger: true });
    if (!ok) return;
    const i = layout.pages.indexOf(page);
    const next = removePage(layout, page.id);
    onChange(next);
    setPageId(next.pages[Math.max(0, i - 1)]?.id ?? null);
    setBlockId(null);
  };
  /** Page glissée sur une autre : elle prend sa place (couverture et formulaire restent à leur place). */
  const reorder = (from: string, to: string) => {
    const pages = [...layout.pages];
    const i = pages.findIndex((p) => p.id === from);
    const j = pages.findIndex((p) => p.id === to);
    if (i < 0 || j < 0 || i === j || ['cover', 'form'].includes(pages[i].kind) || ['cover', 'form'].includes(pages[j].kind)) return;
    const [moved] = pages.splice(i, 1);
    pages.splice(j, 0, moved);
    onChange({ pages });
  };

  const { ref: canvasRef, over } = useOverflow([layout, pageId]);
  const selectedResolved = page ? resolvedOf(page) : null;
  const selectedBlock = page ? findBlock(page.blocks, blockId) : null;
  const fontsHref = googleFontsHref(layoutFonts(layout));

  return (
    <div className="space-y-3">
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <PagesStrip pages={layout.pages} selectedId={pageId} onSelect={(id) => { setPageId(id); setBlockId(null); }} renderPage={renderPage}
        onAdd={addPageAfter} onMove={(dir) => page && onChange(movePage(layout, page.id, dir))}
        onDuplicate={() => page && onChange(duplicatePage(layout, page.id))} onRemove={removeSelected} onReorder={reorder} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[170px_minmax(0,1fr)_260px] items-start">
        <div className="order-2 lg:order-1">
          <details className="rounded-2xl border border-gray-200 bg-white p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium text-gray-800">Ajouter un bloc</summary>
            <div className="mt-3"><BlockPalette onAdd={(k) => add(k)} onAddPage={addSpecial} disabled={page?.kind !== 'blocks'}
              hasCover={layout.pages.some((p) => p.kind === 'cover')} hasContact={layout.pages.some((p) => p.kind === 'contact')} /></div>
          </details>
          <div className="hidden lg:block">
            <BlockPalette onAdd={(k) => add(k)} onAddPage={addSpecial} disabled={page?.kind !== 'blocks'}
              hasCover={layout.pages.some((p) => p.kind === 'cover')} hasContact={layout.pages.some((p) => p.kind === 'contact')} />
          </div>
        </div>

        <div className="order-1 lg:order-2 min-w-0" role="region" aria-label="Page en cours">
          {over && <p role="status" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">Page trop pleine : le lecteur devra faire défiler cette page. Retirez des blocs ou ajoutez une page.</p>}
          <div className="flex justify-center rounded-2xl bg-[#EDE6DA] p-4" onClick={() => setBlockId(null)}>
            <div ref={canvasRef} className="relative w-full max-w-[420px] overflow-hidden bg-[#FBF7F0] shadow-xl"
              style={{ aspectRatio: '210 / 297', containerType: 'inline-size', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {page && selectedResolved && (page.kind === 'blocks'
                ? <BlockPage theme={settings.style} page={{ background: selectedResolved.background, font: selectedResolved.font, blocks: selectedResolved.blocks }}
                    editing={{ selectedId: blockId, onSelect: setBlockId, onDrop, controls }} />
                : renderPage(page))}
            </div>
          </div>
          {page && page.kind !== 'blocks' && (
            <p className="mt-2 text-center text-sm text-gray-500">
              {page.kind === 'form' ? 'Le formulaire de demande : toujours la dernière page.' : 'Cette page se règle dans les réglages de la brochure.'}
            </p>
          )}
        </div>

        <div className="order-3 min-w-0">
          <div className="rounded-2xl border border-gray-200 bg-white p-3" role="region" aria-label={selectedBlock ? 'Réglages du bloc' : 'Réglages de la page'}>
            {selectedBlock ? (
              <BlockSettings key={selectedBlock.id} block={selectedBlock} catalog={byId} language={settings.language}
                onChange={(patch) => onChange(updateBlock(layout, selectedBlock.id, patch))} />
            ) : page ? (
              <PageSettings page={page} onChange={(patch) => onChange(updatePage(layout, page.id, patch))} />
            ) : null}
          </div>
        </div>
      </div>

      {picking && (
        <PrestationPicker catalog={catalog} already={new Set()} onClose={() => setPicking(null)}
          onAdd={(ids) => {
            if (!page) return;
            let next = layout;
            let last: string | null = null;
            ids.forEach((id, i) => {
              const block = makeBlock('prestation', id);
              next = addBlock(next, page.id, block, picking.at ? { ...picking.at, index: picking.at.index + i } : undefined);
              last = block.id;
            });
            onChange(next);
            setBlockId(last);
            setPicking(null);
            if (ids.length === 0) notify('Aucune prestation choisie.');
          }} />
      )}
    </div>
  );
}
