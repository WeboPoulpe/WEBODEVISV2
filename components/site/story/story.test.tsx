import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { euros } from '@/lib/pricing';
import { CHECKED, CHECKLIST, CREW, MARGIN, REQUESTS } from '@/lib/site/story';
import AutoChecklist from './AutoChecklist';
import CrewPhones from './CrewPhones';
import Julien from './Julien';
import LockScreen from './LockScreen';
import MarginCounter from './MarginCounter';
import QuoteStepper from './QuoteStepper';

// Ce que le visiteur lit avant que le moindre script ait tourné : tout doit déjà y être, dans l'état final.
describe('visuels de l’histoire, sans script', () => {
  it('affiche les six demandes', () => {
    const html = renderToStaticMarkup(<LockScreen />);
    for (const r of REQUESTS) expect(html).toContain(r.text);
  });

  it('affiche la checklist déjà cochée', () => {
    const html = renderToStaticMarkup(<AutoChecklist />);
    for (const line of CHECKLIST) expect(html).toContain(line);
    expect(html.match(/data-done="true"/g)).toHaveLength(CHECKED);
  });

  it('affiche la marge à sa valeur finale', () => {
    expect(renderToStaticMarkup(<MarginCounter />)).toContain(euros(MARGIN));
  });

  it('affiche le devis à 120 convives', () => {
    expect(renderToStaticMarkup(<QuoteStepper />)).toContain(euros(10824));
  });

  it('affiche la mission de chaque extra', () => {
    const html = renderToStaticMarkup(<CrewPhones />);
    for (const c of CREW) expect(html).toContain(c.name);
  });

  it('cache Julien aux lecteurs d’écran, sauf quand on le décrit', () => {
    expect(renderToStaticMarkup(<Julien pose="bureau" />)).toContain('aria-hidden="true"');
    const named = renderToStaticMarkup(<Julien pose="cafe" title="Julien, traiteur" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('Julien, traiteur');
  });
});
