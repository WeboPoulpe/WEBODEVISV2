// À lancer juste après scripts/import-data.mjs : remet dans les données copiées de Supabase ce que les
// migrations de la v2 avaient ajouté (modèles de location, liens des notifications).
// Usage : node scripts/after-import.mjs   puis   node scripts/seed-demo.mjs, node scripts/copy-files.mjs,
// node scripts/ingredient-photos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim())).filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);
if (!env.DATABASE_URL || !/\.neon\.tech\//.test(env.DATABASE_URL)) throw new Error('DATABASE_URL doit pointer vers Neon.');

const db = new pg.Client({ connectionString: env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full') });
await db.connect();
await db.query('begin');
try {
  // Articles de location : ceux de chaque compte forment son premier modèle (migration 0009).
  const sets = await db.query(`insert into public.rental_template_sets (user_id, name)
    select distinct user_id, 'Modèle principal' from public.rental_templates where set_id is null returning id`);
  const items = await db.query(`update public.rental_templates t set set_id = s.id from public.rental_template_sets s
    where s.user_id = t.user_id and t.set_id is null`);
  // Notifications qui menaient à une page de l'ancienne version (migration 0012).
  const links = await db.query(`update public.notifications set action_url = '/prospects' where action_url like '/prospect-requests%'`);
  await db.query('commit');
  console.log(`${sets.rowCount} modèles de location créés (${items.rowCount} articles rattachés), ${links.rowCount} liens de notification réparés.`);
} catch (e) {
  await db.query('rollback');
  console.error(`Échec, rien n'a été modifié : ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
