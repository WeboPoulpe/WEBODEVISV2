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
    await db.query(`delete from public.users where email like '%@test.webodevis.local'`);
  } finally {
    await db.end();
  }
}
