import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { REQUESTS_PER_HOUR } from '@/lib/annuaire/config';

// Demande de contact depuis une fiche de l'annuaire, sur le vrai schéma en mémoire.

vi.mock('server-only', () => ({}));
let visitorIp = '203.0.113.9';
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': visitorIp, 'user-agent': 'Test', host: 'choisirmontraiteur.fr' }),
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
  visitorIp = '203.0.113.9';
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

  it('l’accusé de réception est signé Choisir Mon Traiteur', async () => {
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
    const ack = sent.find((m) => m.to === 'marie@exemple.fr')!;
    expect(ack.html).toContain('Votre demande a été transmise à Traiteur A par Choisir Mon Traiteur.');
    expect(ack.html).not.toContain('WeboDevis');
  });

  it('un type d’événement hors de la liste n’est pas gardé', async () => {
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, eventType: 'Gagnez 1000 € sur https://x.example' })).toEqual({ error: null });
    expect((await pg.query(`select event_type from prospect_requests`)).rows).toEqual([{ event_type: null }]);
    expect(sent.map((m) => m.to).sort()).toEqual(['contact@traiteur-a.fr', 'marie@exemple.fr']);
    expect(sent.every((m) => !m.html.includes('Gagnez'))).toBe(true);
    await r.submitDirectoryRequest('a-troyes', { ...ok, eventType: 'Cocktail' });
    expect((await pg.query(`select event_type from prospect_requests order by created_at`)).rows.map((x) => (x as { event_type: string }).event_type)).toContain('Cocktail');
  });

  it('un lien dans le prénom, le nom ou le lieu : demande gardée, aucun e-mail', async () => {
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, firstName: 'Gagnez sur https://spam.example' })).toEqual({ error: null });
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, lastName: 'www.spam.example' })).toEqual({ error: null });
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, location: 'spam.example/promo' })).toEqual({ error: null });
    const { rows } = await pg.query(`select status, source from prospect_requests`);
    expect(rows).toEqual(Array(3).fill({ status: 'nouveau', source: 'annuaire' }));
    expect(sent).toEqual([]);
  });

  it('heure d’ouverture absente ou illisible : traité comme trop rapide', async () => {
    const { startedAt: _drop, ...noStart } = ok;
    expect(await r.submitDirectoryRequest('a-troyes', noStart as typeof ok)).toEqual({ error: null });
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, startedAt: 'hier' as unknown as number })).toEqual({ error: null });
    expect(await r.submitDirectoryRequest('a-troyes', { ...ok, startedAt: Number.NaN })).toEqual({ error: null });
    expect(await count()).toBe(0);
    expect(sent).toEqual([]);
  });

  it('16e demande dans l’heure depuis la même connexion, toutes fiches confondues : refusée', async () => {
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
    const { ip_hash: ipHash } = (await pg.query<{ ip_hash: string }>(`select ip_hash from prospect_requests`)).rows[0];
    // 14 autres demandes de la même connexion, adressées à d'autres traiteurs.
    for (let i = 0; i < 14; i++) {
      await pg.query(`insert into prospect_requests (first_name, last_name, email, owner_user_id, ip_hash, source) values ('X', 'Y', $1, $2, $3, 'annuaire')`,
        [`v${i}@exemple.fr`, i % 2 ? C : D, ipHash]);
    }
    sent.length = 0;
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: 'Vous avez déjà envoyé plusieurs demandes. Réessayez dans une heure.' });
    expect(await count()).toBe(15);
    expect(sent).toEqual([]);
    // Une autre connexion passe.
    visitorIp = '198.51.100.7';
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
  });

  it('au-delà de 5 demandes par jour pour une même adresse : le traiteur est prévenu, sans accusé de réception', async () => {
    const earlier = (n: number, source: string | null) => pg.query(
      `insert into prospect_requests (first_name, last_name, email, owner_user_id, ip_hash, source)
       select 'Marie', 'Dupont', 'marie@exemple.fr', $1, 'autre-connexion-' || g, $2 from generate_series(1, $3::int) g`, [D, source, n]);
    await earlier(4, 'annuaire');
    await earlier(3, null);
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
    expect(sent.map((m) => m.to).sort()).toEqual(['contact@traiteur-a.fr', 'marie@exemple.fr']);
    sent.length = 0;
    // La demande ci-dessus est la 5e venue de l'annuaire : la suivante n'a plus d'accusé.
    expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
    expect(sent.map((m) => m.to)).toEqual(['contact@traiteur-a.fr']);
    expect(await count()).toBe(9);
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
