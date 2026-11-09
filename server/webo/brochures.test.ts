import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Webo et les brochures : lecture limitée à l'entreprise, proposition sans écriture, validation appliquée à la
// brochure telle qu'elle est au moment du clic.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000301';
const OTHER = '00000000-0000-4000-8000-000000000302';
const MENU = '00000000-0000-4000-8000-000000000311';
const FOREIGN = '00000000-0000-4000-8000-000000000312';
const BROCHURE = '00000000-0000-4000-8000-000000000321';
const SIMPLE = '00000000-0000-4000-8000-000000000322';
const THEIRS = '00000000-0000-4000-8000-000000000323';
vi.mock('../session', () => ({
  requireUser: async () => ({ id: CHEF, email: 'c@b.fr' }),
  requireWriter: async () => ({ id: CHEF, email: 'c@b.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool, toolsFor } = await import('./tools');
const { decideProposal } = await import('./execute');

let conv = '';
const call = async (name: string, input: unknown) => JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, name, input));
const op = (o: Record<string, unknown>) => ({ target: null, where: null, position: null, block_type: null, level: null, text: null, html: null, prestation_id: null, ref: null, ...o });
const update = (brochure_id: string, ops: unknown[], settings: Record<string, unknown> = {}) =>
  call('propose_brochure_update', { brochure_id, name: null, language: null, show_prices: null, cover_title: null, cover_subtitle: null, ...settings, ops });
const layoutOf = async (id: string) => (await pg.query<{ layout: { pages: { id: string; kind: string; blocks: { id: string; type: string; text?: string; html?: string }[] }[] } }>(`select layout from brochures where id = $1`, [id])).rows[0].layout;

const LAYOUT = { pages: [
  { id: 'pc', kind: 'cover', blocks: [] },
  { id: 'p1', kind: 'blocks', blocks: [{ id: 'b1', type: 'title', text: 'Nos menus', level: 'm' }, { id: 'b2', type: 'text', html: '<p>Bonjour</p>' }] },
  { id: 'pf', kind: 'form', blocks: [] },
] };

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@b.fr', 'x'), ('${OTHER}', 'o@b.fr', 'x');
    insert into profiles (id, email, company_name) values ('${CHEF}', 'c@b.fr', 'Traiteur'), ('${OTHER}', 'o@b.fr', 'Autre');
    insert into prestations (id, user_id, name, unit_price) values ('${MENU}', '${CHEF}', 'Menu Tentation', 76), ('${FOREIGN}', '${OTHER}', 'Menu Secret', 90);
  `);
  await pg.query(`insert into brochures (id, owner_user_id, user_id, name, share_token, cover, content, editor_mode, layout) values
    ($1, $4, $4, 'Carte 2027', 't1', '{"title":"Carte 2027"}', '{}', 'advanced', $5),
    ($2, $4, $4, 'Carte simple', 't2', '{}', $6, 'simple', null),
    ($3, $7, $7, 'Leur carte', 't3', '{}', '{}', 'simple', null)`,
  [BROCHURE, SIMPLE, THEIRS, CHEF, JSON.stringify(LAYOUT), JSON.stringify({ about: { enabled: false, html: '' }, contact: { enabled: true }, sections: [{ id: 's1', title: 'Dîners', items: [] }] }), OTHER]);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);

describe('Webo modifie une brochure', () => {
  it('le spécialiste Brochures a ses outils', () => {
    expect(toolsFor('brochures').map((t) => t.name)).toEqual(expect.arrayContaining(['get_brochure', 'propose_brochure_update', 'search_catalogue']));
  });

  it('lit une brochure de l’entreprise, jamais celle d’une autre', async () => {
    const view = await call('get_brochure', { brochure_id: BROCHURE });
    expect(view).toMatchObject({ editor: 'advanced', pages: [{ id: 'pc', kind: 'cover' }, { id: 'p1', blocks: [{ id: 'b1', text: 'Nos menus' }, { id: 'b2', html: '<p>Bonjour</p>' }] }, { id: 'pf' }] });
    expect(await call('get_brochure', { brochure_id: THEIRS })).toEqual({ error: 'Brochure introuvable.' });
  });

  it('propose sans écrire, puis applique à la validation', async () => {
    const out = await update(BROCHURE, [op({ op: 'set_text', target: 'b1', text: 'Our menus' })], { language: 'en' });
    expect(out.summary.lines).toHaveLength(2);
    expect((await layoutOf(BROCHURE)).pages[1].blocks[0].text).toBe('Nos menus');
    const r = await decideProposal(out.proposal_id, 'accept');
    expect(r).toMatchObject({ error: null, result: { href: `/brochures/${BROCHURE}` } });
    expect((await layoutOf(BROCHURE)).pages[1].blocks[0].text).toBe('Our menus');
    expect((await pg.query<{ language: string }>(`select language from brochures where id = $1`, [BROCHURE])).rows[0].language).toBe('en');
  });

  it('refuse une prestation d’une autre entreprise', async () => {
    const out = await update(BROCHURE, [op({ op: 'add_block', where: 'p1', block_type: 'prestation', prestation_id: FOREIGN })]);
    expect(out.error).toMatch(/catalogue/);
  });

  it('brochure changée entre-temps : rien n’est écrit', async () => {
    const out = await update(BROCHURE, [op({ op: 'set_text', target: 'b2', html: 'Hello' })]);
    const changed = { pages: LAYOUT.pages.map((p) => (p.id === 'p1' ? { ...p, blocks: p.blocks.filter((b) => b.id !== 'b2') } : p)) };
    await pg.query(`update brochures set layout = $2 where id = $1`, [BROCHURE, JSON.stringify(changed)]);
    const r = await decideProposal(out.proposal_id, 'accept');
    expect(r.error).toMatch(/Bloc introuvable/);
    expect((await layoutOf(BROCHURE)).pages[1].blocks.map((b) => b.id)).toEqual(['b1']);
  });

  it('éditeur simple : prestation ajoutée dans une section', async () => {
    const out = await update(SIMPLE, [op({ op: 'add_prestation', where: 's1', prestation_id: MENU })]);
    expect((await decideProposal(out.proposal_id, 'accept')).error).toBeNull();
    const { content } = (await pg.query<{ content: { sections: { items: { prestationId: string }[] }[] } }>(`select content from brochures where id = $1`, [SIMPLE])).rows[0];
    expect(content.sections[0].items).toEqual([{ prestationId: MENU }]);
  });
});

describe('Webo et le Studio', () => {
  const STUDIO = '00000000-0000-4000-8000-000000000324';
  const studioOf = async (id: string) => (await pg.query<{ studio: { pages: { id: string; form?: boolean; els: { id: string; type: string; html?: string; prestationId?: string }[] }[] } }>(`select studio from brochures where id = $1`, [id])).rows[0].studio;

  beforeAll(async () => {
    const doc = { pages: [
      { id: 's1', bg: '#ffffff', els: [{ id: 't1', type: 'text', html: '<p>Bonjour</p>', x: 5, y: 5, w: 80 }] },
      { id: 'sf', form: true, bg: '#ffffff', els: [{ id: 'f', type: 'form', x: 10, y: 20, w: 80, h: 100 }] },
    ] };
    await pg.query(`insert into brochures (id, owner_user_id, user_id, name, share_token, cover, content, editor_mode, studio) values ($1, $2, $2, 'Studio', 't4', '{}', '{}', 'studio', $3)`,
      [STUDIO, CHEF, JSON.stringify(doc)]);
  });

  it('lit les pages et leurs éléments', async () => {
    expect(await call('get_brochure', { brochure_id: STUDIO })).toMatchObject({ editor: 'studio', pages: [{ id: 's1', elements: [{ id: 't1', type: 'text', html: '<p>Bonjour</p>' }] }, { id: 'sf', form_page: true }] });
  });

  it('change un texte, ajoute une prestation et une page, puis applique à la validation', async () => {
    const out = await update(STUDIO, [
      op({ op: 'set_text', target: 't1', text: 'Hello' }),
      op({ op: 'add_block', where: 's1', block_type: 'prestation', prestation_id: MENU }),
      op({ op: 'add_page', text: 'quote', ref: 'citation' }),
      op({ op: 'add_block', where: 'citation', block_type: 'title', text: 'Merci', level: 'l' }),
    ]);
    expect(out.summary.lines).toHaveLength(4);
    expect((await studioOf(STUDIO)).pages[0].els[0].html).toBe('<p>Bonjour</p>');
    expect((await decideProposal(out.proposal_id, 'accept')).error).toBeNull();
    const doc = await studioOf(STUDIO);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0].els.map((e) => e.type)).toEqual(['text', 'prestation']);
    expect(doc.pages[0].els[0].html).toBe('<p>Hello</p>');
    expect(doc.pages[1].els.at(-1)).toMatchObject({ type: 'text', html: '<p>Merci</p>' });
    expect(doc.pages.at(-1)!.form).toBe(true);
  });

  it('refuse ce qui ne se fait pas dans le Studio', async () => {
    expect((await update(STUDIO, [op({ op: 'move_block', target: 't1', where: 's1' })])).error).toMatch(/Studio/);
    expect((await update(STUDIO, [op({ op: 'remove_block', target: 'f' })])).error).toMatch(/formulaire/);
    expect((await update(STUDIO, [op({ op: 'remove_page', target: 'sf' })])).error).toMatch(/formulaire/);
  });

  it('crée une brochure complète du Studio, avec les seules prestations de l’entreprise', async () => {
    expect(toolsFor('brochures').map((t) => t.name)).toContain('propose_brochure_create');
    const out = await call('propose_brochure_create', { name: 'Mariages 2028', kind: 'mariage', prestation_ids: [MENU, FOREIGN], language: 'fr' });
    expect(out.summary.lines).toHaveLength(1);
    const r = await decideProposal(out.proposal_id, 'accept');
    expect(r.error).toBeNull();
    const id = (r.result as { href: string }).href.split('/').pop()!;
    const row = (await pg.query<{ editor_mode: string; owner_user_id: string; studio: { pages: { els: { prestationId?: string }[] }[] } }>(`select editor_mode, owner_user_id, studio from brochures where id = $1`, [id])).rows[0];
    expect(row).toMatchObject({ editor_mode: 'studio', owner_user_id: CHEF });
    const ids = row.studio.pages.flatMap((p) => p.els.flatMap((e) => (e.prestationId ? [e.prestationId] : [])));
    expect(ids).toEqual([MENU]);
  });
});
