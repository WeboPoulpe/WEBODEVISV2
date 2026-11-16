import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '@/db/testDb';

// Les tables de l'annuaire se créent sur PGlite et leurs contraintes tiennent.

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
let pg: PGlite;

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${B}', 'b@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${A}', 'a@t.fr', 'Traiteur A'), ('${B}', 'b@t.fr', 'Traiteur B');
  `);
});

describe('tables de l’annuaire', () => {
  it('fiche : valeurs par défaut, slug unique, statut fermé', async () => {
    await pg.query(`insert into directory_listings (company_id, slug, display_name) values ($1, 'a-troyes', 'A')`, [A]);
    const row = (await pg.query<{ status: string; departments: string[]; event_types: string[] }>(`select status, departments, event_types from directory_listings where company_id = $1`, [A])).rows[0];
    expect(row).toEqual({ status: 'brouillon', departments: [], event_types: [] });
    await expect(pg.query(`insert into directory_listings (company_id, slug, display_name) values ($1, 'a-troyes', 'B')`, [B])).rejects.toThrow();
    await expect(pg.query(`update directory_listings set status = 'nimporte' where company_id = $1`, [A])).rejects.toThrow();
  });
  it('un même SIRET peut attendre une revue manuelle', async () => {
    await pg.query(`update directory_listings set siret = '12345678901234' where company_id = $1`, [A]);
    await pg.query(`insert into directory_listings (company_id, slug, display_name, siret, status) values ($1, 'b-troyes', 'B', '12345678901234', 'en_attente')`, [B]);
  });
  it('photos et brochures suivent la suppression de la fiche', async () => {
    await pg.query(`insert into directory_photos (company_id, url, path) values ($1, 'https://x/y.jpg', 'a/y.jpg')`, [A]);
    await pg.query(`delete from directory_listings where company_id = $1`, [A]);
    expect((await pg.query(`select 1 from directory_photos where company_id = $1`, [A])).rows).toHaveLength(0);
  });
  it('demande de prospect : origine', async () => {
    await pg.query(`insert into prospect_requests (first_name, last_name, email, owner_user_id, source) values ('a','b','c@d.fr',$1,'annuaire')`, [A]);
  });
});
