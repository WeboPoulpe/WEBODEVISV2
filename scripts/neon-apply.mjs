// Applique des fichiers SQL à la base Neon (DATABASE_URL de .env.local), chacun dans une transaction.
// Usage : node scripts/neon-apply.mjs [--reset] fichier.sql [fichier2.sql …]
// --reset vide d'abord les schémas public et drizzle. À n'utiliser qu'AVANT la bascule en production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const line = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
const url = line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '').replace('sslmode=require', 'sslmode=verify-full');
if (!/\.neon\.tech\//.test(url)) {
  console.error('DATABASE_URL ne pointe pas vers Neon : arrêt.');
  process.exit(1);
}

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const files = args.filter((a) => a !== '--reset');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (reset) {
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('schémas public et drizzle vidés');
  }
  for (const f of files) {
    const sql = fs.readFileSync(path.resolve(ROOT, f), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`appliqué : ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`ÉCHEC ${f} : ${e.message}${e.position ? ` (vers « ${sql.slice(Math.max(0, e.position - 80), +e.position + 40).replace(/\s+/g, ' ')} »)` : ''}`);
      process.exitCode = 1;
      break;
    }
  }
  const r = await client.query(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
  console.log(`tables dans public : ${r.rows[0].n}`);
} finally {
  await client.end();
}
