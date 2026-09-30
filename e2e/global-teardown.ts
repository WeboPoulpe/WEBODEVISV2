import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

// Après les tests : supprime les comptes créés par les tests (adresses du domaine d'essai),
// pour qu'ils ne s'accumulent pas dans la base de développement.
export default async function globalTeardown() {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return;
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  const url = (line ?? '').slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  if (!url) return;
  const db = new Client({ connectionString: url.replace('sslmode=require', 'sslmode=verify-full') });
  await db.connect();
  try {
    // Seulement les comptes créés par ces tests (préfixe e2e-) et restés vides : un compte d'essai créé à la main
    // pour une autre vérification, ou encore utilisé, n'est pas touché.
    await db.query(`delete from public.users u where u.email like 'e2e-%@test.webodevis.local'
      and not exists (select 1 from public.customers c where c.owner_user_id = u.id or c.user_id = u.id)
      and not exists (select 1 from public.quotes q where q.owner_user_id = u.id or q.user_id = u.id)`);
  } finally {
    await db.end();
  }
}
