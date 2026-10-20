// Parcours complet des factures sur le vrai schéma (baseline + migrations) dans un Postgres en mémoire :
// acompte, émission numérotée, paiement, solde, avoir, et les garde-fous de la base.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));

const ME = '00000000-0000-4000-8000-0000000000a1';
const OTHER = '00000000-0000-4000-8000-0000000000b1';
let current = ME;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@y.fr' }), requireWriter: async () => ({ id: current, email: 'x@y.fr' }) }));

let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const inv = await import('./invoices');
const year = new Date().getFullYear();
let quoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'me@t.fr', 'x'), ('${OTHER}', 'other@t.fr', 'x');
    insert into profiles (id, email, company_name, company_address) values
      ('${ME}', 'me@t.fr', 'Traiteur Test', '1 rue du Four, 10000 Troyes'),
      ('${OTHER}', 'other@t.fr', 'Autre', '2 rue B');
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, client_first_name, client_last_name, event_date, event_type, guest_count, status, vat_rate, services)
    values ($1, $1, 'Dupont', 'Jean', 'Dupont', '2026-12-12', 'mariage', 50, 'valide', 10, $2::jsonb) returning id`,
  [ME, JSON.stringify([
    { id: 'a', name: 'Menu mariage', quantity: 50, unitPrice: 45 },
    { id: 'b', name: 'Champagne', quantity: 20, unitPrice: 30, vatRate: 20 },
  ])]);
  quoteId = rows[0].id;
});

const ok = <T extends { error: string | null }>(r: T) => { expect(r.error).toBeNull(); return r as Extract<T, { error: null }>; };

describe('factures', () => {
  let depositId = '';
  let balanceId = '';

  it('prépare une facture d’acompte au pourcentage du compte', async () => {
    depositId = ok(await inv.createInvoiceDraft({ quoteId, kind: 'acompte' })).id;
    const d = (await inv.getInvoice(depositId))!;
    expect(d).toMatchObject({ status: 'brouillon', number: null, total_ttc: 958.5 });
    expect(d.vat_breakdown.map((r) => r.rate)).toEqual([20, 10]);
    expect(d.buyer.name).toBe('Jean Dupont');
  });

  it('refuse d’émettre sans SIRET ni n° de TVA', async () => {
    expect((await inv.issueInvoice(depositId)).error).toMatch(/SIRET/);
    await pg.exec(`update profiles set siret = '12345678900012' where id = '${ME}'`);
    expect((await inv.issueInvoice(depositId)).error).toMatch(/TVA/);
    await pg.exec(`update profiles set vat_number = 'FR12345678900' where id = '${ME}'`);
  });

  it('émet avec un numéro et une échéance', async () => {
    expect(ok(await inv.issueInvoice(depositId)).number).toBe(`F-${year}-0001`);
    const d = (await inv.getInvoice(depositId))!;
    expect(d.status).toBe('emise');
    expect(d.seller.siret).toBe('12345678900012');
    expect(d.due_date).not.toBeNull();
  });

  it('une facture émise ne se modifie ni ne se supprime, même directement en base', async () => {
    expect((await inv.updateInvoiceDraft(depositId, { notes: 'x' })).error).toMatch(/avoir/);
    expect((await inv.deleteInvoiceDraft(depositId)).error).toMatch(/avoir/);
    await expect(pg.query(`update customer_invoices set total_ttc = 1 where id = $1`, [depositId])).rejects.toThrow(/modifiée/);
    await expect(pg.query(`delete from customer_invoices where id = $1`, [depositId])).rejects.toThrow(/supprimée/);
  });

  it('l’acompte réglé fait passer le devis en « acompte »', async () => {
    ok(await inv.recordPayment(depositId, { paidOn: '2026-10-20', amount: 500, method: 'virement' }));
    expect((await inv.getInvoice(depositId))!.status).toBe('payee_partiellement');
    ok(await inv.recordPayment(depositId, { paidOn: '2026-10-21', amount: 458.5, method: 'cheque' }));
    expect((await inv.getInvoice(depositId))!.status).toBe('payee');
    expect((await pg.query<{ status: string }>(`select status from quotes where id = $1`, [quoteId])).rows[0].status).toBe('acompte');
  });

  it('le solde déduit l’acompte, puis le devis passe en « payé »', async () => {
    balanceId = ok(await inv.createInvoiceDraft({ quoteId, kind: 'solde' })).id;
    const b = (await inv.getInvoice(balanceId))!;
    expect(b.total_ttc).toBeCloseTo(3195 - 958.5, 2);
    expect(ok(await inv.issueInvoice(balanceId)).number).toBe(`F-${year}-0002`);
    ok(await inv.recordPayment(balanceId, { paidOn: '2026-12-13', amount: b.total_ttc, method: 'virement' }));
    expect((await pg.query<{ status: string }>(`select status from quotes where id = $1`, [quoteId])).rows[0].status).toBe('paye');
    expect((await inv.createInvoiceDraft({ quoteId, kind: 'solde' })).error).toMatch(/déjà sa facture de solde/);
  });

  it('un avoir annule la facture avec sa propre numérotation', async () => {
    const creditId = ok(await inv.createCreditNoteDraft(balanceId)).id;
    expect(ok(await inv.issueInvoice(creditId)).number).toBe(`AV-${year}-0001`);
    expect((await inv.getInvoice(balanceId))!.status).toBe('annulee');
    expect((await inv.getInvoice(creditId))!.total_ttc).toBeCloseTo(-(3195 - 958.5), 2);
  });

  it('un brouillon se supprime et ne consomme pas de numéro', async () => {
    const id = ok(await inv.createInvoiceDraft({ quoteId, kind: 'solde' })).id;
    ok(await inv.deleteInvoiceDraft(id));
    expect(await inv.getInvoice(id)).toBeNull();
  });

  it('un autre compte ne voit pas ces factures', async () => {
    current = OTHER;
    try {
      expect(await inv.getInvoice(depositId)).toBeNull();
      expect(await inv.listInvoices()).toEqual([]);
      expect((await inv.createInvoiceDraft({ quoteId, kind: 'facture' })).error).toMatch(/introuvable/);
      expect((await inv.recordPayment(depositId, { paidOn: '2026-10-20', amount: 1, method: 'virement' })).error).toMatch(/introuvable/);
    } finally {
      current = ME;
    }
  });

  it('un devis facturé ne peut plus être supprimé', async () => {
    await expect(pg.query(`delete from quotes where id = $1`, [quoteId])).rejects.toThrow();
  });
});
