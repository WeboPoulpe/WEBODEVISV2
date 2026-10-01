import { test, expect, type Locator, type Page } from '@playwright/test';
import { createQuote, horizontalOverflow, offscreenElements, sql, TEST_EMAIL_DOMAIN, withAccount } from './helpers';

// Page Extras : assigner plusieurs extras à plusieurs événements d'un coup (fenêtre en trois étapes),
// avec horaires ajustés par événement, doublons ignorés, alertes « déjà pris » / « pas disponible »,
// cases décochées au récapitulatif, puis envoi des missions.
// Tout se passe sur un compte d'essai supprimé à la fin ; les emails des extras sont en @test.webodevis.local
// (sendMail ne les envoie pas mais répond comme si c'était fait).

test.describe.configure({ mode: 'parallel' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'viewport fixé dans chaque test : un seul passage suffit'); });

const mail = (who: string) => `e2e-extra-${who}-${Date.now()}@${TEST_EMAIL_DOMAIN}`;

async function extra(userId: string, e: { name: string; role: string | null; phone?: string | null; email?: string | null; off?: string[] }) {
  const [row] = await sql<{ id: string }>(
    `insert into public.extras (user_id, name, role, phone, email, unavailable_dates) values ($1, $2, $3, $4, $5, $6::date[]) returning id`,
    [userId, e.name, e.role, e.phone ?? null, e.email ?? null, e.off ?? []],
  );
  return row.id;
}

const dayOf = async (quoteId: string) =>
  (await sql<{ day: string }>(`select to_char(event_date, 'YYYY-MM-DD') as day from public.quotes where id = $1`, [quoteId]))[0].day;

/** Première compilation du serveur de dev : la page peut arriver vide ; on recharge jusqu'à l'avoir. */
async function untilShown(page: Page, locator: Locator) {
  await expect(async () => {
    if (!(await locator.first().isVisible())) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    await expect(locator.first()).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 120_000 });
}

async function openExtras(page: Page, first: string) {
  await page.goto('/extras');
  await page.waitForLoadState('networkidle');
  await untilShown(page, page.getByRole('button', { name: `Modifier ${first}` }));
}

const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Assigner à des événements' });
const eventBox = (dialog: Locator, client: string) => dialog.getByRole('checkbox', { name: new RegExp(`^${client},`) });
const cell = (dialog: Locator, extraName: string, client: string) => dialog.locator(`[data-cell="${extraName}|${client}"]:visible`);

test('2 extras × 3 événements : horaires ajustés, 6 affectations, envoi des missions', async ({ browser }) => {
  test.setTimeout(240_000);
  await withAccount(browser, 'extras-multi', async (page, userId) => {
    const a = await createQuote(userId, { client_name: 'Mariage Durand', status: 'valide', guest_count: 90, event_type: 'Mariage', days: 10 });
    const b = await createQuote(userId, { client_name: 'Cocktail Lefèvre', status: 'acompte', guest_count: 40, event_type: 'Cocktail', days: 17 });
    const c = await createQuote(userId, { client_name: 'Séminaire Morel', status: 'paye', guest_count: 30, event_type: 'Séminaire', days: 24 });
    await createQuote(userId, { client_name: 'Baptême Garnier', status: 'devis_envoye', guest_count: 25, event_type: 'Baptême', days: 12 });
    await createQuote(userId, { client_name: 'Repas Refusé', status: 'refus_client', days: 14 });
    const paul = await extra(userId, { name: 'Paul Martin', role: 'Serveur', email: mail('paul') });
    const marie = await extra(userId, { name: 'Marie Petit', role: 'Chef de rang', email: mail('marie') });
    await extra(userId, { name: 'Jean Roux', role: 'Cuisinier', email: mail('jean') });

    await openExtras(page, 'Jean Roux');

    // Filtre « Service » puis « Tout cocher » : Paul et Marie, pas Jean.
    await page.getByRole('group', { name: 'Filtrer par rôle' }).getByRole('button', { name: /^Service/ }).click();
    await expect(page.getByRole('button', { name: 'Modifier Jean Roux' })).toBeHidden();
    await page.getByRole('checkbox', { name: 'Tout cocher' }).check();
    await expect(page.getByText('2 sélectionnés')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('liste-desktop.png') });
    await page.getByRole('button', { name: 'Assigner 2 extras' }).click();

    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Retirer Paul Martin' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Retirer Marie Petit' })).toBeVisible();
    await expect(eventBox(dialog, 'Mariage Durand')).toBeVisible({ timeout: 30_000 });

    // Devis en cours : seulement sur demande. Devis refusé : jamais.
    await expect(eventBox(dialog, 'Baptême Garnier')).toHaveCount(0);
    await dialog.getByRole('checkbox', { name: 'Inclure les devis en cours' }).check();
    await expect(eventBox(dialog, 'Baptême Garnier')).toBeVisible();
    await expect(dialog.locator('[data-event="Baptême Garnier"]')).toContainText('Devis envoyé');
    await expect(eventBox(dialog, 'Repas Refusé')).toHaveCount(0);
    await dialog.getByRole('checkbox', { name: 'Inclure les devis en cours' }).uncheck();

    // Recherche par client, puis effectif affiché pour chaque événement.
    await dialog.getByRole('searchbox', { name: 'Rechercher un événement' }).fill('lefe');
    await expect(eventBox(dialog, 'Mariage Durand')).toHaveCount(0);
    await expect(eventBox(dialog, 'Cocktail Lefèvre')).toBeVisible();
    await dialog.getByRole('button', { name: 'Effacer la recherche' }).click();
    await expect(dialog.locator('[data-event="Mariage Durand"]')).toContainText('90 couverts');
    await expect(dialog.locator('[data-event="Mariage Durand"]')).toContainText('Équipe : 0 sur 10 conseillés');

    for (const client of ['Mariage Durand', 'Cocktail Lefèvre', 'Séminaire Morel']) await eventBox(dialog, client).check();
    await page.screenshot({ path: test.info().outputPath('etape1-desktop.png') });
    await dialog.getByRole('button', { name: 'Continuer (3 événements)' }).click();

    // Réglages communs, et horaires propres au cocktail.
    await dialog.getByLabel('Heure d’arrivée', { exact: true }).fill('18:00');
    await dialog.getByLabel('Heure de fin', { exact: true }).fill('23:30');
    await dialog.getByLabel('Consignes').fill('Tenue noire');
    await dialog.getByRole('button', { name: 'Changer les horaires pour Cocktail Lefèvre' }).click();
    await dialog.getByLabel('Heure d’arrivée pour Cocktail Lefèvre').fill('11:00');
    await dialog.getByLabel('Heure de fin pour Cocktail Lefèvre').fill('15:00');
    await expect(dialog.locator('[data-hours="Mariage Durand"]')).toContainText('18:00 à 23:30 (communs)');
    await dialog.getByRole('button', { name: 'Vérifier' }).click();

    await expect(dialog.getByTestId('plan-total')).toHaveText('2 extras × 3 événements = 6 affectations');
    await expect(dialog.getByTestId('plan-summary')).toHaveText('6 à créer.');
    await page.screenshot({ path: test.info().outputPath('recap-desktop.png') });
    await dialog.getByRole('button', { name: 'Créer 6 affectations' }).click();
    await expect(dialog.getByRole('status')).toContainText('6 affectations créées.', { timeout: 30_000 });

    const rows = await sql<{ quote_id: string; extra_id: string; arrival_time: string; departure_time: string; mission_notes: string; status: string }>(
      `select quote_id, extra_id, arrival_time, departure_time, mission_notes, status from public.event_extras where extra_id = any($1::uuid[])`, [[paul, marie]]);
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      const hours = r.quote_id === b ? ['11:00', '15:00'] : ['18:00', '23:30'];
      expect([r.quote_id === a || r.quote_id === b || r.quote_id === c, r.arrival_time, r.departure_time, r.mission_notes, r.status])
        .toEqual([true, ...hours, 'Tenue noire', 'a_solliciter']);
    }

    // Envoi des missions : les six partent par email.
    await dialog.getByRole('button', { name: 'Envoyer les missions' }).click();
    await expect(dialog.getByTestId('send-report')).toContainText('6 missions envoyées : 6 par email.', { timeout: 60_000 });
    const sent = await sql<{ invited_at: string | null }>(`select invited_at from public.event_extras where extra_id = any($1::uuid[])`, [[paul, marie]]);
    expect(sent.every((r) => r.invited_at)).toBe(true);
    await dialog.getByRole('button', { name: 'Terminer' }).click();
    await expect(dialog).toBeHidden();

    // La liste montre les nouvelles missions ; la sélection est vidée.
    await page.getByRole('group', { name: 'Filtrer par rôle' }).getByRole('button', { name: /^Tous/ }).click();
    await expect(page.locator('li[data-extra="Paul Martin"]')).toContainText('Mariage', { timeout: 20_000 });
    await expect(page.locator('li[data-extra="Marie Petit"]')).toContainText('Cocktail');
    await expect(page.getByText(/sélectionnés?$/)).toHaveCount(0);
  });
});

test('depuis un extra : doublon ignoré, alertes « déjà pris » et « pas disponible », case décochée', async ({ browser }) => {
  test.setTimeout(240_000);
  await withAccount(browser, 'extras-multi-conflits', async (page, userId) => {
    const a = await createQuote(userId, { client_name: 'Mariage Durand', status: 'valide', days: 10 });
    const b = await createQuote(userId, { client_name: 'Cocktail Lefèvre', status: 'valide', event_type: 'Cocktail', days: 17 });
    const c = await createQuote(userId, { client_name: 'Séminaire Morel', status: 'valide', event_type: 'Séminaire', days: 24 });
    const d = await createQuote(userId, { client_name: 'Anniversaire Roux', status: 'valide', event_type: 'Anniversaire', days: 17 });
    const paul = await extra(userId, { name: 'Paul Martin', role: 'Serveur', email: mail('paul') });
    const marie = await extra(userId, { name: 'Marie Petit', role: 'Serveur', email: mail('marie'), off: [await dayOf(c)] });
    // Paul est déjà sur le mariage (doublon) et sur l'anniversaire, le même jour que le cocktail.
    await sql(`insert into public.event_extras (quote_id, extra_id, status, arrival_time) values ($1, $3, 'confirme', '09:00'), ($2, $3, 'confirme', null)`, [a, d, paul]);

    await openExtras(page, 'Paul Martin');

    // Cas simple : « Assigner » sur la ligne de Paul ouvre la même fenêtre, Paul déjà choisi ; on ajoute Marie.
    await page.locator('li[data-extra="Paul Martin"]').getByRole('button', { name: 'Assigner', exact: true }).click();
    const dialog = dialogOf(page);
    await expect(dialog.getByRole('button', { name: 'Retirer Paul Martin' })).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Ajouter un extra' }).selectOption({ label: 'Marie Petit, Serveur' });
    await expect(dialog.getByRole('button', { name: 'Retirer Marie Petit' })).toBeVisible();
    await expect(eventBox(dialog, 'Mariage Durand')).toBeVisible({ timeout: 30_000 });

    // Indications dès le choix des événements.
    await expect(dialog.locator('[data-event="Mariage Durand"]')).toContainText('Paul Martin : déjà affecté');
    await expect(dialog.locator('[data-event="Cocktail Lefèvre"]')).toContainText('Paul Martin : déjà pris ce jour');
    await expect(dialog.locator('[data-event="Séminaire Morel"]')).toContainText('Marie Petit : pas disponible');

    for (const client of ['Mariage Durand', 'Cocktail Lefèvre', 'Séminaire Morel']) await eventBox(dialog, client).check();
    await dialog.getByRole('button', { name: 'Continuer (3 événements)' }).click();
    await dialog.getByLabel('Heure d’arrivée', { exact: true }).fill('19:00');
    await dialog.getByRole('button', { name: 'Vérifier' }).click();

    await expect(dialog.getByTestId('plan-total')).toHaveText('2 extras × 3 événements = 6 affectations');
    await expect(dialog.getByTestId('plan-summary')).toHaveText('5 à créer, 1 déjà faite, ignorée.');
    await expect(cell(dialog, 'Paul Martin', 'Mariage Durand')).toContainText('Déjà affecté');
    await expect(cell(dialog, 'Paul Martin', 'Cocktail Lefèvre')).toContainText('Déjà pris ce jour');
    await expect(cell(dialog, 'Paul Martin', 'Cocktail Lefèvre')).toHaveAttribute('title', /Anniversaire, Anniversaire Roux/);
    await expect(cell(dialog, 'Marie Petit', 'Séminaire Morel')).toContainText('Pas disponible');
    await expect(cell(dialog, 'Marie Petit', 'Mariage Durand')).not.toContainText('Déjà');
    await expect(dialog.getByText('2 cases sont en alerte')).toBeVisible();

    // Décocher Marie au séminaire.
    await dialog.getByRole('checkbox', { name: /^Marie Petit, Séminaire Morel,/ }).uncheck();
    await expect(dialog.getByTestId('plan-summary')).toHaveText('4 à créer, 1 déjà faite, ignorée, 1 décochée.');
    await expect(dialog.getByText('Une case est en alerte')).toBeVisible();
    await dialog.getByRole('button', { name: 'Créer 4 affectations' }).click();
    await expect(dialog.getByRole('status')).toContainText('4 affectations créées.', { timeout: 30_000 });

    const rows = await sql<{ quote_id: string; extra_id: string; arrival_time: string | null; status: string }>(
      `select quote_id, extra_id, arrival_time, status from public.event_extras where extra_id = any($1::uuid[])`, [[paul, marie]]);
    const has = (q: string, x: string) => rows.filter((r) => r.quote_id === q && r.extra_id === x);
    expect(rows).toHaveLength(6);
    expect(has(a, paul)).toEqual([{ quote_id: a, extra_id: paul, arrival_time: '09:00', status: 'confirme' }]); // doublon : intact
    expect(has(b, paul)[0]?.arrival_time).toBe('19:00');
    expect(has(c, paul)[0]?.arrival_time).toBe('19:00');
    expect(has(a, marie)).toHaveLength(1);
    expect(has(b, marie)).toHaveLength(1);
    expect(has(c, marie)).toHaveLength(0);

    await dialog.getByRole('button', { name: 'Plus tard' }).click();
    await expect(dialog).toBeHidden();
    const invited = await sql<{ n: number }>(`select count(*)::int as n from public.event_extras where extra_id = any($1::uuid[]) and invited_at is not null`, [[paul, marie]]);
    expect(invited[0].n).toBe(0);
  });
});

test('rendu téléphone 390 px : sélection, trois étapes et récapitulatif sans débordement', async ({ browser }) => {
  test.setTimeout(240_000);
  await withAccount(browser, 'extras-multi-mobile', async (page, userId) => {
    const a = await createQuote(userId, { client_name: 'Mariage Durand-Lefèvre de la Fontaine', status: 'valide', guest_count: 120, days: 10 });
    await createQuote(userId, { client_name: 'Cocktail Lefèvre', status: 'acompte', event_type: 'Cocktail dînatoire', days: 17 });
    const c = await createQuote(userId, { client_name: 'Séminaire Morel', status: 'paye', event_type: 'Séminaire', days: 24 });
    const paul = await extra(userId, { name: 'Paul Martin', role: 'Serveur', phone: '06 12 34 56 78', email: mail('paul') });
    await extra(userId, { name: 'Marie-Christine Petit-Delacroix', role: 'Chef de rang', email: mail('marie'), off: [await dayOf(c)] });
    await extra(userId, { name: 'Jean Roux', role: 'Plongeur' });
    await sql(`insert into public.event_extras (quote_id, extra_id, status) values ($1, $2, 'confirme')`, [a, paul]);

    await openExtras(page, 'Jean Roux');
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await page.getByRole('checkbox', { name: 'Sélectionner Paul Martin' }).check();
    await page.getByRole('checkbox', { name: 'Sélectionner Marie-Christine Petit-Delacroix' }).check();
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await page.screenshot({ path: test.info().outputPath('liste-390.png') });

    await page.getByRole('button', { name: 'Assigner 2 extras' }).click();
    const dialog = dialogOf(page);
    await expect(eventBox(dialog, 'Mariage Durand-Lefèvre de la Fontaine')).toBeVisible({ timeout: 30_000 });
    for (const client of ['Mariage Durand-Lefèvre de la Fontaine', 'Cocktail Lefèvre', 'Séminaire Morel']) await eventBox(dialog, client).check();
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await page.screenshot({ path: test.info().outputPath('etape1-390.png') });

    await dialog.getByRole('button', { name: 'Continuer (3 événements)' }).click();
    await dialog.getByRole('button', { name: 'Changer les horaires pour Séminaire Morel' }).click();
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await page.screenshot({ path: test.info().outputPath('etape2-390.png') });

    await dialog.getByRole('button', { name: 'Vérifier' }).click();
    await expect(dialog.getByTestId('plan-total')).toHaveText('2 extras × 3 événements = 6 affectations');
    // Sur téléphone, le récapitulatif est une liste par événement (pas de tableau).
    await expect(dialog.locator('table')).toBeHidden();
    await expect(cell(dialog, 'Marie-Christine Petit-Delacroix', 'Séminaire Morel')).toContainText('A indiqué ne pas être disponible ce jour');
    await expect(cell(dialog, 'Paul Martin', 'Mariage Durand-Lefèvre de la Fontaine')).toContainText('Déjà affecté');
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await page.screenshot({ path: test.info().outputPath('etape3-390.png') });

    await dialog.getByRole('button', { name: 'Décocher les alertes' }).click();
    await expect(dialog.getByTestId('plan-summary')).toHaveText('4 à créer, 1 déjà faite, ignorée, 1 décochée.');
    await dialog.getByRole('button', { name: 'Créer 4 affectations' }).click();
    await expect(dialog.getByRole('status')).toContainText('4 affectations créées.', { timeout: 30_000 });
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await page.screenshot({ path: test.info().outputPath('fin-390.png') });
  }, { viewport: { width: 390, height: 844 } });
});
