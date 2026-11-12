import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { REQUESTS_PER_HOUR } from '@/lib/annuaire/config';

// Demande de contact depuis une fiche de l'annuaire, sur le vrai schéma en mémoire.

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Test', host: 'choisirmontraiteur.fr' }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
const sent: { to: string; subject: string; html: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://hote-de-la-requete.example',
  sendMail: async (m: { to: string; subject: string; html: string }) => { sent.push({ to: m.to, subject: m.subject, html: m.html }); return { error: null }; },
}));
const events: { event: string; path: string }[] = [];
vi.mock('./siteStats', () => ({
  recordEventNow: async (event: string, path: string) => { events.push({ event, path }); },
}));
const A = '00000000-0000-4000-8000-0000000000a1';
const D = '00000000-0000-4000-8000-0000000000a4';
const C = '00000000-0000-4000-8000-0000000000a3';
vi.mock('./subscription', () => ({
  accessOf: async (id: string) => (id === '00000000-0000-4000-8000-0000000000a4' ? 'readonly' : 'full'),
}));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const r = await import('./directoryRequest');

const listing = (id: string, slug: string, status: string) =>
  `insert into directory_listings (company_id, slug, status, display_name, departments, event_types, published_at)
   values ('${id}', '${slug}', '${status}', 'Traiteur ${slug}', '{10}', '{Mariage}', now());`;

const ok = {
  firstName: 'Marie', lastName: 'Dupont', email: 'Marie@Exemple.fr', phone: '0600000000', eventType: 'Mariage',
  eventDate: '2027-06-12', guestCount: '80', location: 'Troyes', message: 'Bonjour, un devis pour notre mariage ?',
  website: '', startedAt: Date.now() - 60_000,
};
const count = async () => Number((await pg.query<{ n: number }>(`select count(*)::int as n from prospect_requests`)).rows[0].n);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec([
    `insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${D}', 'd@t.fr', 'x'), ('${C}', 'c@t.fr', 'x');`,
    `insert into profiles (id, email, company_name, company_email) values
      ('${A}', 'a@t.fr', 'Traiteur A', 'contact@traiteur-a.fr'), ('${D}', 'd@t.fr', 'D', null), ('${C}', 'c@t.fr', 'C', null);`,
    listing(A, 'a-troyes', 'publiee'), listing(D, 'd-reims', 'publiee'), listing(C, 'c-lyon', 'en_attente'),
  ].join('\n'));
});
beforeEach(async () => {
  await pg.exec('delete from prospect_requests');
  sent.length = 0;
  events.length = 0;
});

describe('annuaire : demande de contact', () => {
  it('enregistre la demande, prévient le traiteur et accuse réception', async () => {
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
    const { rows } = await pg.query(`select owner_user_id, source, status, user_token from prospect_requests`);
    expect(rows).toEqual([{ owner_user_id: A, source: 'annuaire', status: 'nouveau', user_token: null }]);
    expect(sent.map((m) => m.to).sort()).toEqual(['contact@traiteur-a.fr', 'marie@exemple.fr']);
    const mail = sent.find((m) => m.to === 'contact@traiteur-a.fr')!;
    expect(mail.html).toContain('https://webodevis.fr/prospects');
    expect(mail.html).not.toContain('hote-de-la-requete');
    expect(mail.html).toContain('Choisir Mon Traiteur');
    expect(events).toEqual([{ event: 'contact', path: '/annuaire/traiteur/a-troyes' }]);
    const saved = (await pg.query(`select email, guest_count, service_address, ip_hash from prospect_requests`)).rows[0] as Record<string, unknown>;
    expect(saved).toMatchObject({ email: 'marie@exemple.fr', guest_count: 80, service_address: 'Troyes' });
    expect(saved.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('un message avec un lien est accepté', async () => {
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, message: 'Voir https://exemple.fr/inspiration svp' })).toEqual({ error: null });
    expect(await count()).toBe(1);
    expect(sent.length).toBe(2);
  });

  it('pot de miel ou envoi trop rapide : faux succès, rien d’enregistré, aucun e-mail', async () => {
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, website: 'http://spam.example' })).toEqual({ error: null });
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, startedAt: Date.now() - 500 })).toEqual({ error: null });
    expect(await count()).toBe(0);
    expect(sent).toEqual([]);
    expect(events).toEqual([]);
  });

  it('6e demande dans l’heure depuis la même connexion : refusée', async () => {
    for (let i = 0; i < REQUESTS_PER_HOUR; i++) expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: 'Vous avez déjà envoyé plusieurs demandes. Réessayez dans une heure.' });
    expect(await count()).toBe(REQUESTS_PER_HOUR);
  });

  it('fiche qui n’est plus visible : refusée avec un message', async () => {
    const gone = { error: 'Ce traiteur ne reçoit plus de demandes ici. Choisissez-en un autre dans l’annuaire.' };
    expect(await r.submitDirectoryRequest('d-reims', ok)).toEqual(gone);
    expect(await r.submitDirectoryRequest('c-lyon', ok)).toEqual(gone);
    expect(await r.submitDirectoryRequest('inconnue', ok)).toEqual(gone);
    expect(await count()).toBe(0);
    expect(sent).toEqual([]);
  });

  it('e-mail invalide ou nom manquant : refusé', async () => {
    expect((await r.submitDirectoryRequest('a-troyes', { ...ok, email: 'pas-un-email' })).error).toBe('L’adresse e-mail n’est pas valide.');
    expect((await r.submitDirectoryRequest('a-troyes', { ...ok, lastName: '  ' })).error).toBe('Indiquez votre prénom et votre nom.');
    expect((await r.submitDirectoryRequest('a-troyes', { ...ok, firstName: '' })).error).toBe('Indiquez votre prénom et votre nom.');
    expect(await count()).toBe(0);
  });
});
