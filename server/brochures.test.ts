import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Brochures, sur le vrai schéma (baseline + migrations) en mémoire.

vi.mock('server-only', () => ({}));
// Cookies du navigateur du lecteur (code d'accès saisi), en mémoire.
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Test' }),
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k: string, v: string) => { jar.set(k, v); } }),
}));
const pushes: { userId: string; title: string; body: string }[] = [];
vi.mock('@/lib/push', () => ({ pushToUser: async (userId: string, m: { title: string; body: string }) => { pushes.push({ userId, title: m.title, body: m.body }); return 1; } }));
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
const links = await import('./brochureLinks');
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

describe('brochures : photos', () => {
  it('cadrage de la couverture gardé et borné, jusqu’au lien public', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Cadrage' });
    await br.saveBrochure(id!, { cover: { title: 'Cadrage', photoUrl: 'https://x/c.webp', photoFrame: { x: 15, y: -4, zoom: 180 } } });
    const row = await br.getBrochure(id!);
    expect((row!.cover as { photoFrame?: unknown }).photoFrame).toEqual({ x: 15, y: 0, zoom: 180, fit: 'cover' });
    const pub = await br.getPublicBrochure(row!.share_token);
    expect(pub!.cover.photoFrame).toEqual({ x: 15, y: 0, zoom: 180, fit: 'cover' });
  });
});

describe('brochures : galerie de photos', () => {
  it('photos déjà envoyées dans les brochures de l’entreprise et du catalogue, sans doublon ; rien d’un autre compte', async () => {
    current = OWNER;
    await pg.query(`update prestations set photo_url = 'https://x/catalogue.webp' where id = $1`, [PRESTATION]);
    const { id } = await br.createBrochure({ name: 'Galerie' });
    await br.saveBrochure(id!, {
      cover: { title: 'Galerie', photoUrl: 'https://x/couverture.webp' },
      content: { about: { enabled: true, html: '', photoUrl: 'https://x/apropos.webp' }, sections: [{ id: 's', title: 'T', items: [
        { prestationId: PRESTATION, photoUrl: 'https://x/retouche.webp' }, { prestationId: PRESTATION, photoUrl: 'https://x/couverture.webp' },
      ] }] },
    });
    await pg.query(`update brochures set layout = $2::jsonb where id = $1`, [id, JSON.stringify({ pages: [
      { id: 'p', kind: 'blocks', blocks: [{ id: 'i', type: 'image', url: 'https://x/bloc.webp', height: 200, fit: 'cover' },
        { id: 'c', type: 'columns', count: 2, gap: 12, cols: [[{ id: 'j', type: 'image', url: 'https://x/colonne.webp', height: 100, fit: 'cover' }], []] }] },
      { id: 'f', kind: 'form', blocks: [] },
    ] })]);
    current = STRANGER;
    const theirs = await br.createBrochure({ name: 'Autre' });
    await br.saveBrochure(theirs.id!, { cover: { title: 'Autre', photoUrl: 'https://x/autre-compte.webp' } });
    current = OWNER;

    const photos = await br.listBrochurePhotos();
    const urls = photos.map((p) => p.url);
    expect(urls).toEqual(expect.arrayContaining([
      'https://x/catalogue.webp', 'https://x/couverture.webp', 'https://x/apropos.webp', 'https://x/retouche.webp', 'https://x/bloc.webp', 'https://x/colonne.webp',
    ]));
    expect(urls).not.toContain('https://x/autre-compte.webp');
    expect(new Set(urls).size).toBe(urls.length);
    expect(photos.find((p) => p.url === 'https://x/catalogue.webp')!.label).toBe('Menu Tentation');
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

  it('Studio : les prestations choisies (par leur rang) partent figées avec la demande, et sont dans l’email', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Choix', editor: 'studio' });
    const doc = { pages: [{ id: 'a', els: [
      { id: 'x', type: 'prestation', prestationId: PRESTATION, x: 1, y: 1, w: 50, h: 40 },
      { id: 'y', type: 'prestation', prestationId: '00000000-0000-4000-8000-0000000000c9', x: 1, y: 50, w: 50, h: 40 },
    ] }] };
    await br.saveBrochure(id!, { studio: doc });
    sent.length = 0;
    expect(await req.submitBrochureRequest(await tokenOf(id!), { ...fields, email: 'choix@exemple.fr' }, ['0', '1', '7', '0'])).toEqual({ error: null });
    const { rows } = await pg.query<{ chosen: { prestationId: string; name: string; unitPrice: number; perGuest: boolean }[] }>(`select chosen from prospect_requests where email = 'choix@exemple.fr'`);
    // Rang 1 : prestation hors catalogue de l'entreprise ; rang 7 : inexistant ; doublon ignoré.
    expect(rows[0].chosen).toEqual([expect.objectContaining({ prestationId: PRESTATION, name: 'Menu Tentation', unitPrice: 76, perGuest: true })]);
    expect(sent.find((m) => m.to === 'contact@b.fr')!.html).toContain('Menu Tentation');
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

  it('brochure en anglais : erreurs et accusé de réception en anglais', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'English' });
    await br.saveBrochure(id!, { language: 'en' });
    const token = await tokenOf(id!);
    expect((await req.submitBrochureRequest(token, { ...fields, email: 'nope' })).error).toBe('The email address is not valid.');
    sent.length = 0;
    expect((await req.submitBrochureRequest(token, { ...fields, email: 'eng@exemple.fr' })).error).toBeNull();
    const ack = sent.find((m) => m.to === 'eng@exemple.fr')!;
    expect(ack.subject).toMatch(/received your request/);
    expect(ack.html).toContain('Thank you');
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

describe('brochures : éditeur avancé', () => {
  const layoutOf = async (id: string) => (await pg.query<{ layout: { pages: { kind: string; blocks: { type: string; html?: string; text?: string }[] }[] } | null; editor_mode: string }>(
    `select layout, editor_mode from brochures where id = $1`, [id])).rows[0];
  const tokenOf = async (id: string) => (await pg.query<{ share_token: string }>(`select share_token from brochures where id = $1`, [id])).rows[0].share_token;
  const content = { sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: PRESTATION }] }] };

  it('passer en avancé convertit les pages ; une brochure jamais passée en avancé garde ses pages', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Avancé' });
    await br.saveBrochure(id!, { content, style: 'carte' });
    const before = (await br.getPublicBrochure(await tokenOf(id!)))!.pages.map((p) => p.kind);
    expect(before).toEqual(['cover', 'about', 'items', 'contact', 'form']);
    expect(await br.switchBrochureEditor(id!, 'advanced')).toEqual({ error: null });
    const row = await layoutOf(id!);
    expect(row.editor_mode).toBe('advanced');
    expect(row.layout!.pages[0].kind).toBe('cover');
    expect(row.layout!.pages.at(-1)!.kind).toBe('form');
    expect((await br.getPublicBrochure(await tokenOf(id!)))!.pages.map((p) => p.kind)).toContain('blocks');
  });

  it('mise en page refusée si ses règles sont violées ; HTML nettoyé', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Règles' });
    await br.switchBrochureEditor(id!, 'advanced');
    const good = (await layoutOf(id!)).layout!;
    const twoCovers = { pages: [{ id: 'c1', kind: 'cover', blocks: [] }, { id: 'c2', kind: 'cover', blocks: [] }, { id: 'f', kind: 'form', blocks: [] }] };
    expect((await br.saveBrochure(id!, { layout: twoCovers })).error).toBeTruthy();
    expect((await layoutOf(id!)).layout).toEqual(good);
    const withScript = { pages: [{ id: 'b', kind: 'blocks', blocks: [{ id: 't', type: 'text', html: '<p>ok</p><script>x()</script>' }] }, { id: 'f', kind: 'form', blocks: [] }] };
    expect((await br.saveBrochure(id!, { layout: withScript })).error).toBeNull();
    const saved = (await layoutOf(id!)).layout!;
    expect(saved.pages[0].blocks[0].html).toContain('<p>ok</p>');
    expect(saved.pages[0].blocks[0].html).not.toContain('script');
  });

  it('mode avancé, prix masqués : aucun prix ni identifiant sur le lien', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Prix avancé' });
    await br.saveBrochure(id!, { content, show_prices: false });
    await br.switchBrochureEditor(id!, 'advanced');
    const json = JSON.stringify(await br.getPublicBrochure(await tokenOf(id!)));
    expect(json).toContain('Menu Tentation');
    expect(json).not.toMatch(/€|unit_price/);
    expect(json).not.toContain(PRESTATION);
  });

  it('retour au simple puis à l’avancé : choix demandé ; reprendre garde la mise en page faite à la main', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Aller-retour' });
    await br.saveBrochure(id!, { content });
    await br.switchBrochureEditor(id!, 'advanced');
    const l = (await layoutOf(id!)).layout!;
    const blocksPage = l.pages.find((p) => p.kind === 'blocks' && p.blocks.some((b) => b.type === 'prestation'))!;
    blocksPage.blocks.unshift({ type: 'title', text: 'Ajouté à la main' } as never);
    await br.saveBrochure(id!, { layout: l });
    expect((await br.switchBrochureEditor(id!, 'simple')).error).toBeNull();
    const simple = (await br.getBrochure(id!))!;
    expect(JSON.stringify(simple.content)).toContain(PRESTATION);
    expect(await br.switchBrochureEditor(id!, 'advanced')).toEqual({ error: null, needsChoice: true });
    expect((await layoutOf(id!)).editor_mode).toBe('simple');
    expect((await br.switchBrochureEditor(id!, 'advanced', { resume: true })).error).toBeNull();
    expect(JSON.stringify((await layoutOf(id!)).layout)).toContain('Ajouté à la main');
  });

  it('déjà en avancé : repasser en avancé (onglet resté en simple) ne retire aucun bloc', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Deux onglets' });
    await br.switchBrochureEditor(id!, 'advanced');
    const l = (await layoutOf(id!)).layout!;
    l.pages.find((p) => p.kind === 'blocks')!.blocks.push({ id: 'pa', type: 'prestation', prestationId: PRESTATION } as never);
    await br.saveBrochure(id!, { layout: l });
    expect(await br.switchBrochureEditor(id!, 'advanced')).toEqual({ error: null });
    expect(JSON.stringify((await layoutOf(id!)).layout)).toContain(PRESTATION);
  });
});

describe('brochures : Studio (v2)', () => {
  const rowOf = async (id: string) => (await pg.query<{ studio: { pages: { form?: boolean; els: { type: string; html?: string; prestationId?: string }[] }[] } | null; editor_mode: string; share_token: string }>(
    `select studio, editor_mode, share_token from brochures where id = $1`, [id])).rows[0];
  const content = { about: { enabled: false, html: '' }, contact: { enabled: false }, sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: PRESTATION }] }] };

  it('créée dans le Studio : couverture et formulaire ; le lien ne montre que ses pages, sans identifiant', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Studio', editor: 'studio' });
    const row = await rowOf(id!);
    expect(row.editor_mode).toBe('studio');
    // Une brochure neuve : couverture, qui sommes-nous, contact, formulaire.
    expect(row.studio!.pages).toHaveLength(4);
    expect(row.studio!.pages.at(-1)!.form).toBe(true);
    const doc = { pages: [{ id: 'a', bg: '#ffffff', els: [{ id: 'p', type: 'prestation', prestationId: PRESTATION, x: 5, y: 5, w: 80, h: 40 }] }, row.studio!.pages.at(-1)] };
    expect(await br.saveBrochure(id!, { studio: doc })).toEqual({ error: null });
    const pub = (await br.getPublicBrochure(row.share_token))!;
    expect(pub.pages).toEqual([]);
    expect(pub.studio).toHaveLength(2);
    expect(JSON.stringify(pub.studio)).toContain('Menu Tentation');
    expect(JSON.stringify(pub)).not.toContain(PRESTATION);
  });

  it('passer au Studio compose les pages depuis la brochure ; on revient au simple sans perdre le Studio', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Bascule' });
    await br.saveBrochure(id!, { content });
    expect(await br.switchBrochureEditor(id!, 'studio')).toEqual({ error: null });
    const first = (await rowOf(id!)).studio!;
    expect(first.pages.flatMap((p) => p.els).some((e) => e.prestationId === PRESTATION)).toBe(true);
    expect((await br.switchBrochureEditor(id!, 'simple')).error).toBeNull();
    const back = await rowOf(id!);
    expect(back.editor_mode).toBe('simple');
    expect((await br.getPublicBrochure(back.share_token))!.studio).toBeNull();
    expect(await br.switchBrochureEditor(id!, 'studio')).toEqual({ error: null });
    expect((await rowOf(id!)).studio).toEqual(first);
    const copy = await br.duplicateBrochure(id!);
    expect((await rowOf(copy.id!)).editor_mode).toBe('studio');
    expect((await rowOf(copy.id!)).studio).toEqual(first);
  });

  it('pages illisibles ou hors limites refusées ; HTML nettoyé', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Règles Studio', editor: 'studio' });
    expect((await br.saveBrochure(id!, { studio: { pages: 'x' } })).error).toBeTruthy();
    expect((await br.saveBrochure(id!, { studio: { pages: Array.from({ length: 45 }, () => ({ els: [] })) } })).error).toMatch(/40 pages/);
    expect((await br.saveBrochure(id!, { studio: { pages: [{ els: [{ type: 'text', html: '<p>ok</p><script>x()</script>', x: 1, y: 1, w: 20 }] }] } })).error).toBeNull();
    const saved = (await rowOf(id!)).studio!;
    expect(saved.pages[0].els[0].html).toBe('<p>ok</p>');
    expect(saved.pages.at(-1)!.form).toBe(true);
  });
});

describe('brochures : lecture page par page (Studio)', () => {
  const statsOf = async (id: string) => (await pg.query<{ page_id: string; views: number; ms: string }>(`select page_id, views, ms from brochure_page_stats where brochure_id = $1 order by page_id`, [id])).rows;
  it('compte vues et temps par page (repérée par son identifiant), borné, sans les visites de l’entreprise', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Lue', editor: 'studio' });
    const row = (await pg.query<{ share_token: string; studio: { pages: { id: string }[] } }>(`select share_token, studio from brochures where id = $1`, [id])).rows[0];
    const token = row.share_token;
    const [a, b] = row.studio.pages.map((p) => p.id);
    session = null;
    await br.recordStudioPages(token, [{ pageId: a, views: 1, ms: 4000 }, { pageId: b, views: 1, ms: 99_000_000 }, { pageId: 'inventee', views: 1 }, { pageId: a, views: 1, ms: 1000 }]);
    await br.recordStudioPages(token, [{ pageId: a, views: 1, ms: 500 }]);
    const rows = Object.fromEntries((await statsOf(id!)).map((r) => [r.page_id, { views: r.views, ms: Number(r.ms) }]));
    expect(rows).toEqual({ [a]: { views: 3, ms: 5500 }, [b]: { views: 1, ms: 600_000 } });
    // Quelqu'un de l'entreprise : rien n'est compté.
    session = { id: OWNER, email: 'chef@b.fr' };
    await br.recordStudioPages(token, [{ pageId: a, views: 1, ms: 1000 }]);
    session = null;
    // Pages déplacées : chaque page garde ses chiffres.
    const moved = { ...row.studio, pages: [row.studio.pages[1], row.studio.pages[0], ...row.studio.pages.slice(2)] };
    expect((await br.saveBrochure(id!, { studio: moved })).error).toBeNull();
    expect((await br.getBrochurePageStats(id!)).find((r) => r.pageId === a)).toEqual({ pageId: a, views: 3, ms: 5500 });
    expect((await br.resetBrochurePageStats(id!)).error).toBeNull();
    expect(await br.getBrochurePageStats(id!)).toEqual([]);
    // Pas de lecture comptée hors Studio, ni avec un jeton inconnu.
    const simple = await br.createBrochure({ name: 'Simple' });
    const t2 = (await pg.query<{ share_token: string }>(`select share_token from brochures where id = $1`, [simple.id])).rows[0].share_token;
    await br.recordStudioPages(t2, [{ pageId: a, views: 1, ms: 1000 }]);
    await br.recordStudioPages('jeton-inconnu-000000000', [{ pageId: a, views: 1, ms: 1000 }]);
    expect(await statsOf(simple.id!)).toEqual([]);
  });

  it('création dans le Studio avec une brochure complète et ses options publiques', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Cocktails', editor: 'studio', kind: 'cocktail' });
    const row = (await pg.query<{ studio: { theme: { name: string }; pages: { els: { prestationId?: string }[] }[] }; share_token: string }>(`select studio, share_token from brochures where id = $1`, [id])).rows[0];
    expect(row.studio.theme.name).toBe('Noir et or');
    expect(row.studio.pages.flatMap((p) => p.els).some((e) => e.prestationId === PRESTATION)).toBe(true);
    const pub = (await br.getPublicBrochure(row.share_token))!;
    expect(pub.studioOptions).toEqual({ animate: true, call: false, whatsapp: false, choose: true, estimate: true });
  });
});


describe('brochures : liens, accès et notifications', () => {
  const rowOf = async (id: string) => (await pg.query<{ share_token: string; view_count: number }>(`select share_token, view_count from brochures where id = $1`, [id])).rows[0];

  it('lien par source : la brochure s’ouvre, ses ouvertures et ses demandes sont comptées à part', async () => {
    current = OWNER;
    session = null;
    const { id } = await br.createBrochure({ name: 'Sources' });
    const made = await links.createBrochureLink(id!, { kind: 'source', label: 'Instagram' });
    expect(made.error).toBeNull();
    expect((await br.getPublicBrochure(made.token!))!.name).toBe('Sources');
    await br.recordBrochureView(made.token!);
    await br.recordBrochureView((await rowOf(id!)).share_token);
    expect((await req.submitBrochureRequest(made.token!, { first_name: 'Iris', last_name: 'Gram', email: 'iris@exemple.fr' })).error).toBeNull();
    const list = (await links.listBrochureLinks(id!))!;
    expect(list.map((l) => [l.kind, l.label, l.views, l.requests])).toEqual([['main', 'Lien principal', 1, 0], ['source', 'Instagram', 1, 1]]);
    // Lien désactivé : plus rien.
    await links.updateBrochureLink(made.id!, { isActive: false });
    expect(await br.getPublicBrochure(made.token!)).toBeNull();
    expect(await br.brochureGate(made.token!)).toBe('gone');
  });

  it('lien d’un client : message d’accueil et {{client}} remplacé, seulement sur son lien', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Perso', editor: 'studio' });
    await br.saveBrochure(id!, { studio: { pages: [{ id: 'a', els: [{ id: 't', type: 'text', html: '<p>Bienvenue {{client}}</p>', x: 1, y: 1, w: 80 }] }] } });
    const made = await links.createBrochureLink(id!, { kind: 'client', label: 'Julie & Thomas', greeting: 'Pour le mariage de Julie & Thomas' });
    const pub = (await br.getPublicBrochure(made.token!))!;
    expect(pub.greeting).toBe('Pour le mariage de Julie & Thomas');
    expect(JSON.stringify(pub.studio)).toContain('Bienvenue Julie &amp; Thomas');
    const main = (await br.getPublicBrochure((await rowOf(id!)).share_token))!;
    expect(main.greeting).toBeNull();
    expect(JSON.stringify(main.studio)).toContain('Bienvenue <');
    expect((await br.brochureShareMeta(made.token!))!.title).toBe('Pour le mariage de Julie & Thomas');
  });

  it('expiration et code d’accès, sur le lien principal comme sur un lien', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Privée' });
    const token = (await rowOf(id!)).share_token;
    expect((await links.setBrochureAccess(id!, { expiresAt: '2001-01-01' })).error).toBeNull();
    expect(await br.brochureGate(token)).toBe('expired');
    expect(await br.getPublicBrochure(token)).toBeNull();
    expect(await br.brochureShareMeta(token)).toBeNull();
    await links.setBrochureAccess(id!, { expiresAt: null, code: 'Sesame42' });
    expect(await br.brochureGate(token)).toBe('code');
    expect(await br.getPublicBrochure(token)).toBeNull();
    expect((await req.submitBrochureRequest(token, { first_name: 'A', last_name: 'B', email: 'ab@exemple.fr' })).error).toBeTruthy();
    expect((await br.brochureShareMeta(token))!.image).toBeNull();
    expect((await br.unlockBrochure(token, 'mauvais')).error).toBeTruthy();
    expect((await br.unlockBrochure(token, ' sesame42 ')).error).toBeNull();
    expect(await br.brochureGate(token)).toBe('ok');
    expect(await br.getPublicBrochure(token)).not.toBeNull();
    // Code changé : l'ancien accès ne vaut plus.
    await links.setBrochureAccess(id!, { code: 'AutreCode' });
    expect(await br.brochureGate(token)).toBe('code');
    expect((await links.setBrochureAccess(id!, { code: 'abc' })).error).toMatch(/4 à 40/);
    const stored = (await pg.query<{ access_code: string }>(`select access_code from brochures where id = $1`, [id])).rows[0].access_code;
    expect(stored).not.toContain('AutreCode');
  });

  it('notifications : ouverture et arrivée au formulaire, une par demi-heure et par lien, pas pour l’entreprise', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Suivie' });
    const token = (await rowOf(id!)).share_token;
    pushes.length = 0;
    session = { id: OWNER, email: 'chef@b.fr' };
    await br.recordBrochureView(token);
    expect(pushes).toHaveLength(0);
    session = null;
    await br.recordBrochureView(token);
    await br.recordBrochureView(token);
    await br.recordBrochureFormReached(token);
    await br.recordBrochureFormReached(token);
    expect(pushes.map((p) => p.title)).toEqual(['Brochure ouverte', 'Un lecteur arrive au formulaire']);
    expect(pushes[0]).toMatchObject({ userId: OWNER, body: expect.stringContaining('Suivie') });
    // Un autre lien a sa propre limite ; notifications coupées : plus rien.
    const other = await links.createBrochureLink(id!, { kind: 'source', label: 'Salon' });
    await br.recordBrochureView(other.token!);
    expect(pushes.at(-1)!.body).toContain('Salon');
    await links.setBrochureAccess(id!, { notify: false });
    const third = await links.createBrochureLink(id!, { kind: 'source', label: 'Flyer' });
    await br.recordBrochureView(third.token!);
    expect(pushes).toHaveLength(3);
  });

  it('envoi avec un lien personnalisé : le lien du client part, pas le lien principal', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Envoi perso' });
    sent.length = 0;
    expect((await br.sendBrochure({ brochureId: id!, to: 'julie@exemple.fr', personal: { label: 'Julie', greeting: 'Pour Julie' } })).error).toBeNull();
    const [l] = (await links.listBrochureLinks(id!))!.filter((x) => x.kind === 'client');
    expect(l).toMatchObject({ label: 'Julie', greeting: 'Pour Julie' });
    expect(sent[0].html).toContain(`/b/${l.token}`);
    expect(sent[0].html).not.toContain(`/b/${(await rowOf(id!)).share_token}`);
  });
});


describe('brochures : passage au Studio sans rien perdre', () => {
  it('la composition (sections, mise en page avancée) n’est pas réécrite ; la base à jour ne manque de rien', async () => {
    current = OWNER;
    const { id } = await br.createBrochure({ name: 'Garde tout' });
    await br.saveBrochure(id!, { content: { sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: PRESTATION }] }] } });
    expect(await br.switchBrochureEditor(id!, 'advanced')).toEqual({ error: null });
    const before = (await pg.query<{ content: unknown; layout: unknown }>(`select content, layout from brochures where id = $1`, [id])).rows[0];
    expect(await br.switchBrochureEditor(id!, 'studio')).toEqual({ error: null });
    const after = (await pg.query<{ content: unknown; layout: unknown; editor_mode: string }>(`select content, layout, editor_mode from brochures where id = $1`, [id])).rows[0];
    expect(after.editor_mode).toBe('studio');
    expect(after.content).toEqual(before.content);
    expect(after.layout).toEqual(before.layout);
    expect(await br.brochureDatabaseCheck()).toEqual([]);
  });
});
