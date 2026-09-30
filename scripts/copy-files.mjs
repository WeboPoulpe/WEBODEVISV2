// Copie vers Vercel Blob les fichiers encore hébergés sur Supabase, puis met à jour leurs adresses dans Neon.
// Usage : node scripts/copy-files.mjs [--dry-run]
//
// Le script part des adresses Supabase présentes dans la base Neon (logos, photos, devis importés,
// images dans les devis) : seuls les fichiers réellement utilisés sont copiés. Les fichiers Supabase
// sont publics, donc lus par leur adresse ; la base Supabase n'est pas interrogée.
// Rejouable : un fichier déjà copié est simplement réécrit au même endroit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { put } from '@vercel/blob';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);
const dryRun = process.argv.includes('--dry-run');
if (!env.DATABASE_URL || !/\.neon\.tech\//.test(env.DATABASE_URL)) throw new Error('DATABASE_URL doit pointer vers Neon.');
if (!dryRun && !env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN est absent de .env.local.');

const SUPABASE_FILE = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\s?)\\<>]+/g;
const q = (n) => `"${n.replace(/"/g, '""')}"`;

const db = new pg.Client({ connectionString: env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full') });
await db.connect();

// 1. Colonnes de texte ou de JSON qui contiennent des adresses Supabase
const columns = (await db.query(
  `select table_name, column_name, data_type from information_schema.columns
   where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb', 'json') order by 1, 2`,
)).rows;
const found = [];
const urls = new Set();
for (const c of columns) {
  const res = await db.query(
    `select ${q(c.column_name)}::text as v from public.${q(c.table_name)} where ${q(c.column_name)}::text like '%supabase.co/storage/v1/object/public/%'`,
  );
  if (res.rows.length === 0) continue;
  found.push({ ...c, rows: res.rows.length });
  for (const r of res.rows) for (const u of r.v.match(SUPABASE_FILE) ?? []) urls.add(u);
}
console.log(`${urls.size} fichiers utilisés, dans ${found.length} colonnes :`);
for (const c of found) console.log(`  ${c.table_name}.${c.column_name} (${c.rows} lignes)`);
if (dryRun || urls.size === 0) { await db.end(); process.exit(0); }

// 2. Copie vers Blob, au même chemin (le bucket historique « storage » devient la racine)
const mapping = new Map();
let failed = 0;
for (const url of urls) {
  const rest = decodeURIComponent(url.split('/storage/v1/object/public/')[1]);
  const pathname = rest.startsWith('storage/') ? rest.slice('storage/'.length) : rest;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await put(pathname, await res.arrayBuffer(), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: res.headers.get('content-type') ?? undefined,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    mapping.set(url, blob.url);
  } catch (e) {
    failed++;
    console.log(`  échec : ${pathname} (${e.message})`);
  }
}
console.log(`${mapping.size} fichiers copiés, ${failed} en échec.`);

// 3. Réécriture des adresses dans Neon (dans une transaction)
await db.query('begin');
try {
  for (const c of found) {
    const cast = c.data_type === 'jsonb' || c.data_type === 'json' ? `::${c.data_type}` : '';
    for (const [from, to] of mapping) {
      await db.query(
        `update public.${q(c.table_name)} set ${q(c.column_name)} = replace(${q(c.column_name)}::text, $1, $2)${cast} where ${q(c.column_name)}::text like '%' || $1 || '%'`,
        [from, to],
      );
    }
  }
  await db.query('commit');
  console.log('Adresses mises à jour dans Neon.');
} catch (e) {
  await db.query('rollback');
  console.error(`Adresses non modifiées : ${e.message}`);
  process.exitCode = 1;
}
await db.end();
