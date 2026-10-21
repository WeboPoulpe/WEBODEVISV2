// Sans la migration 0031 (colonnes des formules absentes) : l'acceptation en ligne, les factures et la production
// fonctionnent comme avant, sans erreur.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'Test' }) }));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
const OWNER = '00000000-0000-4000-8000-0000000000e1';
vi.mock('./session', () => ({
  getSessionUser: async () => null,
  requireUser: async () => ({ id: OWNER, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: OWNER, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { acceptQuote, acceptanceState } = await import('./acceptance');
const { getProductionSheet } = await import('./eventSheets');
const inv = await import('./invoices');
const TOKEN = 'jeton-devis-avant-migration';
let quoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  // La base telle qu'avant la migration 0031 : sans les colonnes, avec le déclencheur d'avant.
  await pg.exec(`
    create or replace function public.invalidate_quote_acceptance() returns trigger language plpgsql as $$
    begin
      if new.services is distinct from old.services or new.content_html is distinct from old.content_html then
        update public.quote_acceptances set invalidated_at = now() where quote_id = new.id and invalidated_at is null;
      end if;
      return new;
    end; $$;
    alter table quotes drop column formulas, drop column chosen_formula_id;
    alter table quote_acceptances drop column formula_id, drop column formula_name;
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'chef@t.fr', 'Traiteur Test');
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, vat_rate, services, share_token, valid_until)
    values ($1, $1, 'Dupont', '2026-12-12', 'mariage', 50, 'devis_envoye', 10, '[{"id":"a","name":"Menu","quantity":50,"unitPrice":45}]', $2, '2099-01-01')
    returning id`, [OWNER, TOKEN]);
  quoteId = rows[0].id;
});

describe('avant la migration 0031', () => {
  it('le devis s’accepte comme avant', async () => {
    expect(await acceptanceState(TOKEN)).toMatchObject({ canAccept: true, formulas: [], chosenFormulaId: null });
    expect((await acceptQuote({ token: TOKEN, signerName: 'Jean Dupont', signature: `data:image/png;base64,${'iVBORw0KGgo'.repeat(30)}`, acceptTerms: true })).error).toBeNull();
    expect((await acceptanceState(TOKEN))!.acceptance).toMatchObject({ signerName: 'Jean Dupont', formulaName: null });
  });

  it('factures et production lisent le devis sans erreur', async () => {
    expect((await inv.quoteBillingSummary(quoteId))!.totalTTC).toBe(2475);
    expect((await getProductionSheet(quoteId))!.plan.dishes).toBeDefined();
  });
});
