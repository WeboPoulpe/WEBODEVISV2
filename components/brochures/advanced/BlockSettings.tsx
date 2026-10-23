'use client';

// Réglages du bloc sélectionné dans l'éditeur avancé : ceux de son type (photo et textes d'une prestation, niveau
// d'un titre, hauteur d'une image…), puis les réglages communs (marges, fond, police, titre). Les changements ne
// valent que pour cette brochure : le catalogue ne bouge pas.

import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { btnSecondary, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { CatalogPrestation } from '@/lib/brochure';
import { BLOCK_FONTS, PALETTE, TITLE_SIZES, type Align, type Block, type BlockStyle } from '@/lib/brochureLayout';
import ItemRetouch from '../ItemRetouch';
import PhotoField from '../PhotoField';

export const COLOR_NAMES: Record<string, string> = {
  '#1C2621': 'Sapin profond', '#2F4A3A': 'Vert sapin', '#B4502D': 'Terracotta', '#5b5b55': 'Gris',
  '#FBF7F0': 'Crème', '#EDE6DA': 'Sable', '#E6DFD3': 'Lin', '#FFFFFF': 'Blanc',
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><span className={labelCls}>{label}</span>{children}</div>;
}

/** Choix exclusif en boutons (aria-pressed), dans un groupe nommé. */
export function Choice<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
            className={cn('rounded-lg border px-2.5 py-1.5 text-sm', o.value === value ? 'border-primary bg-primary-50 text-primary font-medium' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pastilles de la palette ; `none` ajoute « aucune » (couleur du thème). */
export function Swatches({ label, value, onChange, none }: { label: string; value: string | null | undefined; onChange: (c: string | null) => void; none?: string }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
        {none && (
          <button type="button" aria-pressed={!value} onClick={() => onChange(null)}
            className={cn('h-7 rounded-full border px-2 text-xs', !value ? 'border-primary text-primary' : 'border-gray-200 text-gray-600')}>{none}</button>
        )}
        {PALETTE.map((c) => (
          <button key={c} type="button" aria-label={COLOR_NAMES[c]} title={COLOR_NAMES[c]} aria-pressed={value === c} onClick={() => onChange(c)}
            className={cn('h-7 w-7 rounded-full border border-gray-300', value === c && 'ring-2 ring-primary ring-offset-2')} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

export function FontSelect({ label, value, onChange, none }: { label: string; value: string | null | undefined; onChange: (f: string | null) => void; none: string }) {
  return (
    <Field label={label}>
      <select value={value ?? ''} aria-label={label} onChange={(e) => onChange(e.target.value || null)} className={cn(inputCls, 'h-10 py-1.5')}>
        <option value="">{none}</option>
        {BLOCK_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>
    </Field>
  );
}

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className={cn(labelCls, 'flex justify-between')}>{label}<span className="tabular-nums text-gray-500">{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
    </label>
  );
}

const ALIGN: { value: Align; label: string }[] = [{ value: 'left', label: 'Gauche' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Droite' }];
const TYPE_LABEL: Record<Block['type'], string> = {
  prestation: 'Prestation', title: 'Titre', text: 'Texte', image: 'Image', columns: 'Colonnes', separator: 'Séparateur', spacer: 'Espace',
};

export default function BlockSettings({ block, catalog, language, onChange }: {
  block: Block;
  catalog: ReadonlyMap<string, CatalogPrestation>;
  language: 'fr' | 'en';
  onChange: (patch: Partial<Block>) => void;
}) {
  const [retouching, setRetouching] = useState(false);
  const style: BlockStyle = (block.type !== 'spacer' && block.style) || {};
  const setStyle = (patch: Partial<BlockStyle>) => onChange({ style: { ...style, ...patch } } as Partial<Block>);
  const set = <B extends Block>(patch: Partial<B>) => onChange(patch as Partial<Block>);

  const own = (): ReactNode => {
    switch (block.type) {
      case 'prestation': {
        const p = catalog.get(block.prestationId);
        return (
          <>
            <p className="text-sm font-medium text-gray-900">{p ? p.name : 'Supprimée du catalogue'}</p>
            <Choice label="Photo" value={block.photo} onChange={(photo) => set({ photo })}
              options={[{ value: 'top', label: 'Haut' }, { value: 'left', label: 'Gauche' }, { value: 'right', label: 'Droite' }, { value: 'none', label: 'Aucune' }]} />
            <div>
              <span className={labelCls}>Afficher</span>
              <div className="flex flex-wrap gap-3">
                {([['name', 'Nom'], ['text', 'Texte'], ['price', 'Prix']] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={block.show[k]} onChange={(e) => set({ show: { ...block.show, [k]: e.target.checked } })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Choice label="Texte" value={block.text} onChange={(text) => set({ text })} options={[{ value: 'full', label: 'Complet' }, { value: 'short', label: 'Court' }]} />
            {p && <button type="button" onClick={() => setRetouching(true)} className={cn(btnSecondary, 'h-10 w-full')}><Pencil className="h-4 w-4" /> Retoucher pour cette brochure</button>}
            {retouching && p && (
              <ItemRetouch prestation={p} language={language} onClose={() => setRetouching(false)}
                item={{ prestationId: block.prestationId, html: block.html, titled: block.titled, photoUrl: block.photoUrl, hidePrice: block.hidePrice }}
                onSave={(item) => { set({ html: item.html ?? undefined, titled: item.titled, photoUrl: item.photoUrl ?? undefined, hidePrice: item.hidePrice }); setRetouching(false); }} />
            )}
          </>
        );
      }
      case 'title':
        return (
          <>
            <Field label="Texte du titre"><input value={block.text} maxLength={200} onChange={(e) => set({ text: e.target.value })} className={cn(inputCls, 'h-10')} /></Field>
            <Choice label="Niveau" value={block.level} onChange={(level) => set({ level })} options={[{ value: 'l', label: 'Grand' }, { value: 'm', label: 'Moyen' }, { value: 's', label: 'Petit' }]} />
          </>
        );
      case 'text':
        return <RichTextEditor key={block.id} initialValue={block.html} onChange={(html) => set({ html })} ariaLabel="Texte du bloc" minHeight="120px" maxHeight="40vh" />;
      case 'image':
        return (
          <>
            <PhotoField label="Choisir une image" url={block.url} onChange={(url) => set({ url })} />
            <Range label="Hauteur" value={block.height} min={40} max={600} step={10} onChange={(height) => set({ height })} />
            <Choice label="Cadrage" value={block.fit} onChange={(fit) => set({ fit })} options={[{ value: 'cover', label: 'Remplir' }, { value: 'contain', label: 'Contenir' }]} />
          </>
        );
      case 'columns':
        return (
          <>
            <Choice label="Colonnes" value={block.count} options={[{ value: 2, label: '2' }, { value: 3, label: '3' }]}
              onChange={(count) => set({
                count,
                // Passer de 3 à 2 colonnes : les blocs de la troisième rejoignent la deuxième.
                cols: count === 3 ? [...block.cols, ...(block.cols.length < 3 ? [[]] : [])].slice(0, 3) : [block.cols[0] ?? [], [...(block.cols[1] ?? []), ...(block.cols[2] ?? [])]],
              })} />
            <Range label="Espacement" value={block.gap} min={0} max={48} step={4} onChange={(gap) => set({ gap })} />
          </>
        );
      case 'separator':
        return (
          <>
            <Swatches label="Couleur du trait" value={block.color} onChange={(color) => color && set({ color })} />
            <Range label="Largeur (%)" value={block.width} min={10} max={100} step={5} onChange={(width) => set({ width })} />
          </>
        );
      case 'spacer':
        return <Range label="Hauteur" value={block.height} min={4} max={300} step={4} onChange={(height) => set({ height })} />;
    }
  };

  const titled = block.type === 'prestation' || block.type === 'title';
  return (
    <div className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{TYPE_LABEL[block.type]}</h3>
      {own()}
      {block.type !== 'spacer' && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          {(titled || block.type === 'text') && <Choice label="Alignement" value={style.align ?? ('' as Align)} options={ALIGN} onChange={(align) => setStyle({ align })} />}
          <Range label="Marges intérieures" value={style.padding ?? 0} min={0} max={48} step={4} onChange={(padding) => setStyle({ padding })} />
          <Swatches label="Fond du bloc" value={style.background} none="Aucun" onChange={(background) => setStyle({ background })} />
          {block.type !== 'separator' && <FontSelect label="Police du bloc" value={style.font} none="Celle de la page" onChange={(font) => setStyle({ font })} />}
          {titled && (
            <>
              <Choice label="Taille du titre" value={style.titleSize ?? 0}
                options={[{ value: 0, label: 'Auto' }, ...TITLE_SIZES.map((s) => ({ value: s, label: String(s) }))]}
                onChange={(n) => setStyle({ titleSize: n || null })} />
              <Swatches label="Couleur du titre" value={style.titleColor} none="Auto" onChange={(titleColor) => setStyle({ titleColor })} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
