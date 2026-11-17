import { test, expect } from '@playwright/test';

// Lien court Instagram : /ig/<libellé> compte le clic, renvoie vers la page voulue, et l'origine suit la visite
// (sessionStorage) sans rester dans l'adresse. Demande la migration 0059 appliquée sur la base du serveur de test.

test.use({ storageState: { cookies: [], origins: [] } });

test('un lien /ig mène à la démo et l’origine suit la visite', async ({ page }) => {
  await page.goto('/ig/test-e2e?vers=/demo');
  await expect(page).toHaveURL(/\/demo$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('wd-origine'))).toBe('instagram:test-e2e');
});

test('une destination externe est refusée', async ({ page }) => {
  await page.goto('/ig?vers=' + encodeURIComponent('//exemple.com'));
  await expect(page).toHaveURL(/localhost:3001\/(site)?$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('wd-origine'))).toBe('instagram');
});
