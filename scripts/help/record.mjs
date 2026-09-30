// Enregistre les vidéos du centre d'aide.
// Usage : node scripts/help/record.mjs [identifiant…]        (sans identifiant : tous les guides)
// Prérequis : l'app tourne sur http://localhost:3001, le compte de démonstration existe (node scripts/seed-demo.mjs),
// ffmpeg est installé. Les fichiers vont dans .help-media/ ; `node scripts/help/upload.mjs` les met en ligne.
import { loadScenarios, record } from './lib.mjs';

const scenarios = await loadScenarios();
const wanted = process.argv.slice(2);
const ids = wanted.length ? wanted : Object.keys(scenarios);
const unknown = ids.filter((id) => !scenarios[id]);
if (unknown.length) throw new Error(`Scénario inconnu : ${unknown.join(', ')}`);

let failed = 0;
for (const id of ids) {
  try {
    const r = await record(id, scenarios[id]);
    console.log(`ok     ${id}  ${r.seconds} s  ${(r.bytes / 1024).toFixed(0)} Ko`);
  } catch (e) {
    failed++;
    console.log(`ÉCHEC  ${id}  ${String(e.message).split('\n')[0]}  (capture : .help-media/${id}-echec.png)`);
  }
}
process.exit(failed ? 1 : 0);
