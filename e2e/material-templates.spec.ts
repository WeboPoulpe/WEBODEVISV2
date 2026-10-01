import { test, expect, type Page } from '@playwright/test';
import { createQuote, horizontalOverflow, offscreenElements, sql, withAccount } from './helpers';

// Modèles de matériel (page Matériel, onglet Modèles) et application d'un modèle dans un événement :
// directement quand il n'y a rien, sinon fenêtre « Ajouter / Remplacer », pour le matériel comme pour la location.
// Chaque test travaille sur un compte d'essai créé pour lui, puis supprimé.

type Material = { name: string; qty: number; unit: string; checked?: boolean };

const materials = async (quoteId: string) => {
  const [row] = await sql<{ event_materials: Material[] | null }>(`select event_materials from public.quotes where id = $1`, [quoteId]);
  return (row.event_materials ?? []).map((m) => [m.name, Number(m.qty)] as const).sort(([a], [b]) => a.localeCompare(b, 'fr'));
};

const rentals = async (quoteId: string) =>
  (await sql<{ id: string; material_name: string; qty: string; ordered: boolean }>(
    `select id, material_name, qty, ordered from public.rental_items where quote_id = $1 order by material_name, qty`, [quoteId]))
    .map((r) => ({ id: r.id, name: r.material_name, qty: Number(r.qty), ordered: r.ordered }));

/** Un modèle de matériel et ses articles : [nom, quantité fixe, quantité par couvert]. */
async function seedMaterialSet(userId: string, name: string, lines: [string, number, number | null][]) {
  const [set] = await sql<{ id: string }>(`insert into public.material_template_sets (user_id, name) values ($1, $2) returning id`, [userId, name]);
  for (const [i, [item, qty, perGuest]] of lines.entries()) {
    await sql(`insert into public.material_templates (set_id, user_id, name, unit, default_qty, qty_per_guest, sort_order) values ($1, $2, $3, 'pièce', $4, $5, $6)`,
      [set.id, userId, item, qty, perGuest, i]);
  }
}

/** Un modèle de location et ses articles : [nom, quantité par couvert]. */
async function seedRentalSet(userId: string, name: string, lines: [string, number][]) {
  const [set] = await sql<{ id: string }>(`insert into public.rental_template_sets (user_id, name) values ($1, $2) returning id`, [userId, name]);
  for (const [i, [item, perGuest]] of lines.entries()) {
    await sql(`insert into public.rental_templates (user_id, set_id, material_name, qty_per_guest, unit, sort_order) values ($1, $2, $3, $4, 'pièce', $5)`,
      [userId, set.id, item, perGuest, i]);
  }
}

async function openMaterielTab(page: Page, quoteId: string) {
  await page.goto(`/evenements/${quoteId}`);
  await page.getByRole('tab', { name: 'Matériel' }).click();
  await expect(page.getByRole('heading', { name: 'À préparer' })).toBeVisible({ timeout: 20_000 });
}

test('modèle de matériel : création depuis la liste de base, article par couvert, application dans un événement', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  test.setTimeout(180_000);
  await withAccount(browser, 'modele-materiel', async (page, userId) => {
    const quoteId = await createQuote(userId, { client_name: 'Client modèles', status: 'valide', guest_count: 50 });

    await page.goto('/materiel?action=modeles');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('tab', { name: 'Modèles' })).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 });
    await expect(page.getByText('Aucun modèle de matériel')).toBeVisible({ timeout: 20_000 });

    // Un modèle neuf ouvre la liste de base. (En développement, le rechargement à chaud peut refermer la fenêtre.)
    const picker = page.getByRole('dialog', { name: 'Ajouter à « Cocktail »' });
    await expect(async () => {
      if (await picker.isVisible()) return;
      if (await page.getByRole('tab', { name: /Cocktail/ }).isVisible()) await page.getByRole('button', { name: 'Depuis une liste' }).click();
      else {
        if (!(await page.locator('#mset-name').isVisible())) await page.getByRole('button', { name: 'Nouveau modèle' }).first().click();
        await page.locator('#mset-name').fill('Cocktail');
        await page.getByRole('button', { name: 'Créer le modèle' }).click();
      }
      await expect(picker).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 40_000 });

    const search = picker.getByRole('searchbox', { name: 'Rechercher dans la liste de base' });
    await search.fill('chafing');
    await picker.getByRole('checkbox', { name: 'Chafing dish', exact: true }).check();
    await expect(picker.getByRole('spinbutton', { name: 'Quantité, Chafing dish' })).toHaveValue('4');
    await search.fill('isotherme');
    await picker.getByRole('checkbox', { name: 'Caisse isotherme' }).check();
    await picker.getByRole('spinbutton', { name: 'Quantité, Caisse isotherme' }).fill('6');
    await picker.getByRole('button', { name: 'Ajouter 2 articles' }).click();
    await expect(picker).toBeHidden({ timeout: 15_000 });

    // À la main, une quantité selon les couverts : 1 rallonge pour 10 couverts.
    await page.getByRole('button', { name: 'Ajouter un article' }).click();
    await page.locator('#mtpl-name').fill('Rallonge 10 m');
    await page.getByRole('radio', { name: 'Selon les couverts' }).click();
    await page.locator('#mtpl-ratio').fill('1');
    await page.locator('#mtpl-ratio-per').fill('10');
    await expect(page.getByText('Pour 50 couverts : 5 pièces')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('1 pièce pour 10 couverts')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('6 pièces')).toBeVisible();

    const saved = await sql<{ name: string; default_qty: string; qty_per_guest: string | null }>(
      `select name, default_qty, qty_per_guest from public.material_templates where user_id = $1 order by name`, [userId]);
    expect(saved.map((r) => [r.name, Number(r.default_qty), r.qty_per_guest == null ? null : Number(r.qty_per_guest)])).toEqual([
      ['Caisse isotherme', 6, null], ['Chafing dish', 4, null], ['Rallonge 10 m', 1, 0.1],
    ]);
    await testInfo.attach('modele', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // Dans l'événement de 50 couverts : rien à préparer encore, le modèle s'applique sans question.
    await openMaterielTab(page, quoteId);
    await page.getByRole('button', { name: 'Appliquer un modèle de matériel' }).click();
    const chooser = page.getByRole('dialog', { name: 'Quel modèle appliquer ?' });
    await expect(chooser.getByText('Quantités calculées pour 50 couverts.')).toBeVisible();
    await expect(chooser.getByRole('button', { name: /Cocktail/ })).toContainText('Rallonge 10 m : 5 pièces');
    await chooser.getByRole('button', { name: /Cocktail/ }).click();
    await expect(chooser).toBeHidden();
    await expect(page.getByText('Rallonge 10 m')).toBeVisible();
    await expect.poll(() => materials(quoteId), { timeout: 15_000 }).toEqual([['Caisse isotherme', 6], ['Chafing dish', 4], ['Rallonge 10 m', 5]]);
  });
});

test('matériel à préparer : un second modèle s’ajoute en cumulant, ou remplace', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  test.setTimeout(180_000);
  await withAccount(browser, 'modele-ajout', async (page, userId) => {
    await seedMaterialSet(userId, 'Cocktail', [['Chafing dish', 4, null], ['Glacière', 2, null]]);
    await seedMaterialSet(userId, 'Dîner assis', [['chafing dish', 2, null], ['Étuve chauffante', 1, null], ['Rallonge', 1, 0.1]]);
    const quoteId = await createQuote(userId, { client_name: 'Client cumul', status: 'valide', guest_count: 50 });
    await sql(`update public.quotes set event_materials = $2::jsonb where id = $1`, [quoteId, JSON.stringify([
      { id: 'm1', name: 'Chafing dish', qty: 4, unit: 'pièce', checked: true },
      { id: 'm2', name: 'Glacière', qty: 2, unit: 'pièce', checked: false },
    ])]);

    await openMaterielTab(page, quoteId);
    await page.getByRole('button', { name: 'Appliquer un modèle de matériel' }).click();
    await page.getByRole('dialog', { name: 'Quel modèle appliquer ?' }).getByRole('button', { name: /Dîner assis/ }).click();
    const decide = page.getByRole('dialog', { name: 'Appliquer « Dîner assis »' });
    await expect(decide.getByText('L’événement contient déjà 2 articles à préparer.', { exact: false })).toBeVisible();
    const add = decide.getByRole('button', { name: /Ajouter au matériel à préparer/ });
    await expect(add).toContainText('2 articles ajoutés, 1 mis à jour');
    await expect(add).toContainText('Chafing dish : 4 → 6');
    await expect(decide.getByRole('button', { name: /Remplacer le matériel à préparer/ })).toContainText('3 articles ajoutés, 2 retirés');
    await testInfo.attach('ajouter-ou-remplacer', { body: await page.screenshot(), contentType: 'image/png' });

    // Ajouter : le chafing dish (écrit en minuscules dans le modèle) se cumule sur sa ligne, sans doublon, et se décoche.
    await add.click();
    await expect(decide).toBeHidden();
    await expect.poll(() => materials(quoteId), { timeout: 15_000 }).toEqual([['Chafing dish', 6], ['Étuve chauffante', 1], ['Glacière', 2], ['Rallonge', 5]]);
    const [row] = await sql<{ event_materials: Material[] }>(`select event_materials from public.quotes where id = $1`, [quoteId]);
    expect(row.event_materials.find((m) => m.name === 'Chafing dish')?.checked).toBe(false);

    // Annuler ne change rien.
    await page.getByRole('button', { name: 'Appliquer un modèle de matériel' }).click();
    await page.getByRole('dialog', { name: 'Quel modèle appliquer ?' }).getByRole('button', { name: /Cocktail/ }).click();
    await page.getByRole('dialog', { name: 'Appliquer « Cocktail »' }).getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await materials(quoteId)).toHaveLength(4);

    // Remplacer : il ne reste que le cocktail.
    await page.getByRole('button', { name: 'Appliquer un modèle de matériel' }).click();
    await page.getByRole('dialog', { name: 'Quel modèle appliquer ?' }).getByRole('button', { name: /Cocktail/ }).click();
    await page.getByRole('dialog', { name: 'Appliquer « Cocktail »' }).getByRole('button', { name: /Remplacer le matériel à préparer/ }).click();
    await expect.poll(() => materials(quoteId), { timeout: 15_000 }).toEqual([['Chafing dish', 4], ['Glacière', 2]]);
    await page.reload();
    await page.getByRole('tab', { name: 'Matériel' }).click();
    await expect(page.getByText('Étuve chauffante')).toHaveCount(0);
  });
});

test('location : ajouter cumule, remplacer garde la ligne déjà commandée', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  test.setTimeout(180_000);
  await withAccount(browser, 'modele-location', async (page, userId) => {
    await seedRentalSet(userId, 'Cocktail', [['Flûte à champagne', 1.5], ['Mange-debout', 0.1]]);
    await seedRentalSet(userId, 'Dîner assis', [['Assiette plate 27 cm', 1], ['Mange-debout', 0.1], ['Flûte à champagne', 0.5]]);
    const quoteId = await createQuote(userId, { client_name: 'Client location', status: 'valide', guest_count: 50 });
    const [ordered] = await sql<{ id: string }>(
      `insert into public.rental_items (quote_id, material_name, qty, unit, source, ordered) values ($1, 'Flûte à champagne', 75, 'pièce', 'template', true) returning id`, [quoteId]);
    await sql(`insert into public.rental_items (quote_id, material_name, qty, unit, source) values ($1, 'Mange-debout', 5, 'pièce', 'template')`, [quoteId]);

    await openMaterielTab(page, quoteId);
    await expect(page.getByText('Commandé', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Appliquer un modèle de location' }).click();
    await page.getByRole('dialog', { name: 'Quel modèle appliquer ?' }).getByRole('button', { name: /Dîner assis/ }).click();
    const decide = page.getByRole('dialog', { name: 'Appliquer « Dîner assis »' });
    const add = decide.getByRole('button', { name: /Ajouter à la location actuelle/ });
    await expect(add).toContainText('2 articles ajoutés, 1 mis à jour');
    await expect(add).toContainText('Flûte à champagne : complément de 25 (déjà commandé)');

    // Ajouter : le mange-debout passe à 10 sur sa ligne ; la flûte commandée ne bouge pas, le complément est une ligne à part.
    await add.click();
    await expect(decide).toBeHidden();
    await expect.poll(async () => (await rentals(quoteId)).map((r) => [r.name, r.qty, r.ordered]), { timeout: 15_000 }).toEqual([
      ['Assiette plate 27 cm', 50, false], ['Flûte à champagne', 25, false], ['Flûte à champagne', 75, true], ['Mange-debout', 10, false],
    ]);

    // Remplacer par le cocktail : la ligne commandée est signalée et gardée par défaut ; elle couvre les 75 flûtes.
    await page.getByRole('button', { name: 'Appliquer un modèle de location' }).click();
    await page.getByRole('dialog', { name: 'Quel modèle appliquer ?' }).getByRole('button', { name: /Cocktail/ }).click();
    const replace = page.getByRole('dialog', { name: 'Appliquer « Cocktail »' });
    const keep = replace.getByRole('checkbox', { name: /Garder l’article déjà commandé/ });
    await expect(keep).toBeChecked();
    await expect(replace.getByRole('button', { name: /Remplacer la location actuelle/ })).toContainText('1 article ajouté, 3 retirés, 1 gardé');
    await testInfo.attach('remplacer-location', { body: await page.screenshot(), contentType: 'image/png' });
    await replace.getByRole('button', { name: /Remplacer la location actuelle/ }).click();
    await expect(replace).toBeHidden();
    await expect.poll(async () => (await rentals(quoteId)).map((r) => [r.name, r.qty, r.ordered]), { timeout: 15_000 }).toEqual([
      ['Flûte à champagne', 75, true], ['Mange-debout', 5, false],
    ]);
    expect((await rentals(quoteId)).find((r) => r.ordered)?.id).toBe(ordered.id);
  });
});

test('téléphone 390 px : page des modèles et fenêtre Ajouter / Remplacer sans débordement', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit (le téléphone est simulé ici)');
  test.setTimeout(180_000);
  await withAccount(browser, 'modele-mobile', async (page, userId) => {
    await seedMaterialSet(userId, 'Cocktail dînatoire pour un très grand mariage en extérieur', [['Chafing dish', 4, null], ['Caisse isotherme', 6, null], ['Rallonges électriques', 1, 1 / 30]]);
    await seedRentalSet(userId, 'Dîner assis', [['Assiette plate 27 cm', 1]]);
    const quoteId = await createQuote(userId, { client_name: 'Client téléphone', status: 'valide', guest_count: 50 });
    await sql(`update public.quotes set event_materials = $2::jsonb where id = $1`, [quoteId, JSON.stringify([{ id: 'm1', name: 'Chafing dish', qty: 2, unit: 'pièce' }])]);
    await sql(`insert into public.rental_items (quote_id, material_name, qty, unit, ordered) values ($1, 'Assiette plate 27 cm', 40, 'pièce', true)`, [quoteId]);

    const noOverflow = async (label: string) => {
      expect(await horizontalOverflow(page), label).toBe(0);
      expect(await offscreenElements(page), label).toEqual([]);
    };

    await page.goto('/materiel?action=modeles');
    await expect(page.getByText('1 pièce pour 30 couverts')).toBeVisible({ timeout: 20_000 });
    await noOverflow('page des modèles');
    for (const name of ['Renommer le modèle', 'Dupliquer le modèle', 'Supprimer le modèle']) {
      expect((await page.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    await page.screenshot({ path: testInfo.outputPath('modeles-390.png'), fullPage: true });

    await page.getByRole('button', { name: 'Ajouter un article' }).click();
    await page.getByRole('radio', { name: 'Selon les couverts' }).click();
    await expect(page.locator('#mtpl-ratio-per')).toBeVisible();
    await noOverflow('formulaire d’article');
    await page.keyboard.press('Escape');

    await openMaterielTab(page, quoteId);
    await noOverflow('onglet Matériel');
    await page.getByRole('button', { name: 'Appliquer un modèle de matériel' }).click();
    await page.getByRole('dialog', { name: 'Quel modèle appliquer ?' }).getByRole('button', { name: /Cocktail dînatoire/ }).click();
    const decide = page.getByRole('dialog', { name: /^Appliquer « Cocktail dînatoire/ });
    await expect(decide.getByRole('button', { name: /Ajouter au matériel à préparer/ })).toBeVisible();
    await noOverflow('fenêtre ajouter / remplacer (matériel)');
    await page.screenshot({ path: testInfo.outputPath('ajouter-remplacer-390.png') });
    await decide.getByRole('button', { name: 'Annuler' }).click();

    await page.getByRole('button', { name: 'Appliquer un modèle de location' }).click();
    await page.getByRole('dialog', { name: 'Quel modèle appliquer ?' }).getByRole('button', { name: /Dîner assis/ }).click();
    const rental = page.getByRole('dialog', { name: 'Appliquer « Dîner assis »' });
    const keep = rental.getByRole('checkbox', { name: /Garder l’article déjà commandé/ });
    await expect(keep).toBeChecked();
    await noOverflow('fenêtre ajouter / remplacer (location)');
    for (const name of [/Ajouter à la location actuelle/, /Remplacer la location actuelle/]) {
      expect((await rental.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    expect((await keep.locator('xpath=..').boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await page.screenshot({ path: testInfo.outputPath('location-390.png') });
  }, { viewport: { width: 390, height: 844 } });
});
