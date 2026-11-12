// Contrôle automatique de l'entreprise derrière une fiche : le résultat de la recherche officielle (SIRET) est
// comparé à ce que le traiteur a saisi. Un doute n'écarte pas la fiche : il est signalé à l'équipe qui la valide.
import type { CompanyResult } from '@/lib/companies';
import { departmentOfPostalCode } from './departments';
import { slugify } from './listing';

/** Codes NAF admis : traiteurs, restaurants, boulangeries, pâtisseries, charcuteries, boucheries… */
export const ALLOWED_ACTIVITIES = ['56.21Z', '56.10A', '56.10C', '10.13B', '47.22Z', '10.71C', '10.71D', '47.24Z'];

export interface CheckResult {
  ok: boolean;
  reason: string | null;
  checkedAt: string;
  legalName: string | null;
  activity: string | null;
}

const words = (form: string) => form.split('-').filter((w) => w.length >= 3);

/** Noms proches : un mot de 3 lettres ou plus en commun, ou l'un contenu dans l'autre. */
function similarNames(a: string, b: string): boolean {
  const fa = slugify(a);
  const fb = slugify(b);
  if (fa.includes(fb) || fb.includes(fa)) return true;
  const wb = new Set(words(fb));
  return words(fa).some((w) => wb.has(w));
}

export function companyCheck(
  input: { siret: string; displayName: string; postalCode: string | null },
  found: CompanyResult | null | 'unavailable',
  opts: { duplicate: boolean; now: Date },
): CheckResult {
  const checkedAt = opts.now.toISOString();
  const result = (reason: string | null, company?: CompanyResult): CheckResult => ({
    ok: reason === null,
    reason,
    checkedAt,
    legalName: company?.name ?? null,
    activity: company?.activity ?? null,
  });

  if (found === 'unavailable') return result('Le service de recherche des entreprises ne répond pas : le contrôle sera refait par l’équipe.');
  if (!found) return result('SIRET introuvable dans la base officielle des entreprises.');
  if (!found.active) return result('Cet établissement n’est plus en activité d’après la base officielle.', found);
  if (!found.activity || !ALLOWED_ACTIVITIES.includes(found.activity)) {
    return result(`L’activité déclarée de l’entreprise (${found.activity ?? 'inconnue'}) n’est pas un métier de bouche.`, found);
  }
  if (!similarNames(input.displayName, found.name)) {
    return result(`Le nom de la fiche ne ressemble pas à celui de l’entreprise (${found.name}).`, found);
  }
  if (input.postalCode) {
    const wanted = departmentOfPostalCode(input.postalCode);
    const actual = departmentOfPostalCode(found.postalCode);
    if (wanted && actual && wanted !== actual) {
      return result('Le département de la fiche n’est pas celui de l’établissement enregistré.', found);
    }
  }
  if (opts.duplicate) return result('Ce SIRET est déjà utilisé par une autre fiche.', found);
  return result(null, found);
}
