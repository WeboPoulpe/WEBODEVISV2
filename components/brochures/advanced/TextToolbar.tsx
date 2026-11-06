'use client';

// Barre de mise en forme d'un bloc Texte (panneau de droite de l'éditeur avancé). Elle agit sur la sélection faite
// dans la page (EditableText) : gras, italique, souligné, taille, couleur, police, alignement, listes, effacer.
// Les tailles sont relatives (em) : le texte suit la taille de la page, à l'écran comme sur le lien public.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Minus, Plus, Redo2, RemoveFormatting, Underline, Undo2,
} from 'lucide-react';
import { BLOCK_FONTS, PALETTE } from '@/lib/brochureLayout';
import { cn } from '@/lib/utils';
import { TEXT_ATTR } from '../EditableText';

/** Couleurs proposées : celles de la palette des brochures, puis quelques teintes de texte courantes. */
const COLORS = [...PALETTE.filter((c) => c !== '#FBF7F0' && c !== '#EDE6DA' && c !== '#E6DFD3'), '#5b2638', '#a8844f', '#5f6e52', '#1565c0', '#c62828'];

/** La zone de texte de la brochure qui contient ce nœud, s'il y en a une. */
const zoneOf = (node: Node | null): HTMLElement | null =>
  (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>(`[${TEXT_ATTR}]`) ?? null;

export default function TextToolbar() {
  // Dernière sélection faite dans le texte : les listes déroulantes et le nuancier prennent le focus, on la remet.
  const saved = useRef<Range | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [inText, setInText] = useState(false);

  useEffect(() => {
    const onSelection = () => {
      const sel = document.getSelection();
      if (!sel?.rangeCount || !zoneOf(sel.anchorNode)) return;
      saved.current = sel.getRangeAt(0).cloneRange();
      setInText(true);
      const next = new Set<string>();
      for (const c of ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight']) {
        try { if (document.queryCommandState(c)) next.add(c); } catch { /* commande inconnue */ }
      }
      setActive(next);
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  /** Remet la sélection dans le texte ; la zone, ou null si on n'y a encore rien sélectionné. */
  const restore = (): HTMLElement | null => {
    const range = saved.current;
    const zone = range && zoneOf(range.commonAncestorContainer);
    if (!range || !zone || !zone.isConnected) return null;
    zone.focus({ preventScroll: true });
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return zone;
  };

  /** Le texte a changé : la zone l'annonce comme une frappe, et l'éditeur l'enregistre. */
  const changed = (zone: HTMLElement) => zone.dispatchEvent(new Event('input', { bubbles: true }));

  const run = (cmd: string, value?: string, css = false) => {
    const zone = restore();
    if (!zone) return;
    document.execCommand('styleWithCSS', false, css ? 'true' : 'false');
    document.execCommand(cmd, false, value);
    changed(zone);
  };

  /** Plus grand ou plus petit que le texte autour : execCommand ne connaît que 7 tailles, on remplace son résultat. */
  const resize = (factor: number) => {
    const zone = restore();
    if (!zone || document.getSelection()?.isCollapsed) return;
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    zone.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement('span');
      span.style.fontSize = `${factor}em`;
      span.append(...font.childNodes);
      font.replaceWith(span);
    });
    changed(zone);
  };

  const btn = (key: string, label: string, icon: ReactNode, onPress: () => void) => (
    <button key={key} type="button" title={label} aria-label={label} aria-pressed={active.has(key)}
      // Le clic ne prend pas le focus : la sélection reste dans la page.
      onMouseDown={(e) => { e.preventDefault(); onPress(); }}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        active.has(key) ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
      {icon}
    </button>
  );
  const sep = (key: string) => <span key={key} aria-hidden className="mx-0.5 h-5 w-px bg-gray-200" />;
  const icon = 'h-4 w-4';

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {inText ? 'Sélectionnez du texte dans la page, puis choisissez sa mise en forme.' : 'Cliquez dans le texte, sur la page, pour écrire directement dedans.'}
      </p>
      <div role="toolbar" aria-label="Mise en forme du texte" className="flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {btn('bold', 'Gras (Ctrl+B)', <Bold className={icon} />, () => run('bold'))}
        {btn('italic', 'Italique (Ctrl+I)', <Italic className={icon} />, () => run('italic'))}
        {btn('underline', 'Souligné (Ctrl+U)', <Underline className={icon} />, () => run('underline'))}
        {sep('s1')}
        {btn('smaller', 'Texte plus petit', <Minus className={icon} />, () => resize(0.85))}
        {btn('bigger', 'Texte plus grand', <Plus className={icon} />, () => resize(1.18))}
        {sep('s2')}
        {btn('justifyLeft', 'Aligner à gauche', <AlignLeft className={icon} />, () => run('justifyLeft'))}
        {btn('justifyCenter', 'Centrer', <AlignCenter className={icon} />, () => run('justifyCenter'))}
        {btn('justifyRight', 'Aligner à droite', <AlignRight className={icon} />, () => run('justifyRight'))}
        {sep('s3')}
        {btn('insertUnorderedList', 'Liste à puces', <List className={icon} />, () => run('insertUnorderedList'))}
        {btn('insertOrderedList', 'Liste numérotée', <ListOrdered className={icon} />, () => run('insertOrderedList'))}
        {sep('s4')}
        {btn('removeFormat', 'Effacer la mise en forme', <RemoveFormatting className={icon} />, () => run('removeFormat'))}
        {btn('undo', 'Annuler (Ctrl+Z)', <Undo2 className={icon} />, () => run('undo'))}
        {btn('redo', 'Rétablir (Ctrl+Y)', <Redo2 className={icon} />, () => run('redo'))}
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-gray-700">Couleur du texte</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {COLORS.map((c) => (
            <button key={c} type="button" title={c} aria-label={`Couleur ${c}`} onMouseDown={(e) => { e.preventDefault(); run('foreColor', c, true); }}
              className="h-6 w-6 rounded-full border border-gray-300 shadow-sm" style={{ background: c }} />
          ))}
          <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-dashed border-gray-400" title="Autre couleur">
            <span className="sr-only">Autre couleur</span>
            <span aria-hidden className="flex h-full w-full items-center justify-center text-xs text-gray-500">+</span>
            <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => run('foreColor', e.target.value, true)} />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">Police du texte sélectionné</span>
        <select defaultValue="" onChange={(e) => { if (e.target.value) run('fontName', e.target.value, true); e.target.value = ''; }}
          className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm">
          <option value="">Choisir une police…</option>
          {BLOCK_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </label>
    </div>
  );
}
