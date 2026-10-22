import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Brochures, sur le vrai schéma (baseline + migrations) en mémoire.

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Test' }) }));
const sent: { to: string; subject: string; html: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { to: string; subject: string; html: string }) => { sent.push({ to: m.to, subject: m.subject, html: m.html }); return { error: null }; },
}));
const OWNER = '00000000-0000-4000-8000-0000000000b1';
const STRANGER = '00000000-0000-4000-8000-0000000000b2';
let current = OWNER;
// Session vue par les pages publiques (null : lecteur anonyme).
let session: { id: string; email: string } | null = null;
vi.mock('./session', () => ({
  getSessionUser: async () => session,
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const br = await import('./brochures');

const PRESTATION = '00000000-0000-4000-8000-0000000000c1';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@b.fr', 'x'), ('${STRANGER}', 'autre@b.fr', 'x');
    insert into profiles (id, email, company_name, company_email, default_vat_rate) values ('${OWNER}', 'chef@b.fr', 'Traiteur Brochure', 'contact@b.fr', 10), ('${STRANGER}', 'autre@b.fr', 'Autre', null, 20);
    insert into prestations (id, user_id, name, unit_price, category, description) values ('${PRESTATION}', '${OWNER}', 'Menu Tentation', 76, 'dîner', '<p>Entrée, plat, dessert</p>');
  `);
});

describe('brochures : base', () => {
  it('la migration crée la table et la colonne de provenance des demandes', async () => {
    const { rows } = await pg.query<{ style: string; price_mode: string; is_active: boolean; language: string }>(
      `insert into brochures (owner_user_id, user_id, name, share_token) values ($1, $1, 'Mariages', 'jeton-brochure-base-0001')
       returning style, price_mode, is_active, language`, [OWNER]);
    expect(rows[0]).toEqual({ style: 'editorial', price_mode: 'ttc', is_active: true, language: 'fr' });
    await expect(pg.query(`insert into brochures (owner_user_id, user_id, name, share_token) values ($1, $1, 'Copie', 'jeton-brochure-base-0001')`, [OWNER]))
      .rejects.toThrow();
    await expect(pg.query(`insert into brochures (owner_user_id, user_id, name, share_token, style) values ($1, $1, 'Autre', 'jeton-brochure-base-0002', 'autre')`, [OWNER]))
      .rejects.toThrow();
    await expect(pg.query(`select brochure_id from prospect_requests limit 0`)).resolves.toBeDefined();
  });
});

describe('brochures : serveur', () => {
  const content = { sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: PRESTATION }] }] };
  const tokenOf = async (id: string) => (await pg.query<{ share_token: string }>(`select share_token from brochures where id = $1`, [id])).rows[0].share_token;

  it('le traiteur crée, règle, duplique et supprime ; un autre compte n’y a pas accès', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Mariages 2027' });
    expect(id).toBeTruthy();
    const row = (await br.getBrochure(id!))!;
    expect(row).toMatchObject({ name: 'Mariages 2027', style: 'editorial', vat_rate: '10' });
    expect(row.share_token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect((await br.saveBrochure(id!, { style: 'carte', content })).error).toBeNull();
    const copy = await br.duplicateBrochure(id!);
    expect((await br.getBrochure(copy.id!))).toMatchObject({ name: 'Mariages 2027 (copie)', style: 'carte', view_count: 0 });
    expect((await br.listBrochures()).map((b) => b.name).filter((n) => n.startsWith('Mariages 2027')).sort())
      .toEqual(['Mariages 2027', 'Mariages 2027 (copie)']);

    current = STRANGER;
    expect(await br.getBrochure(id!)).toBeNull();
    expect((await br.saveBrochure(id!, { name: 'Volée' })).error).toBeTruthy();
    expect((await br.deleteBrochure(id!)).error).toBeTruthy();
    expect(await br.listBrochures()).toEqual([]);

    current = OWNER;
    expect((await br.deleteBrochure(copy.id!)).error).toBeNull();
    expect(await br.getBrochure(copy.id!)).toBeNull();
  });

  it('retoucher une prestation dans la brochure ne touche pas au catalogue', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Retouche' });
    await br.saveBrochure(id!, { content: { sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: PRESTATION, html: '<p>Texte retouché</p>' }] }] } });
    const { rows } = await pg.query<{ description: string }>(`select description from prestations where id = $1`, [PRESTATION]);
    expect(rows[0].description).toBe('<p>Entrée, plat, dessert</p>');
  });

  it('lien public : pages, entreprise, aucun identifiant interne ; prix masqués : aucune donnée de prix', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Public' });
    await br.saveBrochure(id!, { content: { ...content, about: { enabled: true, html: '<p>Depuis 2010</p>' } }, style: 'carte' });
    const pub = (await br.getPublicBrochure(await tokenOf(id!)))!;
    expect(pub.company.name).toBe('Traiteur Brochure');
    expect(pub.about.html).toBe('<p>Depuis 2010</p>');
    expect(pub.pages.map((p) => p.kind)).toEqual(['cover', 'about', 'items', 'contact', 'form']);
    const json = JSON.stringify(pub);
    expect(json).toContain('Menu Tentation');
    expect(json).not.toContain(PRESTATION);
    expect(json).not.toContain(OWNER);

    await br.saveBrochure(id!, { show_prices: false });
    const hidden = (await br.getPublicBrochure(await tokenOf(id!)))!;
    const items = hidden.pages.flatMap((p) => (p.kind === 'items' ? p.items : []));
    expect(items.every((i) => i.price === null && i.childPrice === null)).toBe(true);
    expect(JSON.stringify(hidden)).not.toMatch(/unit_price|€/);
  });

  it('lien désactivé, puis renouvelé : l’ancien jeton ne donne plus rien', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Lien' });
    const first = await tokenOf(id!);
    await br.saveBrochure(id!, { is_active: false });
    expect(await br.getPublicBrochure(first)).toBeNull();
    expect(await br.brochureUnavailableCompany(first)).toEqual({ name: 'Traiteur Brochure', email: 'contact@b.fr' });
    await br.saveBrochure(id!, { is_active: true });
    const { token } = await br.renewBrochureLink(id!);
    expect(token).not.toBe(first);
    expect(await br.getPublicBrochure(first)).toBeNull();
    expect(await br.getPublicBrochure(token!)).not.toBeNull();
    expect(await br.getPublicBrochure('jeton-inconnu-1234567890')).toBeNull();
    expect(await br.getPublicBrochure('court')).toBeNull();
  });

  it('prestation supprimée du catalogue : le lien public s’affiche sans elle', async () => {
    current = OWNER;
    await pg.exec(`insert into prestations (id, user_id, name, unit_price) values ('00000000-0000-4000-8000-0000000000c2', '${OWNER}', 'Éphémère', 10)`);
    const { id } = await br.createBrochure({ name: 'Disparue' });
    await br.saveBrochure(id!, { content: { sections: [{ id: 's1', title: 'T', items: [{ prestationId: PRESTATION }, { prestationId: '00000000-0000-4000-8000-0000000000c2' }] }] } });
    await pg.exec(`delete from prestations where id = '00000000-0000-4000-8000-0000000000c2'`);
    const pub = (await br.getPublicBrochure(await tokenOf(id!)))!;
    expect(pub.pages.flatMap((p) => (p.kind === 'items' ? p.items.map((i) => i.name) : []))).toEqual(['Menu Tentation']);
  });

  it('ouvertures : le traiteur connecté ne compte pas, un lecteur anonyme si', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Ouvertures' });
    const token = await tokenOf(id!);
    session = { id: OWNER, email: 'chef@b.fr' };
    await br.recordBrochureView(token);
    expect((await br.getBrochure(id!))!.view_count).toBe(0);
    session = null;
    await br.recordBrochureView(token);
    const row = (await br.getBrochure(id!))!;
    expect(row.view_count).toBe(1);
    expect(row.viewed_at).not.toBeNull();
  });
  it('données de l’éditeur : la brochure, le catalogue de l’entreprise et ses coordonnées ; rien pour un autre compte', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Éditeur' });
    const data = (await br.getBrochureEditorData(id!))!;
    expect(data.brochure.name).toBe('Éditeur');
    expect(data.catalog.map((p) => p.name)).toContain('Menu Tentation');
    expect(data.company).toMatchObject({ name: 'Traiteur Brochure', email: 'contact@b.fr' });
    current = STRANGER;
    expect(await br.getBrochureEditorData(id!)).toBeNull();
    current = OWNER;
  });
});
