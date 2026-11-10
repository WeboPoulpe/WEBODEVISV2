import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Formulaire de contact du site : tri des demandes suspectes, doublons, emails.

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Map([['x-forwarded-for', '1.2.3.4']]) }));
const sendMail = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/mail', () => ({ sendMail, appOrigin: async () => 'https://webodevis.fr', isTestAddress: () => false }));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const { submitSiteRequest } = await import('./site');

const rows = async () => (await pg.query<{ status: string; admin_notes: string | null }>(`select status, admin_notes from site_requests order by created_at`)).rows;
const form = (over: Partial<Parameters<typeof submitSiteRequest>[0]> = {}) => ({
  kind: 'devis' as const, name: 'Jeanne Martin', email: 'jeanne@traiteur.fr', message: 'Bonjour, nous faisons 40 mariages par an.',
  startedAt: Date.now() - 60_000, ...over,
});

beforeAll(async () => {
  pg = await createTestDb();
  process.env.CONTACT_EMAIL = 'equipe@webodevis.fr';
});
beforeEach(async () => {
  await pg.exec(`delete from site_requests;`);
  sendMail.mockClear();
});

describe('submitSiteRequest', () => {
  it('une vraie demande est enregistrée et prévient l’équipe et le prospect', async () => {
    expect(await submitSiteRequest(form())).toEqual({ error: null });
    expect((await rows())[0].status).toBe('nouvelle');
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('une demande avec un lien est classée suspecte, sans aucun email', async () => {
    expect(await submitSiteRequest(form({ message: 'Quel est le tarif ? https://gopartage.online/fr/sw/webodevis' }))).toEqual({ error: null });
    const [r] = await rows();
    expect(r.status).toBe('suspecte');
    expect(r.admin_notes).toContain('lien');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('un envoi trop rapide est classé suspect', async () => {
    await submitSiteRequest(form({ startedAt: Date.now() - 500 }));
    expect((await rows())[0].status).toBe('suspecte');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('le même message renvoyé dans les 24 heures n’est ni enregistré ni envoyé deux fois', async () => {
    await submitSiteRequest(form());
    await submitSiteRequest(form());
    expect(await rows()).toHaveLength(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
