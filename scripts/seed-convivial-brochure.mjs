// Ajoute (ou remet à jour) la brochure « Convivial Event — Catering 2026-2027 (FR + EN) » sur un compte.
// Usage : node scripts/seed-convivial-brochure.mjs <email du compte>            → crée ou met à jour
//         node scripts/seed-convivial-brochure.mjs <email du compte> --dry      → affiche sans rien écrire
//
// La brochure est en éditeur avancé (pages à blocs Texte, voir scripts/brochures/convivial-event.mjs) : elle
// s'ouvre dans Brochures et reste modifiable comme les autres. Rejouable : une brochure du même nom sur le même
// compte est mise à jour sur place (son lien de partage et ses statistiques sont gardés), jamais dupliquée.
// Seule la ligne `brochures` de ce compte et de ce nom est touchée.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { buildBrochure } from './brochures/convivial-event.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [email, flag] = process.argv.slice(2);
if (!email || !email.includes('@')) {
  console.error('Usage : node scripts/seed-convivial-brochure.mjs <email du compte> [--dry]');
  process.exit(1);
}
const dry = flag === '--dry';
const brochure = buildBrochure();

if (dry) {
  console.log(JSON.stringify(brochure, null, 2));
  process.exit(0);
}

const envFile = path.join(ROOT, '.env.local');
const env = fs.existsSync(envFile) ? Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
    .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
) : {};
const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL introuvable (variable d’environnement ou .env.local).');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('begin');
  const { rows: users } = await client.query('select id from public.users where lower(email) = lower($1)', [email]);
  if (!users.length) throw new Error(`Aucun compte avec l’email ${email}.`);
  const userId = users[0].id;
  // Comme createBrochure : la brochure appartient au compte qui la crée ; TVA par défaut de l'entreprise.
  const { rows: vat } = await client.query(
    `select p.default_vat_rate from public.profiles p
      where p.id = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = $1)`, [userId]);
  const vatRate = vat[0]?.default_vat_rate ?? 20;

  const { rows: existing } = await client.query(
    'select id from public.brochures where owner_user_id = $1 and name = $2 limit 1', [userId, brochure.name]);
  let id;
  if (existing.length) {
    id = existing[0].id;
    await client.query(
      `update public.brochures set cover = $2, layout = $3, editor_mode = 'advanced', show_prices = false, updated_at = now()
        where id = $1 and owner_user_id = $4`,
      [id, brochure.cover, brochure.layout, userId]);
  } else {
    const { rows } = await client.query(
      `insert into public.brochures (owner_user_id, user_id, name, style, language, show_prices, vat_rate, share_token, cover, content, editor_mode, layout)
       values ($1, $1, $2, 'editorial', 'fr', false, $3, $4, $5, $6, 'advanced', $7) returning id`,
      [userId, brochure.name, String(vatRate), crypto.randomBytes(18).toString('base64url'), brochure.cover,
        { about: { enabled: false, html: '' }, contact: { enabled: true }, sections: [] }, brochure.layout]);
    id = rows[0].id;
  }
  await client.query('commit');
  console.log(`${existing.length ? 'Brochure mise à jour' : 'Brochure créée'} : ${id} (/brochures/${id})`);
} catch (e) {
  await client.query('rollback');
  throw e;
} finally {
  await client.end();
}
