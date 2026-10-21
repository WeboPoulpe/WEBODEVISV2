import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';

// Polices DejaVu des PDF générés côté serveur (contrats d'extra), lues une fois sur le disque.
// Les routes qui s'en servent sont listées dans outputFileTracingIncludes (next.config.ts).

const FONTS_DIR = path.join(process.cwd(), 'lib/facturx/fonts');
let fonts: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;

export const loadPdfFonts = () => (fonts ??= Promise.all([
  fs.readFile(path.join(FONTS_DIR, 'DejaVuSans.ttf')),
  fs.readFile(path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf')),
]).then(([regular, bold]) => ({ regular, bold })).catch((e) => { fonts = null; throw e; }));
