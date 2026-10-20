// Lecture pour l'export comptable, sur le vrai schéma en mémoire : période, brouillons exclus, entreprise seule.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { fecEntries, isBalanced } from '@/lib/accountingExport';

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-00000000ec01';
const COLLAB = '00000000-0000-4000-8000-00000000ec02';
const OTHER = '00000000-0000-4000-8000-00000000ec03';
let current = COLLAB;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'x@t.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@t.fr' }),
  getSessionUser: async () => null,
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { accountingExportData } = await import('./accountingExport');

const breakdown = (base: number, vat: number) => JSON.stringify([{ rate: 20, base, vat }]);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@t.fr', 'x'), ('${COLLAB}', 'collab@t.fr', 'x'), ('${OTHER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name, siret) values ('${OWNER}', 'chef@t.fr', 'Traiteur', '123 456 789 00012'), ('${OTHER}', 'autre@t.fr', 'Autre', '999999999 00011');
    insert into profiles (id, email, parent_user_id, company_role) values ('${COLLAB}', 'collab@t.fr', '${OWNER}', 'lecture');
  `);
  const insert = async (owner: string, v: { kind: string; status: string; number: string | null; issue: string | null; ht: number; vat: number; credited?: string; quote?: string }) => {
    const { rows } = await pg.query<{ id: string }>(`insert into customer_invoices
      (owner_user_id, created_by, kind, status, number, issue_date, seller, buyer, lines, total_ht, total_vat, total_ttc, vat_breakdown, credited_invoice_id, quote_id)
      values ($1, $1, $2, $3, $4, $5, '{}', $6, '[]', $7, $8, $9, $10, $11, $12) returning id`,
    [owner, v.kind, v.status, v.number, v.issue, JSON.stringify({ name: 'Dupont' }), v.ht, v.vat, v.ht + v.vat, breakdown(v.ht, v.vat), v.credited ?? null, v.quote ?? null]);
    return rows[0].id;
  };
  const { rows: [quote] } = await pg.query<{ id: string }>(`insert into quotes (owner_user_id, user_id, client_name, quote_number, status, event_date, event_type, guest_count)
    values ($1, $1, 'Dupont', 'D-2026-0007', 'valide', '2026-12-12', 'mariage', 40) returning id`, [OWNER]);
  const f1 = await insert(OWNER, { kind: 'facture', status: 'annulee', number: 'F-2026-0001', issue: '2026-10-02', ht: 1000, vat: 200, quote: quote.id });
  await insert(OWNER, { kind: 'avoir', status: 'emise', number: 'AV-2026-0001', issue: '2026-10-15', ht: -1000, vat: -200, credited: f1, quote: quote.id });
  const f2 = await insert(OWNER, { kind: 'acompte', status: 'payee_partiellement', number: 'F-2026-0002', issue: '2026-09-28', ht: 500, vat: 100 });
  await insert(OWNER, { kind: 'facture', status: 'brouillon', number: null, issue: null, ht: 50, vat: 10 });
  const other = await insert(OTHER, { kind: 'facture', status: 'emise', number: 'F-2026-0001', issue: '2026-10-03', ht: 80, vat: 16 });
  await pg.query(`insert into customer_invoice_payments (invoice_id, paid_on, amount, method, created_by) values
    ($1, '2026-10-01', 200, 'cheque', $3), ($1, '2026-09-29', 100, 'virement', $3), ($2, '2026-10-04', 96, 'virement', $4)`, [f2, other, OWNER, OTHER]);
});

describe('lecture pour l’export comptable', () => {
  it('ne lit que l’entreprise de l’utilisateur (collaborateur en consultation seule compris), sans brouillon', async () => {
    current = COLLAB;
    const data = await accountingExportData('2026-10-01', '2026-10-31');
    expect(data.siret).toBe('123 456 789 00012');
    expect(data.documents.map((d) => d.number)).toEqual(['F-2026-0001', 'AV-2026-0001']);
    expect(data.documents[1]).toMatchObject({ kind: 'avoir', total_ttc: -1200, credited_number: 'F-2026-0001', quote_number: 'D-2026-0007', buyer_name: 'Dupont' });
    // Paiement du 1er octobre sur une facture de septembre : il est dans la période, pas sa facture.
    expect(data.payments).toEqual([{ paid_on: '2026-10-01', amount: 200, method: 'cheque', note: null, invoice_number: 'F-2026-0002', buyer_name: 'Dupont' }]);
    expect(fecEntries(data.documents, data.payments).every(isBalanced)).toBe(true);
  });

  it('réglé : tous les paiements reçus à ce jour sur la facture', async () => {
    const data = await accountingExportData('2026-09-01', '2026-09-30');
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0]).toMatchObject({ number: 'F-2026-0002', paid: 300, total_ttc: 600 });
    expect(data.payments.map((p) => p.amount)).toEqual([100]);
  });

  it('une autre entreprise ne voit que ses propres documents', async () => {
    current = OTHER;
    const data = await accountingExportData('2026-10-01', '2026-10-31');
    expect(data.documents.map((d) => d.total_ttc)).toEqual([96]);
    expect(data.payments.map((p) => p.amount)).toEqual([96]);
    current = COLLAB;
  });
});
