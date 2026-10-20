// Marge estimée et panier moyen du tableau de bord, sur le vrai schéma (baseline + migrations) dans un Postgres
// en mémoire : prix de revient du catalogue, frais annexes, heures des extras, devis sans coût comptés à part.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));

const ME = '00000000-0000-4000-8000-0000000000a1';
vi.mock('./session', () => ({ requireUser: async () => ({ id: ME, email: 'x@y.fr' }), requireWriter: async () => ({ id: ME, email: 'x@y.fr' }) }));

let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const { getDashboard } = await import('./dashboard');
const TODAY = '2026-10-20';

const quote = async (status: string, date: string, services: unknown[], extra: unknown[] = []) => {
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, vat_rate, services, extra_costs)
    values ($1, $1, 'Client', $2, 'mariage', 50, $3, 10, $4::jsonb, $5::jsonb) returning id`,
  [ME, date, status, JSON.stringify(services), JSON.stringify(extra)]);
  return rows[0].id;
};

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'me@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${ME}', 'me@t.fr', 'Traiteur Test');
    insert into prestations (user_id, name, unit_price, cost_price) values ('${ME}', 'Menu mariage', 45, 12);
  `);
  // Ce mois : 50 × 45 = 2 250 HT, coût 50 × 12 + 150 de transport + personnel (8 h × 15 + 6 h × 14 du taux de l'extra).
  const withCost = await quote('valide', '2026-10-25', [{ name: 'Menu mariage', quantity: 50, unitPrice: 45 }], [{ id: 'a', label: 'Transport', amount: 150 }]);
  const { rows: [x1] } = await pg.query<{ id: string }>(`insert into extras (user_id, name, hourly_rate) values ($1, 'Léa', 14) returning id`, [ME]);
  const { rows: [x2] } = await pg.query<{ id: string }>(`insert into extras (user_id, name) values ($1, 'Tom') returning id`, [ME]);
  await pg.query(`insert into event_extras (quote_id, extra_id, status, hours_worked) values ($1, $2, 'present', 6)`, [withCost, x1.id]);
  await pg.query(`insert into event_extras (quote_id, extra_id, status, hours_worked, hourly_rate) values ($1, $2, 'present', 8, 15)`, [withCost, x2.id]);
  // Ce mois aussi, sans aucun coût connu : 1 000 HT, compté à part.
  await quote('acompte', '2026-10-02', [{ name: 'Buffet libre', quantity: 1, unitPrice: 1000 }]);
  // Plus tôt dans l'année : 20 × 45 = 900 HT, coût 240.
  await quote('paye', '2026-03-14', [{ name: 'menu mariage ', quantity: 20, unitPrice: 45 }]);
  // Devis en cours : hors calcul.
  await quote('devis_envoye', '2026-10-28', [{ name: 'Menu mariage', quantity: 100, unitPrice: 45 }]);
});

describe('tableau de bord : marge estimée', () => {
  it('compte prestations, frais annexes et personnel ; les devis sans coût à part', async () => {
    const { margin } = await getDashboard(TODAY);
    expect(margin.staffCounted).toBe(true);
    // Coût : 600 + 150 + 120 + 84 = 954 ; marge 2 250 − 954 = 1 296.
    expect(margin.month).toMatchObject({ revenueHT: 2250, cost: 954, margin: 1296, costed: 1, uncosted: 1 });
    expect(margin.month.rate).toBeCloseTo(57.6, 1);
    expect(margin.year).toMatchObject({ revenueHT: 3150, cost: 1194, margin: 1956, costed: 2, uncosted: 1 });
  });

  it('panier moyen : CA HT moyen par devis confirmé', async () => {
    const { margin } = await getDashboard(TODAY);
    expect(margin.basketMonth).toBe(1625); // (2 250 + 1 000) / 2
    expect(margin.basketYear).toBe(1383.33); // (2 250 + 1 000 + 900) / 3
  });
});
