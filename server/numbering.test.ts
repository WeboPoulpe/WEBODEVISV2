// Numérotation des documents (migration 0017), jouée sur un vrai Postgres en mémoire (PGlite).
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const pg = new PGlite();
const OWNER = '00000000-0000-4000-8000-000000000001';
const MEMBER = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000003';
const year = new Date().getFullYear();

const next = async (user: string, kind: string) =>
  (await pg.query<{ n: string }>(`select public.next_document_number($1, $2) as n`, [user, kind])).rows[0].n;

beforeAll(async () => {
  await pg.exec(`
    create table users (id uuid primary key);
    create table profiles (id uuid primary key, parent_user_id uuid);
    create table quotes (id uuid primary key default gen_random_uuid(), owner_user_id uuid, user_id uuid, quote_number text, client_name text not null default '');
    insert into users values ('${OWNER}'), ('${MEMBER}'), ('${OTHER}');
    insert into profiles values ('${OWNER}', null), ('${MEMBER}', '${OWNER}'), ('${OTHER}', null);
  `);
  // La migration telle qu'elle sera appliquée, découpée sur ses séparateurs.
  const sql = fs.readFileSync(path.join(__dirname, '../db/migrations/0017_numbering_legal.sql'), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) await pg.exec(statement);
});

describe('next_document_number', () => {
  it('numérote par entreprise, au format par défaut', async () => {
    expect(await next(OWNER, 'invoice')).toBe(`F-${year}-0001`);
    expect(await next(OWNER, 'invoice')).toBe(`F-${year}-0002`);
    expect(await next(OTHER, 'invoice')).toBe(`F-${year}-0001`);
  });

  it('partage le compteur entre les comptes d’une même entreprise', async () => {
    expect(await next(MEMBER, 'invoice')).toBe(`F-${year}-0003`);
  });

  it('suit le format choisi par le traiteur sans remettre le compteur à zéro', async () => {
    await pg.query(`update profiles set numbering = $1 where id = $2`, [JSON.stringify({ invoice: { prefix: 'FAC', withYear: true, digits: 5 } }), OWNER]);
    expect(await next(OWNER, 'invoice')).toBe(`FAC${year}-00004`);
    await pg.query(`update profiles set numbering = $1 where id = $2`, [JSON.stringify({ invoice: { prefix: 'FAC-', withYear: false, digits: 3 } }), OWNER]);
    expect(await next(OWNER, 'invoice')).toBe('FAC-001');
  });

  it('ne laisse pas de trou quand la création échoue', async () => {
    await pg.exec('begin');
    await next(OTHER, 'credit');
    await pg.exec('rollback');
    expect(await next(OTHER, 'credit')).toBe(`AV-${year}-0001`);
  });
});

describe('numéro des devis', () => {
  it('donne un numéro propre au compte à chaque nouveau devis', async () => {
    const { rows } = await pg.query<{ quote_number: string }>(
      `insert into quotes (owner_user_id, user_id) values ($1, $1), ($2, $2) returning quote_number`, [OTHER, MEMBER]);
    expect(rows.map((r) => r.quote_number)).toEqual([`D-${year}-0001`, `D-${year}-0001`]);
  });

  it('garde un numéro fourni', async () => {
    const { rows } = await pg.query<{ quote_number: string }>(
      `insert into quotes (owner_user_id, quote_number) values ($1, 'ANCIEN-1') returning quote_number`, [OTHER]);
    expect(rows[0].quote_number).toBe('ANCIEN-1');
  });
});
