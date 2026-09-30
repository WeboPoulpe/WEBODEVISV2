// Met en ligne (Vercel Blob) les vidéos enregistrées dans .help-media/ et met à jour lib/help/media.json.
// Usage : node scripts/help/upload.mjs [identifiant…]
// Le nom du fichier en ligne contient une empreinte du contenu : une vidéo refaite a une nouvelle adresse,
// donc aucun navigateur ne garde l'ancienne.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { put } from '@vercel/blob';
import { envLocal, OUT, ROOT } from './lib.mjs';

const token = envLocal('BLOB_READ_WRITE_TOKEN');
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN est absent de .env.local.');
const manifestPath = path.join(ROOT, 'lib', 'help', 'media.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const wanted = process.argv.slice(2);
const ids = (wanted.length ? wanted : fs.readdirSync(OUT).filter((f) => f.endsWith('.mp4')).map((f) => f.slice(0, -4))).sort();

const send = async (file, type) => {
  const body = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 10);
  const name = `help/${path.basename(file, path.extname(file))}-${hash}${path.extname(file)}`;
  const blob = await put(name, body, { access: 'public', contentType: type, token, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31536000 });
  return blob.url;
};

for (const id of ids) {
  const mp4 = path.join(OUT, `${id}.mp4`);
  const jpg = path.join(OUT, `${id}.jpg`);
  if (!fs.existsSync(mp4) || !fs.existsSync(jpg)) { console.log(`absent  ${id}`); continue; }
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' });
  manifest[id] = { video: await send(mp4, 'video/mp4'), poster: await send(jpg, 'image/jpeg'), seconds: Math.round(Number(probe.stdout.trim())) };
  console.log(`en ligne  ${id}`);
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`);
