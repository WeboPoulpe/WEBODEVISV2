import path from 'node:path';
import os from 'node:os';
import { test, expect, type Page } from '@playwright/test';
import { createQuote, horizontalOverflow, offscreenElements, sql, TEST_EMAIL_DOMAIN, withAccount } from './helpers';

// Tableau de bord : la liste « À faire » (chaque type de tâche, l'ordre par urgence, les liens), le compte
// sans rien à faire, un compte sans l'option Extras, et le rendu sur téléphone.
// Tout se passe sur des comptes d'essai supprimés à la fin.

test.describe.configure({ mode: 'parallel' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'viewport fixé dans chaque test : un seul passage suffit'); });

const SHOTS = process.env.DASHBOARD_SHOTS || path.join(os.tmpdir(), 'dashboard-shots');

async function extra(userId: string, name: string, role: string) {
  const [row] = await sql<{ id: string }>(`insert into public.extras (user_id, name, role) values ($1, $2, $3) returning id`, [userId, name, role]);
  return row.id;
}
const assign = (quoteId: string, extraId: string, status: string) =>
  sql(`insert into public.event_extras (quote_id, extra_id, status) values ($1, $2, $3)`, [quoteId, extraId, status]);
const checklist = (quoteId: string, items: { text: string; done: boolean }[]) =>
  sql(`update public.quotes set checklist = $2::jsonb where id = $1`, [quoteId, JSON.stringify(items.map((i, n) => ({ id: `t${n}`, ...i })))]);

/** Un compte qui a de quoi remplir chaque type de tâche, plus un événement prêt. */
async function seed(userId: string) {
  // Demande reçue il y a 3 jours, pas encore traitée.
  const [prospect] = await sql<{ id: string }>(
    `insert into public.prospect_requests (owner_user_id, first_name, last_name, email, event_type, guest_count, status, created_at)
     values ($1, 'Julie', 'Martin', $2, 'Anniversaire', 30, 'nouveau', now() - interval '3 days') returning id`,
    [userId, `e2e-prospect-${Date.now()}@${TEST_EMAIL_DOMAIN}`],
  );
  // Devis à faire, créé aujourd'hui.
  const aFaire = await createQuote(userId, { client_name: 'Société Leroy', status: 'devis_a_faire', days: 45 });
  // Devis envoyé il y a 9 jours, sans réponse.
  const relance = await createQuote(userId, { client_name: 'Famille Durand', status: 'devis_envoye', days: 60 });
  await sql(`update public.quotes set sent_at = now() - interval '9 days' where id = $1`, [relance]);

  // Événement dans 2 jours : checklist incomplète, courses à faire, un extra sans réponse, un indisponible, pas de location.
  const proche = await createQuote(userId, { client_name: 'Mariage Petit', status: 'acompte', days: 2, guest_count: 90 });
  await checklist(proche, [{ text: 'Confirmer le lieu', done: true }, { text: 'Imprimer les menus', done: false }]);
  const [beurre] = await sql<{ id: string }>(
    `insert into public.ingredients (user_id, name, unit, stock_quantity, min_stock_alert) values ($1, 'Beurre doux', 'kg', 1, 5) returning id`, [userId]);
  await sql(`insert into public.event_ingredients (quote_id, ingredient_id, quantity, checked) values ($1, $2, 3, false)`, [proche, beurre.id]);
  await assign(proche, await extra(userId, 'Paul Serveur', 'Serveur'), 'a_solliciter');
  await assign(proche, await extra(userId, 'Léa Serveuse', 'Serveur'), 'refuse');
  // Le compte se sert des modèles de location : un événement sans location est signalé.
  await sql(`insert into public.rental_templates (user_id, material_name, qty_per_guest) values ($1, 'Assiette plate', 1)`, [userId]);

  // Devis validé dans 10 jours, sans acompte, location saisie mais pas commandée.
  const valide = await createQuote(userId, { client_name: 'Cocktail Lefèvre', status: 'valide', days: 10, guest_count: 40, event_type: 'Cocktail',
    // 40 × 25 € HT, une option et une ligne offerte qui ne comptent pas : 1 200 € TTC.
    services: [
      { id: 'l1', name: 'Cocktail dînatoire', quantity: 40, unitPrice: 25 },
      { id: 'l2', name: 'Champagne', quantity: 40, unitPrice: 10, isOption: true },
      { id: 'l3', name: 'Mignardises', quantity: 40, unitPrice: 3, isFree: true },
    ] });
  await sql(`insert into public.rental_items (quote_id, material_name, qty, ordered) values ($1, 'Verres à vin', 40, false)`, [valide]);

  // Événement prêt : équipe complète et confirmée, checklist faite, location commandée.
  const pret = await createQuote(userId, { client_name: 'Dîner Garnier', status: 'paye', days: 12, guest_count: 10 });
  await checklist(pret, [{ text: 'Tout est prêt', done: true }]);
  await assign(pret, await extra(userId, 'Marc Serveur', 'Serveur'), 'confirme');
  await assign(pret, await extra(userId, 'Anne Cuisinière', 'Cuisinier'), 'confirme');
  await sql(`insert into public.rental_items (quote_id, material_name, qty, ordered) values ($1, 'Nappes', 2, true)`, [pret]);

  // Commande envoyée il y a 5 jours, pas reçue.
  const [supplier] = await sql<{ id: string }>(`insert into public.suppliers (owner_user_id, user_id, name) values ($1, $1, 'Primeur Dupont') returning id`, [userId]);
  await sql(`insert into public.supplier_orders (user_id, supplier_id, status, ordered_at) values ($1, $2, 'sent', now() - interval '5 days')`, [userId, supplier.id]);
  // Notification importante non lue.
  await sql(`insert into public.notifications (user_id, title, message, type, priority) values ($1, 'Rappel : facture à envoyer', 'La facture du dîner Garnier n’est pas encore partie.', 'task_reminder', 'high')`, [userId]);

  return { prospect: prospect.id, aFaire, relance, proche, valide, pret };
}

/** Le serveur de dev peut être lent à compiler : on recharge jusqu'à voir la liste. */
async function openDashboard(page: Page, ready: ReturnType<Page['locator']>) {
  await expect(async () => {
    if (!(await ready.first().isVisible())) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
    await expect(ready.first()).toBeVisible({ timeout: 20_000 });
  }).toPass({ timeout: 150_000 });
}

/** Capture de toute la hauteur : l'app défile dans son propre conteneur. */
async function tallShot(page: Page, file: string, width: number) {
  const before = page.viewportSize();
  await page.setViewportSize({ width, height: 2600 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, file) });
  if (before) await page.setViewportSize(before);
}

test('à faire : chaque type de tâche, la plus urgente d’abord, avec ses liens', async ({ browser }) => {
  test.setTimeout(240_000);
  await withAccount(browser, 'dashboard', async (page, userId) => {
    const s = await seed(userId);
    await openDashboard(page, page.locator('[data-todo]'));

    // Toutes les tâches, y compris celles repliées sous « Afficher les autres ».
    const more = page.getByRole('button', { name: /Afficher les \d+ autres/ });
    if (await more.isVisible()) await more.click();

    const keys = await page.locator('[data-todo]').evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-key')));
    expect(keys).toEqual([
      `location:${s.proche}`, // événement dans 2 jours, rien de loué (échéance J-7)
      `acompte:${s.valide}`, // validé, événement dans 10 jours (échéance J-14)
      `relance:${s.relance}`, // envoyé il y a 9 jours (échéance au 7e jour)
      expect.stringMatching(/^commande:/), // envoyée il y a 5 jours (réception attendue sous 3 jours)
      `preparation:${s.proche}`, // événement dans 2 jours (échéance J-3)
      `prospect:${s.prospect}`, // reçue il y a 3 jours (réponse sous 2 jours)
      expect.stringMatching(/^notification:/), // reçue aujourd'hui
      `location:${s.valide}`, // 1 article à commander (échéance J-7)
      `devis:${s.aFaire}`, // créé aujourd'hui (échéance à 3 jours)
      `preparation:${s.valide}`, // équipe à constituer (échéance J-3)
      'stock', // sans échéance
    ]);
    // L'événement prêt n'est pas dans la liste.
    expect(keys.some((k) => k?.includes(s.pret))).toBe(false);

    // Regroupement par échéance : en retard d'abord.
    const buckets = await page.locator('[data-bucket]').evaluateAll((els) => els.map((e) => e.getAttribute('data-bucket')));
    expect(buckets).toEqual(['retard', 'aujourdhui', 'semaine']);

    // Phrases et liens.
    const row = (key: string) => page.locator(`[data-todo-key="${key}"]`);
    await expect(row(`relance:${s.relance}`)).toContainText('Relancer Famille Durand : devis envoyé il y a 9 jours');
    await expect(row(`relance:${s.relance}`).getByRole('link').first()).toHaveAttribute('href', `/devis/${s.relance}/modifier`);
    await expect(row(`prospect:${s.prospect}`)).toContainText('Répondre à la demande de Julie Martin');
    await expect(row(`prospect:${s.prospect}`).getByRole('link').first()).toHaveAttribute('href', `/prospects?convert=${s.prospect}`);
    await expect(row(`devis:${s.aFaire}`)).toContainText('Faire le devis de Société Leroy');
    await expect(row(`acompte:${s.valide}`)).toContainText('Acompte à recevoir : Cocktail Lefèvre');
    await expect(row(`acompte:${s.valide}`)).toContainText(/Devis validé de 1\s200\s€/);
    // Résumé : le chiffre d'affaires de l'événement est au vrai total TTC du devis.
    await expect(page.getByTestId('upcoming').locator('[data-event="Cocktail Lefèvre"]')).toContainText(/1\s200\s€/);
    await expect(row(`location:${s.proche}`)).toContainText('Location à prévoir : Mariage Petit');
    await expect(row(`location:${s.proche}`).getByRole('link').first()).toHaveAttribute('href', `/evenements/${s.proche}?onglet=materiel`);
    await expect(row(`location:${s.valide}`)).toContainText('Location à commander : Cocktail Lefèvre');
    await expect(row('stock')).toContainText('Beurre doux');
    await expect(row('stock').getByRole('link').first()).toHaveAttribute('href', '/stock');
    await expect(row(keys[3] as string)).toContainText('Vérifier la réception : commande Primeur Dupont');
    await expect(row(keys[3] as string).getByRole('link').first()).toHaveAttribute('href', '/commandes');
    await expect(row(keys[6] as string)).toContainText('Rappel : facture à envoyer');

    // Événement pas prêt : un lien par chose qui manque, vers le bon onglet.
    const prep = row(`preparation:${s.proche}`);
    await expect(prep).toContainText('Préparer l’événement Mariage Petit');
    const chip = (label: string | RegExp) => prep.getByRole('list', { name: 'Ce qui manque' }).getByRole('link', { name: label });
    await expect(chip('Checklist 1 sur 2')).toHaveAttribute('href', `/evenements/${s.proche}?onglet=checklist`);
    await expect(chip('Courses : 1 article à acheter')).toHaveAttribute('href', `/evenements/${s.proche}?onglet=courses`);
    await expect(chip('1 extra indisponible à remplacer')).toHaveAttribute('href', `/evenements/${s.proche}?onglet=extras`);
    await expect(chip('1 extra sans réponse')).toHaveAttribute('href', `/evenements/${s.proche}?onglet=extras`);
    // 90 couverts à table : 6 serveurs conseillés, 1 seul prévu (l'indisponible ne compte pas).
    await expect(chip(/Équipe : il manque 5 serveurs, 2 cuisiniers, 2 plongeurs/)).toHaveAttribute('href', `/evenements/${s.proche}?onglet=extras`);

    // Prochains événements : l'événement prêt est marqué « Prêt », les autres ont des points à régler.
    const upcoming = page.getByTestId('upcoming');
    await expect(upcoming.locator('[data-event="Dîner Garnier"]')).toContainText('Prêt');
    await expect(upcoming.locator('[data-event="Mariage Petit"]')).toContainText('points à régler');

    // Le lien mène bien à l'onglet.
    await chip('Checklist 1 sur 2').click();
    await expect(page).toHaveURL(new RegExp(`/evenements/${s.proche}\\?onglet=checklist`), { timeout: 60_000 });
    await expect(page.getByRole('tab', { name: 'Checklist' })).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 });

    // Captures bureau.
    await page.goto('/');
    await openDashboard(page, page.locator('[data-todo]'));
    await tallShot(page, 'dashboard-bureau.png', 1440);
  });
});

test('compte sans rien à faire : « Rien d’urgent »', async ({ browser }) => {
  test.setTimeout(180_000);
  await withAccount(browser, 'dashboard-vide', async (page) => {
    await openDashboard(page, page.getByTestId('todo-empty'));
    await expect(page.getByTestId('todo-empty')).toContainText('Rien d’urgent');
    await expect(page.getByTestId('dashboard-headline')).toHaveText('Rien d’urgent pour le moment.');
    await expect(page.getByTestId('upcoming')).toContainText('Aucun événement confirmé à venir.');
    await tallShot(page, 'dashboard-vide.png', 1440);
  });
});

test('compte sans l’option Extras : rien sur les extras', async ({ browser }) => {
  test.setTimeout(180_000);
  await withAccount(browser, 'dashboard-sans-extras', async (page, userId) => {
    await sql(`update public.profiles set modules = '["prospects","evenements","stock"]'::jsonb where id = $1`, [userId]);
    const quoteId = await createQuote(userId, { client_name: 'Baptême Moreau', status: 'acompte', days: 3, guest_count: 60 });
    await checklist(quoteId, [{ text: 'Appeler le client', done: false }]);
    await assign(quoteId, await extra(userId, 'Paul Serveur', 'Serveur'), 'a_solliciter');

    const prep = page.locator(`[data-todo-key="preparation:${quoteId}"]`);
    await openDashboard(page, prep);
    await expect(prep).toContainText('Checklist 0 sur 1');
    await expect(prep).not.toContainText(/extra|Équipe/);
  });
});

test('téléphone 390 px : pas de débordement', async ({ browser }) => {
  test.setTimeout(240_000);
  await withAccount(browser, 'dashboard-mobile', async (page, userId) => {
    await seed(userId);
    await openDashboard(page, page.locator('[data-todo]'));
    await expect(page.getByTestId('activity')).toContainText('Devis en cours');
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await offscreenElements(page)).toEqual([]);
    // Cibles tactiles des liens d'action : au moins 40 px.
    const heights = await page.locator('[data-todo] a').evaluateAll((els) => els.map((e) => (e as HTMLElement).getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(40);
    await tallShot(page, 'dashboard-telephone.png', 390);
  }, { viewport: { width: 390, height: 844 } });
});
