// Base de test en mémoire (PGlite) avec le vrai schéma : la structure de départ (db/baseline) puis toutes les
// migrations, dans l'ordre. Sert aux tests qui ont besoin des déclencheurs et des fonctions de la base.
// À n'importer que depuis des tests.

import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const ROOT = path.join(__dirname, '..');

export async function createTestDb(): Promise<PGlite> {
  const pg = new PGlite();
  // pgcrypto n'existe pas dans PGlite : gen_random_bytes() est remplacée par un équivalent (non cryptographique).
  await pg.exec(`
    create or replace function public.gen_random_bytes(n integer) returns bytea language sql as $$
      select decode(string_agg(lpad(to_hex((random() * 255)::int), 2, '0'), ''), 'hex') from generate_series(1, n)
    $$;
  `);
  for (const file of ['db/baseline/0000_tables.sql', 'db/baseline/0001_functions.sql']) {
    const sql = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/CREATE EXTENSION[^;]*;/g, '');
    for (const statement of sql.split(/;\s*\n(?=(?:CREATE|ALTER|COMMENT|GRANT|DROP|INSERT|SELECT|DO)\b)/)) await pg.exec(statement);
  }
  const dir = path.join(ROOT, 'db/migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of fs.readFileSync(path.join(dir, file), 'utf8').split('--> statement-breakpoint')) await pg.exec(statement);
  }
  return pg;
}
