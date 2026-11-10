import { describe, expect, it } from 'vitest';
import { cleanPath, deviceOf, isBot, sourceOf } from './siteStats';

describe('statistiques du site', () => {
  it('classe la provenance', () => {
    expect(sourceOf('', 'webodevis.fr')).toEqual({ source: 'direct', host: null });
    expect(sourceOf('https://www.webodevis.fr/tarifs', 'webodevis.fr')).toEqual({ source: 'direct', host: null });
    expect(sourceOf('https://www.google.fr/', 'webodevis.fr')).toEqual({ source: 'recherche', host: 'google.fr' });
    expect(sourceOf('https://duckduckgo.com/', 'webodevis.fr').source).toBe('recherche');
    expect(sourceOf('https://l.instagram.com/', 'webodevis.fr').source).toBe('reseaux');
    expect(sourceOf('https://www.linkedin.com/feed', 'webodevis.fr').source).toBe('reseaux');
    expect(sourceOf('https://www.webomax.fr/', 'webodevis.fr')).toEqual({ source: 'site', host: 'webomax.fr' });
    expect(sourceOf('pas une url', 'webodevis.fr').source).toBe('direct');
  });

  it('reconnaît l’appareil', () => {
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148')).toBe('mobile');
    expect(deviceOf('Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36')).toBe('mobile');
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('tablette');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0')).toBe('ordinateur');
  });

  it('écarte les robots', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('Mozilla/5.0 (Windows NT 10.0) HeadlessChrome/140')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0')).toBe(false);
  });

  it('nettoie le chemin', () => {
    expect(cleanPath('/tarifs?utm_source=x#faq')).toBe('/tarifs');
    expect(cleanPath('/fonctionnalites/devis')).toBe('/fonctionnalites/devis');
    expect(cleanPath('https://autre.fr/')).toBeNull();
    expect(cleanPath('/<script>')).toBeNull();
  });
});
