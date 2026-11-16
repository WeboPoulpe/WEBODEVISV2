// Lecture de l'historique : réservée au titulaire et aux gérants, filtrée, paginée.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000e0001';
const MEMBER = '00000000-0000-4000-8000-0000000e0002';   // collaborateur
const MANAGER = '00000000-0000-4000-8000-0000000e0003';  // gérant
const OTHER = '00000000-0000-4000-8000-0000000e0009';    // autre entreprise
const CUSTOMER = '00000000-0000-4000-8000-0000000e00c1';
const GONE = '00000000-0000-4000-8000-0000000e00c2';
let current = OWNER;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@t.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { listActivity } = await import('./activity');

const add = (company: string, actor: string | null, action: string, entity: string, entityId: string | null, label: string, at: string) => pg.query(
  `insert into activity_log (company_id, actor_id, actor_label, action, entity_type, entity_id, entity_label, summary, created_at, updated_at)
   values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
  [company, actor, actor ? 'Quelqu’un' : null, action, entity, entityId, label, `${entity} ${label} ${action}`, at]);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'o@t.fr', 'x'), ('${MEMBER}', 'm@t.fr', 'x'), ('${MANAGER}', 'g@t.fr', 'x'), ('${OTHER}', 'z@t.fr', 'x');
    insert into profiles (id, email, first_name) values ('${OWNER}', 'o@t.fr', 'Julien'), ('${OTHER}', 'z@t.fr', 'Zoé');
    insert into profiles (id, email, first_name, parent_user_id, company_role) values
      ('${MEMBER}', 'm@t.fr', 'Léa', '${OWNER}', 'collaborateur'), ('${MANAGER}', 'g@t.fr', 'Marc', '${OWNER}', 'gerant');
    insert into customers (id, customer_type, email, first_name, last_name, owner_user_id) values ('${CUSTOMER}', 'particulier', 'c@t.fr', 'Julie', 'Martin', '${OWNER}');
  `);
  await add(OWNER, OWNER, 'creation', 'client', CUSTOMER, 'Julie', '2026-11-10T09:00:00Z');
  await add(OWNER, MEMBER, 'suppression', 'client', GONE, 'Paul Disparu', '2026-11-11T09:00:00Z');
  await add(OWNER, null, 'acceptation', 'devis', null, 'D-1', '2026-11-12T09:00:00Z');
  // 23h30 UTC le 15 = 0h30 le 16 à Paris.
  await add(OWNER, OWNER, 'modification', 'devis', null, 'D-2 — 50% de remise', '2026-11-15T23:30:00Z');
  await add(OTHER, OTHER, 'creation', 'client', null, 'Secret', '2026-11-12T09:00:00Z');
});

describe('accès', () => {
  it('refusé à un collaborateur', async () => {
    current = MEMBER;
    expect(await listActivity({})).toEqual({ allowed: false, entries: [], next: null, people: [] });
  });
  it('le titulaire y a toujours accès, quel que soit son rôle enregistré', async () => {
    current = OWNER;
    await pg.exec(`update profiles set company_role = 'collaborateur' where id = '${OWNER}'`);
    try {
      expect((await listActivity({})).allowed).toBe(true);
    } finally {
      await pg.exec(`update profiles set company_role = 'gerant' where id = '${OWNER}'`);
    }
  });
  it('un gérant voit l’historique de son entreprise, pas celui d’une autre', async () => {
    current = MANAGER;
    const r = await listActivity({});
    expect(r.allowed).toBe(true);
    expect(r.entries.map((e) => e.label)).toEqual(['D-2 — 50% de remise', 'D-1', 'Paul Disparu', 'Julie']);
  });
});

describe('filtres', () => {
  it('par type d’élément', async () => {
    current = OWNER;
    expect((await listActivity({ entity: 'client' })).entries.map((e) => e.label)).toEqual(['Paul Disparu', 'Julie']);
  });
  it('par action', async () => {
    expect((await listActivity({ action: 'suppression' })).entries).toHaveLength(1);
  });
  it('« Client » : les actions sans auteur', async () => {
    expect((await listActivity({ actor: 'client' })).entries.map((e) => e.action)).toEqual(['acceptation']);
  });
  it('par personne', async () => {
    expect((await listActivity({ actor: MEMBER })).entries.map((e) => e.label)).toEqual(['Paul Disparu']);
  });
  it('par période, en heure de Paris', async () => {
    expect((await listActivity({ from: '2026-11-16', to: '2026-11-16' })).entries.map((e) => e.label)).toEqual(['D-2 — 50% de remise']);
    expect((await listActivity({ from: '2026-11-11', to: '2026-11-12' })).entries).toHaveLength(2);
  });
  it('recherche, sans que % soit un joker', async () => {
    expect((await listActivity({ q: '50%' })).entries).toHaveLength(1);
    expect((await listActivity({ q: '%' })).entries).toHaveLength(1);
    expect((await listActivity({ q: 'julie' })).entries).toHaveLength(1);
  });
  it('tri du plus ancien au plus récent', async () => {
    expect((await listActivity({ order: 'asc' })).entries[0].label).toBe('Julie');
  });
  it('les dates sont au format ISO', async () => {
    expect((await listActivity({ order: 'asc' })).entries[0]).toMatchObject({ at: '2026-11-10T09:00:00.000000Z', until: null });
  });
  it('liste les personnes de l’entreprise qui ont agi', async () => {
    expect((await listActivity({})).people.map((p) => p.id).sort()).toEqual([OWNER, MEMBER].sort());
  });
});

it('élément supprimé : pas de lien, libellé gardé ; élément présent : lien', async () => {
  current = OWNER;
  const { entries } = await listActivity({ entity: 'client' });
  expect(entries.find((e) => e.label === 'Paul Disparu')).toMatchObject({ href: null });
  expect(entries.find((e) => e.label === 'Julie')).toMatchObject({ href: `/clients?fiche=${CUSTOMER}` });
});

it('pagination par 50', async () => {
  current = OWNER;
  for (let i = 0; i < 56; i++) await add(OWNER, OWNER, 'creation', 'prestation', null, `P${i}`, `2026-10-01T10:${String(i).padStart(2, '0')}:00Z`);
  const first = await listActivity({ entity: 'prestation' });
  expect(first.entries).toHaveLength(50);
  expect(first.next).toBeTruthy();
  const second = await listActivity({ entity: 'prestation', cursor: first.next });
  expect(second.entries).toHaveLength(6);
  expect(second.next).toBeNull();
  expect(new Set([...first.entries, ...second.entries].map((e) => e.id)).size).toBe(56);
});

it('une ligne d’import en lot affiche le total à jour', async () => {
  current = OWNER;
  await pg.query(`insert into activity_log (company_id, actor_id, action, entity_type, entity_label, summary, details, created_at, updated_at)
    values ($1, $1, 'creation', 'ingredient', '', '100 ingrédients créés', '{"n": 215, "count": 1}', '2026-09-01T10:00:00Z', '2026-09-01T10:01:00Z')`, [OWNER]);
  const { entries } = await listActivity({ entity: 'ingredient' });
  expect(entries[0]).toMatchObject({ summary: '215 ingrédients créés' });
});
