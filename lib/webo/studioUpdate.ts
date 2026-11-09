// ═══════════════════════════════════════════════════════════════════════════
// Webo : modifier les pages d'une brochure du Studio
// ═══════════════════════════════════════════════════════════════════════════
// Mêmes opérations que pour l'éditeur avancé, appliquées aux pages composées librement : changer le texte d'un
// élément, ajouter un titre, un texte ou une prestation (posés sous le dernier élément de la page), retirer un
// élément, ajouter une page (vierge ou d'après un modèle), retirer une page. Sans base : appliqué à la proposition
// puis à la validation, sur les pages telles qu'elles sont alors.

import {
  PAGE_H, PAGE_TEMPLATES, blankPage, prestationEl, studioError, textEl,
  type StudioDoc, type StudioPage, type TemplateContext,
} from '@/lib/brochureStudio';
import { preview, toHtml, type BrochureOp, type BrochureOpName } from './brochureUpdate';

const fail = (m: string): never => { throw new Error(m); };
export const STUDIO_OPS = new Set<BrochureOpName>(['set_text', 'add_block', 'remove_block', 'add_page', 'remove_page']);

const plain = (html: string) => preview(html, 400);

/** Les pages telles que Webo les lit : identifiants, éléments et leurs textes. */
export function studioView(doc: StudioDoc, names: ReadonlyMap<string, string>) {
  return doc.pages.map((p, i) => ({
    id: p.id, n: i + 1, ...(p.form ? { form_page: true } : {}),
    elements: p.els.map((e) => {
      switch (e.type) {
        case 'text': return { id: e.id, type: 'text', html: e.html.length > 3000 ? `${e.html.slice(0, 3000)}…` : e.html };
        case 'prestation': return { id: e.id, type: 'prestation', prestation: { id: e.prestationId, name: names.get(e.prestationId) ?? '(retirée du catalogue)' }, own_text: e.html ? plain(e.html) : null };
        case 'image': return { id: e.id, type: 'image', has_photo: !!e.url };
        default: return { id: e.id, type: e.type };
      }
    }),
  }));
}

export function applyStudioUpdate(
  doc: StudioDoc, ops: BrochureOp[], names: ReadonlyMap<string, string>, ctx: TemplateContext,
): { doc: StudioDoc; lines: { label: string; detail: string }[] } {
  let pages: StudioPage[] = structuredClone(doc.pages);
  const lines: { label: string; detail: string }[] = [];
  const refs = new Map<string, string>();
  const pageAt = (id: string | null) => {
    const key = id ? refs.get(id) ?? id : null;
    const i = key ? pages.findIndex((p) => p.id === key) : -1;
    return i < 0 ? fail(`Page « ${id ?? '?'} » introuvable : relisez la brochure.`) : i;
  };
  const elementAt = (id: string | null) => {
    for (const [pi, p] of pages.entries()) {
      const ei = p.els.findIndex((e) => e.id === id);
      if (ei >= 0) return { pi, ei };
    }
    return fail(`Élément « ${id ?? '?'} » introuvable : relisez la brochure.`);
  };

  for (const o of ops) {
    if (!STUDIO_OPS.has(o.op)) fail(`Brochure du Studio : opération « ${o.op} » impossible (seulement set_text, add_block, remove_block, add_page, remove_page).`);
    switch (o.op) {
      case 'set_text': {
        const { pi, ei } = elementAt(o.target);
        const e = pages[pi].els[ei];
        const html = toHtml(o.html ?? o.text ?? '');
        if (!html) fail('Texte vide.');
        if (e.type === 'text') pages[pi].els[ei] = { ...e, html };
        else if (e.type === 'prestation') pages[pi].els[ei] = { ...e, html, titled: false };
        else fail('Seuls les textes et les prestations ont un texte.');
        lines.push({ label: `Texte, page ${pi + 1}`, detail: plain(html) });
        break;
      }
      case 'add_block': {
        const pi = pageAt(o.where);
        const page = pages[pi];
        const bottom = Math.max(8, ...page.els.filter((e) => e.type !== 'form').map((e) => e.y + e.h)) + 3;
        if (bottom > PAGE_H - 10) fail(`La page ${pi + 1} est pleine : ajoutez plutôt une page.`);
        if (o.block_type === 'prestation') {
          if (!o.prestation_id || !names.has(o.prestation_id)) fail('Prestation inconnue : cherchez-la avec search_catalogue.');
          page.els.push(prestationEl({ x: 8, y: bottom, w: 84, h: Math.min(40, PAGE_H - 6 - bottom), prestationId: o.prestation_id!, photo: 'left' }));
          lines.push({ label: `Prestation ajoutée, page ${pi + 1}`, detail: names.get(o.prestation_id!)! });
        } else if (o.block_type === 'title' || o.block_type === 'text') {
          const html = toHtml(o.html ?? o.text ?? '');
          if (!html) fail('Texte vide.');
          const title = o.block_type === 'title';
          page.els.push(textEl({ x: 8, y: bottom, w: 84, html, size: title ? (o.level === 'l' ? 8 : o.level === 's' ? 4 : 5.5) : 3.4, font: title ? 'Playfair Display' : 'Georgia', lineHeight: title ? 1.15 : 1.5, role: title ? (o.level === 'l' ? 'h1' : 'h2') : 'body' }));
          lines.push({ label: `${title ? 'Titre' : 'Texte'} ajouté, page ${pi + 1}`, detail: plain(html) });
        } else fail('Studio : on ajoute un titre, un texte ou une prestation.');
        break;
      }
      case 'remove_block': {
        const { pi, ei } = elementAt(o.target);
        if (pages[pi].els[ei].type === 'form') fail('Le formulaire ne se retire pas.');
        pages[pi].els.splice(ei, 1);
        lines.push({ label: `Élément retiré, page ${pi + 1}`, detail: '' });
        break;
      }
      case 'add_page': {
        const formAt = pages.length - 1;
        const at = o.where ? Math.min(pageAt(o.where) + 1, formAt) : formAt;
        const template = o.text ? PAGE_TEMPLATES.find((t) => t.id === o.text) : null;
        const page = template ? template.make(ctx, []) : blankPage();
        pages = [...pages.slice(0, at), page, ...pages.slice(at)];
        if (o.ref) refs.set(o.ref, page.id);
        lines.push({ label: `Page ajoutée (page ${at + 1})`, detail: template?.label ?? 'Page vierge' });
        break;
      }
      case 'remove_page': {
        const pi = pageAt(o.target);
        if (pages[pi].form) fail('La page du formulaire ne se retire pas.');
        pages.splice(pi, 1);
        lines.push({ label: `Page ${pi + 1} retirée`, detail: '' });
        break;
      }
    }
  }
  const next = { ...doc, pages };
  const problem = studioError(next);
  if (problem) fail(problem);
  return { doc: next, lines };
}
