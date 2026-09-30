import fs from 'node:fs';
import path from 'node:path';

/**
 * Charge .env.local pour les outils lancés hors de Next (drizzle-kit, scripts, tests).
 * Le fichier contient aussi des notes libres : seules les lignes VAR=valeur sont lues.
 */
export function loadEnvLocal(root: string = process.cwd()) {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
