import { test, expect, type Browser } from '@playwright/test';
import { createAccount, deleteAccount, horizontalOverflow, openSession, sql, withAccount } from './helpers';

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
  test('composer une brochure : prestations, style, prix, retouche', async ({ browser }: { browser: Browser }) => {
    await withAccount(browser, 'brochure-editeur', async (page, userId) => {
      const [menu] = await sql<{ id: string }>(`insert into public.prestations (user_id, name, unit_price, category, description) values ($1, 'Menu Tentation', 76, 'dîner', '<p>Entrée, plat, dessert</p>') returning id`, [userId]);
      await sql(`insert into public.prestations (user_id, name, unit_price, category, description) values ($1, 'Cocktail vin d''honneur', 14, 'cocktail', '<p>Huit pièces</p>')`, [userId]);
      const [b] = await sql<{ id: string }>(`insert into public.brochures (owner_user_id, user_id, name, share_token, cover) values ($1, $1, 'Mariages 2027', $2, '{"title":"Mariages 2027"}'::jsonb) returning id`,
        [userId, `jeton-e2e-editeur-${Date.now()}`]);
      await page.goto(`/brochures/${b.id}`);
      await expect(page.getByLabel('Nom de la brochure')).toHaveValue('Mariages 2027', { timeout: 20_000 });

      await page.getByRole('button', { name: 'Ajouter des prestations' }).click();
      await page.getByRole('checkbox', { name: /Menu Tentation/ }).check();
      await page.getByRole('checkbox', { name: /Cocktail vin d'honneur/ }).check();
      await page.getByRole('button', { name: 'Ajouter (2)' }).click();
      const composition = page.getByRole('region', { name: 'Composition' });
      await expect(composition).toContainText('Menu Tentation');
      await expect(composition).toContainText("Cocktail vin d'honneur");

      await page.getByRole('button', { name: 'Carte', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Afficher la page « qui sommes-nous »' }).uncheck();
      const preview = page.getByRole('region', { name: 'Aperçu de la brochure' });
      await preview.getByRole('button', { name: 'Page suivante' }).click();
      await expect(preview).toContainText('Menu Tentation');
      await expect(preview).toContainText('€');
      await page.getByRole('checkbox', { name: 'Afficher les prix' }).uncheck();
      await expect(preview).not.toContainText('€');

      await composition.getByRole('button', { name: 'Retoucher « Menu Tentation »' }).click();
      const editor = page.getByRole('textbox', { name: 'Texte de la prestation dans cette brochure' });
      await editor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('Texte de la brochure');
      await page.getByRole('button', { name: 'Valider' }).click();
      await expect(preview).toContainText('Texte de la brochure');

      await expect.poll(async () => JSON.stringify((await sql<{ content: unknown }>(`select content from public.brochures where id = $1`, [b.id]))[0].content), { timeout: 10_000 })
        .toContain('Texte de la brochure');
      expect((await sql<{ description: string }>(`select description from public.prestations where id = $1`, [menu.id]))[0].description).toBe('<p>Entrée, plat, dessert</p>');

      await page.screenshot({ path: 'e2e/screenshots/brochure-editeur-desktop.png' });

      // Un changement fait juste avant de quitter l'éditeur est quand même enregistré.
      await page.getByLabel('Nom de la brochure').fill('Mariages 2028');
      await page.getByRole('link', { name: 'Retour aux brochures' }).click();
      await expect.poll(async () => (await sql<{ name: string }>(`select name from public.brochures where id = $1`, [b.id]))[0].name, { timeout: 10_000 })
        .toBe('Mariages 2028');
      await page.goto(`/brochures/${b.id}`);
      await page.setViewportSize({ width: 360, height: 780 });
      await page.reload();
      await expect(page.getByLabel('Nom de la brochure')).toHaveValue('Mariages 2028', { timeout: 20_000 });
      expect(await horizontalOverflow(page)).toBe(0);
      await page.screenshot({ path: 'e2e/screenshots/brochure-editeur-mobile.png', fullPage: true });
    });
  });
  test('une demande depuis la dernière page arrive dans les Prospects', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    const t = await brochureAccount('brochure-demande');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    try {
      const page = await context.newPage();
      await page.goto(`/b/${t.token}`);
      await expect(page.getByRole('heading', { name: 'Mariages 2027' })).toBeVisible({ timeout: 20_000 });
      const next = page.getByRole('button', { name: 'Page suivante' });
      while (await next.isEnabled()) { await next.click(); await page.waitForTimeout(750); }
      // Sur téléphone, le formulaire est en plein écran.
      const sheet = page.getByRole('dialog');
      await sheet.getByLabel('Prénom').fill('Camille');
      // Revenir au livre, tourner les pages, revenir au formulaire : la saisie est toujours là.
      await sheet.getByRole('button', { name: 'Revenir au livre' }).click();
      await page.getByRole('button', { name: 'Page précédente' }).click();
      await page.waitForTimeout(750);
      await page.getByRole('button', { name: 'Page suivante' }).click();
      await page.waitForTimeout(750);
      await expect(sheet.getByLabel('Prénom')).toHaveValue('Camille');
      await sheet.getByLabel('Nom', { exact: true }).fill('Martin');
      await sheet.getByLabel('Email').fill(`camille-${Date.now()}@test.webodevis.local`);
      await sheet.getByLabel('Invités').fill('80');
      await sheet.getByRole('button', { name: 'Envoyer ma demande' }).click();
      await expect(sheet.getByText('Merci, votre demande est envoyée.')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: 'e2e/screenshots/brochure-formulaire-mobile.png' });
      const rows = await sql<{ brochure_id: string; guest_count: number }>(`select brochure_id, guest_count from public.prospect_requests where owner_user_id = $1`, [t.user.id]);
      expect(rows).toEqual([{ brochure_id: t.brochureId, guest_count: 80 }]);

      // Le traiteur voit, dans ses Prospects, de quelle brochure vient la demande.
      const owner = await openSession(browser, t.user);
      try {
        const op = await owner.newPage();
        await op.goto('/prospects');
        await expect(op.getByText('Brochure « Mariages 2027 »').first()).toBeVisible({ timeout: 20_000 });
      } finally {
        await owner.close();
      }
    } finally {
      await context.close();
      await sql(`delete from public.prospect_requests where owner_user_id = $1`, [t.user.id]);
      await deleteAccount(t.user.id);
    }
  });
  test('sur téléphone, le formulaire s’ouvre en plein écran', async ({ browser }: { browser: Browser }) => {
    const t = await brochureAccount('brochure-plein-ecran');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    try {
      const page = await context.newPage();
      await page.goto(`/b/${t.token}`);
      await expect(page.getByRole('heading', { name: 'Mariages 2027' })).toBeVisible({ timeout: 20_000 });
      const next = page.getByRole('button', { name: 'Page suivante' });
      while (await next.isEnabled()) { await next.click(); await page.waitForTimeout(750); }
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Envoyer ma demande' })).toBeVisible();
      expect((await sheet.boundingBox())!.height).toBeGreaterThanOrEqual(800);
      await sheet.getByLabel('Prénom').fill('Camille');
      await page.screenshot({ path: 'e2e/screenshots/brochure-formulaire-plein-ecran.png' });
      await sheet.getByRole('button', { name: 'Revenir au livre' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: 'Page précédente' }).click();
      await page.waitForTimeout(750);
      await page.getByRole('button', { name: 'Page suivante' }).click();
      await page.waitForTimeout(750);
      await expect(page.getByRole('dialog').getByLabel('Prénom')).toHaveValue('Camille');

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/b/${t.token}`);
      await expect(page.getByRole('heading', { name: 'Mariages 2027' })).toBeVisible();
      const nextDesk = page.getByRole('button', { name: 'Page suivante' });
      while (await nextDesk.isEnabled()) { await nextDesk.click(); await page.waitForTimeout(750); }
      await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } finally {
      await context.close();
      await deleteAccount(t.user.id);
    }
  });
});
