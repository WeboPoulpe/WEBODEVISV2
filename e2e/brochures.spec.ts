import { test, expect, type Browser } from '@playwright/test';
import { createAccount, deleteAccount, horizontalOverflow, sql, withAccount } from './helpers';

// Brochures : le lien public se feuillette, sans compte. Chaque test travaille sur un compte d'essai créé pour lui,
// puis supprimé : aucun compte réel n'est touché.

async function brochureAccount(kind: string) {
  const user = await createAccount(kind, { companyName: 'Traiteur Feuilleté' });
  const [p] = await sql<{ id: string }>(
    `insert into public.prestations (user_id, name, unit_price, category, description) values ($1, 'Menu Tentation', 76, 'dîner', '<p>Entrée, plat, dessert</p>') returning id`,
    [user.id]);
  const token = `jeton-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [b] = await sql<{ id: string }>(
    `insert into public.brochures (owner_user_id, user_id, name, share_token, cover, content)
     values ($1, $1, 'Mariages 2027', $2, $3::jsonb, $4::jsonb) returning id`,
    [user.id, token, JSON.stringify({ title: 'Mariages 2027' }),
      JSON.stringify({ about: { enabled: false, html: '' }, contact: { enabled: true }, sections: [{ id: 's1', title: 'Nos menus', items: [{ prestationId: p.id }] }] })]);
  return { user, token, brochureId: b.id, prestationId: p.id };
}

test.describe('brochures', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit'); });

  test('le lien public se feuillette, page par page sur téléphone', async ({ browser }: { browser: Browser }) => {
    const t = await brochureAccount('brochure-lien');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    try {
      const page = await context.newPage();
      await page.goto(`/b/${t.token}`);
      await expect(page.getByRole('heading', { name: 'Mariages 2027' })).toBeVisible({ timeout: 20_000 });
      await page.keyboard.press('ArrowRight');
      await expect(page.getByText('Menu Tentation').first()).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);
      await page.waitForTimeout(800); // fin de la page qui tourne, pour la capture
      await page.screenshot({ path: 'e2e/screenshots/brochure-mobile.png' });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/b/${t.token}`);
      await expect(page.getByRole('heading', { name: 'Mariages 2027' })).toBeVisible();
      await page.screenshot({ path: 'e2e/screenshots/brochure-desktop.png' });

      await page.goto('/b/jetonInconnu1234567890');
      await expect(page.getByText('Cette brochure n’est plus disponible')).toBeVisible();
    } finally {
      await context.close();
      await deleteAccount(t.user.id);
    }
  });
  test('créer une brochure depuis la liste', async ({ browser }: { browser: Browser }) => {
    await withAccount(browser, 'brochure-liste', async (page) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto('/brochures');
      await page.getByRole('button', { name: 'Nouvelle brochure' }).click();
      await page.getByLabel('Nom de la brochure').fill('Mariages 2027');
      await page.getByRole('button', { name: 'Créer', exact: true }).click();
      await expect(page).toHaveURL(/\/brochures\/[0-9a-f-]{36}/, { timeout: 15_000 });
      await page.goto('/brochures');
      const card = page.getByRole('listitem').filter({ hasText: 'Mariages 2027' });
      await expect(card).toContainText('Éditorial');
      await expect(card).toContainText('0 ouverture');
      await card.getByRole('button', { name: 'Copier le lien' }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/b\/[A-Za-z0-9_-]{16,}$/);
      await page.setViewportSize({ width: 360, height: 780 });
      await page.reload();
      await expect(page.getByRole('listitem').filter({ hasText: 'Mariages 2027' })).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);
      await page.screenshot({ path: 'e2e/screenshots/brochures-liste-mobile.png' });
    });
  });
});
