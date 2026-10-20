import 'server-only';
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import { del, list } from '@vercel/blob';
import { db } from '@/db';
import { profiles } from '@/db/schema';

// Purge définitive d'un compte : toutes ses lignes, dans toutes les tables, puis le compte lui-même.
// Plutôt qu'une liste de tables écrite à la main (qui vieillirait à chaque nouvelle table), la purge suit les clés
// étrangères de la base : avant d'effacer des lignes, elle efface ce qui en dépend, de proche en proche.
// Elle reprend aussi les tables qui ont une colonne propriétaire (user_id, owner_user_id…) sans clé étrangère.
// Ce module n'est pas une action serveur : rien ici n'est appelable depuis le navigateur.

/** Délai entre la demande de suppression et la purge. */
export const DELETION_DELAY_DAYS = 30;

type Exec = Pick<typeof db, 'execute'>;

// onDelete : 'a' rien, 'r' interdit, 'c' cascade, 'n' mise à vide, 'd' valeur par défaut.
interface ForeignKey { child: string; col: string; parent: string; parentCol: string; onDelete: string }

const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

async function foreignKeys(tx: Exec): Promise<ForeignKey[]> {
  const { rows } = await tx.execute(sql`
    select c.conrelid::regclass::text as child, a.attname as col, c.confrelid::regclass::text as parent, af.attname as "parentCol", c.confdeltype::text as "onDelete"
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1`);
  return (rows as unknown as ForeignKey[]).map((r) => ({ ...r, child: r.child.replace(/^public\./, ''), parent: r.parent.replace(/^public\./, '') }));
}

async function ownerColumns(tx: Exec): Promise<{ table: string; col: string }[]> {
  const { rows } = await tx.execute(sql`
    select c.table_name as "table", c.column_name as col
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type = 'uuid' and c.column_name in ('user_id', 'owner_user_id', 'created_by')`);
  return rows as unknown as { table: string; col: string }[];
}

/**
 * Efface les lignes de `table` désignées par `where`, après avoir effacé (récursivement) les lignes des autres
 * tables qui pointent vers elles. Les auto-références (facture → avoir) partent dans la même instruction.
 */
async function deleteWithDependents(tx: Exec, fks: ForeignKey[], table: string, where: string, depth = 0): Promise<void> {
  if (depth > 12) throw new Error(`Purge : dépendances trop profondes depuis ${table}`);
  // Une clé « mise à vide » ne fait pas partir la ligne qui pointe (le collaborateur d'un compte supprimé reste).
  for (const fk of fks.filter((f) => f.parent === table && f.child !== table && f.onDelete !== 'n' && f.onDelete !== 'd')) {
    await deleteWithDependents(tx, fks, fk.child,
      `${qi(fk.col)} in (select ${qi(fk.parentCol)} from public.${qi(table)} where ${where})`, depth + 1);
  }
  await tx.execute(sql.raw(`delete from public.${qi(table)} where ${where}`));
}

/** Efface toutes les données du compte puis le compte. Ne touche à aucune ligne d'un autre compte. */
export async function purgeAccount(userId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Identifiant de compte invalide');
  const uid = `'${userId}'::uuid`;
  await db.transaction(async (tx) => {
    // Autorise l'effacement des factures émises de ce compte (voir protect_issued_invoice).
    await tx.execute(sql`select set_config('app.purge', 'on', true)`);
    const fks = await foreignKeys(tx);
    // 1. Les lignes dont le compte est propriétaire, table par table, avec ce qui en dépend.
    for (const { table, col } of await ownerColumns(tx)) {
      if (table === 'users' || table === 'profiles') continue;
      await deleteWithDependents(tx, fks, table, `${qi(col)} = ${uid}`);
    }
    // 2. Tout ce qui pointe encore vers le compte (historique, profil…), puis le compte.
    await deleteWithDependents(tx, fks, 'users', `id = ${uid}`);
  });
}

/** Fichiers du compte sur Vercel Blob (tous rangés sous « <id du compte>/ »). */
async function deleteAccountFiles(userId: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${userId}/`, cursor, limit: 1000 });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

/** Purge un compte et ses fichiers. Appelé par la tâche planifiée ou par un administrateur. */
export async function purgeAccountNow(userId: string): Promise<void> {
  await purgeAccount(userId);
  // Les fichiers partent après les données : un échec ici laisse des fichiers orphelins, jamais des données.
  await deleteAccountFiles(userId).catch((e) => console.error('[purge] fichiers', userId, e));
}

/** Comptes dont le délai de suppression est passé. */
export async function accountsDueForPurge(): Promise<string[]> {
  const limit = new Date(Date.now() - DELETION_DELAY_DAYS * 86400_000).toISOString();
  const rows = await db.select({ id: profiles.id }).from(profiles)
    .where(and(isNotNull(profiles.deletion_requested_at), lt(profiles.deletion_requested_at, limit), eq(profiles.is_active, false)));
  return rows.map((r) => r.id);
}

