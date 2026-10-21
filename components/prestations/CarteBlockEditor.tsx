'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Palette, RemoveFormatting, Underline, Wand2,
} from 'lucide-react';
import type { QuoteHtmlOptions } from '@/lib/generateQuoteHtml';
import { appResetCss, documentFonts, googleFontsHref, outputSettings, quoteOutputCss } from '@/lib/quoteOutput';
import { carteShell, EDIT_ATTR, type CardKind } from '@/lib/prestationCard';
import { sanitizeHtml } from '@/lib/sanitize';
import { useHydrated } from '@/lib/useHydrated';
import { cn } from '@/lib/utils';

// Édition d'une prestation directement dans la carte du menu du devis (« WeboWord » de la fiche prestation).
// Le bloc vient du générateur des devis (carteShell) et reçoit la feuille de sortie des devis (quoteOutputCss,
// après appResetCss) : même police, mêmes tailles, mêmes interlignes, même largeur de colonne que la carte.
// On tape donc dans le rendu du devis ; les retours à la ligne sont ceux du PDF.
// La colonne (400 px sur la page A4) est agrandie ou réduite pour remplir la largeur disponible, sans changer
// sa mise en page : seule l'échelle d'affichage change.

/** Largeur de la colonne des plats dans la carte (max-width de .gastro-menu dans le générateur). */
const MENU_WIDTH = 400;
/** Marge blanche autour du bloc, en pixels du document. */
const PAD = 16;
/** Agrandissement maximal à l'écran (le texte de la carte est petit : 12 px). */
const MAX_SCALE = 1.5;

const SIZES = [10, 11, 12, 13, 14, 16, 18, 20];
const COLORS = ['#1a1a1a', '#555555', '#777777', '#1C2621', '#B4502D', '#9c27b0', '#c8956c', '#1565c0', '#2e7d32', '#c62828', '#d97706'];

/** Classe de la feuille : les styles de l'application y sont annulés, comme dans l'éditeur des devis. */
const PAPER = 'presta-carte-paper';

/** Collage : seule la structure du texte est gardée (gras, italique, listes), pas les polices, couleurs ni images. */
function cleanPastedHtml(html: string): string {
  return sanitizeHtml(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'span', 'div'],
    ALLOWED_ATTR: [],
  });
}

/** Découpe un texte collé d'un bloc (tirets, astérisques, retours à la ligne) en paragraphes ; prix en gras. */
function structureText(raw: string): string {
  const lines = raw
    .split(/\n+/)
    .flatMap((line) => line.split(/\s+[-–]\s+/))
    .flatMap((line) => line.split(/\*{2,}/))
    .map((s) => s.trim())
    .filter(Boolean);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return lines.map((line) => {
    const price = line.match(/(\+?\d+€\/pers\.?)$/);
    if (price) return `<p>${esc(line.slice(0, -price[0].length).trim())} <strong>${esc(price[0])}</strong></p>`;
    if (line.length < 40 && /^[A-ZÀ-ÜÉÈ\s&]+$/.test(line)) return `<p><strong>${esc(line)}</strong></p>`;
    return `<p>${esc(line)}</p>`;
  }).join('');
}

export interface CarteBlockEditorProps {
  name: string;
  isOption: boolean;
  /** Ce qui est édité : la description (sous le nom), ou la fiche entière. */
  kind: CardKind;
  lang: 'fr' | 'en';
  template: NonNullable<QuoteHtmlOptions['template']>;
  font: string;
  /** HTML de départ ; l'éditeur le garde ensuite pour lui (pas de réécriture à chaque frappe). */
  value: string;
  onChange: (html: string) => void;
  label: string;
  placeholder: string;
}

export default function CarteBlockEditor({ name, isOption, kind, lang, template, font, value, onChange, label, placeholder }: CarteBlockEditorProps) {
  const hydrated = useHydrated();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLElement | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const savedRange = useRef<Range | null>(null);
  const colorInput = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [box, setBox] = useState({ scale: 0, height: 0, natural: MENU_WIDTH + 2 * PAD });
  const [colorsOpen, setColorsOpen] = useState(false);
  // Téléphone : la carte réduite à la largeur de l'écran est petite ; « Taille réelle » la montre à 100 % (défilement).
  const [realSize, setRealSize] = useState(false);
  const shrunk = box.scale > 0 && box.scale < 1;
  const scale = realSize && shrunk ? 1 : box.scale;

  // Le bloc du devis, avec la zone à éditer vide (remplie juste après, sans passer par React).
  const shell = useMemo(
    () => (hydrated ? sanitizeHtml(carteShell({ name, isOption, kind, lang }, { template, font })) : ''),
    [hydrated, name, isOption, kind, lang, template, font],
  );
  const css = useMemo(
    () => `${appResetCss(`.${PAPER}`)}\n${quoteOutputCss(outputSettings({ selected_font: font })).replace(/@page\s*\{[^}]*\}/, '')}
      .${PAPER} [${EDIT_ATTR}] { outline: none; cursor: text; -webkit-user-select: text; user-select: text; }
      .${PAPER} [${EDIT_ATTR}]:empty::before { content: attr(data-placeholder); color: #a8a29e; pointer-events: none; }`,
    [font],
  );
  // Police des devis, et celles de paragraphes repris d'un devis (bouton « + » de l'éditeur).
  const fontHref = googleFontsHref(documentFonts(font, value));

  const emit = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    // Un bloc vidé par l'effacement garde souvent un <br> : il compte pour vide.
    const html = el.innerHTML === '<br>' ? '' : el.innerHTML;
    valueRef.current = html;
    onChangeRef.current(html);
  }, []);

  const refreshActive = useCallback(() => {
    try {
      const next = new Set<string>();
      for (const cmd of ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList']) {
        if (document.queryCommandState(cmd)) next.add(cmd);
      }
      setActive(next);
    } catch { /* navigateur sans queryCommandState */ }
  }, []);

  // Le bloc est posé ici, hors de React (qui le réécrirait à chaque rendu et effacerait la saisie), à chaque
  // nouveau bloc (nom, style, langue) ; la zone modifiable y reçoit le texte en cours.
  useLayoutEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    doc.innerHTML = shell;
    const el = doc.querySelector<HTMLElement>(`[${EDIT_ATTR}]`);
    editRef.current = el;
    if (!el) return;
    el.innerHTML = sanitizeHtml(valueRef.current);
    el.contentEditable = 'true';
    el.spellcheck = true;
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-multiline', 'true');
    el.setAttribute('aria-label', label);
    el.setAttribute('data-placeholder', placeholder);
    const onInput = () => { emit(); refreshActive(); };
    const onPaste = (e: ClipboardEvent) => {
      const html = e.clipboardData?.getData('text/html');
      const text = e.clipboardData?.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      if (html) document.execCommand('insertHTML', false, cleanPastedHtml(html));
      else document.execCommand('insertText', false, text!);
    };
    el.addEventListener('input', onInput);
    el.addEventListener('paste', onPaste);
    el.addEventListener('keyup', refreshActive);
    el.addEventListener('mouseup', refreshActive);
    return () => {
      el.removeEventListener('input', onInput);
      el.removeEventListener('paste', onPaste);
      el.removeEventListener('keyup', refreshActive);
      el.removeEventListener('mouseup', refreshActive);
    };
  }, [shell, label, placeholder, emit, refreshActive]);

  // Dernière sélection dans la zone : la liste des tailles ou le choix de couleur prennent le focus, on la remet.
  useEffect(() => {
    const onSelection = () => {
      const el = editRef.current;
      const sel = window.getSelection();
      if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  // Échelle : la colonne de 400 px remplit la largeur disponible ; la hauteur suit le texte.
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const fit = () => {
      const available = o.clientWidth;
      if (!available) return;
      // Une ancienne fiche à largeur fixe peut dépasser la colonne : on réduit l'ensemble pour tout montrer.
      const doc = i.firstElementChild as HTMLElement | null;
      const natural = Math.max(MENU_WIDTH, doc?.scrollWidth ?? 0) + 2 * PAD;
      const scale = Math.min(MAX_SCALE, available / natural);
      const height = i.offsetHeight;
      setBox((prev) => (prev.scale === scale && prev.height === height && prev.natural === natural ? prev : { scale, height, natural }));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(o);
    observer.observe(i);
    return () => observer.disconnect();
  }, [shell]);

  /** Remet le curseur dans la zone (à la dernière sélection) avant une commande. */
  const focusEditor = () => {
    const el = editRef.current;
    if (!el) return null;
    if (document.activeElement !== el) {
      el.focus();
      const r = savedRange.current;
      const sel = window.getSelection();
      if (r && sel && el.contains(r.startContainer)) { sel.removeAllRanges(); sel.addRange(r); }
    }
    return el;
  };

  const exec = (cmd: string, arg?: string) => {
    if (!focusEditor()) return;
    document.execCommand('styleWithCSS', false, cmd === 'foreColor' ? 'true' : 'false');
    document.execCommand(cmd, false, arg);
    emit();
    refreshActive();
  };

  /** Taille en pixels sur la sélection (execCommand ne connaît que 7 tailles : on remplace son résultat). */
  const applySize = (px: number) => {
    const el = focusEditor();
    if (!el) return;
    // Sans texte sélectionné, rien à changer (la taille « 7 » resterait sinon sur la frappe suivante).
    if (window.getSelection()?.isCollapsed) return;
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    const spans: HTMLElement[] = [];
    el.querySelectorAll<HTMLElement>('font[size="7"], span[style*="xxx-large"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      if (f.tagName === 'FONT' && f.getAttribute('color')) span.style.color = f.getAttribute('color')!;
      while (f.firstChild) span.appendChild(f.firstChild);
      span.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((c) => { c.style.fontSize = ''; });
      f.replaceWith(span);
      spans.push(span);
    });
    // Le texte reste sélectionné, pour enchaîner gras, couleur…
    const sel = window.getSelection();
    if (spans.length && sel) {
      const range = document.createRange();
      range.setStartBefore(spans[0].firstChild ?? spans[0]);
      range.setEndAfter(spans[spans.length - 1].lastChild ?? spans[spans.length - 1]);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRange.current = range.cloneRange();
    }
    emit();
  };

  const structure = () => {
    const el = editRef.current;
    if (!el) return;
    const html = sanitizeHtml(structureText(el.innerText || ''));
    if (!html) return;
    el.focus();
    // Par l'édition du navigateur : Ctrl+Z revient au texte d'avant.
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertHTML', false, html);
    }
    emit();
  };

  const tb = (key: string, title: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      key={key}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active.has(key) || undefined}
      // onMouseDown + preventDefault : la zone garde le focus et la sélection.
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={cn('inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors flex-shrink-0',
        active.has(key) ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}
    >
      {icon}
    </button>
  );
  const sep = (key: string) => <span key={key} className="w-px h-6 bg-gray-200 mx-1 flex-shrink-0" aria-hidden />;

  return (
    <div className="rounded-xl border border-gray-300 overflow-hidden focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-100 transition-colors">
      {fontHref && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={fontHref} />
      )}
      <style>{css}</style>

      {/* ── Barre d'outils ── */}
      <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-gray-200 bg-gray-50">
        {tb('bold', 'Gras (Ctrl+B)', () => exec('bold'), <Bold className="h-4 w-4" />)}
        {tb('italic', 'Italique (Ctrl+I)', () => exec('italic'), <Italic className="h-4 w-4" />)}
        {tb('underline', 'Souligné (Ctrl+U)', () => exec('underline'), <Underline className="h-4 w-4" />)}
        {sep('s1')}
        <select
          aria-label="Taille du texte sélectionné"
          title="Taille du texte sélectionné"
          value=""
          onChange={(e) => { const px = Number(e.target.value); if (px) applySize(px); }}
          className="h-10 px-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 flex-shrink-0"
        >
          <option value="">Taille</option>
          {SIZES.map((s) => <option key={s} value={s}>{s} px</option>)}
        </select>
        {sep('s2')}
        <button
          type="button" title="Couleur du texte" aria-label="Couleur du texte" aria-expanded={colorsOpen}
          onMouseDown={(e) => { e.preventDefault(); setColorsOpen((v) => !v); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setColorsOpen((v) => !v); } }}
          className={cn('inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors flex-shrink-0',
            colorsOpen ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}
        >
          <Palette className="h-4 w-4" />
        </button>
        {sep('s3')}
        {tb('left', 'Aligner à gauche', () => exec('justifyLeft'), <AlignLeft className="h-4 w-4" />)}
        {tb('center', 'Centrer', () => exec('justifyCenter'), <AlignCenter className="h-4 w-4" />)}
        {tb('right', 'Aligner à droite', () => exec('justifyRight'), <AlignRight className="h-4 w-4" />)}
        {sep('s4')}
        {tb('insertUnorderedList', 'Liste à puces', () => exec('insertUnorderedList'), <List className="h-4 w-4" />)}
        {tb('insertOrderedList', 'Liste numérotée', () => exec('insertOrderedList'), <ListOrdered className="h-4 w-4" />)}
        {tb('clear', 'Effacer la mise en forme de la sélection', () => exec('removeFormat'), <RemoveFormatting className="h-4 w-4" />)}
        {kind === 'description' && sep('s5')}
        {kind === 'description' && <button
          type="button"
          title="Découper le texte en lignes (tirets, retours à la ligne) et mettre les prix en gras"
          onMouseDown={(e) => { e.preventDefault(); structure(); }}
          className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors flex-shrink-0"
        >
          <Wand2 className="h-4 w-4" />Structurer
        </button>}
        {shrunk && (
          <button type="button" onClick={() => setRealSize((v) => !v)} aria-pressed={realSize}
            className="ml-auto h-10 px-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
            {realSize ? 'Toute la carte' : 'Taille réelle'}
          </button>
        )}
        {colorsOpen && (
          <div className="basis-full flex flex-wrap items-center gap-1.5 px-1.5 pt-1 pb-1.5">
            {COLORS.map((c) => (
              <button
                key={c} type="button" title={`Couleur ${c}`} aria-label={`Couleur ${c}`}
                onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c); }}
                style={{ background: c }}
                className="w-7 h-7 rounded-md border border-gray-300 hover:scale-110 transition-transform"
              />
            ))}
            <span className="relative">
              <button type="button" onMouseDown={(e) => { e.preventDefault(); colorInput.current?.click(); }}
                className="h-8 px-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                Autre couleur…
              </button>
              <input ref={colorInput} type="color" tabIndex={-1} aria-hidden className="absolute left-0 bottom-0 opacity-0 w-0 h-0 pointer-events-none"
                onChange={(e) => exec('foreColor', e.target.value)} />
            </span>
          </div>
        )}
      </div>

      {/* ── Le bloc de la carte, tel qu'il sort dans le devis ── */}
      <div ref={outer} className={cn('bg-white', realSize && shrunk && 'overflow-x-auto')}>
        <div className="relative overflow-hidden mx-auto" style={{ width: box.natural * scale, height: box.height * scale }}>
          <div
            ref={inner}
            data-testid="carte-sheet"
            className={cn(PAPER, 'quote-out absolute top-0 left-0 origin-top-left')}
            style={{ width: box.natural, padding: PAD, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
          >
            <div ref={docRef} className="quote-doc" style={{ width: MENU_WIDTH, padding: 0 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
