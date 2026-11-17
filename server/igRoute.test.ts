// Lien court /ig : compte le clic (sauf robot ou personne connectée) et redirige avec l'origine.
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const recordHit = vi.fn(async (_row: unknown) => {});
vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/server/session', () => ({ requireAdmin: async () => ({ id: 'admin' }) }));
vi.mock('@/server/siteStats', async (orig) => ({ ...(await orig<typeof import('@/server/siteStats')>()), recordHit: (r: unknown) => recordHit(r) }));

const { GET } = await import('@/app/ig/[[...libelle]]/route');

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest('https://webodevis.fr' + path, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone)', 'x-forwarded-for': '1.2.3.4', ...headers } });
const params = (libelle?: string[]) => ({ params: Promise.resolve(libelle ? { libelle } : {}) });

beforeEach(() => recordHit.mockClear());

it('bio : compte le clic et redirige vers la présentation', async () => {
  const res = await GET(req('/ig'), params());
  expect(res.status).toBe(302);
  expect(res.headers.get('location')).toBe('https://webodevis.fr/site?o=instagram');
  expect(recordHit).toHaveBeenCalledWith(expect.objectContaining({ event: 'clic', origin: 'instagram', path: '/ig', source: 'reseaux' }));
});

it('story et destination', async () => {
  const res = await GET(req('/ig/lancement?vers=/demo'), params(['lancement']));
  expect(res.headers.get('location')).toBe('https://webodevis.fr/demo?o=instagram%3Alancement');
  expect(recordHit).toHaveBeenCalledWith(expect.objectContaining({ origin: 'instagram:lancement', path: '/ig/lancement' }));
});

it('destination avec paramètres : conservés', async () => {
  const res = await GET(req('/ig?vers=' + encodeURIComponent('/tarifs?x=1')), params());
  expect(res.headers.get('location')).toBe('https://webodevis.fr/tarifs?x=1&o=instagram');
});

it('destination externe refusée', async () => {
  for (const vers of ['//exemple.com', 'https://exemple.com', '/\\exemple.com']) {
    const res = await GET(req('/ig?vers=' + encodeURIComponent(vers)), params());
    expect(res.headers.get('location')).toBe('https://webodevis.fr/site?o=instagram');
  }
});

it('connecté : redirigé sans compter', async () => {
  const res = await GET(req('/ig', { cookie: 'next-auth.session-token=x' }), params());
  expect(res.status).toBe(302);
  expect(recordHit).not.toHaveBeenCalled();
});

it('robot : redirigé sans compter', async () => {
  const res = await GET(req('/ig', { 'user-agent': 'facebookexternalhit/1.1' }), params());
  expect(res.status).toBe(302);
  expect(recordHit).not.toHaveBeenCalled();
});
