'use client';

// Fins de page de la sortie papier, affichées dans l'éditeur.
//
// La feuille de l'éditeur n'a pas exactement la mise en forme imprimée (styles de l'application, marges
// différentes). Le document est donc recopié dans un cadre caché, à la largeur d'une feuille A4, avec la même
// feuille de style que la fenêtre d'impression (quoteOutputCss, règles d'impression comprises) et les mêmes
// repères (plats longs, cadre de signature). Les blocs y sont mesurés, computePageBreaks (lib/pageBreaks.ts)
// place les fins de page, puis chaque fin est reportée à l'endroit correspondant de la feuille de l'éditeur.
// Rien n'est écrit dans le contenu du devis.

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { QuoteOutputSettings } from '@/lib/quoteOutput';
import { hasCgvTitle } from '@/lib/cgvDetect';
import { MEASURE_FRAME_DOC, measurePrintPages } from './printMeasure';
import { layoutPages, type PageBand } from './pageView';

export interface PrintPreview {
  /** Bandes entre les feuilles de la vue en pages. */
  bands: PageBand[];
  /** Hauteur des feuilles de la vue en pages (px CSS), null avant la première mesure. */
  sheetHeight: number | null;
  /** Nombre total de pages à l'impression (null tant que la mesure n'est pas faite). */
  totalPages: number | null;
  /** Le bloc des conditions générales ajouté automatiquement double un titre « Conditions Générales de Vente ». */
  cgvDuplicate: boolean;
  /** Les conditions de vente de l'entreprise seront ajoutées à l'impression, sur une page à part. */
  addCgv: boolean;
}

interface Options {
  /** La zone de texte de l'éditeur. */
  editorRef: RefObject<HTMLDivElement | null>;
  /** La feuille blanche qui l'entoure (210 mm de large), où sont posés les repères. */
  sheetRef: RefObject<HTMLDivElement | null>;
  settings: QuoteOutputSettings;
  coverEnabled: boolean;
  /** Nombre de pages photos imprimées après le document. */
  photoPages: number;
  /** Logo imprimé au-dessus du document quand il n'y a pas de page de garde (HTML nettoyé). */
  logoHtml: string;
  /** Mentions légales imprimées sous le document (HTML nettoyé). */
  legalHtml: string;
  /** Bloc des conditions de vente ajouté à l'impression s'il n'est pas déjà dans le document (HTML nettoyé). */
  cgvHtml: string;
  /** Texte des conditions de vente de l'entreprise. */
  cgvText: string | null;
}

const DEBOUNCE_MS = 300;
/** Sélecteur de la zone de texte de l'éditeur, racine des règles de la vue en pages. */
const EDITOR_SELECTOR = '#weboword-sheet';

export function usePrintPreview(o: Options): PrintPreview {
  const [preview, setPreview] = useState<PrintPreview>({ bands: [], sheetHeight: null, totalPages: null, cgvDuplicate: false, addCgv: false });
  const styleRef = useRef<HTMLStyleElement | null>(null);
  // Hauteur de la zone de texte après la pose de la vue en pages : un redimensionnement qui n'en vient pas
  // relance la mesure, celui que provoquent nos propres marges est ignoré.
  const appliedHeightRef = useRef<number | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optsRef = useRef(o);
  optsRef.current = o;
  const measureRef = useRef<() => void>(() => {});
  // Dernier contenu recopié dans le cadre : on ne le réécrit que s'il a changé (sinon les images s'y
  // rechargeraient et relanceraient la mesure sans fin).
  const writtenRef = useRef<Map<Element, string>>(new Map());

  // Mesure : recopie le document dans le cadre caché, place les fins de page, puis les reporte sur la feuille.
  measureRef.current = () => {
    const { editorRef, sheetRef, settings, coverEnabled, photoPages, logoHtml, legalHtml, cgvHtml, cgvText } = optsRef.current;
    const editor = editorRef.current;
    const sheet = sheetRef.current;
    const frame = frameRef.current;
    const idoc = frame?.contentDocument;
    const iwin = frame?.contentWindow;
    if (!editor || !sheet || !idoc || !iwin || !readyRef.current) return;
    const html = editor.innerHTML;

    // Conditions générales en double : bloc ajouté + titre tapé ailleurs dans le texte.
    let cgvDuplicate = false;
    if (editor.querySelector('[data-webo-cgv]')) {
      const clone = editor.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-webo-cgv]').forEach((b) => b.remove());
      cgvDuplicate = hasCgvTitle(clone.innerHTML);
    }

    const measured = measurePrintPages(idoc, iwin, {
      html, settings, coverEnabled, photoPages, logoHtml, legalHtml, cgvHtml, cgvText,
    }, writtenRef.current);
    if (!measured) return;
    const { totalPages, addCgv } = measured;

    // Vue en pages : chaque page commence sur sa propre feuille, comme sur le papier.
    const style = styleRef.current;
    if (!style) return;
    const view = layoutPages(measured, editor, EDITOR_SELECTOR, sheet, style);
    appliedHeightRef.current = editor.offsetHeight;
    // Le contenu enregistré ne doit jamais porter la vue en pages.
    if (process.env.NODE_ENV !== 'production' && editor.innerHTML !== html) console.error('Vue en pages : le contenu du devis a changé pendant la mesure.');

    const bands = view.bands.map((b) => ({ ...b, top: Math.round(b.top * 100) / 100 }));
    const sheetHeight = Math.ceil(view.height);
    setPreview((prev) => {
      const same = prev.totalPages === totalPages && prev.cgvDuplicate === cgvDuplicate && prev.sheetHeight === sheetHeight && prev.addCgv === addCgv
        && prev.bands.length === bands.length
        && prev.bands.every((m, i) => m.nextPage === bands[i].nextPage && m.top === bands[i].top && m.nearlyEmpty === bands[i].nearlyEmpty && m.cut === bands[i].cut);
      return same ? prev : { bands, sheetHeight, totalPages, cgvDuplicate, addCgv };
    });
  };

  // Cadre de mesure caché, créé une fois.
  useEffect(() => {
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { try { measureRef.current(); } catch { /* mesure impossible : pas de repères */ } }, DEBOUNCE_MS);
    };
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.title = 'Mesure des pages';
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:200px;border:0;visibility:hidden;pointer-events:none;';
    frame.srcdoc = MEASURE_FRAME_DOC;
    const style = document.createElement('style');
    style.setAttribute('data-weboword-pages', '');
    document.head.appendChild(style);
    styleRef.current = style;
    const onFrameLoad = () => {
      readyRef.current = true;
      const idoc = frame.contentDocument;
      // Polices et images du cadre : la mise en page change quand elles arrivent.
      idoc?.fonts?.addEventListener?.('loadingdone', schedule);
      idoc?.addEventListener('load', schedule, true);
      schedule();
    };
    frame.addEventListener('load', onFrameLoad);
    document.body.appendChild(frame);
    frameRef.current = frame;

    const editor = optsRef.current.editorRef.current;
    const mutations = new MutationObserver(schedule);
    if (editor) mutations.observe(editor, { subtree: true, childList: true, characterData: true, attributes: true });
    const resize = new ResizeObserver(() => {
      if (editor && editor.offsetHeight === appliedHeightRef.current) return;
      schedule();
    });
    if (editor) resize.observe(editor);
    window.addEventListener('resize', schedule);
    document.fonts?.addEventListener?.('loadingdone', schedule);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      document.fonts?.removeEventListener?.('loadingdone', schedule);
      frame.removeEventListener('load', onFrameLoad);
      frame.remove();
      frameRef.current = null;
      style.remove();
      styleRef.current = null;
      readyRef.current = false;
      writtenRef.current = new Map();
    };
  }, []);

  // Réglages qui changent la mise en page : nouvelle mesure.
  const { font, fontSize, lineHeight, showDesc } = o.settings;
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { try { measureRef.current(); } catch { /* rien */ } }, DEBOUNCE_MS);
  }, [font, fontSize, lineHeight, showDesc, o.coverEnabled, o.photoPages, o.logoHtml, o.legalHtml, o.cgvHtml, o.cgvText]);

  return preview;
}
