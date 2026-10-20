// « Écrire au support » : la demande enregistrée, les emails (simulés), la limite et les refus.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

vi.mock('server-only', () => ({}));
const HEAD = '00000000-0000-4000-8000-0000000b0001';
const MEMBER = '00000000-0000-4000-8000-0000000b0002';
const ADMIN = '00000000-0000-4000-8000-0000000b0003';
let session: { user: { id: string }; actingAsAdmin?: boolean } | null = { user: { id: HEAD } };
vi.mock('next-auth', () => ({ getServerSession: async () => session }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
const mails: { to: string; subject: string; replyTo?: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  isTestAddress: (email: string) => /\.(local|test|example|invalid)$/i.test(email),
  sendMail: async (m: { to: string; subject: string; replyTo?: string }) => { mails.push(m); return { error: null }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { contactSupport } = await import('./support');
const requests = async () => (await pg.query<{ kind: string; name: string; email: string; company: string | null; message: string }>(
  `select kind, name, email, company, message from site_requests order by created_at`)).rows;

beforeAll(async () => {
  delete process.env.CONTACT_EMAIL;
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${HEAD}', 'chef@traiteur.fr', 'x'), ('${MEMBER}', 'aide@traiteur.fr', 'x'), ('${ADMIN}', 'equipe@webodevis.fr', 'x');
    insert into profiles (id, email, first_name, last_name, company_name) values ('${HEAD}', 'chef@traiteur.fr', 'Marie', 'Durand', 'Traiteur Durand');
    insert into profiles (id, email, first_name, parent_user_id) values ('${MEMBER}', 'aide@traiteur.fr', 'Paul', '${HEAD}');
    insert into profiles (id, email, role, is_active) values ('${ADMIN}', 'equipe@webodevis.fr', 'admin', true);
  `);
});

describe('écrire au support', () => {
  it('enregistre la demande avec le sujet, la page et le navigateur, et prévient l’équipe', async () => {
    const res = await contactSupport({ topic: 'probleme', message: 'Le PDF du devis ne se télécharge pas.', context: { page: '/devis/12/modifier', browser: 'Firefox 140, 390x844' } });
    expect(res.error).toBeNull();
    const [r] = await requests();
    expect(r).toMatchObject({ kind: 'message', name: 'Marie Durand', email: 'chef@traiteur.fr', company: 'Traiteur Durand' });
    expect(r.message).toMatch(/^\[Support, Problème\] Le PDF du devis/);
    expect(r.message).toContain('Page : /devis/12/modifier');
    expect(r.message).toContain('Navigateur : Firefox 140, 390x844');
    expect(r.message).toContain(`Compte : ${HEAD}`);
    expect(mails.map((m) => m.to).sort()).toEqual(['chef@traiteur.fr', 'equipe@webodevis.fr']);
    expect(mails.find((m) => m.to === 'equipe@webodevis.fr')).toMatchObject({ replyTo: 'chef@traiteur.fr' });
  });

  it('ne joint ni la page ni le navigateur si la case est décochée', async () => {
    session = { user: { id: MEMBER } };
    expect((await contactSupport({ topic: 'suggestion', message: 'Un export des clients en Excel serait utile.', context: null })).error).toBeNull();
    const r = (await requests()).at(-1)!;
    expect(r).toMatchObject({ name: 'Paul', company: 'Traiteur Durand' });
    expect(r.message).not.toContain('Page :');
    expect(r.message).toContain(`Compte : ${MEMBER}`);
    session = { user: { id: HEAD } };
  });

  it('refuse un message vide', async () => {
    expect((await contactSupport({ topic: 'question', message: '  ok ' })).error).toMatch(/quelques mots/);
  });

  it('limite à cinq messages par heure et par compte', async () => {
    for (let i = 0; i < 4; i++) expect((await contactSupport({ topic: 'question', message: `Question numéro ${i} pour le support` })).error).toBeNull();
    expect((await contactSupport({ topic: 'question', message: 'Encore une question pour le support' })).error).toMatch(/une heure/);
    // L'autre compte de l'entreprise n'a envoyé qu'un message : il peut encore écrire.
    session = { user: { id: MEMBER } };
    expect((await contactSupport({ topic: 'question', message: 'Une question de Paul pour le support' })).error).toBeNull();
    session = { user: { id: HEAD } };
  });

  it('renvoie la démonstration vers la page Contact', async () => {
    session = { user: { id: DEMO_USER_ID } };
    const before = (await requests()).length;
    expect((await contactSupport({ topic: 'question', message: 'Bonjour, une question sur la démo' })).error).toMatch(/\/contact/);
    expect((await requests()).length).toBe(before);
    session = { user: { id: HEAD } };
  });

  it('refuse l’administrateur entré dans le compte d’un client', async () => {
    session = { user: { id: HEAD }, actingAsAdmin: true };
    expect((await contactSupport({ topic: 'question', message: 'Message écrit par l’administrateur' })).error).toMatch(/titulaire/);
    session = { user: { id: HEAD } };
  });

  it('demande d’être connecté', async () => {
    session = null;
    expect((await contactSupport({ topic: 'question', message: 'Message sans session ouverte' })).error).toMatch(/session/);
    session = { user: { id: HEAD } };
  });
});
