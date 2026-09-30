import { test, expect } from '@playwright/test';

// Parcours complet d'authentification sur la base Neon : inscription, connexion, accès à l'app.
test('inscription puis connexion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  const email = `e2e-${Date.now()}@test.webodevis.local`;
  const password = 'Test-e2e-123456';

  await page.goto('/register');
  await page.getByPlaceholder('Jean').fill('Test');
  await page.getByPlaceholder('Dupont').fill('E2E');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Compte créé avec succès')).toBeVisible({ timeout: 20_000 });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible({ timeout: 20_000 });

  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
});
