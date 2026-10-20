// « Vos premiers pas » : chaque étape lue sur le vrai schéma en mémoire, à l'échelle de l'entreprise.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

vi.mock('server-only', () => ({}));
const HEAD = '00000000-0000-4000-8000-0000000a0001';
const MEMBER = '00000000-0000-4000-8000-0000000a0002';
const OTHER = '00000000-0000-4000-8000-0000000a0003';
let current = HEAD;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@y.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { getFirstSteps } = await import('./onboarding');
const doneKeys = async () => (await getFirstSteps())!.steps.filter((s) => s.done).map((s) => s.key);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${HEAD}', 'h@t.fr', 'x'), ('${MEMBER}', 'm@t.fr', 'x'), ('${OTHER}', 'o@t.fr', 'x');
    insert into profiles (id, email) values ('${HEAD}', 'h@t.fr'), ('${OTHER}', 'o@t.fr');
    insert into profiles (id, email, parent_user_id) values ('${MEMBER}', 'm@t.fr', '${HEAD}');
  `);
});

it('part de zéro pour un compte neuf', async () => {
  const data = (await getFirstSteps())!;
  expect(data.total).toBe(7);
  expect(data.done).toBe(0);
  expect(data.steps.map((s) => s.href)).toEqual(['/parametres', '/parametres', '/prestations', '/clients/nouveau', '/devis/nouveau', '/devis', '/prospects?action=formulaire']);
});

it('demande le logo, le nom et l’adresse ensemble', async () => {
  await pg.exec(`update profiles set company_name = 'Traiteur H', company_address = '1 rue Haute' where id = '${HEAD}'`);
  expect(await doneKeys()).toEqual([]);
  await pg.exec(`update profiles set logo_url = 'https://x/logo.png' where id = '${HEAD}'`);
  expect(await doneKeys()).toEqual(['identite']);
});

it('demande le SIRET et la TVA, ou l’exonération', async () => {
  await pg.exec(`update profiles set company_siret = '12345678900011' where id = '${HEAD}'`);
  expect(await doneKeys()).not.toContain('mentions');
  await pg.exec(`update profiles set vat_exempt = true where id = '${HEAD}'`);
  expect(await doneKeys()).toContain('mentions');
});

it('compte les prestations, clients, devis et formulaire de toute l’équipe', async () => {
  await pg.exec(`
    insert into prestations (name, user_id) values ('A', '${HEAD}'), ('B', '${MEMBER}');
    insert into customers (customer_type, email, first_name, last_name, owner_user_id) values ('particulier', 'c@t.fr', 'Jean', 'Dupont', '${MEMBER}');
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status) values ('${MEMBER}', '${MEMBER}', 'Dupont', '2026-12-12', 'mariage', 40, 'devis_a_faire');
  `);
  expect(await doneKeys()).toEqual(['identite', 'mentions', 'client', 'devis']);

  await pg.exec(`
    insert into prestations (name, user_id) values ('C', '${MEMBER}');
    update quotes set sent_at = now();
    insert into user_prospect_tokens (user_id, token, is_active) values ('${HEAD}', 'jeton-h', false);
  `);
  expect(await doneKeys()).toEqual(['identite', 'mentions', 'prestations', 'client', 'devis', 'envoi']);

  await pg.exec(`update user_prospect_tokens set is_active = true`);
  expect((await getFirstSteps())!.done).toBe(7);

  // Le collaborateur voit les mêmes étapes, l'identité étant celle du titulaire.
  current = MEMBER;
  expect((await getFirstSteps())!.done).toBe(7);
  current = HEAD;
});

it('ne mélange pas les entreprises', async () => {
  current = OTHER;
  expect((await getFirstSteps())!.done).toBe(0);
  current = HEAD;
});

it('ne concerne pas la démonstration', async () => {
  current = DEMO_USER_ID;
  expect(await getFirstSteps()).toBeNull();
  current = HEAD;
});
