import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { coinsForCost, formatCoins, haikuCostUsd, monthKeyParis, nextMonthStartParis, splitDebit } from './webocoins';

describe('WeboCoins : calculs', () => {
  it('mois à l’heure de Paris', () => {
    expect(monthKeyParis(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11');
    expect(monthKeyParis(new Date('2026-10-31T21:59:00Z'))).toBe('2026-10');
    expect(monthKeyParis(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01');
    // Premier jour du mois suivant, minuit à Paris (heure d'hiver : 23 h UTC la veille).
    expect(nextMonthStartParis(new Date('2026-11-15T10:00:00Z')).toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });

  it('débit : pièces du mois d’abord, puis pièces gardées', () => {
    expect(splitDebit(3, 10, 5)).toEqual({ fromMonth: 3, fromKept: 2 });
    expect(splitDebit(3, 1, 5)).toBeNull();
    expect(splitDebit(0, 0, 0)).toEqual({ fromMonth: 0, fromKept: 0 });
    expect(splitDebit(10, 0, 4)).toEqual({ fromMonth: 4, fromKept: 0 });
  });

  it('coût réel de Haiku et prix en pièces', () => {
    expect(haikuCostUsd({ input: 4000, output: 2000 })).toBeCloseTo(0.0014, 6);
    expect(haikuCostUsd({ input: 0, output: 0, cacheWrite: 1_000_000, cacheRead: 1_000_000 })).toBeCloseTo(0.125 + 0.01, 6);
    expect(coinsForCost(0.0014, 3, 0.92)).toBe(1);
    expect(coinsForCost(0.03, 3, 0.92)).toBe(9);
    expect(formatCoins(1234)).toMatch(/^1\s234 W$/);
  });
});

describe('WeboCoins : base', () => {
  it('solde jamais négatif ; clé d’unicité du journal', async () => {
    const pg = await createTestDb();
    const U = '00000000-0000-4000-8000-0000000000d1';
    await pg.exec(`insert into users (id, email, password_hash) values ('${U}', 'w@b.fr', 'x');
      insert into profiles (id, email) values ('${U}', 'w@b.fr');`);
    await expect(pg.query(`insert into webo_wallets (company_id, kept_coins) values ($1, -1)`, [U])).rejects.toThrow();
    await pg.query(`insert into webo_wallets (company_id) values ($1)`, [U]);
    const line = `insert into webo_ledger (company_id, kind, coins, reason, idempotency_key) values ($1, 'debit', -1, 'Test', $2)`;
    await pg.query(line, [U, 'k1']);
    await expect(pg.query(line, [U, 'k1'])).rejects.toThrow();
    await pg.query(line, [U, null]);
    await pg.query(line, [U, null]);
    await expect(pg.query(`insert into webo_ledger (company_id, kind, coins, reason) values ($1, 'vol', 1, 'x')`, [U])).rejects.toThrow();
    // La base en mémoire (schéma complet et migrations) se crée dans le test : plus long qu'un test ordinaire.
  }, 30_000);
});
