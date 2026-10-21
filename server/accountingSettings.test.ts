// Comptes de l'export FEC (Paramètres > Comptabilité), sur le vrai schéma en mémoire : réglage de l'entreprise,
// lu par les collaborateurs, changé par le titulaire ou un gérant seulement.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { ACCOUNTING_ACCOUNTS, type AccountingAccounts } from '@/lib/accountingExport';

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-00000000ac01';
const MANAGER = '00000000-0000-4000-8000-00000000ac02';
const STAFF = '00000000-0000-4000-8000-00000000ac03';
const READER = '00000000-0000-4000-8000-00000000ac04';
const OTHER = '00000000-0000-4000-8000-00000000ac05';
let current = OWNER;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'x@t.fr' }),
  requireWriter: async () => {
    if (current === READER) throw new Error('Votre accès est en consultation seule');
    return { id: current, email: 'x@t.fr' };
  },
  getSessionUser: async () => null,
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { getAccountingSettings, saveAccountingSettings } = await import('./accountingSettings');
const { accountingExportData, companyAccounts } = await import('./accountingExport');

const custom: AccountingAccounts = { ...ACCOUNTING_ACCOUNTS, customers: '41100000', salesJournal: { code: 'VT', label: 'Ventes' }, auxPerCustomer: false };

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values
      ('${OWNER}', 'chef@t.fr', 'x'), ('${MANAGER}', 'g@t.fr', 'x'), ('${STAFF}', 'c@t.fr', 'x'), ('${READER}', 'l@t.fr', 'x'), ('${OTHER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'chef@t.fr', 'Traiteur'), ('${OTHER}', 'autre@t.fr', 'Autre');
    insert into profiles (id, email, parent_user_id, company_role) values
      ('${MANAGER}', 'g@t.fr', '${OWNER}', 'gerant'), ('${STAFF}', 'c@t.fr', '${OWNER}', 'collaborateur'), ('${READER}', 'l@t.fr', '${OWNER}', 'lecture');
  `);
});

describe('comptes de l’export FEC', () => {
  it('comptes standards tant que rien n’est réglé', async () => {
    current = OWNER;
    expect(await getAccountingSettings()).toEqual({ accounts: ACCOUNTING_ACCOUNTS, isDefault: true, canEdit: true });
  });

  it('le titulaire enregistre ; ses collaborateurs les lisent et l’export les utilise', async () => {
    current = OWNER;
    expect((await saveAccountingSettings(custom)).error).toBeNull();
    current = READER;
    const read = await getAccountingSettings();
    expect(read).toMatchObject({ accounts: custom, isDefault: false, canEdit: false });
    expect((await accountingExportData('2026-01-01', '2026-12-31')).accounts).toEqual(custom);
    // Rangé sur le profil du titulaire, pas sur celui du collaborateur.
    const { rows } = await pg.query<{ id: string }>(`select id from profiles where accounting_settings is not null`);
    expect(rows.map((r) => r.id)).toEqual([OWNER]);
  });

  it('un gérant peut changer les comptes, un collaborateur ou un compte en lecture non', async () => {
    current = MANAGER;
    expect((await getAccountingSettings()).canEdit).toBe(true);
    expect((await saveAccountingSettings({ ...custom, bank: '51200001' })).error).toBeNull();
    current = STAFF;
    expect((await getAccountingSettings()).canEdit).toBe(false);
    expect((await saveAccountingSettings(ACCOUNTING_ACCOUNTS)).error).toMatch(/titulaire/);
    current = READER;
    await expect(saveAccountingSettings(null)).rejects.toThrow(/consultation seule/);
    expect((await companyAccounts(OWNER)).bank).toBe('51200001');
  });

  it('refuse une saisie invalide, sans rien changer', async () => {
    current = OWNER;
    expect((await saveAccountingSettings({ ...custom, customers: '41A' })).error).toMatch(/Compte clients/);
    expect((await companyAccounts(OWNER)).customers).toBe('41100000');
  });

  it('une autre entreprise garde ses propres comptes', async () => {
    current = OTHER;
    expect((await getAccountingSettings()).accounts).toEqual(ACCOUNTING_ACCOUNTS);
  });

  it('« Revenir aux comptes standards » efface le réglage', async () => {
    current = OWNER;
    expect(await saveAccountingSettings(null)).toEqual({ error: null, accounts: ACCOUNTING_ACCOUNTS });
    expect((await getAccountingSettings()).isDefault).toBe(true);
    const { rows } = await pg.query(`select 1 from profiles where accounting_settings is not null`);
    expect(rows).toHaveLength(0);
  });

  it('migration pas encore appliquée : comptes standards, sans erreur', async () => {
    await pg.exec(`alter table profiles drop column accounting_settings`);
    expect(await companyAccounts(OWNER)).toEqual(ACCOUNTING_ACCOUNTS);
  });
});
