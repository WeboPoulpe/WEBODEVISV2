import { test, expect, type Browser } from '@playwright/test';
import { horizontalOverflow, sql, withAccount } from './helpers';

// Assistant Webo : serveur lancé avec WEBO_FAKE=1 (spécialistes simulés, aucun appel payant). Comptes d'essai jetables.

const ASK = 'Prépare un devis pour le mariage de Claire Dupont, 50 personnes le 12 juin 2027, menu Tentation, claire@exemple.fr';

test.describe('assistant Webo', () => {
  test('demander un devis, le valider ; une autre proposition annulée ne crée rien', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(180_000);
    await withAccount(browser, 'webo-assistant', async (page, userId) => {
      await sql(`insert into public.prestations (user_id, name, unit_price, category) values ($1, 'Menu Tentation', 76, 'dîner')`, [userId]);
      await page.goto('/');
      await expect(page.getByLabel('Solde : 200 WeboCoins')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      const panel = page.getByRole('dialog', { name: 'Webo' });
      await expect(panel).toBeVisible();

      await panel.getByRole('textbox', { name: 'Votre message à Webo' }).fill(ASK);
      await panel.getByRole('button', { name: 'Envoyer' }).click();
      const card = panel.getByRole('article', { name: 'Nouveau devis' });
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText('Claire Dupont');
      await expect(card).toContainText('50');
      await expect(card).toContainText('Menu Tentation');
      await page.screenshot({ path: 'e2e/screenshots/webo-assistant-desktop.png' });
      expect(Number((await sql<{ n: string }>(`select count(*) n from public.quotes where owner_user_id = $1`, [userId]))[0].n)).toBe(0);

      await card.getByRole('button', { name: 'Valider' }).click();
      await expect(card.getByRole('link', { name: 'Ouvrir le devis' })).toBeVisible({ timeout: 20_000 });
      const [q] = await sql<{ guest_count: number; status: string }>(`select guest_count, status from public.quotes where owner_user_id = $1`, [userId]);
      expect(q).toMatchObject({ guest_count: 50, status: 'devis_a_faire' });
      await expect(page.getByLabel(/^Solde : 19\d WeboCoins$/)).toBeVisible({ timeout: 15_000 });

      await panel.getByRole('textbox', { name: 'Votre message à Webo' }).fill(ASK.replace('Claire Dupont', 'Paul Martin'));
      await panel.getByRole('button', { name: 'Envoyer' }).click();
      const second = panel.getByRole('article', { name: 'Nouveau devis' }).last();
      await expect(second).toContainText('Paul Martin', { timeout: 30_000 });
      await second.getByRole('button', { name: 'Annuler' }).click();
      await expect(second).toContainText('Annulée');
      expect(Number((await sql<{ n: string }>(`select count(*) n from public.quotes where owner_user_id = $1`, [userId]))[0].n)).toBe(1);

      // L'historique garde la conversation.
      await page.reload();
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      await expect(page.getByRole('dialog', { name: 'Webo' }).getByText('Paul Martin').first()).toBeVisible({ timeout: 20_000 });
    });
  });

  test('Paramètres : ce que Webo retient, et l’oublier', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    await withAccount(browser, 'webo-memoire', async (page, userId) => {
      await sql(`insert into public.webo_memories (company_id, text) values ($1, 'Acompte toujours à 40 %')`, [userId]);
      await page.goto('/parametres');
      const list = page.getByRole('list', { name: 'Ce que Webo retient' });
      await expect(list).toContainText('Acompte toujours à 40 %', { timeout: 30_000 });
      await page.getByRole('button', { name: 'Oublier « Acompte toujours à 40 % »' }).click();
      await expect(page.getByText('Rien pour l’instant.')).toBeVisible();
      expect(await sql(`select 1 from public.webo_memories where company_id = $1`, [userId])).toHaveLength(0);
    });
  });

  test('téléphone : la bulle et le panneau plein écran, sans débordement', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    await withAccount(browser, 'webo-assistant-tel', async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      const panel = page.getByRole('dialog', { name: 'Webo' });
      await expect(panel).toBeVisible({ timeout: 20_000 });
      const box = await panel.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(355);
      expect(await horizontalOverflow(page)).toBe(0);
      await page.screenshot({ path: 'e2e/screenshots/webo-assistant-mobile.png' });
    }, { viewport: { width: 360, height: 780 } });
  });
});
