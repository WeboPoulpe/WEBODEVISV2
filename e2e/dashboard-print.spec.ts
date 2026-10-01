import { test, expect } from '@playwright/test';
import { createQuote, sql, withAccount } from './helpers';

// « À faire » imprimable : tâches avec case à cocher, événements, chiffres ; tient en A4 ; lien depuis le tableau de bord.

test('le à faire s’imprime : tâches, événements et chiffres, en A4', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'imprimer-a-faire', async (page, userId) => {
    await createQuote(userId, { client_name: 'Famille Martin', status: 'devis_a_faire', days: 10, event_type: 'Anniversaire' });
    const eventId = await createQuote(userId, { client_name: 'Société Lumen', status: 'valide', days: 5, event_type: 'Cocktail', guest_count: 60 });
    await sql(`update public.quotes set checklist = $2::jsonb where id = $1`, [eventId, JSON.stringify([{ id: 'a', text: 'Confirmer le lieu', done: false }])]);

    await page.goto('/');
    const link = page.getByRole('link', { name: /Imprimer/ });
    await expect(link).toHaveAttribute('href', '/tableau-de-bord/imprimer?auto');

    await page.goto('/tableau-de-bord/imprimer');
    await expect(page.getByRole('heading', { level: 1, name: 'À faire' })).toBeVisible();
    await expect(page.getByText('Famille Martin').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prochains événements' })).toBeVisible();
    await expect(page.locator('table.sheet').first().locator('tr.row')).not.toHaveCount(0);
    await expect(page.getByText('Chiffre d’affaires du mois')).toBeVisible();

    // En PDF A4 : la barre d'écran disparaît, le contenu tient dans la largeur.
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-toolbar')).toBeHidden();
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    if (process.env.PRINT_SHOT) { require('node:fs').writeFileSync(process.env.PRINT_SHOT + '.pdf', pdf); await page.setViewportSize({ width: 794, height: 1123 }); await page.screenshot({ path: process.env.PRINT_SHOT + '.png', fullPage: true }); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
