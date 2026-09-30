import fs from 'node:fs';
import path from 'node:path';
import { deleteAccount, envLocal, sql } from './helpers';

// Après les tests : supprime les comptes créés par les tests (adresses du domaine d'essai),
// pour qu'ils ne s'accumulent pas dans la base.
export default async function globalTeardown() {
  // La session commune (compte de démonstration) ne reste pas sur le disque après les tests.
  fs.rmSync(path.join(__dirname, '.auth', 'user.json'), { force: true });
  if (!envLocal('DATABASE_URL')) return;

  // Comptes d'essai restés vides : supprimés tout de suite. Un par un, pour qu'un compte encore utilisé par un test
  // en cours ailleurs (qui a par exemple déjà des prestations) n'empêche pas de nettoyer les autres.
  const empty = await sql<{ id: string }>(`select u.id from public.users u where u.email like 'e2e-%@test.webodevis.local'
    and not exists (select 1 from public.customers c where c.owner_user_id = u.id or c.user_id = u.id)
    and not exists (select 1 from public.quotes q where q.owner_user_id = u.id or q.user_id = u.id)`);
  for (const { id } of empty) {
    await sql(`delete from public.users where id = $1 and email like 'e2e-%@test.webodevis.local'`, [id]).catch(() => undefined);
  }

  // Comptes d'essai générés par les tests (e2e-<quoi>-<horodatage>…) et abandonnés avec leurs données par un test
  // interrompu : supprimés, avec ce qui leur appartient, après deux heures. Un test encore en cours (autre
  // exécution en parallèle) n'est donc pas gêné. deleteAccount refuse toute adresse qui n'est pas d'essai.
  const stale = await sql<{ id: string }>(
    `select id from public.users
     where email ~ '^e2e-[a-z0-9-]+-[0-9]{13}(-[0-9]+)?@test\\.webodevis\\.local$' and created_at < now() - interval '2 hours'`);
  for (const { id } of stale) await deleteAccount(id).catch((e) => console.warn(`Compte d'essai ${id} non supprimé : ${e.message}`));
}
