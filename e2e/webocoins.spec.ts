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

  // Serveur lancé avec WEBO_FAKE=1 : Webo « traduit » en préfixant « EN », sans appel payant. Le service gratuit est
  // simulé dans le navigateur.
  test('traduire une prestation avec Webo débite 1 pièce ; en gratuit, rien', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(150_000);
    await withAccount(browser, 'webocoins-traduction', async (page, userId) => {
      await page.route('**/api.mymemory.translated.net/**', (route) => route.fulfill({
        contentType: 'application/json', body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'Free cheese platter' } }),
      }));
      const [p] = await sql<{ id: string }>(`insert into public.prestations (user_id, name, unit_price, category, description) values ($1, 'Plateau de fromages', 9, 'dîner', '<p>Fromages affinés</p>') returning id`, [userId]);
      await page.goto(`/prestations/${p.id}`);
      await expect(page.getByLabel('Nom de la prestation')).toHaveValue('Plateau de fromages', { timeout: 30_000 });
      await expect(page.getByLabel('Solde : 200 WeboCoins')).toBeVisible({ timeout: 20_000 });

      await page.getByRole('tab', { name: 'Anglais' }).click();
      await page.getByRole('button', { name: 'Traduire avec Webo · 1 W' }).click();
      const english = page.getByRole('textbox', { name: 'Texte de la carte, en anglais' });
      await expect(english).toContainText('EN ', { timeout: 20_000 });
      await expect(page.getByLabel('Solde : 199 WeboCoins')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: 'e2e/screenshots/webocoins-traduction-desktop.png' });

      await page.getByRole('button', { name: 'Retraduire (gratuit)' }).click();
      await page.getByRole('button', { name: 'Remplacer' }).click();
      await expect(english).toContainText('Free cheese platter', { timeout: 20_000 });
      await expect(page.getByLabel('Solde : 199 WeboCoins')).toBeVisible();
      const [row] = await sql<{ n: string }>(`select count(*) n from public.webo_ledger where company_id = $1 and kind = 'debit'`, [userId]);
      expect(Number(row.n)).toBe(1);
    });
  });

  test('WeboWord en anglais : pièces annoncées, fiches traduites par Webo, solde débité', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(180_000);
    await withAccount(browser, 'webocoins-weboword', async (page, userId) => {
      const lines = [
        { id: 'l1', name: 'Dîner trois plats', description: '<p>Entrée, plat, dessert</p>', quantity: 40, unitPrice: 50 },
        { id: 'l2', name: 'Forfait boissons', description: '<p>Vins et softs</p>', quantity: 40, unitPrice: 10 },
      ];
      const [q] = await sql<{ id: string }>(
        `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services, vat_rate)
         values ($1, $1, 'Client Essai', current_date + 60, 'Mariage', 40, 'devis_a_faire', $2::jsonb, 10) returning id`, [userId, JSON.stringify(lines)]);
      await page.goto(`/devis/${q.id}/modifier?mode=weboword`);
      await expect(page.locator('#weboword-sheet [data-webo-intro]')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByLabel('Solde : 200 WeboCoins')).toBeVisible({ timeout: 20_000 });
      await page.getByRole('link', { name: 'Style', exact: true }).first().click();
      await page.getByRole('button', { name: 'English' }).click();
      await page.getByRole('button', { name: 'Appliquer' }).first().click();
      await expect(page.getByRole('dialog', { name: '2 fiches à traduire · 2 W' })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Traduire avec Webo' }).click();
      await expect.poll(async () => (await sql<{ content_html: string | null }>(`select content_html from public.quotes where id = $1`, [q.id]))[0].content_html ?? '', { timeout: 60_000 })
        .toContain('EN ');
      await expect(page.getByText(/2 fiches traduites par Webo \(2 W\)/)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByLabel('Solde : 198 WeboCoins')).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: 'e2e/screenshots/webocoins-weboword-desktop.png' });
    });
  });
});
