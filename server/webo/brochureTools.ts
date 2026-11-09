import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { brochures, prestations } from '@/db/schema';
import { parseBrochureContent, type BrochureCover } from '@/lib/brochure';
import { parseLayout, type Block } from '@/lib/brochureLayout';
import { applyBrochureUpdate, BROCHURE_OPS, NEW_BLOCK_TYPES, preview, type BrochureOp, type BrochureSettings, type BrochureState } from '@/lib/webo/brochureUpdate';
import { companyIdsOf } from '../companyScope';
import { fail, isUuid, nullableStr, propose, tool, type Handler, type ToolContext } from './toolKit';

// Outils de Webo pour modifier une brochure : la lire (pages et blocs, ou sections), puis proposer une liste de
// changements que le traiteur valide. Les changements s'appliquent dans lib/webo/brochureUpdate.ts.

type Row = typeof brochures.$inferSelect;

export async function brochureOf(companyId: string, id: unknown): Promise<Row> {
  if (!isUuid(id)) fail('Brochure introuvable.');
  const [b] = await db.select().from(brochures).where(and(eq(brochures.id, id as string), sql`${brochures.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  return b ?? fail('Brochure introuvable.');
}

export function stateOf(b: Row): BrochureState {
  const cover = (b.cover && typeof b.cover === 'object' ? b.cover : {}) as Partial<BrochureCover>;
  return {
    name: b.name,
    editorMode: b.editor_mode === 'advanced' ? 'advanced' : 'simple',
    language: b.language,
    showPrices: b.show_prices,
    cover: { ...cover, title: typeof cover.title === 'string' && cover.title ? cover.title : b.name },
    content: parseBrochureContent(b.content),
    layout: parseLayout(b.layout),
  };
}

/** Noms des prestations de l'entreprise parmi `ids` (les autres sont ignorées) ; `q` : la transaction en cours. */
export async function prestationNames(companyId: string, ids: string[], q: Pick<typeof db, 'select'> = db): Promise<Map<string, string>> {
  const valid = [...new Set(ids.filter(isUuid))];
  if (!valid.length) return new Map();
  const rows = await q.select({ id: prestations.id, name: prestations.name }).from(prestations)
    .where(and(inArray(prestations.id, valid), sql`${prestations.user_id} in ${companyIdsOf(companyId)}`));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Prestations citées par la brochure et par les opérations. */
export function idsOf(s: BrochureState, ops: BrochureOp[] = []): string[] {
  const fromLayout = (s.layout?.pages ?? []).flatMap((p) => p.blocks.flatMap((b) => (b.type === 'columns' ? b.cols.flat() : [b])))
    .flatMap((b) => (b.type === 'prestation' ? [b.prestationId] : []));
  const fromContent = s.content.sections.flatMap((x) => x.items.map((i) => i.prestationId));
  return [...fromLayout, ...fromContent, ...ops.flatMap((o) => (o.prestation_id ? [o.prestation_id] : []))];
}

const HTML_MAX = 4000;
const cut = (html: string) => (html.length > HTML_MAX ? `${html.slice(0, HTML_MAX)}…[texte coupé]` : html);

function blockView(b: Block, names: ReadonlyMap<string, string>): Record<string, unknown> {
  switch (b.type) {
    case 'title': return { id: b.id, type: 'title', level: b.level, text: b.text };
    case 'text': return { id: b.id, type: 'text', html: cut(b.html) };
    case 'prestation': return { id: b.id, type: 'prestation', prestation: { id: b.prestationId, name: names.get(b.prestationId) ?? '(retirée du catalogue)' }, html: b.html ? cut(b.html) : null };
    case 'columns': return { id: b.id, type: 'columns', cols: b.cols.map((c) => c.map((x) => blockView(x, names))) };
    case 'image': return { id: b.id, type: 'image', has_photo: !!b.url };
    default: return { id: b.id, type: b.type };
  }
}

/** La brochure, telle que Webo la lit : identifiants à reprendre dans les opérations. */
export async function brochureView(companyId: string, b: Row) {
  const s = stateOf(b);
  const names = await prestationNames(companyId, idsOf(s));
  const base = {
    id: b.id, name: b.name, editor: s.editorMode, language: b.language, show_prices: b.show_prices, active: b.is_active,
    cover: { title: s.cover.title, subtitle: s.cover.subtitle ?? null },
  };
  if (b.editor_mode === 'studio') {
    return { ...base, editor: 'studio', note: 'Brochure composée dans le Studio : Webo peut changer son nom, sa langue et l’affichage des prix, pas encore ses pages.' };
  }
  if (s.editorMode === 'advanced') {
    return { ...base, pages: (s.layout?.pages ?? []).map((p, i) => ({ id: p.id, n: i + 1, kind: p.kind, ...(p.kind === 'blocks' ? { blocks: p.blocks.map((x) => blockView(x, names)) } : {}) })) };
  }
  return {
    ...base,
    about: { shown: s.content.about.enabled, html: cut(s.content.about.html) },
    sections: s.content.sections.map((x) => ({
      id: x.id, title: x.title,
      prestations: x.items.map((i) => ({ id: i.prestationId, name: names.get(i.prestationId) ?? '(retirée du catalogue)', own_text: i.html ? cut(i.html) : null })),
    })),
  };
}

const opSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', enum: [...BROCHURE_OPS] },
    target: nullableStr, where: nullableStr,
    position: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    block_type: { anyOf: [{ type: 'string', enum: [...NEW_BLOCK_TYPES] }, { type: 'null' }] },
    level: { anyOf: [{ type: 'string', enum: ['l', 'm', 's'] }, { type: 'null' }] },
    text: nullableStr, html: nullableStr, prestation_id: nullableStr, ref: nullableStr,
  },
  required: ['op', 'target', 'where', 'position', 'block_type', 'level', 'text', 'html', 'prestation_id', 'ref'],
  additionalProperties: false,
};

export const BROCHURE_TOOLS: Record<string, Anthropic.Tool> = {
  get_brochure: tool('get_brochure', 'Lit une brochure : réglages, couverture, et ses pages à blocs (éditeur avancé) ou ses sections de prestations (éditeur simple), avec les identifiants à reprendre dans propose_brochure_update.', {
    brochure_id: { type: 'string' },
  }),
  propose_brochure_update: tool('propose_brochure_update', `Propose de modifier une brochure (lisez-la d'abord avec get_brochure). Réglages : null = inchangé. Opérations, dans l'ordre :
- éditeur avancé : set_text (target = bloc ; text pour un titre, html pour un texte ou le texte propre d'une prestation), add_block (where = page, block_type, position ; text/level pour un titre, html pour un texte, prestation_id pour une prestation), remove_block (target = bloc), move_block (target = bloc, where = page, position), add_page (where = page après laquelle l'ajouter, null = avant le formulaire ; ref = nom pour la viser ensuite comme where), remove_page (target = page) ;
- éditeur simple : set_about (html), add_section (text = titre, position, ref), set_section_title (target = section, text), remove_section (target = section), add_prestation (where = section, prestation_id, position), remove_prestation (target = section, prestation_id), set_prestation_text (target = section, prestation_id, html).
html : paragraphes <p>, <strong>, <em>, listes ; du texte simple est accepté. Champs inutiles d'une opération : null.`, {
    brochure_id: { type: 'string' },
    name: nullableStr,
    language: { anyOf: [{ type: 'string', enum: ['fr', 'en'] }, { type: 'null' }] },
    show_prices: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    cover_title: nullableStr, cover_subtitle: nullableStr,
    ops: { type: 'array', items: opSchema },
  }),
};

export const settingsOf = (i: Record<string, unknown>): BrochureSettings => ({
  name: typeof i.name === 'string' ? i.name : null,
  language: i.language === 'fr' || i.language === 'en' ? i.language : null,
  showPrices: typeof i.show_prices === 'boolean' ? i.show_prices : null,
  coverTitle: typeof i.cover_title === 'string' ? i.cover_title : null,
  coverSubtitle: typeof i.cover_subtitle === 'string' ? i.cover_subtitle : null,
});

const OP_FIELDS = ['target', 'where', 'position', 'block_type', 'level', 'text', 'html', 'prestation_id', 'ref'] as const;
export function opsOf(raw: unknown): BrochureOp[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o): BrochureOp[] => {
    if (!o || typeof o !== 'object' || !BROCHURE_OPS.includes((o as BrochureOp).op)) return [];
    const r = o as Record<string, unknown>;
    const op = { op: r.op } as BrochureOp;
    for (const k of OP_FIELDS) (op as unknown as Record<string, unknown>)[k] = r[k] ?? null;
    if (op.position != null && !Number.isFinite(Number(op.position))) op.position = null;
    return [op];
  });
}

export const BROCHURE_HANDLERS: Record<string, Handler> = {
  async get_brochure(ctx: ToolContext, i) {
    return brochureView(ctx.companyId, await brochureOf(ctx.companyId, i.brochure_id));
  },

  async propose_brochure_update(ctx: ToolContext, i) {
    const b = await brochureOf(ctx.companyId, i.brochure_id);
    const state = stateOf(b);
    const settings = settingsOf(i);
    const ops = opsOf(i.ops);
    if (b.editor_mode === 'studio' && ops.length) return fail('Cette brochure est composée dans le Studio : ses pages se modifient dans l’éditeur. Seuls son nom, sa langue et l’affichage des prix peuvent être changés ici.');
    const names = await prestationNames(ctx.companyId, idsOf(state, ops));
    let change;
    try { change = applyBrochureUpdate(state, settings, ops, names); } catch (e) { return fail((e as Error).message); }
    return propose(ctx, 'brochure_update', { brochureId: b.id, settings, ops }, {
      title: `Modifier la brochure « ${b.name} »`,
      fields: [{ label: 'Changements', value: String(change.lines.length) }],
      lines: change.lines.map((l) => ({ label: l.label, detail: preview(l.detail, 140), amount: '' })),
      note: 'Rien n’est écrit avant votre validation. Si la brochure a changé entre-temps, ces changements sont refusés.',
    });
  },
};
