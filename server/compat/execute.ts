import 'server-only';
import { pool } from '@/db';
import type { Filter, QueryDescriptor, QueryResult } from '@/lib/compat/builder';
import { RULES, type TableRule } from './rules';

/** Qui exécute la requête. `bypass` est réservé au code serveur de confiance (pages à jeton). */
export interface QueryContext {
  uid: string | null;
  bypass?: boolean;
}

interface ForeignKey { tbl: string; col: string; ref_tbl: string; ref_col: string }
interface Catalog { columns: Map<string, Set<string>>; fks: ForeignKey[] }

let catalogPromise: Promise<Catalog> | null = null;

function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= (async () => {
    const cols = await pool.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
    );
    const fks = await pool.query<ForeignKey>(
      `select distinct c.conrelid::regclass::text as tbl, a.attname as col,
              c.confrelid::regclass::text as ref_tbl, af.attname as ref_col
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1`,
    );
    const columns = new Map<string, Set<string>>();
    for (const r of cols.rows) {
      if (!columns.has(r.table_name)) columns.set(r.table_name, new Set());
      columns.get(r.table_name)!.add(r.column_name);
    }
    return { columns, fks: fks.rows };
  })().catch((e) => { catalogPromise = null; throw e; });
  return catalogPromise;
}

class QueryError extends Error {
  constructor(message: string, public code = 'PGRST100') { super(message); }
}

/** Paramètres de la requête ; l'utilisateur n'est ajouté que s'il est réellement utilisé. */
class Params {
  values: unknown[] = [];
  private uidRef: string | null = null;
  constructor(private uid: string | null) {}
  add(v: unknown) { this.values.push(v); return `$${this.values.length}`; }
  user() {
    this.uidRef ??= `${this.add(this.uid)}::uuid`;
    return this.uidRef;
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const qi = (name: string) => `"${name}"`;

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

class Compiler {
  private aliasSeq = 0;
  constructor(private cat: Catalog, private ctx: QueryContext, private isAdmin: boolean, readonly p: Params) {}

  rule(table: string): TableRule {
    const rule = RULES[table];
    if (!rule || !this.cat.columns.has(table)) throw new QueryError(`Table non autorisée : ${table}`, '42501');
    return rule;
  }

  column(table: string, name: string): string {
    if (!IDENT.test(name) || !this.cat.columns.get(table)?.has(name)) {
      throw new QueryError(`Colonne inconnue : ${table}.${name}`, '42703');
    }
    return qi(name);
  }

  nextAlias() { return `t${++this.aliasSeq}`; }

  /** Condition d'accès en lecture sur une table (l'équivalent du USING de RLS). */
  readScope(table: string, alias: string, d?: QueryDescriptor): string {
    const rule = this.rule(table);
    if (this.ctx.bypass) return 'true';
    if (!this.ctx.uid) {
      const anon = rule.anonRead;
      const hasEq = d?.filters.some((f) => f.kind === 'cmp' && f.op === 'eq' && !f.negate && f.column === anon?.requiredEq);
      if (!anon || !hasEq) throw new QueryError('Non connecté', '401');
      return anon.predicate(alias, '');
    }
    if (this.isAdmin && rule.admin?.includes('select')) return 'true';
    return rule.read(alias, this.p.user());
  }

  /** Condition d'accès en écriture ; sert aussi à valider les lignes écrites (WITH CHECK). */
  writeScope(table: string, alias: string, op: 'insert' | 'update' | 'delete'): string {
    const rule = this.rule(table);
    if (this.ctx.bypass) return 'true';
    if (!this.ctx.uid) {
      if (op === 'insert' && rule.anonInsert) return rule.anonInsert(alias, '');
      throw new QueryError('Non connecté', '401');
    }
    if (this.isAdmin && rule.admin?.includes(op)) return 'true';
    const base = rule.write(alias, this.p.user());
    return this.isAdmin && rule.adminWrite ? `(${base} or ${rule.adminWrite(alias, this.p.user())})` : base;
  }

  /** Liste de colonnes façon PostgREST, ressources imbriquées comprises : `*, supplier:suppliers(id, name)`. */
  selectList(table: string, alias: string, columns: string): string {
    const items = splitTop(columns || '*');
    return items.map((item) => {
      if (item === '*') return `${alias}.*`;
      const embed = /^(?:([a-z_][a-z0-9_]*)\s*:\s*)?([a-z_][a-z0-9_]*)(?:!(?:inner|left))?\s*\(([\s\S]*)\)$/.exec(item);
      if (embed) return this.embed(table, alias, embed[1] ?? embed[2], embed[2], embed[3]);
      const plain = /^(?:([a-z_][a-z0-9_]*)\s*:\s*)?([a-z_][a-z0-9_]*)$/.exec(item);
      if (!plain) throw new QueryError(`Sélection non comprise : ${item}`);
      const col = `${alias}.${this.column(table, plain[2])}`;
      return plain[1] ? `${col} as ${qi(plain[1])}` : col;
    }).join(', ');
  }

  private embed(parent: string, parentAlias: string, name: string, table: string, inner: string): string {
    this.rule(table);
    const a = this.nextAlias();
    const list = this.selectList(table, a, inner);
    const scope = this.readScope(table, a);
    const toOne = this.cat.fks.find((f) => f.tbl === parent && f.ref_tbl === table);
    if (toOne) {
      return `(select row_to_json(s) from (select ${list} from public.${qi(table)} ${a} where ${a}.${qi(toOne.ref_col)} = ${parentAlias}.${qi(toOne.col)} and ${scope}) s) as ${qi(name)}`;
    }
    const toMany = this.cat.fks.find((f) => f.tbl === table && f.ref_tbl === parent);
    if (toMany) {
      return `(select coalesce(json_agg(row_to_json(s)), '[]'::json) from (select ${list} from public.${qi(table)} ${a} where ${a}.${qi(toMany.col)} = ${parentAlias}.${qi(toMany.ref_col)} and ${scope}) s) as ${qi(name)}`;
    }
    throw new QueryError(`Aucune relation entre ${parent} et ${table}`, 'PGRST200');
  }

  private compare(table: string, alias: string, column: string, op: string, value: unknown, negate = false): string {
    const col = `${alias}.${this.column(table, column)}`;
    let sql: string;
    switch (op) {
      case 'eq': sql = `${col} = ${this.p.add(value)}`; break;
      case 'neq': sql = `${col} <> ${this.p.add(value)}`; break;
      case 'gt': sql = `${col} > ${this.p.add(value)}`; break;
      case 'gte': sql = `${col} >= ${this.p.add(value)}`; break;
      case 'lt': sql = `${col} < ${this.p.add(value)}`; break;
      case 'lte': sql = `${col} <= ${this.p.add(value)}`; break;
      case 'like': sql = `${col}::text like ${this.p.add(String(value))}`; break;
      case 'ilike': sql = `${col}::text ilike ${this.p.add(String(value))}`; break;
      case 'is':
        if (value === null || value === 'null') sql = `${col} is null`;
        else if (value === true || value === 'true') sql = `${col} is true`;
        else if (value === false || value === 'false') sql = `${col} is false`;
        else throw new QueryError(`Valeur non comprise pour is : ${String(value)}`);
        break;
      case 'in': {
        const list = Array.isArray(value)
          ? value
          : String(value).replace(/^\(|\)$/g, '').split(',').map((v) => v.trim().replace(/^"|"$/g, '')).filter(Boolean);
        sql = list.length === 0 ? 'false' : `${col}::text = any(${this.p.add(list.map(String))}::text[])`;
        break;
      }
      default: throw new QueryError(`Opérateur non pris en charge : ${op}`);
    }
    return negate ? `not coalesce((${sql}), false)` : sql;
  }

  /** Filtre `.or('a.eq.1,b.is.null')` : chaque terme est colonne.opérateur.valeur. */
  private orExpr(table: string, alias: string, expr: string): string {
    const parts = splitTop(expr).map((term) => {
      const m = /^([a-z_][a-z0-9_]*)\.(not\.)?([a-z]+)\.([\s\S]*)$/.exec(term);
      if (!m) throw new QueryError(`Filtre or non compris : ${term}`);
      return this.compare(table, alias, m[1], m[3], m[4], !!m[2]);
    });
    if (parts.length === 0) throw new QueryError('Filtre or vide');
    return `(${parts.join(' or ')})`;
  }

  where(table: string, alias: string, filters: Filter[]): string[] {
    return filters.map((f) =>
      f.kind === 'or' ? this.orExpr(table, alias, f.expr) : this.compare(table, alias, f.column, f.op, f.value, f.negate));
  }

  orderLimit(d: QueryDescriptor, alias: string): string {
    let sql = '';
    if (d.order.length) {
      sql += ' order by ' + d.order.map((o) =>
        `${alias}.${this.column(d.table, o.column)} ${o.ascending ? 'asc' : 'desc'}${o.nullsFirst === undefined ? '' : o.nullsFirst ? ' nulls first' : ' nulls last'}`).join(', ');
    }
    if (d.limit !== undefined) {
      if (!Number.isInteger(d.limit) || d.limit < 0) throw new QueryError('Limite invalide');
      sql += ` limit ${d.limit}`;
    }
    return sql;
  }
}

function rowsOf(values: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(values) ? values : [values];
  if (rows.length === 0 || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
    throw new QueryError('Aucune donnée à écrire');
  }
  return rows as Record<string, unknown>[];
}

function finish(d: QueryDescriptor, rows: unknown[] | null, count: number | null): QueryResult {
  if (rows === null) return { data: null, error: null, count };
  if (d.single) {
    if (rows.length === 1) return { data: rows[0], error: null, count };
    if (rows.length === 0 && d.single === 'maybeSingle') return { data: null, error: null, count };
    return { data: null, count, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` } };
  }
  return { data: rows, error: null, count };
}

// Le rôle est relu au plus une fois par minute et par utilisateur.
const adminCache = new Map<string, { admin: boolean; until: number }>();

async function isAdminUser(uid: string | null): Promise<boolean> {
  if (!uid) return false;
  const cached = adminCache.get(uid);
  if (cached && cached.until > Date.now()) return cached.admin;
  const r = await pool.query(`select 1 from public.profiles where id = $1 and role = 'admin'`, [uid]);
  const admin = r.rowCount === 1;
  adminCache.set(uid, { admin, until: Date.now() + 60_000 });
  return admin;
}

export async function executeQuery(d: QueryDescriptor, ctx: QueryContext): Promise<QueryResult> {
  try {
    const cat = await loadCatalog();
    const rule = RULES[d.table];
    const needsAdmin = !ctx.bypass && !!ctx.uid && !!rule && !!(rule.admin || rule.adminWrite || rule.adminOnlyColumns);
    const isAdmin = needsAdmin ? await isAdminUser(ctx.uid) : false;
    const p = new Params(ctx.uid);
    const c = new Compiler(cat, ctx, isAdmin, p);
    c.rule(d.table);
    const T = `public.${qi(d.table)}`;

    // ── Lecture ────────────────────────────────────────────────────────────────
    if (d.op === 'select') {
      const conditions = [c.readScope(d.table, 't0', d), ...c.where(d.table, 't0', d.filters)].join(' and ');
      // Données et total dans une seule requête : les deux parties partagent les mêmes paramètres.
      const data = d.head
        ? 'null::json'
        : `(select coalesce(json_agg(row_to_json(q)), '[]'::json) from (select ${c.selectList(d.table, 't0', d.select ?? '*')} from ${T} t0 where ${conditions}${c.orderLimit(d, 't0')}) q)`;
      const total = d.count ? `(select count(*)::int from ${T} t0 where ${conditions})` : 'null::int';
      const row = (await pool.query(`select ${data} as data, ${total} as n`, p.values)).rows[0];
      return finish(d, row.data, row.n);
    }

    // ── Écriture ───────────────────────────────────────────────────────────────
    let mutation: string;
    if (d.op === 'insert' || d.op === 'upsert') {
      const rows = rowsOf(d.values);
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      if (rule.adminOnlyColumns && !isAdmin && !ctx.bypass) {
        const forbidden = keys.filter((k) => rule.adminOnlyColumns!.includes(k));
        if (forbidden.length) throw new QueryError(`Colonnes réservées aux administrateurs : ${forbidden.join(', ')}`, '42501');
      }
      const cols = keys.map((k) => c.column(d.table, k)).join(', ');
      const payload = p.add(JSON.stringify(rows));
      mutation = `insert into ${T} (${cols}) select ${cols} from json_populate_recordset(null::${T}, ${payload}::json)`;
      if (d.op === 'upsert') {
        const conflict = (d.onConflict ?? 'id').split(',').map((k) => c.column(d.table, k.trim()));
        const updates = keys.filter((k) => !conflict.includes(qi(k))).map((k) => `${qi(k)} = excluded.${qi(k)}`);
        mutation += ` on conflict (${conflict.join(', ')}) ${updates.length ? `do update set ${updates.join(', ')}` : 'do nothing'}`;
      }
      mutation += ' returning *';
    } else if (d.op === 'update') {
      const row = rowsOf(d.values)[0];
      const keys = Object.keys(row);
      if (keys.length === 0) throw new QueryError('Aucune colonne à mettre à jour');
      if (rule.adminOnlyColumns && !isAdmin && !ctx.bypass) {
        const forbidden = keys.filter((k) => rule.adminOnlyColumns!.includes(k));
        if (forbidden.length) throw new QueryError(`Colonnes réservées aux administrateurs : ${forbidden.join(', ')}`, '42501');
      }
      const cols = keys.map((k) => c.column(d.table, k)).join(', ');
      const payload = p.add(JSON.stringify(row));
      const conditions = [c.writeScope(d.table, 't0', 'update'), ...c.where(d.table, 't0', d.filters)].join(' and ');
      mutation = `update ${T} t0 set (${cols}) = (select ${cols} from json_populate_record(null::${T}, ${payload}::json)) where ${conditions} returning t0.*`;
    } else {
      const conditions = [c.writeScope(d.table, 't0', 'delete'), ...c.where(d.table, 't0', d.filters)].join(' and ');
      mutation = `delete from ${T} t0 where ${conditions} returning t0.*`;
    }

    // Les lignes écrites doivent rester dans le périmètre de l'utilisateur (WITH CHECK).
    const check = d.op === 'delete' ? 'true' : c.writeScope(d.table, 't0', d.op === 'update' ? 'update' : 'insert');
    const list = d.returning ? c.selectList(d.table, 't0', d.select ?? '*') : null;
    const sql = `with m as (${mutation})
      select (select coalesce(bool_and(${check}), true) from m t0) as ok,
             ${list ? `(select coalesce(json_agg(row_to_json(q)), '[]'::json) from (select ${list} from m t0) q)` : 'null::json'} as data`;

    const client = await pool.connect();
    try {
      await client.query('begin');
      // Lu par les triggers d'historique (remplace auth.uid()).
      await client.query(`select set_config('app.user_id', $1, true)`, [ctx.uid ?? '']);
      const res = await client.query(sql, p.values);
      if (!res.rows[0].ok) {
        await client.query('rollback');
        return { data: null, count: null, error: { code: '42501', message: `new row violates row-level security policy for table "${d.table}"` } };
      }
      await client.query('commit');
      return finish(d, d.returning ? res.rows[0].data : null, null);
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const err = e as { message?: string; code?: string; detail?: string };
    // Une session absente est un cas normal (page publique, session expirée) : pas de bruit dans les journaux.
    if (err.code !== '401') console.error(`[db] ${d.op} ${d.table} : ${err.message}`);
    return { data: null, count: null, error: { message: err.message ?? 'Erreur inconnue', code: err.code, details: err.detail } };
  }
}
