// Historique des actions : la table inaltérable et la fonction log_activity, sur le vrai schéma en mémoire.
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '@/db/testDb';

const OWNER = '00000000-0000-4000-8000-0000000a0001';
const MEMBER = '00000000-0000-4000-8000-0000000a0002';
const QUOTE = '00000000-0000-4000-8000-0000000a00d1';
let pg: PGlite;

const log = (action: string, actor: string | null = MEMBER, company: string | null = null) => pg.query(
  `select public.log_activity($1, $2, false, $3, 'devis', $4, 'D-2026-042 — Mariage Dupont', 'Devis modifié', null)`,
  [company, actor, action, QUOTE],
);
const rows = async () => (await pg.query<{ company_id: string; actor_label: string; details: { count: number } }>(`select * from activity_log order by created_at`)).rows;

const seedUsers = () => pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@t.fr', 'x'), ('${MEMBER}', 'sophie@t.fr', 'x');
    insert into profiles (id, email, first_name, last_name) values ('${OWNER}', 'chef@t.fr', 'Julien', 'Martin');
    insert into profiles (id, email, first_name, last_name, parent_user_id, company_role) values ('${MEMBER}', 'sophie@t.fr', 'Sophie', 'Durand', '${OWNER}', 'collaborateur');
  `);

beforeAll(async () => {
  pg = await createTestDb();
  await seedUsers();
});

beforeEach(async () => {
  // Vider la table malgré la protection : seul le test peut désactiver les déclencheurs.
  await pg.exec(`alter table activity_log disable trigger user; delete from activity_log; alter table activity_log enable trigger user;`);
});

it('log_activity crée une ligne rattachée à l’entreprise du collaborateur', async () => {
  await log('creation');
  const [r] = await rows();
  expect(r).toMatchObject({ company_id: OWNER, actor_label: 'Sophie Durand', details: { count: 1 } });
});

it('deux modifications du même devis à 3 minutes d’écart ne font qu’une ligne', async () => {
  await log('modification');
  await pg.exec(`update activity_log set updated_at = now() - interval '3 min'`);
  await log('modification');
  const r = await rows();
  expect(r).toHaveLength(1);
  expect(r[0].details.count).toBe(2);
});

it('après 11 minutes, une nouvelle ligne', async () => {
  await log('modification');
  await pg.exec(`update activity_log set updated_at = now() - interval '11 min'`);
  await log('modification');
  expect(await rows()).toHaveLength(2);
});

it('une création n’est jamais regroupée', async () => {
  await log('creation');
  await log('creation');
  expect(await rows()).toHaveLength(2);
});

it('une action sans auteur (le client) est rattachée à l’entreprise donnée', async () => {
  await log('acceptation', null, OWNER);
  const [r] = await rows();
  expect(r).toMatchObject({ company_id: OWNER, actor_label: null });
});

it('sans auteur ni entreprise, rien n’est écrit', async () => {
  await log('acceptation', null, null);
  expect(await rows()).toHaveLength(0);
});

it('refuse la modification du résumé', async () => {
  await log('creation');
  await expect(pg.exec(`update activity_log set summary = 'autre chose'`)).rejects.toThrow();
});

it('refuse la suppression', async () => {
  await log('creation');
  await expect(pg.exec(`delete from activity_log`)).rejects.toThrow();
  expect(await rows()).toHaveLength(1);
});

it('la suppression du compte efface son historique', async () => {
  await log('creation');
  await pg.exec(`delete from users where id = '${MEMBER}'; delete from users where id = '${OWNER}'`);
  expect(await rows()).toHaveLength(0);
  await seedUsers();
});

it('une modification faite par l’équipe WeboDevis ne se fond pas dans celle du client', async () => {
  await log('modification');
  await pg.query(`select public.log_activity(null, $1, true, 'modification', 'devis', $2, 'D-2026-042', 'Devis modifié', null)`, [MEMBER, QUOTE]);
  expect(await rows()).toHaveLength(2);
});

it('deux clients différents qui consultent la même brochure font deux lignes', async () => {
  const view = (who: string) => pg.query(`select public.log_activity($1, null, false, 'consultation_client', 'brochure', $2, 'Mariages', $3, null)`,
    [OWNER, QUOTE, `Brochure Mariages consultée par ${who}`]);
  await view('Julie'); await view('Marc'); await view('Julie');
  const r = await rows();
  expect(r).toHaveLength(2);
  expect(r.map((x) => x.details.count).sort()).toEqual([1, 2]);
});

describe('log_activity_batch', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const batch = (n: number) => pg.query(`select public.log_activity_batch($1, false, 'creation', 'client', $2::uuid[], $3::text[], $4::text[], $5)`,
    [MEMBER, ids(n), ids(n).map((_, i) => `C${i}`), ids(n).map((_, i) => `Client C${i} créé`), `${n} clients créés`]);
  const lots = async () => (await pg.query<{ entity_id: string | null; details: { n?: number } }>(`select entity_id, details from activity_log`)).rows;

  it('peu d’éléments : une ligne chacun', async () => {
    await batch(3);
    expect(await lots()).toHaveLength(3);
  });
  it('un import en plusieurs envois ne fait qu’une ligne', async () => {
    await batch(100); await batch(100); await batch(15);
    const r = await lots();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ entity_id: null, details: { n: 215 } });
  });
});
