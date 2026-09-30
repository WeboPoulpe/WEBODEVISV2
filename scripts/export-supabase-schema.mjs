// Export en LECTURE SEULE du schéma réel de Supabase (aucune donnée métier, aucun secret).
// Usage : node scripts/export-supabase-schema.mjs
// Lit SUPABASE_DB_URL dans .env.local et écrit .migration/supabase-schema.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLine = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split(/\r?\n/).find((l) => l.startsWith('SUPABASE_DB_URL='));
if (!envLine) {
  console.error('SUPABASE_DB_URL est absent de .env.local');
  process.exit(1);
}
const url = envLine.slice('SUPABASE_DB_URL='.length).trim().replace(/^["']|["']$/g, '');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
await client.connect();
await client.query('set default_transaction_read_only = on');
const q = async (sql) => (await client.query(sql)).rows;

const out = {
  exportedAt: new Date().toISOString(),
  server: (await q('select version() as v'))[0].v,
  columns: await q(`
    select c.relname as table_name, a.attname as column_name, a.attnum as ordinal_position,
           format_type(a.atttypid, a.atttypmod) as full_type,
           tn.nspname as type_schema, t.typname as udt_name,
           case when a.attnotnull then 'NO' else 'YES' end as is_nullable,
           pg_get_expr(d.adbin, d.adrelid) as column_default,
           a.attidentity as identity, a.attgenerated as generated
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    join pg_namespace tn on tn.oid = t.typnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum`),
  sequences: await q(`select sequencename, start_value, increment_by, last_value from pg_sequences where schemaname = 'public' order by 1`),
  constraints: await q(`
    select c.conrelid::regclass::text as table_name, c.conname, c.contype,
           pg_get_constraintdef(c.oid) as definition
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' order by 1, 2`),
  indexes: await q(`select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by 1, 2`),
  rls: await q(`
    select c.relname as table_name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1`),
  policies: await q(`
    select schemaname, tablename, policyname, cmd, roles::text as roles, qual, with_check
    from pg_policies where schemaname in ('public', 'storage') order by 1, 2, 3`),
  triggers: await q(`
    select event_object_schema as schema, event_object_table as table_name, trigger_name,
           action_timing, event_manipulation, action_statement
    from information_schema.triggers
    where event_object_schema in ('public', 'auth') order by 1, 2, 3`),
  triggerDefs: await q(`
    select c.relname as table_name, t.tgname, p.proname as function_name, pg_get_triggerdef(t.oid) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public' and not t.tgisinternal order by 1, 2`),
  functions: await q(`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer,
           pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' order by 1`),
  enums: await q(`
    select t.typname, array_agg(e.enumlabel order by e.enumsortorder)::text as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by 1 order by 1`),
  views: await q(`select table_name, view_definition from information_schema.views where table_schema = 'public' order by 1`),
  extensions: await q(`select extname, extversion from pg_extension order by 1`),
  rowCounts: {},
  auth: {},
  storage: {},
};

for (const { table_name } of out.rls) {
  out.rowCounts[table_name] = (await q(`select count(*)::int as n from public."${table_name}"`))[0].n;
}
// Comptes et fichiers : uniquement des compteurs, pas de contenu.
out.auth.userCount = (await q('select count(*)::int as n from auth.users'))[0].n;
out.auth.passwordHashPrefixes = (await q(`select distinct left(encrypted_password, 4) as p from auth.users`)).map((r) => r.p);
out.storage.buckets = await q('select id, name, public from storage.buckets order by 1');
out.storage.objectCounts = await q(`select bucket_id, count(*)::int as n, coalesce(sum((metadata->>'size')::bigint), 0)::bigint as bytes from storage.objects group by 1 order by 1`);

// Tâches planifiées (pg_cron) : à reprendre en tâches Vercel.
try {
  out.cronJobs = await q('select jobname, schedule, command, active from cron.job order by 1');
} catch (e) {
  out.cronJobs = `illisible : ${e.message}`;
}

await client.end();

const dir = path.join(ROOT, '.migration');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'supabase-schema.json'), JSON.stringify(out, null, 1));

const tables = out.rls.map((t) => t.table_name);
console.log(`Export écrit dans .migration/supabase-schema.json`);
console.log(`${tables.length} tables, ${out.columns.length} colonnes, ${out.policies.length} règles RLS, ${out.triggers.length} triggers, ${out.functions.length} fonctions`);
console.log(`${out.auth.userCount} comptes, ${out.storage.objectCounts.reduce((s, o) => s + o.n, 0)} fichiers`);
console.log('Lignes par table :', tables.map((t) => `${t}=${out.rowCounts[t]}`).join(' '));
