import { describe, expect, it } from 'vitest';
import { SHOW_RELEASES } from './config';
import { FOOTER, MENU, MENU_LINKS, SITEMAP } from './pages';

describe('page Nouveautés masquée', () => {
  it('n’apparaît dans aucun lien ni dans le sitemap tant qu’elle est éteinte', () => {
    if (SHOW_RELEASES) return;
    const all = JSON.stringify({ MENU, MENU_LINKS, FOOTER, SITEMAP });
    expect(all).not.toContain('/nouveautes');
  });
});
