import { test, expect, type Locator, type Page } from '@playwright/test';
import { createAccount, deleteAccount, horizontalOverflow, offscreenElements, sessionCookie, sql, withAccount } from './helpers';

// Recherche dans les fenêtres de choix : liste de base (Matériel, modèles de location) et « Ma liste de matériel »
// d'un événement. Chaque test travaille sur un compte d'essai créé pour lui, puis supprimé.

/** Articles affichés dans la liste (une case par ligne), dans l'ordre. */
const visibleNames = async (dialog: Locator) => dialog.locator('li input[type="checkbox"]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));

async function openBaseList(page: Page) {
  await page.goto('/materiel');
  await page.waitForLoadState('networkidle');
  const dialog = page.getByRole('dialog', { name: 'Liste de base' });
  // En développement, le rechargement à chaud qui suit la première compilation peut refermer la fenêtre.
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'Partir de la liste de base' }).click();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  return dialog;
}

test('Matériel : la recherche filtre la liste de base, garde les cochés et propose d’ajouter un article perso', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'base-recherche', async (page, userId) => {
    const dialog = await openBaseList(page);
    const search = dialog.getByRole('searchbox', { name: 'Rechercher dans la liste de base' });
    // Sur ordinateur, le champ reçoit la mise au point d'office.
    await expect(search).toBeFocused();

    // Filtrage : seuls les articles qui parlent de chafing restent, les autres groupes disparaissent.
    await search.fill('chafing');
    await expect.poll(() => visibleNames(dialog)).toEqual(['Chafing dish', 'Brûleurs pour chafing dish']);
    await expect(dialog.getByRole('heading', { name: 'Froid et transport' })).toHaveCount(0);
    await expect(dialog.getByText('2 articles trouvés.')).toBeVisible();

    // Sans accents ni majuscules.
    await search.fill('ETUVE');
    await expect.poll(() => visibleNames(dialog)).toEqual(['Étuve chauffante']);
    // Le nom du groupe compte aussi.
    await search.fill('froid');
    await expect(dialog.getByRole('checkbox', { name: 'Glacière' })).toBeVisible();

    // Un article coché reste coché quand la recherche le cache.
    await dialog.getByRole('checkbox', { name: 'Glacière' }).check();
    await search.fill('chafing');
    await expect(dialog.getByText('2 articles trouvés, 1 autre déjà coché.')).toBeVisible();
    // « Tout cocher » ne coche que les lignes affichées.
    await dialog.getByRole('button', { name: 'Tout cocher' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Chafing dish', exact: true })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Brûleurs pour chafing dish' })).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Ajouter 3 articles' })).toBeEnabled();

    // Le bouton d'effacement rend toute la liste ; le reste du groupe n'a pas été coché.
    await dialog.getByRole('button', { name: 'Effacer la recherche' }).click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(dialog.getByRole('checkbox', { name: 'Glacière' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Étuve chauffante' })).not.toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Plaque à induction' })).not.toBeChecked();

    // Aucun résultat : on propose d'ajouter le texte comme article perso.
    await search.fill('Nappe bordeaux');
    await expect(dialog.getByText('Aucun article ne correspond à « Nappe bordeaux », 3 autres déjà cochés.')).toBeVisible();
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Ajouter « Nappe bordeaux »' }).click();
    const form = page.getByRole('dialog', { name: 'Nouvel article' });
    await expect(form).toBeVisible();
    await expect(form.locator('#mat-name')).toHaveValue('Nappe bordeaux');
    // Des articles étaient cochés : la liste reste ouverte dessous, et Échap ne ferme que le formulaire.
    await page.keyboard.press('Escape');
    await expect(form).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Ajouter 3 articles' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Ajouter 3 articles' }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect.poll(async () => (await sql<{ name: string }>(`select name from public.material_presets where user_id = $1 order by name`, [userId])).map((r) => r.name), { timeout: 15_000 })
      .toEqual(['Brûleurs pour chafing dish', 'Chafing dish', 'Glacière']);

    // Rien de coché : la liste se ferme et laisse place au formulaire prérempli.
    await page.getByRole('button', { name: 'Depuis la liste' }).click();
    await search.fill('Plancha');
    await dialog.getByRole('button', { name: 'Ajouter « Plancha »' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#mat-name')).toHaveValue('Plancha');
  });
});

test('modèle de location : recherche dans la liste de base et article introuvable prérempli', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'location-recherche', async (page, userId) => {
    await sql(`insert into public.rental_template_sets (user_id, name) values ($1, 'Cocktail')`, [userId]);
    await page.goto('/location-templates');
    await page.waitForLoadState('networkidle');
    const dialog = page.getByRole('dialog', { name: 'Ajouter à « Cocktail »' });
    await expect(async () => {
      if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'Depuis la liste' }).click();
      await expect(dialog).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    const search = dialog.getByRole('searchbox', { name: 'Rechercher dans la liste de base' });

    await search.fill('flute');
    await expect.poll(() => visibleNames(dialog)).toEqual(['Flûte à champagne']);
    await search.fill('nappe ronde');
    await expect.poll(() => visibleNames(dialog)).toEqual(['Nappe ronde 240 cm']);

    await search.fill('Plateau ardoise');
    await expect(dialog.getByText('Aucun article ne correspond à « Plateau ardoise ».')).toBeVisible();
    await dialog.getByRole('button', { name: 'Ajouter « Plateau ardoise »' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#tpl-name')).toHaveValue('Plateau ardoise');
  });
});

test('événement : recherche dans « Ma liste de matériel »', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'picker-recherche', async (page, userId) => {
    const [quote] = await sql<{ id: string }>(
      `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status)
       values ($1, $1, 'Client recherche', current_date + 30, 'Mariage', 40, 'valide') returning id`, [userId]);
    for (const [name, qty] of [['Chafing dish', 4], ['Brûleurs pour chafing dish', 1], ['Étuve chauffante', 1], ['Glacière', 2], ['Rallonges électriques', 3]] as const) {
      await sql(`insert into public.material_presets (user_id, name, unit, default_qty) values ($1, $2, 'pièce', $3)`, [userId, name, qty]);
    }
    await page.goto(`/evenements/${quote.id}`);
    await page.getByRole('tab', { name: 'Matériel' }).click();
    await page.getByRole('button', { name: 'Choisir dans ma liste' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ma liste de matériel' });
    const search = dialog.getByRole('searchbox', { name: 'Rechercher dans ma liste de matériel' });
    await expect(search).toBeVisible({ timeout: 15_000 });

    await search.fill('etuve');
    await expect.poll(() => visibleNames(dialog)).toEqual(['Étuve chauffante']);

    await search.fill('');
    await dialog.getByRole('checkbox', { name: 'Glacière' }).check();
    await search.fill('Chafing');
    await expect.poll(() => visibleNames(dialog)).toEqual(['Brûleurs pour chafing dish', 'Chafing dish']);
    await dialog.getByRole('button', { name: 'Tout cocher' }).click();
    await expect(dialog.getByRole('button', { name: 'Ajouter 3 articles' })).toBeEnabled();
    await search.fill('');
    await expect(dialog.getByRole('checkbox', { name: 'Glacière' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Étuve chauffante' })).not.toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Rallonges électriques' })).not.toBeChecked();

    // Rien trouvé : le formulaire « Ajouter à ma liste » reprend le texte cherché.
    await search.fill('Nappe blanche');
    await expect(dialog.getByText('Aucun article ne correspond à « Nappe blanche », 3 autres déjà cochés.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Ajouter « Nappe blanche » à ma liste' }).click();
    await expect(dialog.getByLabel('Nom du matériel')).toHaveValue('Nappe blanche');
    await expect(dialog.getByLabel('Nom du matériel')).toBeFocused();
  });
});

test('téléphone (390 px) : champ collé en haut, pas de clavier d’office, aucun débordement', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit (le téléphone est simulé ici)');
  const account = await createAccount('base-recherche-mobile');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: { cookies: [], origins: [] },
  });
  try {
    await context.addCookies([await sessionCookie(account)]);
    const page = await context.newPage();
    const dialog = await openBaseList(page);
    const search = dialog.getByRole('searchbox', { name: 'Rechercher dans la liste de base' });
    await expect(search).toBeVisible();
    // Pas de mise au point automatique sur un écran tactile : le clavier ne s'ouvre pas tout seul.
    await expect(search).not.toBeFocused();

    // Le champ reste collé en haut de la zone qui défile, même tout en bas de la liste.
    const scroller = dialog.locator('.overflow-y-auto').first();
    const gapFromTop = () => scroller.evaluate((el) => {
      const field = el.querySelector('input[type="search"]')!;
      return Math.round(field.getBoundingClientRect().top - el.getBoundingClientRect().top);
    });
    const atRest = await gapFromTop();
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
    expect(await gapFromTop()).toBe(atRest);
    expect(atRest).toBeLessThanOrEqual(16);

    const checkOverflow = async () => {
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await offscreenElements(page)).toEqual([]);
      expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    };
    await checkOverflow();

    await search.fill('Un article au nom vraiment très long pour vérifier le retour à la ligne');
    await expect(dialog.getByRole('button', { name: /^Ajouter « Un article/ })).toBeVisible();
    await checkOverflow();
    const button = (await dialog.getByRole('button', { name: /^Ajouter « Un article/ }).boundingBox())!;
    expect(button.height).toBeGreaterThanOrEqual(40);
    expect(button.x + button.width).toBeLessThanOrEqual(390);

    await page.screenshot({ path: testInfo.outputPath('liste-de-base-390.png') });
  } finally {
    await context.close().catch(() => undefined);
    await deleteAccount(account.id);
  }
});
