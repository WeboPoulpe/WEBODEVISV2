'use client';

// Panneaux du Studio : « Ajouter » (modèles de pages, textes, photos, formes, prestations), « Réglages » de
// l'élément choisi ou de la page, nuancier, et le bandeau des pages.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical,
  ArrowLeft, ArrowRight, Circle, Copy, ImagePlus, Loader2, Minus, Plus, Search, Square, SquareDashed, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { iconBtn, iconBtnDanger, inputCls } from '@/components/ui/kit';
import type { CatalogPrestation } from '@/lib/brochure';
import {
  PAGE_H, PAGE_TEMPLATES, STUDIO_FONTS, STUDIO_SWATCHES,
  type ResolvedStudioPage, type StudioElement, type StudioPage, type TemplateContext,
} from '@/lib/brochureStudio';
import type { PhotoFrame } from '@/lib/photoFrame';
import { listBrochurePhotos } from '@/server/brochures';
import { PhotoFramer, PhotoPicker, usePhotoUpload } from '../PhotoPicker';
import { categoryLabel } from '../PrestationPicker';
import { StudioPageView } from './StudioPage';

// ── Petits champs ────────────────────────────────────────────────────────────

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

/** Nombre avec bornes ; `scale` : facteur d'affichage (par exemple centièmes de page → millimètres). */
export function NumberField({ label, value, onChange, min, max, step = 1, scale = 1, suffix }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; scale?: number; suffix?: string;
}) {
  const shown = Math.round(value * scale * 10) / 10;
  const [text, setText] = useState(String(shown));
  useEffect(() => { setText(String(shown)); }, [shown]);
  return (
    <Field label={label}>
      <div className="flex items-center rounded-lg border border-gray-300 bg-white focus-within:border-primary">
        <input inputMode="decimal" value={text} aria-label={label}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(',', '.'));
            if (Number.isFinite(n) && e.target.value.trim() !== '') onChange(Math.min(max, Math.max(min, n / scale)));
          }}
          onBlur={() => setText(String(shown))}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            onChange(Math.min(max, Math.max(min, value + ((e.key === 'ArrowUp' ? 1 : -1) * step) / scale)));
          }}
          className="h-8 w-full min-w-0 rounded-lg bg-transparent px-2 text-sm tabular-nums outline-none" />
        {suffix && <span className="pr-2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </Field>
  );
}

export function Slider({ label, value, onChange, min, max, step = 1, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-medium text-gray-600">{label}<span className="tabular-nums text-gray-400">{Math.round(value * 100) / 100}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
    </label>
  );
}

/** Nuancier : couleurs de la maison, autre couleur, et « aucune » si `nullable`. */
export function ColorField({ label, value, onChange, nullable }: { label: string; value: string | null; onChange: (c: string | null) => void; nullable?: boolean }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {nullable && (
          <button type="button" title="Aucune" aria-label="Aucune couleur" aria-pressed={value === null} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(null)}
            className={cn('relative h-6 w-6 overflow-hidden rounded-full border bg-white', value === null ? 'ring-2 ring-primary ring-offset-1' : 'border-gray-300')}>
            <span aria-hidden className="absolute left-1/2 top-[-2px] h-[28px] w-[2px] -translate-x-1/2 rotate-45 bg-red-500" />
          </button>
        )}
        {STUDIO_SWATCHES.map((c) => (
          <button key={c} type="button" title={c} aria-label={`Couleur ${c}`} aria-pressed={value === c} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(c)}
            className={cn('h-6 w-6 rounded-full border shadow-sm', value === c ? 'ring-2 ring-primary ring-offset-1' : 'border-gray-300')} style={{ background: c }} />
        ))}
        <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-dashed border-gray-400" title="Autre couleur"
          style={value && !STUDIO_SWATCHES.includes(value) ? { background: value, borderStyle: 'solid' } : undefined}>
          <span className="sr-only">Autre couleur</span>
          {!(value && !STUDIO_SWATCHES.includes(value)) && <Plus aria-hidden className="absolute inset-0 m-auto h-3.5 w-3.5 text-gray-500" />}
          <input type="color" value={value ?? '#000000'} className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => onChange(e.target.value.toLowerCase())} />
        </label>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, ReactNode, string?][]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label={label}>
        {options.map(([v, content, title]) => (
          <button key={v} type="button" title={title} aria-label={title} aria-pressed={value === v} onClick={() => onChange(v)}
            className={cn('rounded-md px-2.5 py-1 text-xs font-medium', value === v ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            {content}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FontSelect({ value, onChange, label = 'Police' }: { value: string; onChange: (f: string) => void; label?: string }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm">
        {STUDIO_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>
    </Field>
  );
}

// ── Vignette d'une page ──────────────────────────────────────────────────────

export function PageThumb({ page, language, className }: { page: ResolvedStudioPage; language: 'fr' | 'en'; className?: string }) {
  return (
    <div className={cn('relative w-full overflow-hidden', className)} style={{ aspectRatio: '210 / 297', containerType: 'inline-size' }}>
      <div className="pointer-events-none absolute inset-0"><StudioPageView page={page} language={language} editor /></div>
    </div>
  );
}

// ── Panneau « Ajouter » ──────────────────────────────────────────────────────

export type AddTab = 'templates' | 'text' | 'photos' | 'shapes' | 'prestations';
export const ADD_TABS: [AddTab, string][] = [['templates', 'Modèles'], ['text', 'Texte'], ['photos', 'Photos'], ['shapes', 'Formes'], ['prestations', 'Prestations']];

export const TEXT_PRESETS = [
  { id: 'title', label: 'Ajouter un titre', sample: 'Titre', style: { font: 'Playfair Display', size: 8, lineHeight: 1.1 } },
  { id: 'subtitle', label: 'Ajouter un sous-titre', sample: 'SOUS-TITRE', style: { font: 'Montserrat', size: 2.8, color: '#b4502d', uppercase: true, letterSpacing: 0.18 } },
  { id: 'body', label: 'Ajouter un paragraphe', sample: 'Votre texte ici. Double-cliquez pour l’écrire.', style: { font: 'Georgia', size: 3.4, lineHeight: 1.5 } },
  { id: 'quote', label: 'Citation', sample: '« Une cuisine généreuse »', style: { font: 'Cormorant Garamond', size: 5.5, lineHeight: 1.25, align: 'center' as const } },
  { id: 'script', label: 'Écriture manuscrite', sample: 'Avec amour', style: { font: 'Great Vibes', size: 7, color: '#a8844f' } },
  { id: 'price', label: 'Prix', sample: '76 € / pers.', style: { font: 'Montserrat', size: 3.6, color: '#b4502d' } },
] as const;

export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'line' | 'frame';

export function AddPanel({ tab, onTab, onTemplate, onText, onPhoto, onShape, onPrestation, catalog, used, templateContext, resolve, language }: {
  tab: AddTab;
  onTab: (t: AddTab) => void;
  onTemplate: (id: string) => void;
  onText: (presetId: (typeof TEXT_PRESETS)[number]['id']) => void;
  onPhoto: (url: string) => void;
  onShape: (s: ShapeKind) => void;
  onPrestation: (id: string) => void;
  catalog: CatalogPrestation[];
  used: Set<string>;
  templateContext: TemplateContext;
  resolve: (p: StudioPage) => ResolvedStudioPage;
  language: 'fr' | 'en';
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Ajouter">
        {ADD_TABS.map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}
            className={cn('rounded-lg px-2.5 py-1.5 text-xs font-semibold', tab === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'templates' && <TemplatesTab onTemplate={onTemplate} ctx={templateContext} catalog={catalog} used={used} resolve={resolve} language={language} />}
      {tab === 'text' && (
        <div className="space-y-2">
          {TEXT_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => onText(p.id)}
              className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-primary/50 hover:bg-primary-50/40">
              <span className="block truncate text-gray-900" style={{
                fontFamily: `'${p.style.font}', Georgia, serif`,
                fontSize: Math.min(26, Math.max(12, p.style.size * 3.4)),
                color: 'color' in p.style ? p.style.color : undefined,
                letterSpacing: 'letterSpacing' in p.style ? `${p.style.letterSpacing}em` : undefined,
              }}>{p.sample}</span>
              <span className="text-xs text-gray-500">{p.label}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'photos' && <PhotosTab onPhoto={onPhoto} />}
      {tab === 'shapes' && (
        <div className="grid grid-cols-3 gap-2">
          {([
            ['rect', 'Rectangle', <Square key="i" className="h-7 w-7 fill-[#e6dfd3] text-[#e6dfd3]" />],
            ['rounded', 'Arrondi', <span key="i" className="block h-7 w-7 rounded-lg bg-[#e6dfd3]" />],
            ['ellipse', 'Cercle', <Circle key="i" className="h-7 w-7 fill-[#e6dfd3] text-[#e6dfd3]" />],
            ['line', 'Ligne', <Minus key="i" className="h-7 w-7 text-[#b4502d]" />],
            ['frame', 'Cadre', <SquareDashed key="i" className="h-7 w-7 text-[#a8844f]" />],
          ] as [ShapeKind, string, ReactNode][]).map(([s, label, icon]) => (
            <button key={s} type="button" onClick={() => onShape(s)}
              className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-3 text-xs text-gray-600 hover:border-primary/50">
              {icon}{label}
            </button>
          ))}
        </div>
      )}
      {tab === 'prestations' && <PrestationsTab catalog={catalog} used={used} onPick={onPrestation} />}
    </div>
  );
}

function TemplatesTab({ onTemplate, ctx, catalog, used, resolve, language }: {
  onTemplate: (id: string) => void; ctx: TemplateContext; catalog: CatalogPrestation[]; used: Set<string>;
  resolve: (p: StudioPage) => ResolvedStudioPage; language: 'fr' | 'en';
}) {
  // Aperçus faits une fois, avec les prestations pas encore placées (celles que le modèle prendra).
  const previews = useMemo(() => {
    const ids = [...catalog.filter((p) => !used.has(p.id)), ...catalog.filter((p) => used.has(p.id))].map((p) => p.id);
    return PAGE_TEMPLATES.map((t) => ({ t, page: resolve(t.make(ctx, ids)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, catalog]);
  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">Un clic ajoute la page après celle en cours. Tout reste modifiable.</p>
      <ul className="grid grid-cols-2 gap-2">
        {previews.map(({ t, page }) => (
          <li key={t.id}>
            <button type="button" onClick={() => onTemplate(t.id)} className="block w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-left hover:border-primary hover:ring-1 hover:ring-primary">
              <PageThumb page={page} language={language} />
              <span className="block truncate border-t border-gray-100 px-2 py-1 text-[11px] text-gray-600">{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhotosTab({ onPhoto }: { onPhoto: (url: string) => void }) {
  const [photos, setPhotos] = useState<{ url: string; label: string }[] | null>(null);
  const { upload, busy } = usePhotoUpload();
  useEffect(() => {
    let alive = true;
    listBrochurePhotos().then((p) => { if (alive) setPhotos(p); }).catch(() => { if (alive) setPhotos([]); });
    return () => { alive = false; };
  }, []);
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-3 text-sm font-medium text-primary hover:border-primary">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        Envoyer depuis l’appareil
        <input type="file" accept="image/*" className="sr-only" disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            const url = await upload(f);
            if (url) { onPhoto(url); setPhotos((p) => [{ url, label: 'Envoyée' }, ...(p ?? [])]); }
          }} />
      </label>
      <p className="text-xs text-gray-500">Un clic pose la photo sur la page (ou remplace celle de la photo choisie).</p>
      {photos === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune photo pour l’instant.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <li key={p.url}>
              <button type="button" onClick={() => onPhoto(p.url)} title={p.label} className="block w-full overflow-hidden rounded-md border border-gray-200 hover:ring-2 hover:ring-primary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrestationsTab({ catalog, used, onPick }: { catalog: CatalogPrestation[]; used: Set<string>; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const map = new Map<string, CatalogPrestation[]>();
    for (const p of catalog) {
      if (s && !p.name.toLowerCase().includes(s)) continue;
      const key = categoryLabel(p.category);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [catalog, q]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher une prestation" className={cn(inputCls, 'py-1.5 pl-8')} />
      </div>
      <p className="text-xs text-gray-500">Nom, texte, prix et photo viennent du catalogue et restent à jour.</p>
      {catalog.length === 0 && <p className="text-sm text-gray-500">Votre catalogue est vide.</p>}
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {groups.map(([cat, list]) => (
          <div key={cat}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{cat}</p>
            <ul className="space-y-1">
              {list.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white p-1.5 text-left text-sm hover:border-primary/50">
                    <span className="h-9 w-9 flex-shrink-0 overflow-hidden rounded bg-[#E6DFD3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.photo_url && <img src={p.photo_url} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {used.has(p.id) && <span className="text-[10px] text-gray-400">déjà placée</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Réglages communs d'un élément ────────────────────────────────────────────

/** Millimètres sur une page A4 (210 mm de large) pour 1 centième de largeur. */
export const MM = 2.1;

export function PositionGroup({ el, onChange, measuredH }: { el: StudioElement; onChange: (patch: Partial<StudioElement>) => void; measuredH: number }) {
  const h = el.type === 'text' ? measuredH : el.h;
  const align: [string, ReactNode, Partial<StudioElement>][] = [
    ['Aligner à gauche de la page', <AlignStartVertical key="a" className="h-4 w-4" />, { x: 0 }],
    ['Centrer horizontalement', <AlignCenterVertical key="b" className="h-4 w-4" />, { x: (100 - el.w) / 2 }],
    ['Aligner à droite de la page', <AlignEndVertical key="c" className="h-4 w-4" />, { x: 100 - el.w }],
    ['Aligner en haut de la page', <AlignStartHorizontal key="d" className="h-4 w-4" />, { y: 0 }],
    ['Centrer verticalement', <AlignCenterHorizontal key="e" className="h-4 w-4" />, { y: (PAGE_H - h) / 2 }],
    ['Aligner en bas de la page', <AlignEndHorizontal key="f" className="h-4 w-4" />, { y: PAGE_H - h }],
  ];
  return (
    <Group title="Position">
      <div className="flex flex-wrap gap-1">
        {align.map(([label, icon, patch]) => (
          <button key={label} type="button" title={label} aria-label={label} onClick={() => onChange(patch)} className={iconBtn}>{icon}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Gauche" value={el.x} onChange={(x) => onChange({ x })} min={-el.w} max={100} scale={MM} suffix="mm" />
        <NumberField label="Haut" value={el.y} onChange={(y) => onChange({ y })} min={-h} max={PAGE_H} scale={MM} suffix="mm" />
        <NumberField label="Largeur" value={el.w} onChange={(w) => onChange({ w })} min={2} max={300} scale={MM} suffix="mm" />
        {el.type !== 'text' && <NumberField label="Hauteur" value={el.h} onChange={(v) => onChange({ h: v })} min={0.5} max={400} scale={MM} suffix="mm" />}
        <NumberField label="Rotation" value={el.rot} onChange={(rot) => onChange({ rot })} min={-180} max={180} suffix="°" />
      </div>
      <Slider label="Transparence" value={100 - el.opacity} onChange={(v) => onChange({ opacity: 100 - v })} min={0} max={100} unit=" %" />
    </Group>
  );
}

/** Photo d'un élément ou du fond : changer, cadrer. */
export function PhotoGroup({ url, frame, onUrl, onFrame, ratio, title = 'Photo' }: {
  url: string | null; frame: PhotoFrame | null | undefined; onUrl: (u: string | null) => void; onFrame: (f: PhotoFrame | null) => void; ratio: number; title?: string;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <Group title={title}>
      <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark">
        <ImagePlus className="h-4 w-4" /> {url ? 'Changer la photo' : 'Choisir une photo'}
      </button>
      {url && <PhotoFramer url={url} frame={frame} onChange={onFrame} ratio={Math.max(20, Math.min(200, ratio))} />}
      {picking && <PhotoPicker current={url} onClose={() => setPicking(false)} onPick={(u) => { onUrl(u); setPicking(false); }} />}
    </Group>
  );
}

// ── Bandeau des pages ────────────────────────────────────────────────────────

export function PagesStrip({ pages, resolved, current, language, onSelect, onAdd, onDuplicate, onDelete, onMove }: {
  pages: StudioPage[];
  resolved: ResolvedStudioPage[];
  current: number;
  language: 'fr' | 'en';
  onSelect: (i: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const page = pages[current];
  const lastMovable = pages.length - 2;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-2">
      <div className="mb-2 flex flex-wrap items-center gap-1 px-1">
        <span className="mr-auto text-xs font-semibold uppercase tracking-wider text-gray-500">Page {current + 1} / {pages.length}{page?.form ? ' · formulaire' : ''}</span>
        <button type="button" className={iconBtn} title="Déplacer avant" aria-label="Déplacer la page avant" disabled={!!page?.form || current === 0} onClick={() => onMove(-1)}><ArrowLeft className="h-4 w-4" /></button>
        <button type="button" className={iconBtn} title="Déplacer après" aria-label="Déplacer la page après" disabled={!!page?.form || current >= lastMovable} onClick={() => onMove(1)}><ArrowRight className="h-4 w-4" /></button>
        <button type="button" className={iconBtn} title="Dupliquer la page" aria-label="Dupliquer la page" disabled={!!page?.form} onClick={onDuplicate}><Copy className="h-4 w-4" /></button>
        <button type="button" className={iconBtnDanger} title="Supprimer la page" aria-label="Supprimer la page" disabled={!!page?.form} onClick={onDelete}><Trash2 className="h-4 w-4" /></button>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Pages">
        {resolved.map((p, i) => (
          <li key={pages[i].id} className="flex-none">
            <button type="button" onClick={() => onSelect(i)} aria-current={i === current ? 'page' : undefined} aria-label={`Page ${i + 1}${p.form ? ' (formulaire)' : ''}`}
              className={cn('block w-[64px] overflow-hidden rounded-md border-2 bg-white', i === current ? 'border-primary' : 'border-transparent ring-1 ring-gray-200 hover:ring-gray-400')}>
              <PageThumb page={p} language={language} />
            </button>
            <span className="block text-center text-[10px] text-gray-500">{p.form ? 'Formulaire' : i + 1}</span>
          </li>
        ))}
        <li className="flex-none">
          <button type="button" onClick={onAdd} aria-label="Ajouter une page vierge"
            className="flex w-[64px] items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary hover:text-primary" style={{ aspectRatio: '210 / 297' }}>
            <Plus className="h-5 w-5" />
          </button>
        </li>
      </ol>
    </div>
  );
}
