import { test, expect } from '@playwright/test';
import { shot, horizontalOverflow } from './helpers';

// Pages accessibles sans être connecté.
test.describe('pages publiques', () => {
  test('login : s\'affiche sans débordement', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await shot(page, testInfo, 'login');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('register : s\'affiche sans débordement', async ({ page }, testInfo) => {
    await page.goto('/register');
    await shot(page, testInfo, 'register');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('lien extra /e/<token> : ne doit pas renvoyer vers /login', async ({ page }) => {
    // Le lien copié depuis la page Extras est destiné à quelqu'un qui n'a pas de compte.
    await page.goto('/e/jeton-inexistant');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('une page privée renvoie vers /login', async ({ page }) => {
    await page.goto('/evenements');
    await expect(page).toHaveURL(/\/login/);
  });
});
