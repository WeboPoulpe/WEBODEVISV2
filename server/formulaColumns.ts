import 'server-only';
import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { quote_acceptances, quotes } from '@/db/schema';

// Colonnes des formules d'un devis (migration 0031). Tant que la migration n'est pas appliquée, les nommer ferait
// échouer la requête : on vérifie d'abord qu'elles existent (une fois par minute, puis plus jamais une fois là),
// et à défaut on lit null à leur place. Les devis se comportent alors comme des devis sans formule.

let ready: { at: number; ok: Promise<boolean> } | null = null;

/** Les colonnes de la migration 0031 existent-elles ? */
export function formulaColumnsReady(): Promise<boolean> {
  if (!ready || Date.now() - ready.at > 60_000) {
    const ok = db.execute<{ ok: boolean }>(sql`select exists (select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quote_acceptances' and column_name = 'formula_name') as ok`)
      .then((r) => {
        const yes = !!r.rows[0]?.ok;
        // Une fois là, les colonnes ne disparaissent plus : inutile de revérifier.
        if (yes && ready) ready.at = Number.POSITIVE_INFINITY;
        return yes;
      })
      .catch(() => false);
    ready = { at: Date.now(), ok };
  }
  return ready.ok;
}

const ALL_QUOTE_COLUMNS = getTableColumns(quotes);
const nothing = <T>() => sql<T>`null` as unknown as SQL<T>;

/** Toutes les colonnes d'un devis, formules comprises (null avant la migration 0031). */
export async function quoteColumns(): Promise<typeof ALL_QUOTE_COLUMNS> {
  if (await formulaColumnsReady()) return ALL_QUOTE_COLUMNS;
  return { ...ALL_QUOTE_COLUMNS, formulas: nothing<unknown>(), chosen_formula_id: nothing<string | null>() } as unknown as typeof ALL_QUOTE_COLUMNS;
}

/** Les deux colonnes des formules, à ajouter à une sélection (null avant la migration 0031). */
export async function formulaFields(): Promise<{ formulas: typeof quotes.formulas; chosen_formula_id: typeof quotes.chosen_formula_id }> {
  if (await formulaColumnsReady()) return { formulas: quotes.formulas, chosen_formula_id: quotes.chosen_formula_id };
  return { formulas: nothing<unknown>(), chosen_formula_id: nothing<string | null>() } as never;
}

/** Les mêmes en SQL brut, pour une requête sur `public.quotes <alias>`. */
export async function formulaSql(alias: string): Promise<SQL> {
  const a = sql.raw(alias.replace(/[^a-z_]/gi, ''));
  return (await formulaColumnsReady())
    ? sql`${a}.formulas, ${a}.chosen_formula_id`
    : sql`null::jsonb as formulas, null::text as chosen_formula_id`;
}

/** Nom de la formule signée avec une acceptation (null sans formule ou avant la migration 0031). */
export async function acceptanceFormulaName(): Promise<SQL<string | null>> {
  return (await formulaColumnsReady()) ? sql<string | null>`${quote_acceptances.formula_name}` : nothing<string | null>();
}
