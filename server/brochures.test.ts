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
const req = await import('./brochureRequests');
const mail = await import('./prospectMail');

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

describe('brochures : formulaire de fin', () => {
  const fields = { first_name: 'Camille', last_name: 'Martin', email: 'camille@exemple.fr', event_type: 'Mariage', guest_count: 80, message: 'Bonjour' };
  const tokenOf = async (id: string) => (await pg.query<{ share_token: string }>(`select share_token from brochures where id = $1`, [id])).rows[0].share_token;

  it('une demande valide arrive dans les Prospects du traiteur, avec la brochure ; deux emails partent', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Formulaire' });
    sent.length = 0;
    expect(await req.submitBrochureRequest(await tokenOf(id!), fields)).toEqual({ error: null });
    const { rows } = await pg.query<{ owner_user_id: string; brochure_id: string; user_token: string | null; status: string }>(
      `select owner_user_id, brochure_id, user_token, status from prospect_requests where email = 'camille@exemple.fr'`);
    expect(rows).toEqual([{ owner_user_id: OWNER, brochure_id: id, user_token: null, status: 'nouveau' }]);
    expect(sent.map((m) => m.to).sort()).toEqual(['camille@exemple.fr', 'contact@b.fr']);
    expect(sent.find((m) => m.to === 'contact@b.fr')!.html).toContain('Formulaire');
  });

  it('email invalide ou brochure désactivée : refusé, rien d’enregistré', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Refus' });
    const token = await tokenOf(id!);
    expect((await req.submitBrochureRequest(token, { ...fields, email: 'pas-un-email' })).error).toBeTruthy();
    await br.saveBrochure(id!, { is_active: false });
    expect((await req.submitBrochureRequest(token, { ...fields, email: 'autre@exemple.fr' })).error).toBeTruthy();
    const { rows } = await pg.query(`select 1 from prospect_requests where brochure_id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });

  it('au-delà de 5 demandes par heure depuis la même connexion : refusé', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Rafale' });
    const token = await tokenOf(id!);
    for (let i = 0; i < 5; i++) expect((await req.submitBrochureRequest(token, { ...fields, email: `r${i}@exemple.fr` })).error).toBeNull();
    expect((await req.submitBrochureRequest(token, { ...fields, email: 'r6@exemple.fr' })).error).toMatch(/Trop de demandes/);
  });

  it('notifyProspect : la notification au traiteur et l’accusé à la personne', async () => {
    sent.length = 0;
    await mail.notifyProspect({ ownerId: OWNER, prospect: { firstName: 'Lou', lastName: 'Bé', email: 'lou@exemple.fr' } });
    expect(sent.map((m) => m.to).sort()).toEqual(['contact@b.fr', 'lou@exemple.fr']);
  });
});

describe('brochures : envoi', () => {
  const tokenOf = async (id: string) => (await pg.query<{ share_token: string }>(`select share_token from brochures where id = $1`, [id])).rows[0].share_token;
  const prospect = async (owner: string, email: string) => (await pg.query<{ id: string }>(
    `insert into prospect_requests (first_name, last_name, email, owner_user_id, status) values ('P', 'Q', $2, $1, 'nouveau') returning id`, [owner, email])).rows[0].id;

  it('l’email contient le lien de la brochure ; envoyée à une demande, celle-ci passe « Brochure envoyée »', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Envoi' });
    const pid = await prospect(OWNER, 'p1@exemple.fr');
    sent.length = 0;
    expect(await br.sendBrochure({ brochureId: id!, to: 'p1@exemple.fr', message: 'Voici notre brochure', prospectId: pid })).toEqual({ error: null });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('p1@exemple.fr');
    expect(sent[0].html).toContain(`/b/${await tokenOf(id!)}`);
    expect((await pg.query<{ status: string }>(`select status from prospect_requests where id = $1`, [pid])).rows[0].status).toBe('broch_envoyee');
  });

  it('demande d’une autre entreprise inchangée ; adresse invalide, brochure désactivée, démo : refusé', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Garde' });
    const foreign = await prospect(STRANGER, 'p2@exemple.fr');
    expect((await br.sendBrochure({ brochureId: id!, to: 'p2@exemple.fr', prospectId: foreign })).error).toBeNull();
    expect((await pg.query<{ status: string }>(`select status from prospect_requests where id = $1`, [foreign])).rows[0].status).toBe('nouveau');
    expect((await br.sendBrochure({ brochureId: id!, to: 'pas-un-email' })).error).toBeTruthy();
    await br.saveBrochure(id!, { is_active: false });
    expect((await br.sendBrochure({ brochureId: id!, to: 'p3@exemple.fr' })).error).toBeTruthy();
    current = '0d3e0000-0000-4000-8000-000000000001';
    expect((await br.sendBrochure({ brochureId: id!, to: 'p3@exemple.fr' })).error).toMatch(/démonstration/);
    current = OWNER;
  });
});
