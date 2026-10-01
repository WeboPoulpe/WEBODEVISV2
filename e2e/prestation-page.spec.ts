import { test, expect, type Page, type Locator } from '@playwright/test';
import { withAccount, sql, horizontalOverflow } from './helpers';

// Page d'une prestation (/prestations/[id] et /prestations/nouvelle) : enregistrement, retour à la liste au même
// endroit, aperçu fidèle au devis sans débordement, confirmation avant de perdre une saisie, téléphone.
// Chaque test travaille sur un compte d'essai créé pour lui, puis supprimé : aucun compte réel n'est touché.

test.setTimeout(180_000);
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'les largeurs sont fixées dans chaque test ; un seul passage suffit');
});

/** Description riche et longue, comme celles des traiteurs : titre coloré, sous-titre italique bleu, rubriques rouges soulignées avec prix. */
const RICH = `<p style="text-align:center"><span style="color:#9c27b0;font-size:20px"><b>COCKTAIL DÎNATOIRE PRESTIGE</b></span></p>
<p style="text-align:center"><i><span style="color:#1565c0">Servi en buffet, 18 pièces par personne, de 19 h à 22 h</span></i></p>
<p><br></p>
<p><u><span style="color:#c62828"><b>Pièces froides (10 pièces) +2€/pers</b></span></u></p>
<p>Verrine d'avocat et crevettes - Tartare de saumon à l'aneth - Mini-club au poulet et curry - Gougères au comté affiné - Wraps de légumes croquants - Cuillère de foie gras et chutney de figue - Tataki de thon au sésame - Blinis au saumon fumé maison - Brochette tomate mozzarella basilic - Pain surprise campagnard</p>
<p><br></p>
<p><u><span style="color:#c62828"><b>Pièces chaudes (6 pièces) +3€/pers</b></span></u></p>
<p>Mini-burger de bœuf charolais - Croustillant de chèvre au miel - Brochette de volaille satay - Accras de morue sauce chien - Quiche lorraine - Croque-monsieur à la truffe</p>
<p><br></p>
<p><u><span style="color:#c62828"><b>Douceurs (2 pièces) 14,00 €</b></span></u></p>
<p>Macarons parisiens - Mini-tartelette citron meringuée - Chou craquelin vanille - Verrine fruits rouges et chantilly</p>`;

/** Fiche mise en page avec une largeur fixe plus grande que la page : l'aperçu doit la contenir. */
const WIDE_CARD = `<div class="gastro-card" style="text-align:center;width:900px;padding:20px;">
<h3 style="font-size:16px;color:#9c27b0;margin:0 0 8px;">Plateau du chef</h3>
<table style="width:900px"><tr><td>Fiche-plateau-avec-un-mot-tres-long-sans-espace-qui-ne-se-coupe-jamais-nulle-part</td></tr></table>
</div>`;

async function addPrestation(userId: string, p: { name: string; price: number; cost?: number; description?: string; card?: string | null }) {
  const [row] = await sql<{ id: string }>(
    `insert into public.prestations (user_id, name, unit_price, cost_price, description, gastro_card_html, category)
     values ($1, $2, $3, $4, $5, $6, 'cocktail') returning id`,
    [userId, p.name, p.price, p.cost ?? 0, p.description ?? null, p.card ?? null],
  );
  return row.id;
}

/** Ouvre la prestation depuis la liste, comme on le fait à la main. */
async function openFromList(page: Page, id: string, name: string) {
  await page.goto('/prestations');
  await page.getByRole('link', { name: new RegExp(name) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/prestations/${id}$`), { timeout: 30_000 });
  await expect(page.getByLabel('Nom de la prestation')).toHaveValue(name, { timeout: 30_000 });
}

/** Aucun bloc de l'aperçu ne déborde : la colonne et chaque morceau de document tiennent dans leur largeur. */
async function expectPreviewContained(page: Page) {
  const preview: Locator = page.getByTestId('prestation-preview');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('img').first()).toBeVisible();
  const boxes = await preview.evaluate((el) => [el, ...Array.from(el.querySelectorAll<HTMLElement>('[role="img"]'))]
    .map((b) => ({ scroll: b.scrollWidth, client: b.clientWidth, right: b.getBoundingClientRect().right, limit: el.getBoundingClientRect().right })));
  for (const b of boxes) {
    expect(b.scroll, 'le contenu de l’aperçu déborde').toBeLessThanOrEqual(b.client);
    expect(b.right).toBeLessThanOrEqual(b.limit + 1);
  }
}

test('ouvrir depuis la liste, modifier et enregistrer : les valeurs arrivent en base', async ({ browser }) => {
  await withAccount(browser, 'presta-page-save', async (page, userId) => {
    const id = await addPrestation(userId, { name: 'Cocktail dînatoire prestige', price: 14, cost: 6, description: RICH });
    await openFromList(page, id, 'Cocktail dînatoire prestige');

    // Grand écran : formulaire et aperçu côte à côte, sans onglets ; le nom est en titre de page.
    await expect(page.getByRole('heading', { level: 1, name: 'Cocktail dînatoire prestige' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Aperçu' })).toBeHidden();
    await expect(page.getByTestId('prestation-preview')).toBeVisible();
    await expect(page.getByTestId('presta-margin')).toContainText('8,00');

    await page.getByLabel('Nom de la prestation').fill('Cocktail prestige du soir');
    await page.getByLabel('Prix unitaire HT').fill('15,50');
    await expect(page.getByTestId('presta-margin')).toContainText('9,50');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cocktail prestige du soir');
    // L'aperçu suit la saisie : la ligne du devis porte le nouveau nom et le nouveau prix.
    await expect(page.getByTestId('prestation-preview')).toContainText('Cocktail prestige du soir');
    await expect(page.getByTestId('prestation-preview')).toContainText('15,50');
    await expectPreviewContained(page);
    expect(await horizontalOverflow(page)).toBe(0);

    // Entrée dans un champ enregistre, puis la liste revient avec un message.
    await page.getByLabel('Prix de revient').press('Enter');
    await expect(page).toHaveURL(/\/prestations$/, { timeout: 30_000 });
    await expect(page.getByRole('status').filter({ hasText: '« Cocktail prestige du soir » est enregistrée.' })).toBeVisible({ timeout: 30_000 });
    expect((await sql<{ name: string; unit_price: number; cost_price: number; description: string }>(
      `select name, unit_price::float as unit_price, cost_price::float as cost_price, description from public.prestations where id = $1 and user_id = $2`, [id, userId]))[0])
      .toMatchObject({ name: 'Cocktail prestige du soir', unit_price: 15.5, cost_price: 6, description: RICH });
  });
});

test('retour à la liste au même endroit après une prestation du bas de la liste', async ({ browser }) => {
  await withAccount(browser, 'presta-page-retour', async (page, userId) => {
    const values = Array.from({ length: 30 }, (_, i) => `($1, 'Prestation ${String(i + 1).padStart(2, '0')}', ${10 + i}, 'cocktail')`).join(', ');
    await sql(`insert into public.prestations (user_id, name, unit_price, category) values ${values}`, [userId]);
    await page.goto('/prestations');
    const last = page.getByRole('link', { name: /Prestation 30/ });
    await last.scrollIntoViewIfNeeded({ timeout: 30_000 });
    const before = await page.evaluate(() => document.querySelector('main')!.scrollTop);
    expect(before).toBeGreaterThan(200);
    await last.click();
    await expect(page.getByLabel('Nom de la prestation')).toHaveValue('Prestation 30', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page).toHaveURL(/\/prestations$/, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: /Prestation 30/ })).toBeInViewport({ timeout: 30_000 });
    expect(await page.evaluate(() => document.querySelector('main')!.scrollTop)).toBeGreaterThan(200);
  }, { viewport: { width: 1280, height: 800 } });
});

test('nouvelle prestation : erreurs compréhensibles, nouvelle catégorie, retour à la liste', async ({ browser }) => {
  await withAccount(browser, 'presta-page-new', async (page, userId) => {
    try {
      await page.goto('/prestations');
      await page.getByRole('link', { name: 'Nouvelle prestation' }).first().click();
      await expect(page).toHaveURL(/\/prestations\/nouvelle$/, { timeout: 30_000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Nouvelle prestation' })).toBeVisible();

      await page.getByRole('button', { name: 'Ajouter la prestation' }).click();
      await expect(page.getByText('Donnez un nom à la prestation.')).toBeVisible();
      await expect(page.getByText('Indiquez le prix unitaire HT, par exemple 14,50.')).toBeVisible();
      await page.getByLabel('Nom de la prestation').fill('Brunch du dimanche');
      await page.getByLabel('Prix unitaire HT').fill('douze');
      await page.getByLabel('Prix unitaire HT').press('Enter');
      await expect(page.getByText('Ce prix n’est pas un montant valide. Exemple : 14,50.')).toBeVisible();
      await page.getByLabel('Prix unitaire HT').fill('32');

      // « Nouvelle catégorie » : une vraie action, lisible, à 40 px de haut.
      const newCat = page.getByRole('button', { name: 'Nouvelle catégorie' });
      expect((await newCat.boundingBox())!.height).toBeGreaterThanOrEqual(40);
      await newCat.click();
      await page.getByLabel('Catégorie', { exact: true }).fill('Brunchs');
      await page.getByLabel('Catégorie', { exact: true }).press('Enter');
      // La catégorie créée est choisie d'office dans la liste.
      await expect(page.getByRole('combobox', { name: 'Catégorie', exact: true }).locator('option:checked')).toHaveText(/Brunchs/, { timeout: 30_000 });

      await page.getByLabel('Prix unitaire HT').press('Enter');
      await expect(page).toHaveURL(/\/prestations$/, { timeout: 30_000 });
      await expect(page.getByRole('status').filter({ hasText: '« Brunch du dimanche » est enregistrée.' })).toBeVisible({ timeout: 30_000 });
      expect(await sql<{ name: string; unit_price: number; category: string }>(
        `select name, unit_price::float as unit_price, category from public.prestations where user_id = $1`, [userId])).toEqual([
        { name: 'Brunch du dimanche', unit_price: 32, category: 'Brunchs' },
      ]);
    } finally {
      // Les catégories créées ici ne sont pas couvertes par deleteAccount : on les retire, pour ce compte d'essai seulement.
      await sql(`update public.prestations set category_id = null, sub_category_id = null where user_id = $1`, [userId]);
      await sql(`delete from public.prestation_subcategories where user_id = $1`, [userId]);
      await sql(`delete from public.prestation_categories where user_id = $1`, [userId]);
    }
  });
});

test('quitter après une modification demande confirmation', async ({ browser }) => {
  await withAccount(browser, 'presta-page-close', async (page, userId) => {
    const id = await addPrestation(userId, { name: 'Plateau de fromages', price: 9 });

    // Sans modification : le retour est immédiat.
    await openFromList(page, id, 'Plateau de fromages');
    await page.getByRole('link', { name: 'Prestations', exact: true }).first().click();
    await expect(page).toHaveURL(/\/prestations$/, { timeout: 30_000 });

    // Avec une modification : le lien de retour, un lien du menu et Annuler demandent d'abord.
    await openFromList(page, id, 'Plateau de fromages');
    await page.getByLabel('Nom de la prestation').fill('Plateau de fromages affinés');
    await page.locator('main').getByRole('link', { name: 'Prestations', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Quitter sans enregistrer ?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Continuer la saisie' }).click();
    await expect(confirm).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/prestations/${id}$`));
    await expect(page.getByLabel('Nom de la prestation')).toHaveValue('Plateau de fromages affinés');

    await page.getByRole('link', { name: 'Devis', exact: true }).first().click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Continuer la saisie' }).click();

    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await confirm.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await expect(page).toHaveURL(/\/prestations$/, { timeout: 30_000 });
    const [row] = await sql<{ name: string }>(`select name from public.prestations where id = $1 and user_id = $2`, [id, userId]);
    expect(row.name).toBe('Plateau de fromages');
  });
});

test('aperçu à toutes les largeurs : fiche mise en page large contenue, onglets quand la place manque', async ({ browser }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await withAccount(browser, 'presta-page-preview', async (page, userId) => {
      const id = await addPrestation(userId, { name: 'Plateau du chef', price: 22, description: RICH, card: WIDE_CARD });
      await page.goto(`/prestations/${id}`);
      await expect(page.getByLabel('Nom de la prestation')).toHaveValue('Plateau du chef', { timeout: 30_000 });
      // La fiche existe : la page le dit, et propose de la modifier en plein écran.
      await expect(page.getByText('fiche mise en page', { exact: false }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Modifier la fiche' })).toBeVisible();
      if (viewport.width < 1100) {
        await expect(page.getByTestId('prestation-preview')).toBeHidden();
        await page.getByRole('tab', { name: 'Aperçu' }).click();
      }
      await expect(page.getByTestId('prestation-preview')).toContainText('Plateau du chef');
      await expectPreviewContained(page);
      expect(await horizontalOverflow(page)).toBe(0);
    }, { viewport });
  }
});

test('téléphone (390 px) : une colonne, onglets Modifier / Aperçu, actions visibles, rien ne déborde', async ({ browser }) => {
  await withAccount(browser, 'presta-page-phone', async (page, userId) => {
    const id = await addPrestation(userId, { name: 'Cocktail dînatoire prestige', price: 14, cost: 6, description: RICH });
    await page.goto(`/prestations/${id}`);
    await expect(page.getByLabel('Nom de la prestation')).toHaveValue('Cocktail dînatoire prestige', { timeout: 30_000 });
    const mainOverflow = () => page.evaluate(() => { const m = document.querySelector('main')!; return m.scrollWidth - m.clientWidth; });

    await expect(page.getByRole('tab', { name: 'Modifier' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('prestation-preview')).toBeHidden();
    expect(await mainOverflow()).toBeLessThanOrEqual(0);
    expect(await horizontalOverflow(page)).toBe(0);
    // La barre d'actions reste à l'écran, au-dessus de la barre d'onglets du téléphone.
    const save = page.getByRole('button', { name: 'Enregistrer', exact: true });
    await expect(save).toBeInViewport();
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(40);

    await page.getByRole('tab', { name: 'Aperçu' }).click();
    await expect(page.getByLabel('Nom de la prestation')).toBeHidden();
    await expectPreviewContained(page);
    expect(await mainOverflow()).toBeLessThanOrEqual(0);
    expect(await horizontalOverflow(page)).toBe(0);
  }, { viewport: { width: 390, height: 844 } });
});
