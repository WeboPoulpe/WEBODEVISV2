// Liste allégée des devis (page /devis) : les devis de l'entreprise seulement, lignes sans textes longs.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));

const ME = '00000000-0000-4000-8000-0000000000b1';
const MATE = '00000000-0000-4000-8000-0000000000b2';
const OTHER = '00000000-0000-4000-8000-0000000000b3';
vi.mock('./session', () => ({ requireUser: async () => ({ id: ME, email: 'x@y.fr' }) }));

let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const { listQuotesLight, listQuoteTemplatesLight } = await import('./quoteList');

const heavyLine = { name: 'Menu mariage', quantity: 50, unitPrice: 45, description: '<p>long</p>'.repeat(500), gastroCardHtml: '<div/>', gastroCardHtmlEn: '<div/>' };

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'me@t.fr', 'x'), ('${MATE}', 'mate@t.fr', 'x'), ('${OTHER}', 'o@t.fr', 'x');
    insert into profiles (id, email) values ('${ME}', 'me@t.fr'), ('${OTHER}', 'o@t.fr');
    insert into profiles (id, email, parent_user_id) values ('${MATE}', 'mate@t.fr', '${ME}');
  `);
  const ins = (owner: string, name: string, created: string) => pg.query(
    `insert into quotes (owner_user_id, user_id, client_name, event_type, guest_count, event_date, status, services, created_at) values ($1, $1, $2, 'mariage', 50, '2026-12-05', 'devis_envoye', $3::jsonb, $4)`,
    [owner, name, JSON.stringify([heavyLine, { isPageBreak: true }]), created]);
  await ins(ME, 'Mien', '2026-11-01T10:00:00Z');
  await ins(MATE, 'Collègue', '2026-11-02T10:00:00Z');
  await ins(OTHER, 'Autre traiteur', '2026-11-03T10:00:00Z');
  await pg.query(`insert into devis_templates (user_id, name, template, services) values ($1, 'Mariage', 'classique', $2::jsonb), ($3, 'Pas à moi', 'classique', '[]')`,
    [MATE, JSON.stringify([heavyLine]), OTHER]);
});

describe('liste des devis', () => {
  it('les devis de l’entreprise, du plus récent au plus ancien', async () => {
    const rows = await listQuotesLight<{ client_name: string }>();
    expect(rows.map((r) => r.client_name)).toEqual(['Collègue', 'Mien']);
  });

  it('garde noms, quantités et prix ; retire descriptions et cartes', async () => {
    const [row] = await listQuotesLight<{ services: Record<string, unknown>[]; event_date: string }>();
    expect(row.services[0]).toEqual({ name: 'Menu mariage', quantity: 50, unitPrice: 45 });
    expect(row.services[1]).toEqual({ isPageBreak: true });
    expect(row.event_date).toBe('2026-12-05');
  });

  it('modèles de l’entreprise, allégés', async () => {
    const rows = await listQuoteTemplatesLight<{ name: string; services: Record<string, unknown>[] }>();
    expect(rows.map((r) => r.name)).toEqual(['Mariage']);
    expect(rows[0].services[0]).not.toHaveProperty('description');
  });
});
