import { test, expect } from '@playwright/test';
import { AUTH_FILE } from '../playwright.config';
import { hasTestAccount, shot, horizontalOverflow, offscreenElements } from './helpers';

// Tour de toutes les pages de l'app avec le compte de test : capture + débordement + erreurs console.
const PAGES: { name: string; path: string }[] = [
  { name: 'accueil', path: '/' },
  { name: 'devis', path: '/devis' },
  { name: 'devis-nouveau', path: '/devis/nouveau' },
  { name: 'clients', path: '/clients' },
  { name: 'prospects', path: '/prospects' },
  { name: 'calendrier', path: '/calendrier' },
  { name: 'evenements', path: '/evenements' },
  { name: 'prestations', path: '/prestations' },
  { name: 'ingredients', path: '/ingredients' },
  { name: 'fournisseurs', path: '/fournisseurs' },
  { name: 'commandes', path: '/commandes' },
  { name: 'stock', path: '/stock' },
  { name: 'extras', path: '/extras' },
  { name: 'courses-globales', path: '/courses-globales' },
  { name: 'location-globale', path: '/location-globale' },
  { name: 'location-templates', path: '/location-templates' },
  { name: 'modeles', path: '/modeles' },
  { name: 'notifications', path: '/notifications' },
  { name: 'parametres', path: '/parametres' },
  { name: 'parametres-categories', path: '/parametres/categories' },
];

test.use({ storageState: AUTH_FILE });
test.skip(!hasTestAccount, 'TEST_EMAIL / TEST_PASSWORD absents de .env.local');

for (const { name, path } of PAGES) {
  test(`${name} : s'affiche sans débordement ni erreur`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`exception : ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console : ${m.text().slice(0, 200)}`); });
    // Toute requête de données refusée ou en erreur côté serveur fait échouer le test.
    page.on('response', async (r) => {
      if (!r.url().endsWith('/api/db')) return;
      const body = await r.json().catch(() => null);
      if (body?.error) errors.push(`données : ${body.error.message}`);
    });

    await page.goto(path);
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('networkidle');
    await shot(page, testInfo, name);

    const overflow = await horizontalOverflow(page);
    const offscreen = await offscreenElements(page);
    expect.soft(overflow, `déborde de ${overflow}px`).toBe(0);
    expect.soft(offscreen, 'éléments hors écran à droite').toEqual([]);
    expect.soft(errors, 'erreurs console / réseau').toEqual([]);
  });
}

// La fiche d'un événement : on ouvre le premier de la liste, puis chaque onglet.
test('fiche événement : chaque onglet s\'affiche', async ({ page }, testInfo) => {
  await page.goto('/evenements');
  await page.waitForLoadState('networkidle');
  const first = page.locator('a[href^="/evenements/"]').first();
  test.skip((await first.count()) === 0, 'le compte de test n\'a aucun événement');
  await first.click();
  await expect(page).toHaveURL(/\/evenements\/[^/]+$/);
  await page.waitForLoadState('networkidle');

  const tabs = page.getByRole('tablist', { name: 'Préparation de l\'événement' }).getByRole('tab');
  await expect(tabs).toHaveCount(4, { timeout: 20_000 });
  for (let i = 0; i < 4; i++) {
    await tabs.nth(i).click();
    await page.waitForLoadState('networkidle');
    await shot(page, testInfo, `evenement-onglet-${i + 1}`);
    const offscreen = await offscreenElements(page);
    expect.soft(offscreen, `onglet ${i + 1} : éléments hors écran`).toEqual([]);
  }
});
