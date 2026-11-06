// ═══════════════════════════════════════════════════════════════════════════
// Webo : modifier une brochure
// ═══════════════════════════════════════════════════════════════════════════
// Webo décrit ses changements comme une liste d'opérations (texte d'un bloc, page ajoutée, prestation retirée…).
// Elles s'appliquent ici, sans base, deux fois : à la proposition (pour refuser tout de suite ce qui ne tient pas et
// résumer la carte), puis à la validation, sur la brochure telle qu'elle est à ce moment-là. Les opérations visent
// des identifiants : si la brochure a changé entre-temps et qu'ils n'y sont plus, rien n'est écrit.

import { parseBrochureContent, type BrochureContent, type BrochureCover } from '@/lib/brochure';
import {
  addBlock, addPage, layoutError, newBlock, parseLayout, placeBlock, removeBlock, removePage, sanitizeLayout,
  type Block, type BrochureLayout,
} from '@/lib/brochureLayout';
import { sanitizeHtml } from '@/lib/sanitize';

export const BROCHURE_OPS = [
  // Éditeur avancé (pages à blocs).
  'set_text', 'add_block', 'remove_block', 'move_block', 'add_page', 'remove_page',
  // Éditeur simple (sections de prestations).
  'set_about', 'add_section', 'set_section_title', 'remove_section', 'add_prestation', 'remove_prestation', 'set_prestation_text',
] as const;
export type BrochureOpName = typeof BROCHURE_OPS[number];
export const NEW_BLOCK_TYPES = ['title', 'text', 'prestation', 'separator', 'spacer'] as const;

export interface BrochureOp {
  op: BrochureOpName;
  /** Ce qui est visé : bloc, page ou section. */
  target: string | null;
  /** Où mettre : page ou section d'arrivée (ou page après laquelle ajouter une page). */
  where: string | null;
  /** Rang dans la page ou la section, à partir de 0 ; null = à la fin. */
  position: number | null;
  block_type: typeof NEW_BLOCK_TYPES[number] | null;
  level: 'l' | 'm' | 's' | null;
  text: string | null;
  html: string | null;
  prestation_id: string | null;
  /** Nom donné à une page ou une section ajoutée, pour la viser dans les opérations suivantes. */
  ref: string | null;
}

export interface BrochureSettings {
  name: string | null;
  language: 'fr' | 'en' | null;
  showPrices: boolean | null;
  coverTitle: string | null;
  coverSubtitle: string | null;
}

export interface BrochureState {
  name: string;
  editorMode: 'simple' | 'advanced';
  language: string;
  showPrices: boolean;
  cover: BrochureCover;
  content: BrochureContent;
  layout: BrochureLayout | null;
}

/** Ce qui change, à écrire tel quel ; et une ligne lisible par opération pour la carte. */
export interface BrochureChange {
  patch: { name?: string; language?: 'fr' | 'en'; show_prices?: boolean; cover?: BrochureCover; content?: BrochureContent; layout?: BrochureLayout };
  lines: { label: string; detail: string }[];
}

export const MAX_OPS = 60;

/** Texte saisi sans balises : un paragraphe par bloc de lignes. Sinon le HTML, nettoyé. */
export function toHtml(text: string): string {
  const t = text.trim();
  if (/<[a-z][\s\S]*>/i.test(t)) return sanitizeHtml(t);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

/** Aperçu d'un texte pour la carte : sans balises, raccourci. */
export function preview(html: string, max = 90): string {
  const t = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const fail = (m: string): never => { throw new Error(m); };

/** Les blocs d'une page, colonnes comprises, avec la page qui les porte. */
function locate(l: BrochureLayout, blockId: string): { block: Block; page: number } | null {
  for (const [i, p] of l.pages.entries()) for (const b of p.blocks) {
    if (b.id === blockId) return { block: b, page: i + 1 };
    if (b.type === 'columns') for (const c of b.cols) for (const x of c) if (x.id === blockId) return { block: x, page: i + 1 };
  }
  return null;
}

function updateIn(l: BrochureLayout, id: string, fn: (b: Block) => Block): BrochureLayout {
  const map = (list: Block[]): Block[] => list.map((b) => (b.id === id ? fn(b) : b.type === 'columns' ? { ...b, cols: b.cols.map(map) } : b));
  return { pages: l.pages.map((p) => ({ ...p, blocks: map(p.blocks) })) };
}

const KIND_LABEL: Record<string, string> = { cover: 'la couverture', contact: 'la page contact', form: 'le formulaire', blocks: 'une page' };
const TYPE_LABEL: Record<string, string> = { title: 'Titre', text: 'Texte', prestation: 'Prestation', separator: 'Séparateur', spacer: 'Espace', image: 'Image', columns: 'Colonnes' };

/**
 * Applique les opérations. `names` donne le nom des prestations (catalogue de l'entreprise) : une prestation
 * inconnue est refusée. Lève une erreur au message lisible si une opération ne tient pas.
 */
export function applyBrochureUpdate(state: BrochureState, settings: BrochureSettings, ops: BrochureOp[], names: ReadonlyMap<string, string>): BrochureChange {
  if (ops.length > MAX_OPS) fail(`${MAX_OPS} changements au plus par proposition : découpez (par exemple page par page).`);
  const patch: BrochureChange['patch'] = {};
  const lines: BrochureChange['lines'] = [];

  if (settings.name != null) {
    const name = settings.name.trim().slice(0, 120);
    if (!name) fail('Le nom de la brochure ne peut pas être vide.');
    if (name !== state.name) { patch.name = name; lines.push({ label: 'Nom', detail: name }); }
  }
  if (settings.language && settings.language !== state.language) {
    patch.language = settings.language;
    lines.push({ label: 'Langue', detail: settings.language === 'en' ? 'Anglais' : 'Français' });
  }
  if (settings.showPrices != null && settings.showPrices !== state.showPrices) {
    patch.show_prices = settings.showPrices;
    lines.push({ label: 'Prix', detail: settings.showPrices ? 'Affichés' : 'Masqués' });
  }
  if (settings.coverTitle != null || settings.coverSubtitle != null) {
    const cover = { ...state.cover };
    if (settings.coverTitle != null) {
      const title = settings.coverTitle.trim().slice(0, 200);
      if (!title) fail('Le titre de la couverture ne peut pas être vide.');
      cover.title = title;
      lines.push({ label: 'Titre de couverture', detail: title });
    }
    if (settings.coverSubtitle != null) {
      cover.subtitle = settings.coverSubtitle.trim().slice(0, 300) || null;
      lines.push({ label: 'Sous-titre de couverture', detail: cover.subtitle ?? '(retiré)' });
    }
    patch.cover = cover;
  }

  const advancedOps = new Set<BrochureOpName>(['set_text', 'add_block', 'remove_block', 'move_block', 'add_page', 'remove_page']);
  const advanced = state.editorMode === 'advanced';
  for (const o of ops) {
    if (advancedOps.has(o.op) !== advanced) {
      fail(advanced
        ? `« ${o.op} » vaut pour l’éditeur simple ; cette brochure est en éditeur avancé (pages et blocs).`
        : `« ${o.op} » vaut pour l’éditeur avancé ; cette brochure est en éditeur simple (sections de prestations).`);
    }
  }
  const prestationName = (id: string | null) => (id && names.get(id)) || fail('Prestation introuvable dans le catalogue : cherchez-la d’abord (search_catalogue).');

  if (advanced && ops.length) {
    let l = state.layout ?? fail('Cette brochure n’a pas encore de pages à blocs.');
    const refs = new Map<string, string>();
    const pageId = (v: string | null) => {
      const id = (v && refs.get(v)) || v;
      const i = l.pages.findIndex((p) => p.id === id);
      if (i < 0) fail(`Page introuvable : ${v ?? '(aucune)'}. La brochure a peut-être changé : relisez-la.`);
      return { id: l.pages[i].id, n: i + 1, kind: l.pages[i].kind };
    };
    const block = (id: string | null) => (id && locate(l, id)) || fail(`Bloc introuvable : ${id ?? '(aucun)'}. La brochure a peut-être changé : relisez-la.`);

    for (const o of ops) {
      switch (o.op) {
        case 'set_text': {
          const { block: b, page } = block(o.target);
          if (b.type === 'title') {
            const text = (o.text ?? '').trim().slice(0, 200);
            if (!text) fail('Un titre a besoin de texte (champ text).');
            l = updateIn(l, b.id, (x) => ({ ...x, text } as Block));
            lines.push({ label: `Titre, page ${page}`, detail: text });
          } else if (b.type === 'text' || b.type === 'prestation') {
            const raw = o.html ?? o.text;
            if (!raw?.trim()) fail('Un texte a besoin de contenu (champ html).');
            const html = toHtml(raw!).slice(0, 20000);
            l = updateIn(l, b.id, (x) => ({ ...x, html } as Block));
            lines.push({ label: b.type === 'text' ? `Texte, page ${page}` : `Texte de « ${names.get(b.prestationId) ?? 'prestation'} », page ${page}`, detail: preview(html) });
          } else fail(`Un bloc ${TYPE_LABEL[b.type] ?? b.type} n’a pas de texte à changer.`);
          break;
        }
        case 'add_block': {
          const page = pageId(o.where);
          if (page.kind !== 'blocks') fail(`On n’ajoute pas de bloc sur ${KIND_LABEL[page.kind]}.`);
          const type = o.block_type ?? fail('Type de bloc manquant (block_type).');
          let b = newBlock(type, type === 'prestation' ? o.prestation_id ?? undefined : undefined);
          let detail = '';
          if (b.type === 'title') {
            const text = (o.text ?? '').trim().slice(0, 200);
            if (!text) fail('Un titre a besoin de texte (champ text).');
            b = { ...b, text, level: o.level ?? 'm' };
            detail = text;
          } else if (b.type === 'text') {
            const raw = o.html ?? o.text;
            if (!raw?.trim()) fail('Un texte a besoin de contenu (champ html).');
            b = { ...b, html: toHtml(raw!).slice(0, 20000) };
            detail = preview(b.html);
          } else if (b.type === 'prestation') {
            detail = prestationName(o.prestation_id);
            if (o.html?.trim()) b = { ...b, html: toHtml(o.html).slice(0, 20000) };
          }
          l = addBlock(l, page.id, b, o.position != null ? { index: Math.max(0, Math.floor(o.position)) } : undefined);
          lines.push({ label: `${TYPE_LABEL[type]} ajouté, page ${page.n}`, detail });
          break;
        }
        case 'remove_block': {
          const { block: b, page } = block(o.target);
          l = removeBlock(l, b.id);
          lines.push({ label: `${TYPE_LABEL[b.type] ?? 'Bloc'} retiré, page ${page}`, detail: b.type === 'title' ? b.text : b.type === 'text' ? preview(b.html) : b.type === 'prestation' ? names.get(b.prestationId) ?? '' : '' });
          break;
        }
        case 'move_block': {
          const { block: b } = block(o.target);
          const page = pageId(o.where);
          if (page.kind !== 'blocks') fail(`On ne déplace pas de bloc sur ${KIND_LABEL[page.kind]}.`);
          l = placeBlock(l, b.id, { pageId: page.id, index: o.position != null ? Math.max(0, Math.floor(o.position)) : Number.MAX_SAFE_INTEGER });
          lines.push({ label: `${TYPE_LABEL[b.type] ?? 'Bloc'} déplacé`, detail: `vers la page ${page.n}` });
          break;
        }
        case 'add_page': {
          const after = o.where ? pageId(o.where).id : undefined;
          const before = new Set(l.pages.map((p) => p.id));
          l = addPage(l, 'blocks', after);
          const added = l.pages.findIndex((p) => !before.has(p.id));
          if (o.ref) refs.set(o.ref, l.pages[added].id);
          lines.push({ label: 'Page ajoutée', detail: `page ${added + 1}` });
          break;
        }
        case 'remove_page': {
          const page = pageId(o.target);
          if (page.kind === 'form') fail('Le formulaire de demande reste toujours en dernière page.');
          l = removePage(l, page.id);
          lines.push({ label: 'Page retirée', detail: `page ${page.n} (${KIND_LABEL[page.kind]})` });
          break;
        }
        default: break;
      }
    }
    const parsed = parseLayout(l) ?? fail('Mise en page illisible.');
    const problem = layoutError(parsed);
    if (problem) fail(problem);
    patch.layout = sanitizeLayout(parsed);
  }

  if (!advanced && ops.length) {
    let c: BrochureContent = structuredClone(state.content);
    const refs = new Map<string, string>();
    const section = (v: string | null) => {
      const id = (v && refs.get(v)) || v;
      const i = c.sections.findIndex((s) => s.id === id);
      if (i < 0) fail(`Section introuvable : ${v ?? '(aucune)'}. La brochure a peut-être changé : relisez-la.`);
      return c.sections[i];
    };
    for (const o of ops) {
      switch (o.op) {
        case 'set_about': {
          const raw = o.html ?? o.text;
          if (!raw?.trim()) fail('Le texte de présentation a besoin de contenu (champ html).');
          c.about = { ...c.about, enabled: true, html: toHtml(raw!).slice(0, 20000) };
          lines.push({ label: 'Présentation', detail: preview(c.about.html) });
          break;
        }
        case 'add_section': {
          const title = (o.text ?? '').trim().slice(0, 120);
          if (!title) fail('Une section a besoin d’un titre (champ text).');
          const id = `s${Math.random().toString(36).slice(2, 10)}`;
          const at = o.position != null ? Math.max(0, Math.min(Math.floor(o.position), c.sections.length)) : c.sections.length;
          c.sections.splice(at, 0, { id, title, items: [] });
          if (o.ref) refs.set(o.ref, id);
          lines.push({ label: 'Section ajoutée', detail: title });
          break;
        }
        case 'set_section_title': {
          const s = section(o.target);
          const title = (o.text ?? '').trim().slice(0, 120);
          if (!title) fail('Une section a besoin d’un titre (champ text).');
          s.title = title;
          lines.push({ label: 'Titre de section', detail: title });
          break;
        }
        case 'remove_section': {
          const s = section(o.target);
          c.sections = c.sections.filter((x) => x.id !== s.id);
          lines.push({ label: 'Section retirée', detail: `${s.title} (${s.items.length} prestation${s.items.length > 1 ? 's' : ''})` });
          break;
        }
        case 'add_prestation': {
          const s = section(o.where);
          const name = prestationName(o.prestation_id);
          if (c.sections.some((x) => x.items.some((i) => i.prestationId === o.prestation_id))) fail(`« ${name} » est déjà dans la brochure.`);
          const at = o.position != null ? Math.max(0, Math.min(Math.floor(o.position), s.items.length)) : s.items.length;
          s.items.splice(at, 0, { prestationId: o.prestation_id!, ...(o.html?.trim() ? { html: toHtml(o.html).slice(0, 20000) } : {}) });
          lines.push({ label: 'Prestation ajoutée', detail: `${name}, dans « ${s.title} »` });
          break;
        }
        case 'remove_prestation': {
          const s = section(o.target);
          const name = names.get(o.prestation_id ?? '') ?? 'prestation';
          if (!s.items.some((i) => i.prestationId === o.prestation_id)) fail(`« ${name} » n’est pas dans la section « ${s.title} ».`);
          s.items = s.items.filter((i) => i.prestationId !== o.prestation_id);
          lines.push({ label: 'Prestation retirée', detail: `${name}, de « ${s.title} »` });
          break;
        }
        case 'set_prestation_text': {
          const s = section(o.target);
          const item = s.items.find((i) => i.prestationId === o.prestation_id) ?? fail(`Cette prestation n’est pas dans la section « ${s.title} ».`);
          const raw = o.html ?? o.text;
          if (!raw?.trim()) fail('Un texte a besoin de contenu (champ html).');
          item.html = toHtml(raw!).slice(0, 20000);
          lines.push({ label: `Texte de « ${names.get(item.prestationId) ?? 'prestation'} »`, detail: preview(item.html) });
          break;
        }
        default: break;
      }
    }
    // Relu et nettoyé comme ce qu'enregistre l'éditeur.
    c = parseBrochureContent(c);
    patch.content = {
      ...c,
      about: { ...c.about, html: sanitizeHtml(c.about.html) },
      sections: c.sections.map((s) => ({ ...s, title: s.title.slice(0, 120), items: s.items.map((i) => (i.html ? { ...i, html: sanitizeHtml(i.html) } : i)) })),
    };
  }

  if (!lines.length) fail('Rien à changer : la brochure est déjà comme demandé.');
  return { patch, lines };
}
