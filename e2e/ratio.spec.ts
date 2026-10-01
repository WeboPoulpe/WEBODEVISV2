import { test, expect } from '@playwright/test';
import { sql, withAccount } from './helpers';

// Quantité saisie comme on la dit : « 1 nappe pour 8 couverts » ; enregistrée par couvert (0,125), relue en ratio.

test('modèle de location : « 1 pour 8 couverts » se saisit, se calcule et se relit', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'ratio', async (page, userId) => {
    const [set] = await sql<{ id: string }>(`insert into public.rental_template_sets (user_id, name) values ($1, 'Dîner assis') returning id`, [userId]);
    await page.goto('/location-templates');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Ajouter un article' }).click();
    await page.locator('#tpl-name').fill('Nappe ronde perso');
    await page.locator('#tpl-qty').fill('1');
    await page.locator('#tpl-qty-per').fill('8');
    await expect(page.getByText('Pour 100 couverts : 13 pièces (arrondi au-dessus).')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('1 pièce pour 8 couverts')).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => Number((await sql<{ q: string }>(`select qty_per_guest as q from public.rental_templates where set_id = $1`, [set.id]))[0]?.q), { timeout: 15_000 })
      .toBe(0.125);

    // À la réouverture, le ratio revient tel quel.
    await page.getByRole('button', { name: 'Modifier Nappe ronde perso' }).click();
    await expect(page.locator('#tpl-qty')).toHaveValue('1');
    await expect(page.locator('#tpl-qty-per')).toHaveValue('8');
    await sql(`delete from public.rental_templates where set_id = $1`, [set.id]);
    await sql(`delete from public.rental_template_sets where id = $1`, [set.id]);
  });
});
