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
    // Les échecs de chargement sont relevés par requête (on sait alors ce qui a échoué), pas par la console.
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console : ${m.text().slice(0, 200)}`); });
    page.on('requestfailed', (r) => {
      // Photos hébergées sur Vercel Blob : ce poste est parfois limité par Vercel après des envois en série ; ce n'est pas l'app.
      if (r.resourceType() === 'image' && /vercel-storage.com/.test(r.url())) return;
      errors.push(`réseau : ${r.resourceType()} ${new URL(r.url()).pathname.slice(0, 80)} ${r.failure()?.errorText ?? ''}`);
    });
    page.on('response', (r) => { if (r.status() >= 500) errors.push(`réseau : ${r.status()} ${new URL(r.url()).pathname.slice(0, 80)}`); });
    // Toute requête de données refusée ou en erreur côté serveur fait échouer le test.
    page.on('response', async (r) => {
      if (!r.url().endsWith('/api/db')) return;
      const body = await r.json().catch(() => null);
      for (const result of body?.results ?? []) if (result?.error) errors.push(`données : ${result.error.message}`);
      if (body?.error) errors.push(`données : ${body.error}`);
    });

    await page.goto(path);
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('networkidle');
    // Les gabarits de chargement doivent avoir laissé place au contenu.
    await expect.soft(page.locator('.animate-pulse'), 'chargement qui ne se termine pas').toHaveCount(0, { timeout: 20_000 });
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
