// Constructeur de requêtes compatible avec la syntaxe supabase-js utilisée dans l'app.
// Il ne parle à aucune base : il décrit la requête, puis la confie à un exécuteur
// (fonction serveur depuis le navigateur, exécution directe depuis le serveur).

export type CompareOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in';

export type Filter =
  | { kind: 'cmp'; column: string; op: CompareOp; value: unknown; negate?: boolean }
  | { kind: 'or'; expr: string };

export interface QueryDescriptor {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  /** Colonnes à lire (lecture), ou à renvoyer après une écriture suivie de .select(). */
  select?: string;
  returning?: boolean;
  values?: unknown;
  onConflict?: string;
  filters: Filter[];
  order: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  limit?: number;
  count?: 'exact';
  head?: boolean;
  single?: 'single' | 'maybeSingle';
}

export interface QueryError {
  message: string;
  code?: string;
  details?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryResult<R = any> {
  /** Liste de lignes par défaut ; une seule ligne après .single() / .maybeSingle(). */
  data: R | null;
  error: QueryError | null;
  count: number | null;
}

export type Executor = (descriptor: QueryDescriptor) => Promise<QueryResult>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryBuilder<R = any[]> implements PromiseLike<QueryResult<R>> {
  private d: QueryDescriptor;

  constructor(private exec: Executor, table: string) {
    this.d = { table, op: 'select', select: '*', filters: [], order: [] };
  }

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    if (this.d.op === 'select') {
      this.d.count = options?.count;
      this.d.head = options?.head;
    } else {
      this.d.returning = true;
    }
    this.d.select = columns;
    return this;
  }

  insert(values: unknown) { this.d.op = 'insert'; this.d.values = values; this.d.select = undefined; return this; }
  upsert(values: unknown, options?: { onConflict?: string }) {
    this.d.op = 'upsert'; this.d.values = values; this.d.onConflict = options?.onConflict; this.d.select = undefined; return this;
  }
  update(values: unknown) { this.d.op = 'update'; this.d.values = values; this.d.select = undefined; return this; }
  delete() { this.d.op = 'delete'; this.d.select = undefined; return this; }

  private cmp(column: string, op: CompareOp, value: unknown, negate = false) {
    this.d.filters.push({ kind: 'cmp', column, op, value, negate });
    return this;
  }
  eq(column: string, value: unknown) { return this.cmp(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.cmp(column, 'neq', value); }
  gt(column: string, value: unknown) { return this.cmp(column, 'gt', value); }
  gte(column: string, value: unknown) { return this.cmp(column, 'gte', value); }
  lt(column: string, value: unknown) { return this.cmp(column, 'lt', value); }
  lte(column: string, value: unknown) { return this.cmp(column, 'lte', value); }
  like(column: string, pattern: string) { return this.cmp(column, 'like', pattern); }
  ilike(column: string, pattern: string) { return this.cmp(column, 'ilike', pattern); }
  is(column: string, value: null | boolean) { return this.cmp(column, 'is', value); }
  in(column: string, values: readonly unknown[]) { return this.cmp(column, 'in', values); }
  not(column: string, op: CompareOp, value: unknown) { return this.cmp(column, op, value, true); }
  or(expr: string) { this.d.filters.push({ kind: 'or', expr }); return this; }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.d.order.push({ column, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst });
    return this;
  }
  limit(n: number) { this.d.limit = n; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single() { this.d.single = 'single'; return this as unknown as QueryBuilder<any>; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle() { this.d.single = 'maybeSingle'; return this as unknown as QueryBuilder<any>; }

  then<R1 = QueryResult<R>, R2 = never>(
    onfulfilled?: ((value: QueryResult<R>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return (this.exec(this.d) as Promise<QueryResult<R>>)
      .catch((e): QueryResult<R> => ({ data: null, error: { message: e instanceof Error ? e.message : String(e) }, count: null }))
      .then(onfulfilled, onrejected);
  }
}
