import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import OriginPill from './OriginPill';
import InstagramBlock from './InstagramBlock';
import type { InstagramStats } from '@/server/siteStats';

it('pastille : rien sans origine', () => {
  expect(renderToStaticMarkup(<OriginPill origin={null} />)).toBe('');
});

it('pastille : libellé lisible', () => {
  expect(renderToStaticMarkup(<OriginPill origin="instagram:lancement" />)).toContain('Instagram · lancement');
});

const stats: InstagramStats = {
  days: 30,
  totals: { clics: 84, visiteurs: 71, demos: 12, contacts: 3, inscriptions: 2 },
  daily: [{ day: '2026-12-01', clics: 40 }, { day: '2026-12-02', clics: 44 }],
  liens: [{ origin: 'instagram', clics: 61 }, { origin: 'instagram:lancement', clics: 23 }],
  personnes: [{ kind: 'demo', id: 'r1', name: 'Camille Martin', company: 'Traiteur Martin', origin: 'instagram', at: '2026-12-12T10:00:00.000Z' }],
};

it('bloc : tuiles, liens et personnes', () => {
  const html = renderToStaticMarkup(<InstagramBlock stats={stats} />);
  for (const t of ['Clics', '84', 'Demandes de démo', '12', 'Instagram · bio', '61', 'Camille Martin', 'Traiteur Martin', '/admin/demandes']) expect(html).toContain(t);
});

it('bloc vide : message simple', () => {
  const empty: InstagramStats = { ...stats, totals: { clics: 0, visiteurs: 0, demos: 0, contacts: 0, inscriptions: 0 }, liens: [], personnes: [] };
  expect(renderToStaticMarkup(<InstagramBlock stats={empty} />)).toContain('webodevis.fr/ig');
});
