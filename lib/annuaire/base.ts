import 'server-only';
import { headers } from 'next/headers';
import { DIRECTORY_PREFIX } from './config';
import { isDirectoryHost } from './routing';

export type DirectoryBase = '' | typeof DIRECTORY_PREFIX;

/**
 * Début des liens internes de l'annuaire : rien sur son propre hôte (le middleware réécrit vers /annuaire), « /annuaire »
 * ailleurs (local, aperçus Vercel). Côté navigateur, le même résultat se lit avec useDirectoryBase().
 */
export async function directoryBase(): Promise<DirectoryBase> {
  const h = await headers();
  return isDirectoryHost(h.get('host'), process.env.DIRECTORY_HOST) ? '' : DIRECTORY_PREFIX;
}
