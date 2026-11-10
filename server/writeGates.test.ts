// Audit : une fonction serveur exportée qui écrit en base passe par requireWriter (rôle et abonnement), jamais par
// requireUser / getSessionUser seuls. Analyse statique simple, fonction par fonction : une écriture faite dans une
// fonction locale du même fichier compte comme une écriture de la fonction qui l'appelle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

const ROOT = path.join(process.cwd(), 'server');

/**
 * Cas légitimes, « fichier:fonction » (ou « fichier:* » pour tout le fichier), chacun avec sa raison.
 * server/compat est hors analyse : executeQuery a son propre contrôle.
 */
const ALLOWED: Record<string, string> = {
  // Compte : connexion, mot de passe, suppression (droit RGPD) restent permis sans abonnement.
  'account.ts:*': 'suppression du compte, permise sans abonnement',
  'auth.ts:*': 'connexion et mot de passe, permis sans abonnement',
  // Actions d'abonnement (tâche 6) : elles doivent rester possibles justement sans abonnement.
  'billingActions.ts:*': 'souscription et gestion de l’abonnement',
  // Administration : requireAdmin, hors abonnement du client.
  'admin.ts:*': 'administration',
  'adminWebo.ts:*': 'administration de Webo',
  // Lecture qui tient un compteur à jour : consultation d'un devis par le client final (lien public, sans abonnement requis).
  'acceptance.ts:recordQuoteView': 'compteur de consultations du lien public',
  // Faux positif : « .delete( » vide le cache mémoire des recherches, rien n'est écrit en base.
  'companies.ts:searchCompanies': 'cache mémoire, aucune écriture',
  // Demande de site à Webomax (vente additionnelle, réservée au gérant) : rien n'est modifié dans les données de l'entreprise.
  'siteWeb.ts:submitSiteWebRequest': 'demande commerciale adressée à Webomax',
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'compat' ? [] : files(full);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [full] : [];
  });
}

interface Chunk { name: string; exported: boolean; body: string }

const START = /^(export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)|^(export\s+)?const\s+(\w+)\s*=/;
const TOP_LEVEL = /^(export|async|function|const|let|var|class|type|interface|import|\/\*\*|\/\/|enum|declare)\b|^\/\//;

/** Découpe un fichier en déclarations de premier niveau. */
function chunks(text: string): Chunk[] {
  const out: Chunk[] = [];
  let current: Chunk | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = START.exec(line);
    if (m) {
      current = { name: m[2] ?? m[4], exported: !!(m[1] ?? m[3]), body: line + '\n' };
      out.push(current);
    } else if (TOP_LEVEL.test(line)) {
      current = null;
    } else if (current) {
      current.body += line + '\n';
    }
  }
  return out;
}

const WRITES = /db\.insert\(|\.update\(|\.delete\(/;
const SESSION = /requireUser\(|getSessionUser\(/;

/** Fonctions exportées qui écrivent (elles-mêmes ou par une fonction locale) sans porte d'écriture. */
function ungated(text: string): string[] {
  const all = chunks(text);
  const writers = new Set(all.filter((c) => WRITES.test(c.body)).map((c) => c.name));
  const callsWriter = (c: Chunk) => [...writers].some((w) => w !== c.name && new RegExp(`\\b${w}\\(`).test(c.body));
  return all
    .filter((c) => c.exported && SESSION.test(c.body) && !/requireWriter\(/.test(c.body))
    .filter((c) => WRITES.test(c.body) || callsWriter(c))
    .map((c) => c.name);
}

it('les fonctions serveur qui écrivent passent par requireWriter', () => {
  const offenders: string[] = [];
  for (const file of files(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (ALLOWED[`${rel}:*`]) continue;
    for (const name of ungated(readFileSync(file, 'utf8'))) if (!ALLOWED[`${rel}:${name}`]) offenders.push(`${rel}:${name}`);
  }
  expect(offenders).toEqual([]);
});

it("l'analyse repère une écriture sans porte", () => {
  const sample = [
    "export async function bad() {",
    "  const user = await requireUser();",
    "  await db.insert(t).values({});",
    "}",
    "async function save() {",
    "  await db.update(t).set({});",
    "}",
    "export async function viaHelper() {",
    "  await requireUser();",
    "  await save();",
    "}",
    "export async function good() {",
    "  await requireWriter();",
    "  await db.delete(t);",
    "}",
    "export async function read() {",
    "  await requireUser();",
    "  return db.select().from(t);",
    "}",
  ].join('\n');
  expect(chunks(sample).map((c) => c.name)).toEqual(['bad', 'save', 'viaHelper', 'good', 'read']);
  expect(ungated(sample)).toEqual(['bad', 'viaHelper']);
});
