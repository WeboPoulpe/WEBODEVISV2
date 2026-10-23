import { test, expect, type Browser } from '@playwright/test';
import { horizontalOverflow, sql, withAccount } from './helpers';

// WeboCoins : solde dans l'en-tête, page « Mes WeboCoins », choix de la traduction. Comptes d'essai jetables.

test.describe('WeboCoins', () => {
  test('solde dans l’en-tête, page Mes WeboCoins, pièces offertes au journal', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(150_000);
    await withAccount(browser, 'webocoins', async (page, userId) => {
      await page.goto('/');
      await expect(page.getByLabel('Solde : 200 WeboCoins')).toBeVisible({ timeout: 20_000 });

      await sql(`update public.webo_wallets set kept_coins = kept_coins + 50 where company_id = $1`, [userId]);
      await sql(`insert into public.webo_ledger (company_id, kind, coins, reason) values ($1, 'gift', 50, 'Geste commercial')`, [userId]);
      await page.reload();
      await expect(page.getByLabel('Solde : 250 WeboCoins')).toBeVisible({ timeout: 20_000 });

      await page.getByLabel('Solde : 250 WeboCoins').click();
      await expect(page).toHaveURL(/\/parametres\/webocoins/);
      await expect(page.getByText('200 pièces du mois')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Renouvelées le/)).toBeVisible();
      await expect(page.getByText('Geste commercial')).toBeVisible();
      await expect(page.getByRole('button', { name: /Recharger/ })).toBeDisabled();
      await expect(page.getByText('bientôt', { exact: false }).first()).toBeVisible();
      await page.screenshot({ path: 'e2e/screenshots/webocoins-page-desktop.png', fullPage: true });

      await page.goto('/parametres');
      const mode = page.getByRole('group', { name: 'Traduction des prestations' });
      await expect(mode.getByRole('button', { name: /Webo/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
      await mode.getByRole('button', { name: /Gratuite/ }).click();
      await expect(mode.getByRole('button', { name: /Gratuite/ })).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(page.getByRole('group', { name: 'Traduction des prestations' }).getByRole('button', { name: /Gratuite/ }))
        .toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });

      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto('/parametres/webocoins');
      await expect(page.getByText('200 pièces du mois')).toBeVisible({ timeout: 20_000 });
      expect(await horizontalOverflow(page)).toBe(0);
      await page.screenshot({ path: 'e2e/screenshots/webocoins-page-mobile.png', fullPage: true });
    });
  });
});
