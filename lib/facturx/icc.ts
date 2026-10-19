// Profil de couleur sRGB minimal (ICC v2, écran RGB, matrice + courbes), généré plutôt que livré en fichier.
// PDF/A l'exige comme « intention de sortie » : il dit comment interpréter les couleurs RGB du document.
// Primaires sRGB adaptées à l'illuminant D50 (Bradford) et courbe gamma 2,2.

const D50 = [0.9642, 1.0, 0.8249];
const PRIMARIES: Record<'rXYZ' | 'gXYZ' | 'bXYZ', number[]> = {
  rXYZ: [0.4361, 0.2225, 0.0139],
  gXYZ: [0.3851, 0.7169, 0.0971],
  bXYZ: [0.1431, 0.0606, 0.7141],
};

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number) => [(n >>> 8) & 255, n & 255];
const s15f16 = (x: number) => u32(Math.round(x * 65536) >>> 0);
const pad4 = (b: number[]) => [...b, ...new Array((4 - (b.length % 4)) % 4).fill(0)];

const xyzTag = (xyz: number[]) => [...ascii('XYZ '), 0, 0, 0, 0, ...xyz.flatMap(s15f16)];
const curveTag = (gamma: number) => [...ascii('curv'), 0, 0, 0, 0, ...u32(1), ...u16(Math.round(gamma * 256))];
const textTag = (s: string) => [...ascii('text'), 0, 0, 0, 0, ...ascii(s), 0];
function descTag(s: string): number[] {
  // textDescriptionType : ASCII, puis Unicode et ScriptCode vides (67 octets de remplissage pour ScriptCode).
  return [...ascii('desc'), 0, 0, 0, 0, ...u32(s.length + 1), ...ascii(s), 0, ...u32(0), ...u32(0), ...u16(0), 0, ...new Array(67).fill(0)];
}

export function srgbIccProfile(): Uint8Array {
  const trc = curveTag(2.2);
  const tags: [string, number[]][] = [
    ['desc', descTag('sRGB')],
    ['cprt', textTag('Domaine public')],
    ['wtpt', xyzTag(D50)],
    ['rXYZ', xyzTag(PRIMARIES.rXYZ)],
    ['gXYZ', xyzTag(PRIMARIES.gXYZ)],
    ['bXYZ', xyzTag(PRIMARIES.bXYZ)],
    ['rTRC', trc],
    ['gTRC', trc],
    ['bTRC', trc],
  ];
  const tableSize = 4 + tags.length * 12;
  let offset = 128 + tableSize;
  const table: number[] = [...u32(tags.length)];
  const data: number[] = [];
  const shared = new Map<number[], number>();
  for (const [sig, body] of tags) {
    // Les trois courbes partagent les mêmes données.
    let at = shared.get(body);
    if (at === undefined) {
      at = offset;
      shared.set(body, at);
      const padded = pad4(body);
      data.push(...padded);
      offset += padded.length;
    }
    table.push(...ascii(sig), ...u32(at), ...u32(body.length));
  }
  const size = 128 + tableSize + data.length;
  const header = [
    ...u32(size), 0, 0, 0, 0, 0x02, 0x10, 0, 0,
    ...ascii('mntr'), ...ascii('RGB '), ...ascii('XYZ '),
    ...u16(2026), ...u16(1), ...u16(1), 0, 0, 0, 0, 0, 0,
    ...ascii('acsp'), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, // attributs
    ...u32(0), // intention de rendu : perceptuelle
    ...D50.flatMap(s15f16),
    0, 0, 0, 0,
  ];
  const full = [...header, ...new Array(128 - header.length).fill(0), ...table, ...data];
  return Uint8Array.from(full);
}
