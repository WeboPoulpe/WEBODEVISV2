// Copie les données de Supabase vers Neon. Rejouable : vide les tables de Neon puis recharge tout.
// Usage : node scripts/import-data.mjs
// Supabase est ouvert en LECTURE SEULE. Rien n'est affiché en dehors des compteurs.
// À ne plus lancer après la bascule en production (il écraserait les données de Neon).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);
if (!env.SUPABASE_DB_URL || !env.DATABASE_URL) throw new Error('SUPABASE_DB_URL et DATABASE_URL sont requis dans .env.local');
if (!/\.neon\.tech\//.test(env.DATABASE_URL)) throw new Error('DATABASE_URL ne pointe pas vers Neon : arrêt.');

// Côté source, toutes les valeurs sont lues comme texte brut : aucune conversion de date, de JSON ou de tableau.
const raw = { getTypeParser: () => (v) => v };
const src = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, types: raw });
const dst = new pg.Client({ connectionString: env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full') });
await src.connect();
await dst.connect();
await src.query('set default_transaction_read_only = on');

const q = (n) => `"${n.replace(/"/g, '""')}"`;

async function copyRows(table, columns, rows) {
  if (rows.length === 0) return;
  const chunk = Math.max(1, Math.floor(30000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params = [];
    const values = part.map((row) => `(${columns.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(', ')})`);
    await dst.query(`insert into public.${q(table)} (${columns.map(q).join(', ')}) values ${values.join(', ')}`, params);
  }
}

const tables = (await dst.query(
  `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
)).rows.map((r) => r.table_name);
const OWN_TABLES = ['users', 'password_reset_tokens'];
const copied = tables.filter((t) => !OWN_TABLES.includes(t));

const fks = (await dst.query(
  `select conrelid::regclass::text as t, conname, pg_get_constraintdef(oid) as def
   from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace order by 1, 2`,
)).rows;

const report = [];
await dst.query('begin');
try {
  // Les clés étrangères et les triggers sont suspendus le temps de la copie, puis remis.
  for (const fk of fks) await dst.query(`alter table ${fk.t} drop constraint ${q(fk.conname)}`);
  for (const t of tables) await dst.query(`alter table public.${q(t)} disable trigger user`);
  await dst.query(`truncate ${tables.map((t) => `public.${q(t)}`).join(', ')}`);

  // Comptes : identifiant et hachage du mot de passe conservés.
  const users = (await src.query('select id, lower(email) as email, encrypted_password, created_at from auth.users')).rows;
  await copyRows('users', ['id', 'email', 'password_hash', 'created_at'],
    // Un compte sans mot de passe reçoit un hachage invalide : il devra passer par « mot de passe oublié ».
    users.map((u) => ({ id: u.id, email: u.email, password_hash: u.encrypted_password || '!', created_at: u.created_at })));
  report.push(['users', users.length, users.length]);

  for (const t of copied) {
    const res = await src.query(`select * from public.${q(t)}`);
    const columns = res.fields.map((f) => f.name);
    await copyRows(t, columns, res.rows);
    const n = (await dst.query(`select count(*)::int as n from public.${q(t)}`)).rows[0].n;
    report.push([t, res.rows.length, n]);
  }

  for (const t of tables) await dst.query(`alter table public.${q(t)} enable trigger user`);
  for (const fk of fks) await dst.query(`alter table ${fk.t} add constraint ${q(fk.conname)} ${fk.def}`);
  await dst.query('commit');
} catch (e) {
  await dst.query('rollback');
  console.error(`ÉCHEC, rien n'a été modifié dans Neon : ${e.message}${e.detail ? ` — ${e.detail}` : ''}${e.table ? ` (table ${e.table})` : ''}`);
  process.exitCode = 1;
} finally {
  await src.end();
  await dst.end();
}

if (!process.exitCode) {
  const bad = report.filter(([, a, b]) => a !== b);
  const total = report.reduce((s, [, a]) => s + a, 0);
  console.log(`${report.length} tables copiées, ${total} lignes, ${fks.length} clés étrangères revalidées.`);
  console.log(bad.length ? `ÉCARTS : ${bad.map(([t, a, b]) => `${t} ${a}→${b}`).join(', ')}` : 'Comptages identiques des deux côtés pour toutes les tables.');
  if (bad.length) process.exitCode = 1;
}
