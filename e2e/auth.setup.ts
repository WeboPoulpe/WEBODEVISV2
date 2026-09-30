import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { AUTH_FILE } from '../playwright.config';

// Connexion une seule fois avec le compte de test ; la session est réutilisée par tous les tests.
setup('connexion compte de test', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    // Pas de compte de test : session vide, les tests authentifiés se sautent d'eux-mêmes.
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(true, 'TEST_EMAIL / TEST_PASSWORD absents de .env.local');
    return;
  }

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
