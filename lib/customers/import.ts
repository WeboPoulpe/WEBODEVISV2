// Import de clients en masse : lecture d'un fichier CSV ou de lignes copiées depuis un tableur.
// Le texte est analysé ici, sans accès à la base : le résultat dit quoi créer et quoi laisser de côté.

export interface ImportedCustomer {
  customer_type: 'particulier' | 'entreprise';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  contact_person_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
}

export interface SkippedLine {
  /** Numéro de la ligne dans le texte collé (1 = première ligne). */
  line: number;
  label: string;
  reason: string;
}

export interface ImportAnalysis {
  customers: ImportedCustomer[];
  skipped: SkippedLine[];
  /** La première ligne a été reconnue comme une ligne de titres. */
  hasHeader: boolean;
}

type Field = 'first_name' | 'last_name' | 'full_name' | 'company_name' | 'email' | 'phone' | 'address' | 'type';

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const HEADERS: Record<string, Field> = {
  prenom: 'first_name', 'first name': 'first_name', firstname: 'first_name',
  nom: 'last_name', 'nom de famille': 'last_name', 'last name': 'last_name', lastname: 'last_name',
  'nom complet': 'full_name', 'nom et prenom': 'full_name', 'prenom et nom': 'full_name', 'prenom nom': 'full_name', 'nom prenom': 'full_name', client: 'full_name', contact: 'full_name', name: 'full_name',
  entreprise: 'company_name', societe: 'company_name', 'raison sociale': 'company_name', company: 'company_name', organisation: 'company_name',
  email: 'email', 'e mail': 'email', mail: 'email', courriel: 'email', 'adresse email': 'email', 'adresse mail': 'email', 'adresse e mail': 'email',
  telephone: 'phone', tel: 'phone', portable: 'phone', mobile: 'phone', phone: 'phone', 'numero de telephone': 'phone', numero: 'phone',
  adresse: 'address', address: 'address', 'adresse postale': 'address',
  type: 'type', 'type de client': 'type',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const looksLikePhone = (s: string) => /^[+\d][\d\s().-]{7,}$/.test(s) && s.replace(/\D/g, '').length >= 9;

/** Découpe le texte en lignes et en cellules. Séparateur deviné : tabulation (tableur), point-virgule ou virgule (CSV). */
export function parseTable(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = count('\t') > 0 ? '\t' : count(';') >= count(',') && count(';') > 0 ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows;
}

/** « Jean-Marc Le Goff » → prénom « Jean-Marc », nom « Le Goff ». Un seul mot : c'est le nom. */
function splitName(full: string): { first: string; last: string } {
  const words = full.trim().split(/\s+/);
  if (words.length < 2) return { first: '', last: words[0] ?? '' };
  return { first: words[0], last: words.slice(1).join(' ') };
}

/** Sans ligne de titres : chaque cellule est reconnue à son contenu. */
function guessFields(cells: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  const texts: string[] = [];
  for (const c of cells) {
    if (!c) continue;
    if (!out.email && EMAIL.test(c)) out.email = c;
    else if (!out.phone && looksLikePhone(c)) out.phone = c;
    else texts.push(c);
  }
  if (texts.length === 1) out.full_name = texts[0];
  else if (texts.length >= 2) {
    out.first_name = texts[0];
    out.last_name = texts[1];
    if (texts[2]) out.address = texts.slice(2).join(', ');
  }
  return out;
}

/**
 * Analyse le texte collé ou le contenu d'un fichier.
 * @param existingEmails adresses des clients déjà enregistrés, pour ne pas créer de doublon.
 */
export function analyzeCustomerImport(text: string, existingEmails: Iterable<string> = []): ImportAnalysis {
  const rows = parseTable(text);
  const header = (rows[0] ?? []).map((c) => HEADERS[normalize(c)]);
  const hasHeader = header.filter(Boolean).length >= 2 || (header.filter(Boolean).length === 1 && !rows[0].some((c) => EMAIL.test(c)));
  const seen = new Set([...existingEmails].map((e) => e.trim().toLowerCase()));

  const customers: ImportedCustomer[] = [];
  const skipped: SkippedLine[] = [];

  rows.forEach((cells, index) => {
    if ((hasHeader && index === 0) || cells.every((c) => !c)) return;
    const fields: Partial<Record<Field, string>> = hasHeader
      ? Object.fromEntries(cells.map((c, i) => [header[i], c] as const).filter(([k, v]) => k && v))
      : guessFields(cells);

    let first = fields.first_name ?? '';
    let last = fields.last_name ?? '';
    if (fields.full_name && !first && !last) ({ first, last } = splitName(fields.full_name));
    // Une colonne « Nom » seule contient souvent le prénom et le nom.
    else if (hasHeader && !first && last.includes(' ') && !header.includes('first_name')) ({ first, last } = splitName(last));

    const company = fields.company_name ?? '';
    const label = company || [first, last].filter(Boolean).join(' ') || fields.email || cells.filter(Boolean).join(' ').slice(0, 40);
    const line = index + 1;
    const email = (fields.email ?? '').trim().toLowerCase();

    if (!email) { skipped.push({ line, label, reason: 'Pas d’adresse email' }); return; }
    if (!EMAIL.test(email)) { skipped.push({ line, label, reason: 'Adresse email invalide' }); return; }
    if (seen.has(email)) { skipped.push({ line, label, reason: 'Déjà dans vos clients' }); return; }
    if (!company && !first && !last) { skipped.push({ line, label, reason: 'Pas de nom' }); return; }
    seen.add(email);

    const isCompany = !!company || /entreprise|societe|pro/.test(normalize(fields.type ?? ''));
    customers.push(isCompany
      ? {
          customer_type: 'entreprise',
          company_name: company || [first, last].filter(Boolean).join(' '),
          contact_person_name: [first, last].filter(Boolean).join(' ') || company,
          first_name: first || null, last_name: last || null,
          email, phone: fields.phone || null, address: fields.address || null,
        }
      : {
          customer_type: 'particulier',
          company_name: null, contact_person_name: null,
          // Prénom et nom sont obligatoires pour un particulier ; un champ absent reste vide plutôt qu'inventé.
          first_name: first, last_name: last,
          email, phone: fields.phone || null, address: fields.address || null,
        });
  });

  return { customers, skipped, hasHeader };
}
