// Recherche d'entreprise (API publique « Recherche d'entreprises » de l'État) : lecture de la requête
// et mise en forme des réponses. Sans accès réseau ni base : utilisé par server/companies.ts.

/** Une entreprise (un établissement précis) prête à remplir une fiche client. */
export interface CompanyResult {
  name: string;
  siren: string;
  siret: string;
  /** Adresse complète sur une ligne (voie, code postal, ville). */
  address: string;
  postalCode: string;
  city: string;
  /** Faux si l'établissement est fermé ou l'entreprise cessée. */
  active: boolean;
  /** Code d'activité principale (NAF), ex. 56.21Z. */
  activity?: string;
  /** Vrai pour le siège de l'entreprise. */
  headOffice: boolean;
  /** Client du carnet qui porte déjà ce SIRET. */
  existingCustomer?: { id: string; name: string };
}

export interface CompanySearchResponse {
  results: CompanyResult[];
  error: string | null;
}

export const COMPANY_SEARCH_UNAVAILABLE = 'Recherche indisponible pour le moment, saisissez les informations à la main.';

export type CompanyQuery =
  | { kind: 'siret'; q: string }
  | { kind: 'siren'; q: string }
  | { kind: 'text'; q: string };

/**
 * Lit ce qui a été tapé : un SIRET (14 chiffres) ou un SIREN (9 chiffres), espaces, points et tirets
 * retirés ; sinon un nom d'au moins 3 caractères. Null si la requête est trop courte pour chercher.
 */
export function parseCompanyQuery(raw: string): CompanyQuery | null {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 100);
  const digits = text.replace(/[\s.\-]/g, '');
  if (/^\d{14}$/.test(digits)) return { kind: 'siret', q: digits };
  if (/^\d{9}$/.test(digits)) return { kind: 'siren', q: digits };
  // Un numéro en cours de saisie n'est pas un nom : on attend qu'il soit complet.
  if (/^\d+$/.test(digits)) return null;
  if (text.length < 3) return null;
  return { kind: 'text', q: text };
}

/** SIRET sans espaces (tel qu'enregistré), ou null s'il n'y en a pas. */
export const cleanSiret = (value: string | null | undefined): string | null => {
  const v = (value ?? '').replace(/[\s.\-]/g, '');
  return v || null;
};

/** SIRET lisible : 123 456 789 00012. */
export const formatSiret = (siret: string) =>
  /^\d{14}$/.test(siret) ? `${siret.slice(0, 3)} ${siret.slice(3, 6)} ${siret.slice(6, 9)} ${siret.slice(9)}` : siret;

// ── Réponse de l'API ────────────────────────────────────────────────────────
// Format constaté (octobre 2026) : results[] avec siren, nom_complet, nom_raison_sociale, etat_administratif
// (A active / C cessée), siege { siret, adresse, code_postal, libelle_commune, etat_administratif (A / F fermé),
// activite_principale, est_siege } et matching_etablissements[] (mêmes champs) : les établissements qui
// correspondent à la recherche, dont celui d'un SIRET recherché. Les entreprises non diffusibles renvoient
// « [NON-DIFFUSIBLE] » à la place de l'adresse et du code postal.

interface ApiEtablissement {
  siret?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
  etat_administratif?: string | null;
  activite_principale?: string | null;
  est_siege?: boolean | null;
}

interface ApiCompany {
  siren?: string | null;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  etat_administratif?: string | null;
  activite_principale?: string | null;
  siege?: ApiEtablissement | null;
  matching_etablissements?: ApiEtablissement[] | null;
}

const clean = (value: string | null | undefined) => {
  const v = (value ?? '').replace(/\s+/g, ' ').trim();
  return /NON-DIFFUSIBLE/i.test(v) ? '' : v;
};

function toResult(company: ApiCompany, etab: ApiEtablissement): CompanyResult | null {
  const siret = clean(etab.siret);
  const name = clean(company.nom_raison_sociale) || clean(company.nom_complet);
  if (!/^\d{14}$/.test(siret) || !name) return null;
  const postalCode = clean(etab.code_postal);
  const city = clean(etab.libelle_commune);
  const address = clean(etab.adresse) || [postalCode, city].filter(Boolean).join(' ');
  const activity = clean(etab.activite_principale) || clean(company.activite_principale);
  return {
    name,
    siren: clean(company.siren) || siret.slice(0, 9),
    siret,
    address,
    postalCode,
    city,
    active: company.etat_administratif !== 'C' && etab.etat_administratif !== 'F',
    ...(activity ? { activity } : {}),
    headOffice: !!etab.est_siege,
  };
}

/**
 * Une suggestion par entreprise, sur son siège ; pour un SIRET recherché, l'établissement exact
 * (pas le siège, qui peut être ailleurs).
 */
export function normalizeCompanies(body: unknown, query: CompanyQuery, limit = 8): CompanyResult[] {
  const list = (body && typeof body === 'object' && Array.isArray((body as { results?: unknown }).results))
    ? (body as { results: ApiCompany[] }).results
    : [];
  const out: CompanyResult[] = [];
  for (const company of list) {
    if (!company || typeof company !== 'object') continue;
    let etab: ApiEtablissement | null | undefined = company.siege;
    if (query.kind === 'siret') {
      etab = [...(company.matching_etablissements ?? []), ...(company.siege ? [company.siege] : [])]
        .find((e) => clean(e?.siret) === query.q);
      if (!etab) continue;
    }
    if (!etab) continue;
    const result = toResult(company, etab);
    if (result && !out.some((r) => r.siret === result.siret)) out.push(result);
    if (out.length >= limit) break;
  }
  return out;
}
