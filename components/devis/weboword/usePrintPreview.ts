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
import { NEARLY_EMPTY_FILL } from '@/lib/pageBreaks';
import type { QuoteOutputSettings } from '@/lib/quoteOutput';
import { hasCgvTitle } from '@/lib/cgvDetect';
import { MEASURE_FRAME_DOC, measurePrintPages, resolvePath } from './printMeasure';

export interface PageEndMarker {
  /** Numéro de la page qui se termine, dans le document imprimé (page de garde comprise). */
  page: number;
  /** Position du repère dans la feuille de l'éditeur, en pixels (sans le zoom d'affichage). */
  top: number;
  /** Page remplie à moins de 15 %. */
  nearlyEmpty: boolean;
}

export interface PrintPreview {
  markers: PageEndMarker[];
  /** Nombre total de pages à l'impression (null tant que la mesure n'est pas faite). */
  totalPages: number | null;
  /** Le bloc des conditions générales ajouté automatiquement double un titre « Conditions Générales de Vente ». */
  cgvDuplicate: boolean;
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

const MM_TO_PX = 96 / 25.4;
const SHEET_WIDTH_PX = 210 * MM_TO_PX;
const DEBOUNCE_MS = 300;

export function usePrintPreview(o: Options): PrintPreview {
  const [preview, setPreview] = useState<PrintPreview>({ markers: [], totalPages: null, cgvDuplicate: false });
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
    const { blocks, paths, result, coverPages: cover, totalPages } = measured;

    // Report sur la feuille de l'éditeur (affichée éventuellement réduite sur téléphone).
    const sheetRect = sheet.getBoundingClientRect();
    const scale = sheetRect.width > 0 ? sheetRect.width / SHEET_WIDTH_PX : 1;
    const editorRect = editor.getBoundingClientRect();
    const editorBottom = (editorRect.bottom - sheetRect.top) / scale - (parseFloat(getComputedStyle(editor).paddingBottom) || 0);
    const markers: PageEndMarker[] = [];
    for (const end of result.ends) {
      const path = paths[end.blockIndex];
      let top: number | null = null;
      if (path && path.length === 0) top = editorBottom;
      else if (path) {
        const el = resolvePath(editor, path);
        if (el) {
          const r = el.getBoundingClientRect();
          const measured = blocks[end.blockIndex].height;
          const inside = end.offsetInBlock > 0 && measured > 0 ? (end.offsetInBlock / measured) * (r.height / scale) : -3;
          top = (r.top - sheetRect.top) / scale + inside;
        }
      }
      if (top === null) continue;
      markers.push({ page: end.page + cover, top: Math.round(top), nearlyEmpty: end.fill < NEARLY_EMPTY_FILL });
    }

    setPreview((prev) => {
      const same = prev.totalPages === totalPages && prev.cgvDuplicate === cgvDuplicate
        && prev.markers.length === markers.length
        && prev.markers.every((m, i) => m.page === markers[i].page && m.top === markers[i].top && m.nearlyEmpty === markers[i].nearlyEmpty);
      return same ? prev : { markers, totalPages, cgvDuplicate };
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
    const resize = new ResizeObserver(schedule);
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
