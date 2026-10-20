// Emails de conseils : choix de l'email, une seule fois, désinscription — sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const sent: { to: string; subject: string }[] = [];
vi.mock('@/lib/mail', () => ({ sendMail: async (m: { to: string; subject: string }) => { sent.push({ to: m.to, subject: m.subject }); return { error: null }; } }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));
process.env.NEXTAUTH_SECRET ??= 'secret-de-test';

const { nextLifecycleEmail, runLifecycleEmails } = await import('./lifecycle');

const base = { id: 'x', email: 'x@t.fr', first_name: null, idle_days: 0, prestations: 0, quotes: 0, sent: 0 };

describe('choix de l’email', () => {
  it('suit les premiers pas, sans répéter', () => {
    expect(nextLifecycleEmail({ ...base, age_days: 0 }, new Set())).toBeNull();
    expect(nextLifecycleEmail({ ...base, age_days: 1 }, new Set())).toBe('catalogue');
    expect(nextLifecycleEmail({ ...base, age_days: 2 }, new Set(['catalogue']))).toBeNull();
    expect(nextLifecycleEmail({ ...base, age_days: 4, prestations: 5 }, new Set(['catalogue']))).toBe('premier_devis');
    expect(nextLifecycleEmail({ ...base, age_days: 8, prestations: 5, quotes: 2 }, new Set())).toBe('envoi_en_ligne');
    expect(nextLifecycleEmail({ ...base, age_days: 8, prestations: 5, quotes: 2, sent: 1 }, new Set())).toBeNull();
    expect(nextLifecycleEmail({ ...base, age_days: 60, idle_days: 30, prestations: 5, quotes: 2, sent: 1 }, new Set())).toBe('inactif');
  });
});

describe('envoi quotidien', () => {
  beforeAll(async () => {
    pg = await createTestDb();
    await pg.exec(`
      insert into users (id, email, password_hash) values
        ('00000000-0000-4000-8000-00000000d101', 'nouveau@t.fr', 'x'),
        ('00000000-0000-4000-8000-00000000d102', 'desinscrit@t.fr', 'x'),
        ('00000000-0000-4000-8000-00000000d103', 'membre@t.fr', 'x');
      insert into profiles (id, email, created_at) values ('00000000-0000-4000-8000-00000000d101', 'nouveau@t.fr', now() - interval '2 days');
      insert into profiles (id, email, created_at, tips_opt_out) values ('00000000-0000-4000-8000-00000000d102', 'desinscrit@t.fr', now() - interval '2 days', true);
      insert into profiles (id, email, created_at, parent_user_id) values ('00000000-0000-4000-8000-00000000d103', 'membre@t.fr', now() - interval '2 days', '00000000-0000-4000-8000-00000000d101');
    `);
  });

  it('envoie une fois aux titulaires inscrits, pas aux désinscrits ni aux collaborateurs', async () => {
    expect(await runLifecycleEmails({ origin: 'https://webodevis.fr' })).toEqual({ sent: 1 });
    expect(sent).toEqual([{ to: 'nouveau@t.fr', subject: 'Commencez par votre carte' }]);
    expect(await runLifecycleEmails({ origin: 'https://webodevis.fr' })).toEqual({ sent: 0 });
  });
});
