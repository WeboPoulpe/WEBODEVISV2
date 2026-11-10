// Lecture seule sans abonnement, côté serveur, sur le vrai schéma en mémoire : requireWriter, /api/db (executeQuery),
// liens publics (acceptation, « Je veux ce menu ») et relances automatiques.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import type { QueryDescriptor } from '@/lib/compat/builder';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Test' }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
const sent: { to: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { to: string }) => { sent.push({ to: m.to }); return { error: null }; },
}));
let session: { user: { id: string; email: string }; actingAsAdmin?: boolean } | null = null;
vi.mock('next-auth', () => ({ getServerSession: async () => session }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

let pg: PGlite;
vi.mock('@/db', () => {
  const query = async (text: string, values?: unknown[]) => {
    const r = await pg.query(text, values);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  return {
    get db() { return drizzle(pg, { schema }); },
    pool: { query, connect: async () => ({ query, release: () => {} }) },
  };
});

const { requireWriter, SubscriptionRequiredError } = await import('./session');
const { clearAdminWriteLog, SUBSCRIPTION_REQUIRED_MESSAGE, OWNER_UNAVAILABLE_MESSAGE } = await import('./subscriptionGuard');
const { executeQuery } = await import('./compat/execute');
const { clearAccessCache, setComped } = await import('./subscription');
const { setBillingEnforced } = await import('./settings');
const { acceptQuote } = await import('./acceptance');
const { submitBrochureRequest } = await import('./brochureRequests');
const { runReminders } = await import('./reminders');

const OWNER = '00000000-0000-4000-8000-0000000000e1';
const PAID = '00000000-0000-4000-8000-0000000000e2';
const QUOTE_TOKEN = 'jeton-devis-sans-abonnement-01';
const BROCHURE_TOKEN = 'jeton-brochure-sans-abonnement';
const SIGNATURE = `data:image/png;base64,${'iVBORw0KGgo'.repeat(30)}`;

const run = (d: Partial<QueryDescriptor> & Pick<QueryDescriptor, 'table' | 'op'>, ctx: { uid: string; actingAsAdmin?: boolean }) =>
  executeQuery({ filters: [], order: [], returning: true, select: '*', ...d } as QueryDescriptor, ctx);
const draft = (owner: string) => ({ table: 'quotes', op: 'insert' as const, values: { user_id: owner, owner_user_id: owner, client_name: 'Brouillon', status: 'devis_envoye', event_date: '2099-05-01', event_type: 'Cocktail', guest_count: 10 } });
const audits = async () => (await pg.query<{ n: number }>(`select count(*)::int as n from audit_log where action = 'ecriture_admin_compte_inactif'`)).rows[0].n;

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'o@g.fr', 'x'), ('${PAID}', 'p@g.fr', 'x');
    insert into profiles (id, email, company_name, auto_reminders, reminder_delay_days)
      values ('${OWNER}', 'o@g.fr', 'Traiteur Inactif', true, 7), ('${PAID}', 'p@g.fr', 'Traiteur Abonné', true, 7);
    insert into quotes (owner_user_id, user_id, client_name, client_email, event_date, event_type, guest_count, status, sent_at, share_token, valid_until)
      values ('${OWNER}', '${OWNER}', 'Dupont', 'dupont@client.fr', '2099-03-01', 'Mariage', 50, 'devis_envoye', '2026-10-10T10:00:00Z', '${QUOTE_TOKEN}', '2099-01-01'),
             ('${PAID}', '${PAID}', 'Martin', 'martin@client.fr', '2099-03-01', 'Mariage', 50, 'devis_envoye', '2026-10-10T10:00:00Z', 'jeton-devis-abonne-000000001', '2099-01-01');
    insert into brochures (owner_user_id, user_id, name, share_token) values ('${OWNER}', '${OWNER}', 'Mariages', '${BROCHURE_TOKEN}');
  `);
});

beforeEach(async () => {
  await pg.exec(`delete from company_subscriptions; delete from app_settings where key = 'billing_enforced'; delete from audit_log;`);
  clearAccessCache();
  clearAdminWriteLog();
  await setBillingEnforced(true);
  await setComped(PAID, true, 'test');
  await setComped(OWNER, true, 'test');
  await setComped(OWNER, false, '');           // a déjà eu accès, n'en a plus : lecture seule
  session = { user: { id: OWNER, email: 'o@g.fr' } };
  sent.length = 0;
});

describe('écritures sans abonnement', () => {
  it('requireWriter refuse, avec le message unique', async () => {
    const err = await requireWriter().catch((e) => e);
    expect(err).toBeInstanceOf(SubscriptionRequiredError);
    expect(err.name).toBe('SubscriptionRequiredError');
    expect(err.message).toBe(SUBSCRIPTION_REQUIRED_MESSAGE);
  });

  it('une entreprise abonnée écrit ; réglage éteint, tout le monde écrit', async () => {
    session = { user: { id: PAID, email: 'p@g.fr' } };
    expect((await requireWriter()).id).toBe(PAID);
    await setBillingEnforced(false);
    session = { user: { id: OWNER, email: 'o@g.fr' } };
    expect((await requireWriter()).id).toBe(OWNER);
  });

  it('/api/db : écriture refusée, lecture permise', async () => {
    const insert = await run(draft(OWNER), { uid: OWNER });
    expect(insert.error?.message).toBe(SUBSCRIPTION_REQUIRED_MESSAGE);
    const read = await run({ table: 'quotes', op: 'select' }, { uid: OWNER });
    expect(read.error).toBeNull();
    expect((read.data as unknown[]).length).toBe(1);
    const paid = await run(draft(PAID), { uid: PAID });
    expect(paid.error).toBeNull();
  });

  it('un administrateur entré dans le compte écrit, et c’est inscrit au journal (une fois par minute)', async () => {
    session = { user: { id: OWNER, email: 'o@g.fr' }, actingAsAdmin: true };
    expect((await requireWriter()).id).toBe(OWNER);
    const r = await run(draft(OWNER), { uid: OWNER, actingAsAdmin: true });
    expect(r.error).toBeNull();
    await requireWriter();
    expect(await audits()).toBe(1);
  });

  it('un administrateur dans un compte abonné : rien au journal', async () => {
    session = { user: { id: PAID, email: 'p@g.fr' }, actingAsAdmin: true };
    await requireWriter();
    expect(await audits()).toBe(0);
  });
});

describe('liens publics et relances', () => {
  // En premier : l'acceptation, si elle passait, retirerait le devis des relances.
  it('les relances ne partent que pour les entreprises abonnées', async () => {
    const r = await runReminders({ origin: 'https://webodevis.fr', now: new Date('2026-10-20T14:00:00Z') });
    expect(r.quotes).toBe(1);
    expect(sent.map((m) => m.to)).toEqual(['martin@client.fr']);
  });

  it('acceptation en ligne refusée avec un message neutre', async () => {
    const r = await acceptQuote({ token: QUOTE_TOKEN, signerName: 'Jean Dupont', signature: SIGNATURE, acceptTerms: true });
    expect(r.error).toBe(OWNER_UNAVAILABLE_MESSAGE);
    expect(r.error).toBe('Ce traiteur ne peut pas recevoir de réponse en ligne pour le moment, contactez-le directement.');
    expect((await pg.query(`select 1 from quote_acceptances`)).rows.length).toBe(0);
  });

  it('« Je veux ce menu » refusé avec le même message', async () => {
    const r = await submitBrochureRequest(BROCHURE_TOKEN, { first_name: 'Jean', last_name: 'Dupont', email: 'jean@client.fr' });
    expect(r.error).toBe(OWNER_UNAVAILABLE_MESSAGE);
    expect((await pg.query(`select 1 from prospect_requests`)).rows.length).toBe(0);
  });
});
