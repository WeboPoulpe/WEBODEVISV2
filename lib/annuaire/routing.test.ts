import { describe, expect, it } from 'vitest';
import { directoryAuthBlock, directoryHref, directoryRewrite, isDirectoryHost } from './routing';

// Aiguillage des adresses entre webodevis.fr et l'annuaire « Choisir Mon Traiteur ».

const H = 'choisirmontraiteur.fr';

describe('directoryRewrite', () => {
  it('réécrit les pages de l’annuaire', () => {
    expect(directoryRewrite(H, '/', H)).toEqual({ kind: 'rewrite', to: '/annuaire' });
    expect(directoryRewrite(`www.${H}`, '/traiteur/a-troyes', H)).toEqual({ kind: 'rewrite', to: '/annuaire/traiteur/a-troyes' });
    expect(directoryRewrite(`${H}:443`, '/sitemap.xml', H)).toEqual({ kind: 'rewrite', to: '/annuaire/sitemap.xml' });
    expect(directoryRewrite(H, '/robots.txt', H)).toEqual({ kind: 'rewrite', to: '/annuaire/robots.txt' });
  });

  it('laisse passer l’API, les fichiers et les brochures', () => {
    for (const p of ['/api/stats', '/_next/static/x.js', '/icons/a.png', '/b/abc', '/embed/b/abc', '/sw.js']) expect(directoryRewrite(H, p, H)).toBeNull();
    expect(directoryRewrite(H, '/manifest.webmanifest', H)).toBeNull();
    expect(directoryRewrite(H, '/annuaire/logo-pourpre.png', H)).toBeNull();
    expect(directoryRewrite(H, '/annuaire/icone-192.png', H)).toBeNull();
  });

  it('retire le préfixe en double et renvoie webodevis.fr vers l’annuaire', () => {
    expect(directoryRewrite(H, '/annuaire/traiteurs', H)).toEqual({ kind: 'redirect', to: '/traiteurs' });
    expect(directoryRewrite(H, '/annuaire', H)).toEqual({ kind: 'redirect', to: '/' });
    expect(directoryRewrite('webodevis.fr', '/annuaire/traiteur/a', H)).toEqual({ kind: 'redirect', to: `https://${H}/traiteur/a` });
    expect(directoryRewrite('www.webodevis.fr', '/annuaire', H)).toEqual({ kind: 'redirect', to: `https://${H}/` });
  });

  it('ne touche à rien ailleurs', () => {
    expect(directoryRewrite('webodevis.fr', '/tarifs', H)).toBeNull();
    expect(directoryRewrite('webodevis.fr', '/annuaires', H)).toBeNull();
    expect(directoryRewrite('localhost:3001', '/annuaire', H)).toBeNull();
    expect(directoryRewrite('mon-apercu.vercel.app', '/annuaire/traiteurs', H)).toBeNull();
    expect(directoryRewrite(H, '/', undefined)).toBeNull();
    expect(directoryRewrite(null, '/', H)).toBeNull();
  });

  it('les écrans de l’app ne s’ouvrent pas sur l’hôte de l’annuaire', () => {
    expect(directoryRewrite(H, '/login', H)).toEqual({ kind: 'rewrite', to: '/annuaire/login' });
    expect(directoryRewrite(H, '/admin/annuaire', H)).toEqual({ kind: 'rewrite', to: '/annuaire/admin/annuaire' });
  });
});

describe('isDirectoryHost', () => {
  it('reconnaît l’hôte avec ou sans www et port', () => {
    expect(isDirectoryHost(`www.${H}:3000`, H)).toBe(true);
    expect(isDirectoryHost('WEBODEVIS.fr', H)).toBe(false);
    expect(isDirectoryHost(H, undefined)).toBe(false);
  });
});

describe('directoryHref', () => {
  it('pose le préfixe seulement hors de l’hôte de l’annuaire', () => {
    expect(directoryHref('', '/')).toBe('/');
    expect(directoryHref('', '/traiteurs')).toBe('/traiteurs');
    expect(directoryHref('/annuaire', '/')).toBe('/annuaire');
    expect(directoryHref('/annuaire', '/traiteur/a')).toBe('/annuaire/traiteur/a');
  });
});

describe('directoryAuthBlock', () => {
  it('aucune session WeboDevis, donc aucun cookie, sur l’hôte de l’annuaire', () => {
    expect(directoryAuthBlock(H, '/api/auth/session', H)).toBe('empty-session');
    expect(directoryAuthBlock(`www.${H}`, '/api/auth/csrf', H)).toBe('not-found');
    expect(directoryAuthBlock(H, '/api/stats', H)).toBeNull();
    expect(directoryAuthBlock('webodevis.fr', '/api/auth/session', H)).toBeNull();
    expect(directoryAuthBlock(H, '/api/auth/session', undefined)).toBeNull();
  });
});
