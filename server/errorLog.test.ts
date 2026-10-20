// Journal d'erreurs maison, sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const mails: string[] = [];
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async (m: { subject: string }) => { mails.push(m.subject); return { error: null }; } }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const log = await import('./errorLog');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('00000000-0000-4000-8000-00000000f101', 'admin@t.fr', 'x');
    insert into profiles (id, email, role) values ('00000000-0000-4000-8000-00000000f101', 'admin@t.fr', 'admin');
  `);
});

const groups = async () => (await pg.query<{ message: string; count: number; last_path: string | null; resolved_at: string | null }>(`select message, count, last_path, resolved_at from error_groups order by first_seen`)).rows;

describe('regroupement', () => {
  it('ne garde pas ce qui change d’une fois à l’autre', () => {
    expect(log.normalizeMessage('Devis 3f2b8c1e-0000-4000-8000-000000000001 introuvable (42)')).toBe('Devis <id> introuvable (#)');
    expect(log.cleanPath('https://webodevis.fr/d/AbCdEf1234567890xyz?x=1')).toBe('/d/<jeton>');
    expect(log.cleanPath('/devis/12/modifier?mode=weboword')).toBe('/devis/12/modifier');
    const stack = 'TypeError: x\n    at render (webpack-internal:///./components/devis/A.tsx:10:5)';
    expect(log.fingerprintOf({ source: 'navigateur', message: 'Ligne 12 vide', stack }))
      .toBe(log.fingerprintOf({ source: 'navigateur', message: 'Ligne 99 vide', stack: stack.replace(':10:5', ':11:7') }));
  });
});

describe('enregistrement et alertes', () => {
  it('compte les répétitions et ne prévient qu’une fois', async () => {
    for (let i = 0; i < 3; i++) await log.recordError({ source: 'navigateur', message: `Impossible de lire la ligne ${i}`, path: '/devis' });
    expect(await groups()).toEqual([{ message: 'Impossible de lire la ligne 2', count: 3, last_path: '/devis', resolved_at: null }]);
    expect(mails).toEqual(['Nouvelle erreur : Impossible de lire la ligne 0']);
  });

  it('prévient de nouveau quand une erreur résolue revient', async () => {
    await pg.exec(`update error_groups set resolved_at = now(), notified_at = now() - interval '2 hours'`);
    await log.recordError({ source: 'navigateur', message: 'Impossible de lire la ligne 7' });
    expect((await groups())[0]).toMatchObject({ count: 4, resolved_at: null });
    expect(mails.at(-1)).toBe('Erreur revenue : Impossible de lire la ligne 7');
  });

  it('plafonne les erreurs nouvelles en cas d’avalanche', async () => {
    for (let i = 0; i < 60; i++) await log.recordError({ source: 'serveur', message: `Erreur différente ${'x'.repeat(i)}` });
    expect((await groups()).length).toBe(50);
  });
});
