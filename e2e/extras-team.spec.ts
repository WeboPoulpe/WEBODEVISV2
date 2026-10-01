import { test, expect, type Page } from '@playwright/test';
import { createQuote, horizontalOverflow, offscreenElements, sql, TEST_EMAIL_DOMAIN, withAccount } from './helpers';

// Équipe d'un événement côté traiteur : affectation de plusieurs extras d'un coup, alertes « déjà pris »
// et « pas disponible », effectif conseillé, envoi des missions, liens SMS / WhatsApp, page Extras et Paramètres.
// Tout se passe sur un compte d'essai supprimé à la fin ; les emails des extras sont en @test.webodevis.local
// (sendMail ne les envoie pas mais répond comme si c'était fait).

test.describe.configure({ mode: 'parallel' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'viewport fixé dans chaque test : un seul passage suffit'); });

const mail = (who: string) => `e2e-extra-${who}-${Date.now()}@${TEST_EMAIL_DOMAIN}`;

async function extra(userId: string, e: { name: string; role: string | null; phone?: string | null; email?: string | null; off?: string[] }) {
  const [row] = await sql<{ id: string; access_token: string }>(
    `insert into public.extras (user_id, name, role, phone, email, unavailable_dates) values ($1, $2, $3, $4, $5, $6::date[]) returning id, access_token`,
    [userId, e.name, e.role, e.phone ?? null, e.email ?? null, e.off ?? []],
  );
  return row;
}

/** Un mariage de 90 couverts, un autre événement le même jour, et cinq extras. */
async function seed(userId: string) {
  const quoteId = await createQuote(userId, { client_name: 'Mariage Durand', status: 'valide', guest_count: 90, event_type: 'Mariage', days: 30 });
  const otherId = await createQuote(userId, { client_name: 'Cocktail Lefèvre', status: 'valide', guest_count: 40, event_type: 'Cocktail', days: 30 });
  const [{ day }] = await sql<{ day: string }>(`select to_char(event_date, 'YYYY-MM-DD') as day from public.quotes where id = $1`, [quoteId]);
  const paul = await extra(userId, { name: 'Paul Martin', role: 'Serveur', phone: '06 12 34 56 78', email: mail('paul') });
  const marie = await extra(userId, { name: 'Marie Petit', role: 'Chef de rang', email: mail('marie') });
  const jean = await extra(userId, { name: 'Jean Roux', role: 'Cuisinier', phone: '06 98 76 54 32' });
  const luc = await extra(userId, { name: 'Luc Bernard', role: 'Plongeur', off: [day] });
  const sophie = await extra(userId, { name: 'Sophie Blanc', role: 'Serveur', email: mail('sophie') });
  await sql(`insert into public.event_extras (quote_id, extra_id, status) values ($1, $2, 'confirme')`, [otherId, sophie.id]);
  return { quoteId, otherId, day, paul, marie, jean, luc, sophie };
}

async function openTeam(page: Page, quoteId: string) {
  await page.goto(`/evenements/${quoteId}?onglet=extras`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('tab', { name: 'Extras' })).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 });
}

/** Capture de toute la hauteur : l'app défile dans son propre conteneur, une capture « pleine page » s'arrêterait à l'écran. */
async function tallShot(page: Page, file: string) {
  await page.setViewportSize({ width: 390, height: 2000 });
  await page.screenshot({ path: file });
  await page.setViewportSize({ width: 390, height: 844 });
}

/** Première compilation du serveur de dev : la page peut arriver vide ou se recharger ; on recharge jusqu'à l'avoir. */
async function untilShown(page: Page, locator: ReturnType<Page['locator']>) {
  await expect(async () => {
    if (!(await locator.first().isVisible())) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    await expect(locator.first()).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

const family = (page: Page, key: string) => page.locator(`[data-family="${key}"]`);
const card = (page: Page, name: string) => page.locator(`li[data-assignment="${name}"]`);

test('constituer l’équipe, effectif conseillé, envoi à toute l’équipe et liens SMS / WhatsApp', async ({ browser }) => {
  test.setTimeout(210_000);
  await withAccount(browser, 'extras-team', async (page, userId) => {
    const s = await seed(userId);
    await openTeam(page, s.quoteId);

    // Effectif conseillé pour 90 couverts à table : 6 serveurs, 2 cuisiniers, 2 plongeurs.
    await untilShown(page, family(page, 'service'));
    await expect(family(page, 'service')).toContainText('0 sur 6');
    await expect(family(page, 'cuisine')).toContainText('0 sur 2');
    await expect(family(page, 'plonge')).toContainText('0 sur 2');

    // Fenêtre « Affecter des extras » : alertes sans blocage.
    await expect(async () => {
      await page.getByRole('button', { name: 'Affecter des extras' }).click();
      await expect(page.getByRole('dialog', { name: 'Affecter des extras' })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    const dialog = page.getByRole('dialog', { name: 'Affecter des extras' });
    await expect(dialog.locator('li', { hasText: 'Sophie Blanc' })).toContainText('Déjà pris ce jour-là : Cocktail, Cocktail Lefèvre');
    await expect(dialog.locator('li', { hasText: 'Luc Bernard' })).toContainText('A indiqué ne pas être disponible ce jour');
    await expect(dialog.locator('li', { hasText: 'Paul Martin' })).not.toContainText('Déjà pris');

    for (const name of ['Paul Martin', 'Marie Petit', 'Jean Roux', 'Luc Bernard']) await dialog.getByRole('checkbox', { name }).check();
    await dialog.getByLabel('Heure d’arrivée').fill('18:00');
    await dialog.getByLabel('Heure de fin').fill('23:30');
    await dialog.getByLabel('Consignes pour toute l’équipe').fill('Tenue noire');
    await dialog.getByRole('button', { name: 'Affecter 4 extras' }).click();
    await expect(dialog).toBeHidden();

    const rows = await sql<{ arrival_time: string; departure_time: string; mission_notes: string; status: string }>(
      `select arrival_time, departure_time, mission_notes, status from public.event_extras where quote_id = $1`, [s.quoteId]);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r).toEqual({ arrival_time: '18:00', departure_time: '23:30', mission_notes: 'Tenue noire', status: 'a_solliciter' });

    // Une fois affectés, Luc garde l'alerte sur sa carte ; l'effectif se compte par rôle.
    await expect(card(page, 'Luc Bernard')).toContainText('A indiqué ne pas être disponible ce jour.');
    await expect(card(page, 'Paul Martin')).toContainText('Mission pas encore envoyée');
    await expect(family(page, 'service')).toContainText('2 sur 6');
    await expect(family(page, 'cuisine')).toContainText('1 sur 2');
    await expect(family(page, 'plonge')).toContainText('1 sur 2');

    // Luc décline : il ne compte plus dans l'effectif.
    await card(page, 'Luc Bernard').getByRole('radio', { name: 'Indisponible' }).click();
    await expect(family(page, 'plonge')).toContainText('0 sur 2');
    await expect.poll(async () => (await sql<{ status: string }>(`select status from public.event_extras where extra_id = $1`, [s.luc.id]))[0]?.status).toBe('refuse');

    // Envoyer à toute l'équipe : les trois missions en attente. Jean n'a ni email ni appareil.
    await expect(page.getByText('3 missions n’ont pas encore été envoyées.')).toBeVisible();
    await page.getByRole('button', { name: 'Envoyer à toute l’équipe' }).click();
    const notice = page.getByRole('status').filter({ hasText: 'Mission envoyée' });
    await expect(notice).toContainText('Mission envoyée à 2 extras : 2 par email.', { timeout: 30_000 });
    await expect(notice).toContainText('Sans email ni appareil enregistré');
    const sent = await sql<{ extra_id: string; invited_at: string | null }>(`select extra_id, invited_at from public.event_extras where quote_id = $1`, [s.quoteId]);
    const invited = (id: string) => sent.find((r) => r.extra_id === id)?.invited_at;
    expect(invited(s.paul.id)).toBeTruthy();
    expect(invited(s.marie.id)).toBeTruthy();
    expect(invited(s.jean.id)).toBeNull();
    expect(invited(s.luc.id)).toBeNull();
    await expect(card(page, 'Paul Martin')).toContainText('Mission envoyée le');
    // Jean n'a pas été joint : sa mission reste à envoyer (par SMS ou WhatsApp).
    await expect(page.getByText('Une mission n’a pas encore été envoyée.')).toBeVisible();

    // Proposer SMS / WhatsApp pour Jean : liens prêts, avec le lien de sa page.
    await notice.getByRole('button', { name: 'Jean Roux' }).click();
    const send = page.getByRole('dialog', { name: 'Envoyer la mission à Jean Roux' });
    await expect(send).toBeVisible();
    const link = encodeURIComponent(`http://localhost:3001/e/${s.jean.access_token}`);
    const sms = await send.getByRole('link', { name: /SMS/ }).getAttribute('href');
    expect(sms).toMatch(/^sms:0698765432\?&body=/);
    expect(sms).toContain(link);
    expect(decodeURIComponent(sms!.split('body=')[1])).toContain('Bonjour Jean,');
    expect(decodeURIComponent(sms!.split('body=')[1])).toContain('de 18:00 à 23:30');
    const wa = await send.getByRole('link', { name: /WhatsApp/ }).getAttribute('href');
    expect(wa).toMatch(/^https:\/\/wa\.me\/33698765432\?text=/);
    expect(wa).toContain(link);
    await send.getByRole('button', { name: 'Fermer' }).click();

    // Marie n'a pas de téléphone : SMS et WhatsApp ne sont pas proposés comme liens.
    await card(page, 'Marie Petit').getByRole('button', { name: 'Renvoyer la mission' }).click();
    const sendMarie = page.getByRole('dialog', { name: 'Envoyer la mission à Marie Petit' });
    await expect(sendMarie.getByText('Aucun numéro de téléphone pour cet extra.').first()).toBeVisible();
    await expect(sendMarie.getByRole('link')).toHaveCount(0);
    await sendMarie.getByRole('button', { name: 'Fermer' }).click();

    // Mission envoyée puis modifiée : heure de fin enregistrée, l'extra est prévenu.
    await card(page, 'Paul Martin').getByRole('button', { name: 'Modifier la mission' }).click();
    const edit = page.getByRole('dialog', { name: 'Modifier la mission' });
    await expect(edit.getByLabel('Heure de fin')).toHaveValue('23:30');
    await edit.getByLabel('Heure de fin').fill('00:30');
    await edit.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Paul Martin est prévenu du changement' })).toBeVisible();
    await expect(card(page, 'Paul Martin')).toContainText('fin vers 00:30');
    expect((await sql<{ departure_time: string }>(`select departure_time from public.event_extras where extra_id = $1`, [s.paul.id]))[0].departure_time).toBe('00:30');
  });
});

test('rendu téléphone : onglet Extras et page Extras sans débordement', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  await withAccount(browser, 'extras-mobile', async (page, userId) => {
    const s = await seed(userId);
    await sql(`update public.extras set role = 'Sommelier' where id = $1`, [s.marie.id]);
    await sql(
      `insert into public.event_extras (quote_id, extra_id, status, arrival_time, departure_time, mission_notes, invited_at, responded_at)
       values ($1, $2, 'confirme', '18:00', '23:30', 'Tenue noire', now(), now()), ($1, $3, 'a_solliciter', '18:00', null, null, null, null), ($1, $4, 'refuse', null, null, null, now(), now())`,
      [s.quoteId, s.paul.id, s.jean.id, s.luc.id]);

    await openTeam(page, s.quoteId);
    await untilShown(page, card(page, 'Paul Martin'));
    await expect(card(page, 'Paul Martin')).toContainText('A accepté lui-même le');
    await expect(card(page, 'Luc Bernard')).toContainText('A décliné lui-même le');
    await expect(card(page, 'Paul Martin').getByText('Confirmé').first()).toBeVisible();
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await tallShot(page, testInfo.outputPath('onglet-extras-390.png'));

    await page.getByRole('button', { name: 'Affecter des extras' }).click();
    await expect(page.getByRole('dialog', { name: 'Affecter des extras' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('affecter-390.png') });
    await page.keyboard.press('Escape');

    await card(page, 'Paul Martin').getByRole('button', { name: 'Renvoyer la mission' }).click();
    await expect(page.getByRole('dialog', { name: /Envoyer la mission/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('envoyer-390.png') });
    await page.keyboard.press('Escape');

    // Page Extras : liste, rôle hors liste conservé (« Autre »), page de missions, planning.
    await page.goto('/extras');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Modifier Luc Bernard' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('li', { hasText: 'Luc Bernard' }).first()).toContainText('Pas disponible le');
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await tallShot(page, testInfo.outputPath('page-extras-390.png'));

    await expect(async () => {
      await page.getByRole('button', { name: 'Modifier Marie Petit' }).click();
      await expect(page.getByRole('dialog', { name: 'Modifier l’extra' })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    const modal = page.getByRole('dialog', { name: 'Modifier l’extra' });
    await expect(modal.getByLabel('Rôle', { exact: true })).toHaveValue('__autre__');
    await expect(modal.getByLabel('Autre rôle')).toHaveValue('Sommelier');
    await expect(modal.getByText('Sa page de missions')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Copier le lien' })).toBeVisible();
    await modal.getByLabel('Rôle', { exact: true }).selectOption('Barman');
    await modal.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(modal).toBeHidden();
    expect((await sql<{ role: string }>(`select role from public.extras where id = $1`, [s.marie.id]))[0].role).toBe('Barman');

    await page.getByRole('tab', { name: 'Agenda' }).click();
    await expect(page.getByText('Jour pas libre')).toBeVisible();
    await expect(page.locator('td', { hasText: 'pas libre' }).first()).toBeVisible();
    expect(await horizontalOverflow(page), (await offscreenElements(page)).join('\n')).toBe(0);
    await tallShot(page, testInfo.outputPath('agenda-390.png'));
  }, { viewport: { width: 390, height: 844 } });
});

test('Paramètres : la section des notifications s’affiche et réagit', async ({ browser }) => {
  test.setTimeout(150_000);
  await withAccount(browser, 'extras-notif', async (page) => {
    await page.goto('/parametres');
    await page.waitForLoadState('networkidle');
    const section = page.getByRole('region', { name: 'Notifications sur cet appareil' });
    await untilShown(page, section);
    await expect(section).toContainText('Recevez une alerte quand un extra accepte ou refuse une mission.');
    // Le navigateur d'essai sans fenêtre refuse souvent les notifications d'office : la section l'explique.
    // Quand il les permet, « Activer » doit donner une réponse claire (activées, ou pourquoi pas).
    await page.context().grantPermissions(['notifications'], { origin: 'http://localhost:3001' });
    await page.reload();
    await page.waitForLoadState('networkidle');
    const blocked = section.getByText('Les notifications sont bloquées pour ce site.');
    const state = section.getByTestId('notif-state');
    await expect(blocked.or(state)).toBeVisible({ timeout: 20_000 });
    if (await state.isVisible()) {
      await expect(state).toHaveText('Coupées sur cet appareil.');
      await section.getByRole('button', { name: 'Activer' }).click();
      await expect(section.getByRole('alert').or(section.getByRole('status'))).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(blocked).toContainText('réglages de votre navigateur');
    }
  });
});
