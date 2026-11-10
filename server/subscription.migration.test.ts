import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

// Migration 0050 : les titulaires existants passent en compte offert « Bêta », pas les collaborateurs, la démo ni l'admin.

const T1 = '00000000-0000-4000-8000-0000000000f1';
const T2 = '00000000-0000-4000-8000-0000000000f2';
const COLLAB = '00000000-0000-4000-8000-0000000000f3';
const ADMIN = '00000000-0000-4000-8000-0000000000f4';
let pg: PGlite;

const replay = async () => {
  const file = path.join(__dirname, '..', 'db/migrations/0050_subscriptions.sql');
  for (const statement of fs.readFileSync(file, 'utf8').split('--> statement-breakpoint')) await pg.exec(statement);
};
const rows = async () => (await pg.query<{ company_id: string; comped: boolean; comped_note: string; ever_subscribed: boolean; status: string }>(
  `select company_id, comped, comped_note, ever_subscribed, status from company_subscriptions order by company_id`)).rows;

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${T1}', 't1@w.fr', 'x'), ('${T2}', 't2@w.fr', 'x'), ('${COLLAB}', 'c@w.fr', 'x'), ('${ADMIN}', 'a@w.fr', 'x'), ('${DEMO_USER_ID}', 'demo@w.fr', 'x');
    insert into profiles (id, email) values ('${T1}', 't1@w.fr'), ('${T2}', 't2@w.fr'), ('${DEMO_USER_ID}', 'demo@w.fr');
    insert into profiles (id, email, role) values ('${ADMIN}', 'a@w.fr', 'admin');
    insert into profiles (id, email, parent_user_id) values ('${COLLAB}', 'c@w.fr', '${T1}');
  `);
  await pg.exec('delete from company_subscriptions');
  await replay();
});

describe('migration 0050_subscriptions', () => {
  it('offre la bêta aux titulaires seulement', async () => {
    const r = await rows();
    expect(r.map((x) => x.company_id)).toEqual([T1, T2]);
    for (const x of r) expect(x).toMatchObject({ comped: true, comped_note: 'Bêta', ever_subscribed: true, status: 'none' });
  });
  it('est rejouable sans rien changer', async () => {
    const before = await rows();
    await replay();
    expect(await rows()).toEqual(before);
  });
});
