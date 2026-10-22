import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '@/db/testDb';

// Brochures, sur le vrai schéma (baseline + migrations) en mémoire.

const OWNER = '00000000-0000-4000-8000-0000000000b1';
let pg: PGlite;

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@b.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'chef@b.fr', 'Traiteur Brochure');
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
