import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

// Accès d'une entreprise selon son abonnement, sur le vrai schéma en mémoire.

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000000f1';
const MEMBER = '00000000-0000-4000-8000-0000000000f2';
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const s = await import('./subscription');
const settings = await import('./settings');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'o@s.fr', 'x'), ('${MEMBER}', 'm@s.fr', 'x'), ('${DEMO_USER_ID}', 'demo@s.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'o@s.fr', 'Traiteur S'), ('${DEMO_USER_ID}', 'demo@s.fr', 'Démo');
    insert into profiles (id, email, parent_user_id, company_role) values ('${MEMBER}', 'm@s.fr', '${OWNER}', 'commercial');
  `);
});
beforeEach(async () => {
  await pg.exec(`delete from company_subscriptions; delete from app_settings where key = 'billing_enforced';`);
  s.clearAccessCache();
});

describe("accès selon l'abonnement", () => {
  it('réglage éteint : accès complet', async () => {
    expect(await s.accessOf(OWNER)).toBe('full');
  });

  it('allumé : sans ligne, le titulaire et son collaborateur sont « unpaid »', async () => {
    await settings.setBillingEnforced(true);
    expect(await s.accessOf(OWNER)).toBe('unpaid');
    expect(await s.accessOfUser(MEMBER)).toBe('unpaid');
  });

  it('offert : accès complet pour les deux ; retiré : lecture seule', async () => {
    await settings.setBillingEnforced(true);
    await s.setComped(OWNER, true, 'bêta');
    expect(await s.accessOfUser(OWNER)).toBe('full');
    expect(await s.accessOfUser(MEMBER)).toBe('full');
    await s.setComped(OWNER, false, '');
    expect(await s.accessOfUser(OWNER)).toBe('readonly');
    expect(await s.accessOfUser(MEMBER)).toBe('readonly');
  });

  it('la démonstration reste complète', async () => {
    await settings.setBillingEnforced(true);
    expect(await s.accessOf(DEMO_USER_ID)).toBe('full');
  });

  it('invalidateAccess rend un changement visible sans attendre le cache', async () => {
    await settings.setBillingEnforced(true);
    await pg.exec(`insert into company_subscriptions (company_id, status, ever_subscribed) values ('${OWNER}', 'active', true)`);
    expect(await s.accessOf(OWNER)).toBe('full');
    await pg.exec(`update company_subscriptions set status = 'canceled' where company_id = '${OWNER}'`);
    expect(await s.accessOf(OWNER)).toBe('full'); // « full » gardé 60 s
    s.invalidateAccess(OWNER);
    expect(await s.accessOf(OWNER)).toBe('readonly');
  });

  it('changer le réglage vide le cache', async () => {
    expect(await s.accessOf(OWNER)).toBe('full');
    await settings.setBillingEnforced(true);
    expect(await s.accessOf(OWNER)).toBe('unpaid');
  });

  it("un refus n'est jamais gardé : un accès offert en base se voit tout de suite", async () => {
    await settings.setBillingEnforced(true);
    await s.setComped(OWNER, true, '');
    await s.setComped(OWNER, false, '');
    expect(await s.accessOf(OWNER)).toBe('readonly');
    await pg.exec(`update company_subscriptions set comped = true where company_id = '${OWNER}'`);
    expect(await s.accessOf(OWNER)).toBe('full');
  });

  it('base en panne : accès laissé, journalisé, non gardé', async () => {
    await settings.setBillingEnforced(true);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await pg.exec('alter table company_subscriptions rename to company_subscriptions_off');
    try {
      expect(await s.accessOf(OWNER)).toBe('full');
      expect(err).toHaveBeenCalled();
    } finally {
      await pg.exec('alter table company_subscriptions_off rename to company_subscriptions');
      err.mockRestore();
    }
    expect(await s.accessOf(OWNER)).toBe('unpaid');
  });
});
