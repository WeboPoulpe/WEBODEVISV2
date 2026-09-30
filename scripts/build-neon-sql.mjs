// Construit le SQL de recréation du schéma Supabase sur Neon à partir de l'export.
// Usage : node scripts/build-neon-sql.mjs
// Lit .migration/supabase-schema.json, écrit .migration/tables.sql et .migration/functions.sql
// (aucun accès base : transformation de fichiers uniquement).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, '.migration');
const s = JSON.parse(fs.readFileSync(path.join(DIR, 'supabase-schema.json'), 'utf8'));

const ident = (n) => (/^[a-z_][a-z0-9_]*$/.test(n) ? n : `"${n.replace(/"/g, '""')}"`);
const parsePgArray = (txt) =>
  [...txt.slice(1, -1).matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)].map((m) => (m[1] ?? m[2]).replace(/\\(.)/g, '$1'));
// Supabase range les comptes dans auth.users ; sur Neon ils vivent dans public.users.
const retarget = (sql) => sql.replace(/REFERENCES auth\.users\(id\)/g, 'REFERENCES public.users(id)');

// ── Tables ────────────────────────────────────────────────────────────────────
const out = [];
out.push('-- Généré par scripts/build-neon-sql.mjs à partir de l\'export Supabase. Ne pas modifier à la main.');
out.push('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
for (const e of s.enums) {
  out.push(`CREATE TYPE public.${ident(e.typname)} AS ENUM (${parsePgArray(e.labels).map((l) => `'${l.replace(/'/g, "''")}'`).join(', ')});`);
}

// Comptes (remplace auth.users) et jetons de réinitialisation.
out.push(`CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);`);
out.push(`CREATE TABLE public.password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone
);`);

const tables = s.rls.map((t) => t.table_name);
for (const t of tables) {
  const cols = s.columns.filter((c) => c.table_name === t).map((c) => {
    let line = `  ${ident(c.column_name)} ${c.full_type}`;
    if (c.column_default !== null) line += ` DEFAULT ${c.column_default}`;
    if (c.is_nullable === 'NO') line += ' NOT NULL';
    return line;
  });
  out.push(`CREATE TABLE public.${ident(t)} (\n${cols.join(',\n')}\n);`);
}

// Clés primaires, unicité et contrôles d'abord, clés étrangères ensuite.
const order = { p: 0, u: 1, c: 2, f: 3 };
const constraints = [...s.constraints].sort((a, b) => order[a.contype] - order[b.contype]);
for (const c of constraints) {
  out.push(`ALTER TABLE public.${c.table_name} ADD CONSTRAINT ${ident(c.conname)} ${retarget(c.definition)};`);
}
const constraintNames = new Set(s.constraints.map((c) => c.conname));
for (const i of s.indexes.filter((i) => !constraintNames.has(i.indexname))) out.push(`${i.indexdef};`);

fs.writeFileSync(path.join(DIR, 'tables.sql'), out.join('\n\n') + '\n');

// ── Fonctions et triggers ─────────────────────────────────────────────────────
// Non repris : liés à l'authentification Supabase (remplacés par le code serveur).
const SKIP_FUNCTIONS = new Set(['handle_new_user', 'enforce_profile_role', 'is_admin', 'get_current_user_role', 'make_user_admin']);
const fn = [];
fn.push('-- Généré par scripts/build-neon-sql.mjs à partir de l\'export Supabase.');
fn.push(`-- Utilisateur courant transmis par l'application (remplace auth.uid()) ; NULL si non renseigné.
CREATE OR REPLACE FUNCTION public.current_app_user() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;`);
const kept = s.functions.filter((f) => !SKIP_FUNCTIONS.has(f.proname));
for (const f of kept) {
  fn.push(f.definition.replace(/auth\.uid\(\)/g, 'public.current_app_user()') + ';');
}
const keptNames = new Set(kept.map((f) => f.proname));
for (const t of s.triggerDefs.filter((t) => keptNames.has(t.function_name))) fn.push(`${t.definition};`);
fs.writeFileSync(path.join(DIR, 'functions.sql'), fn.join('\n\n') + '\n');

const leftovers = fn.join('\n').match(/\b(auth|storage|net|vault|cron)\.[a-z_]+/g) ?? [];
console.log(`tables.sql : ${tables.length + 2} tables, ${s.enums.length} enums, ${constraints.length} contraintes, ${s.indexes.length - [...constraintNames].filter((n) => s.indexes.some((i) => i.indexname === n)).length} index`);
console.log(`functions.sql : ${kept.length + 1} fonctions, ${s.triggerDefs.filter((t) => keptNames.has(t.function_name)).length} triggers (ignorés : ${s.triggerDefs.filter((t) => !keptNames.has(t.function_name)).map((t) => t.tgname).join(', ') || 'aucun'})`);
console.log(`références Supabase restantes dans functions.sql : ${[...new Set(leftovers)].join(', ') || 'aucune'}`);
