import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';
import { emptyAnswers } from '@/lib/siteWeb';

// Onglet « Site web » : visible du titulaire et des gérants, demande rattachée à l'entreprise, e-mails, démo.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000401';
const GERANT = '00000000-0000-4000-8000-000000000402';
const EMPLOYE = '00000000-0000-4000-8000-000000000403';
const SANS = '00000000-0000-4000-8000-000000000404';
let current = CHEF;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireAdmin: async () => ({ id: current, email: 'x@y.fr' }),
}));
const sent: { to: string; subject: string; replyTo?: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  isTestAddress: (e: string) => e.endsWith('@example.test'),
  sendMail: async (m: { to: string; subject: string }) => { sent.push(m); return { error: null }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { getSiteWebPage, submitSiteWebRequest, saveSiteWebCatalog, getSiteWebCatalogAdmin } = await import('./siteWeb');

const answers = (over: Record<string, unknown> = {}) => ({ ...emptyAnswers('vitrine', { name: 'Francis Dupuis', phone: '06 75 33 08 23', email: 'francis@convivial.fr' }), ...over });
const requests = async () => (await pg.query<{ user_id: string; kind: string; name: string; company: string; message: string; answers: { sentBy: string } }>(
  `select user_id, kind, name, company, message, answers from site_requests order by created_at`)).rows;

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'chef@c.fr', 'x'), ('${GERANT}', 'g@c.fr', 'x'), ('${EMPLOYE}', 'e@c.fr', 'x'), ('${SANS}', 's@c.fr', 'x'), ('${DEMO_USER_ID}', 'demo@webodevis.fr', 'x');
    insert into profiles (id, email, first_name, last_name, company_name, company_phone, role) values
      ('${CHEF}', 'chef@c.fr', 'Francis', 'Dupuis', 'Convivial Event', '06 75 33 08 23', 'admin'),
      ('${SANS}', 's@c.fr', 'Sam', 'Sans', 'Déjà client', null, 'user'),
      ('${DEMO_USER_ID}', 'demo@webodevis.fr', 'Démo', 'Verdier', 'Maison Verdier', null, 'user');
    update profiles set modules = '["prospects"]' where id = '${SANS}';
    insert into profiles (id, email, first_name, last_name, parent_user_id, company_role) values
      ('${GERANT}', 'g@c.fr', 'Gaëlle', 'Gérante', '${CHEF}', 'gerant'),
      ('${EMPLOYE}', 'e@c.fr', 'Eddy', 'Employé', '${CHEF}', 'commercial');
  `);
}, 30_000);
beforeEach(() => { current = CHEF; sent.length = 0; });

describe('onglet Site web', () => {
  it('le titulaire voit la page, pré-remplie depuis son compte', async () => {
    const page = await getSiteWebPage();
    expect(page?.contact).toMatchObject({ name: 'Francis Dupuis', phone: '06 75 33 08 23', email: 'chef@c.fr', company: 'Convivial Event' });
    expect(page?.catalog.packs.map((p) => p.price)).toEqual(['1 500 €', '2 500 €', 'Sur devis']);
    expect(page?.pendingSince).toBeNull();
  });

  it('un employé ne le voit pas, ni un compte où l’option est coupée', async () => {
    current = EMPLOYE;
    expect(await getSiteWebPage()).toBeNull();
    expect((await submitSiteWebRequest(answers())).error).toMatch(/pas disponible/);
    current = SANS;
    expect(await getSiteWebPage()).toBeNull();
  });

  it('une demande d’un gérant : rattachée à l’entreprise, Webomax prévenu, accusé de réception', async () => {
    current = GERANT;
    expect((await submitSiteWebRequest(answers({ likeWork: 'lepicure' })))).toEqual({ error: null });
    const [r] = await requests();
    expect(r).toMatchObject({ user_id: CHEF, kind: 'service', name: 'Francis Dupuis', company: 'Convivial Event' });
    expect(r.answers.sentBy).toBe('Gaëlle Gérante');
    expect(r.message).toContain('Projet : Site Vitrine (2 500 €)');
    expect(sent.map((m) => m.to).sort()).toEqual(['chef@c.fr', 'francis@convivial.fr']);
    expect(sent.find((m) => m.to === 'chef@c.fr')?.replyTo).toBe('francis@convivial.fr');
    // La demande en cours se voit depuis toute l'entreprise.
    current = CHEF;
    expect((await getSiteWebPage())?.pendingSince).toBeTruthy();
  });

  it('refuse une réponse incomplète, et limite les envois par heure', async () => {
    expect((await submitSiteWebRequest(answers({ phone: '' }))).error).toMatch(/téléphone/);
    expect((await submitSiteWebRequest(answers())).error).toBeNull();
    expect((await submitSiteWebRequest(answers())).error).toBeNull();
    expect((await submitSiteWebRequest(answers())).error).toMatch(/plusieurs demandes/);
  });

  it('démonstration : la page répond, rien n’est enregistré ni envoyé', async () => {
    current = DEMO_USER_ID;
    const before = (await requests()).length;
    expect((await submitSiteWebRequest(answers()))).toEqual({ error: null });
    expect((await requests()).length).toBe(before);
    expect(sent).toEqual([]);
  });

  it('le catalogue se modifie dans l’admin ; sans pack, refusé', async () => {
    expect((await saveSiteWebCatalog({ packs: [] })).error).toMatch(/au moins un pack/);
    const c = await getSiteWebCatalogAdmin();
    expect((await saveSiteWebCatalog({ ...c, packs: [{ ...c.packs[0], price: '1 600 €' }] })).error).toBeNull();
    expect((await getSiteWebPage())?.catalog.packs.map((p) => p.price)).toEqual(['1 600 €']);
  });
});
