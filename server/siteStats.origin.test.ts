// Origine Instagram dans la mesure d'audience (lib/origine.ts).
import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('./session', () => ({ requireAdmin: async () => ({ id: 'admin' }) }));

const { buildRow } = await import('./siteStats');
const ctx = { ip: '1.2.3.4', userAgent: 'Mozilla/5.0 (iPhone)', ownHost: 'webodevis.fr' };

it('origine valide : écrite, source réseaux', () => {
  expect(buildRow({ path: '/site', origin: 'instagram:lancement' }, ctx)).toMatchObject({ origin: 'instagram:lancement', source: 'reseaux' });
});

it('origine invalide : ignorée, provenance inchangée', () => {
  const r = buildRow({ path: '/site', origin: 'facebook' }, ctx);
  expect(r?.origin).toBeNull();
  expect(r?.source).toBe('direct');
});

it('sans origine : rien ne change', () => {
  expect(buildRow({ path: '/site', referrer: 'https://www.google.com/' }, ctx)).toMatchObject({ origin: null, source: 'recherche' });
});

it('événement clic accepté', () => {
  expect(buildRow({ path: '/ig', event: 'clic', origin: 'instagram' }, ctx)?.event).toBe('clic');
});
