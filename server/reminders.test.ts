// Relances automatiques sur le vrai schéma en mémoire : choix des devis et factures, nombre et espacement.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
interface Sent { to: string; subject: string; html: string; fromName?: string; replyTo?: string | null }
const sent: Sent[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: Sent) => { sent.push(m); return { error: null }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { runReminders, addDays } = await import('./reminders');

const A = '00000000-0000-4000-8000-0000000000a1';   // relances activées
const M = '00000000-0000-4000-8000-0000000000a2';   // collaborateur rattaché à A
const B = '00000000-0000-4000-8000-0000000000b1';   // relances coupées
const DAY0 = '2026-10-20';
const at = (day: string) => new Date(`${day}T14:00:00Z`);
const run = (day: string) => { sent.length = 0; return runReminders({ origin: 'https://webodevis.fr', now: at(day) }); };

async function quote(owner: string, name: string, opts: { status?: string; sentAt?: string | null; email?: string | null; validUntil?: string; token?: string }) {
  await pg.query(`
    insert into quotes (owner_user_id, user_id, client_name, client_email, event_date, event_type, guest_count, status, sent_at, share_token, valid_until, quote_number)
    values ($1, $1, $2, $3, '2027-03-01', 'Mariage', 80, $4, $5, $6, $7, $8)`,
  [owner, name, opts.email === undefined ? `${name.toLowerCase()}@client.fr` : opts.email, opts.status ?? 'devis_envoye',
    opts.sentAt === undefined ? '2026-10-10T10:00:00Z' : opts.sentAt, opts.token ?? `jeton-${name.toLowerCase()}-0123456789`, opts.validUntil ?? '2027-01-01', `D-${name}`]);
}

async function invoice(owner: string, number: string, opts: { due: string; total: number; paid?: number; email?: string | null; status?: string }) {
  const { rows } = await pg.query<{ id: string }>(`
    insert into customer_invoices (owner_user_id, created_by, kind, seller, buyer, lines, total_ttc)
    values ($1, $1, 'facture', $2, $3, '[]', $4) returning id`,
  [owner, JSON.stringify({ name: 'Traiteur A', iban: 'FR76 3000 6000 0112 3456 7890 189', bic: 'AGRIFRPP' }),
    JSON.stringify({ name: 'Société Cliente', email: opts.email === undefined ? 'compta@cliente.fr' : opts.email }), opts.total]);
  await pg.query(`update customer_invoices set status = 'emise', number = $2, issue_date = '2026-09-01', due_date = $3 where id = $1`, [rows[0].id, number, opts.due]);
  if (opts.paid) {
    await pg.query(`insert into customer_invoice_payments (invoice_id, paid_on, amount, created_by) values ($1, '2026-09-15', $2, $3)`, [rows[0].id, opts.paid, owner]);
    if (opts.status) await pg.query(`update customer_invoices set status = $2 where id = $1`, [rows[0].id, opts.status]);
  }
}

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${M}', 'm@t.fr', 'x'), ('${B}', 'b@t.fr', 'x');
    insert into profiles (id, email, company_name, company_email, auto_reminders, reminder_delay_days) values ('${A}', 'a@t.fr', 'Traiteur A', 'contact@traiteur-a.fr', true, 7);
    insert into profiles (id, email, parent_user_id) values ('${M}', 'm@t.fr', '${A}');
    insert into profiles (id, email, company_name) values ('${B}', 'b@t.fr', 'Traiteur B');
  `);
  await quote(A, 'Dupont', {});                                         // envoyé il y a 10 jours : à relancer
  await quote(M, 'Leroy', {});                                          // devis d'un collaborateur : réglage de l'entreprise
  await quote(A, 'Recent', { sentAt: '2026-10-17T10:00:00Z' });         // envoyé il y a 3 jours
  await quote(A, 'Expire', { validUntil: '2026-10-01' });               // plus acceptable
  await quote(A, 'Signe', { status: 'valide' });                        // déjà accepté
  await quote(A, 'Sansmail', { email: null });
  await quote(A, 'Jamais', { sentAt: null });                           // jamais envoyé
  await quote(B, 'Martin', {});                                         // relances coupées chez B

  await invoice(A, 'F-2026-001', { due: '2026-10-15', total: 1000, paid: 400, status: 'payee_partiellement' });
  await invoice(A, 'F-2026-002', { due: '2026-11-30', total: 500 });   // pas encore échue
  await invoice(A, 'F-2026-003', { due: '2026-10-01', total: 300, email: null });
  await invoice(B, 'F-2026-001', { due: '2026-10-01', total: 300 });
});

const subjects = () => sent.map((m) => m.to).sort();

describe('relances automatiques', () => {
  it('relance les devis en attente et les factures échues des comptes qui l’ont activé', async () => {
    const r = await run(DAY0);
    expect(r).toEqual({ quotes: 2, invoices: 1, failed: 0 });
    expect(subjects()).toEqual(['compta@cliente.fr', 'dupont@client.fr', 'leroy@client.fr']);
    const devis = sent.find((m) => m.to === 'dupont@client.fr')!;
    expect(devis).toMatchObject({ fromName: 'Traiteur A', replyTo: 'contact@traiteur-a.fr' });
    expect(devis.html).toContain('https://webodevis.fr/d/jeton-dupont-0123456789');
    const facture = sent.find((m) => m.to === 'compta@cliente.fr')!;
    expect(facture.subject).toContain('F-2026-001');
    expect(facture.html).toMatch(/600,00\s€/);
    expect(facture.html).toContain('FR76 3000 6000 0112 3456 7890 189');
    expect(facture.html).not.toContain('/api/factures');
  });

  it('note chaque envoi et prévient le traiteur par une notification', async () => {
    const { rows } = await pg.query<{ kind: string; owner_user_id: string }>(`select kind, owner_user_id from document_reminders`);
    expect(rows.filter((r) => r.kind === 'devis')).toHaveLength(2);
    expect(rows.filter((r) => r.kind === 'facture')).toHaveLength(1);
    expect(rows.every((r) => r.owner_user_id === A)).toBe(true);
    const notes = (await pg.query<{ type: string; title: string }>(`select type, title from notifications where user_id = $1 order by type`, [A])).rows;
    expect(notes).toEqual([{ type: 'invoice_due', title: '1 facture échue relancée' }, { type: 'task_reminder', title: '2 devis relancés' }]);
    expect((await pg.query(`select 1 from notifications where user_id = $1`, [B])).rows).toHaveLength(0);
  });

  it('respecte l’espacement : rien avant le délai, puis une nouvelle relance', async () => {
    expect(await run(DAY0)).toEqual({ quotes: 0, invoices: 0, failed: 0 });
    // Six jours plus tard, seul le devis « Recent » (envoyé le 17) a atteint son délai.
    expect(await run(addDays(DAY0, 6))).toEqual({ quotes: 1, invoices: 0, failed: 0 });
    expect(subjects()).toEqual(['recent@client.fr']);
    // Sept jours après la première relance : deuxième relance des devis et de la facture.
    expect(await run(addDays(DAY0, 7))).toEqual({ quotes: 2, invoices: 1, failed: 0 });
    expect(sent.find((m) => m.to === 'compta@cliente.fr')!.subject).toMatch(/^Nouveau rappel/);
  });

  it('s’arrête à 2 relances par devis et 3 par facture', async () => {
    expect(await run(addDays(DAY0, 14))).toEqual({ quotes: 1, invoices: 1, failed: 0 }); // Recent : 2e relance
    expect(await run(addDays(DAY0, 21))).toEqual({ quotes: 0, invoices: 0, failed: 0 });
    const counts = (await pg.query<{ kind: string; n: number }>(`select kind, count(*)::int as n from document_reminders group by kind order by kind`)).rows;
    expect(counts).toEqual([{ kind: 'devis', n: 6 }, { kind: 'facture', n: 3 }]);
  });

  it('ne relance plus une facture payée ni un devis accepté', async () => {
    await pg.query(`update customer_invoices set status = 'payee' where number = 'F-2026-002'`);
    await pg.query(`update profiles set reminder_delay_days = 1 where id = $1`, [A]);
    await quote(A, 'Nouveau', { sentAt: '2026-11-20T10:00:00Z', status: 'valide' });
    expect(await run(addDays(DAY0, 45))).toEqual({ quotes: 0, invoices: 0, failed: 0 });
  });
});
