import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { Client } from 'pg';

// Listes de base (modèles de location, page Matériel) et raccourcis vers un nouveau devis.
// Chaque test travaille sur un compte d'essai créé pour lui, puis supprimé : aucun compte réel n'est touché.

function envLocal(name: string): string {
  const line = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return (line ?? '').slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

async function sql<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const db = new Client({ connectionString: envLocal('DATABASE_URL').replace('sslmode=require', 'sslmode=verify-full') });
  await db.connect();
  try {
    return (await db.query(query, params)).rows as T[];
  } finally {
    await db.end();
  }
}

async function withAccount(browser: Browser, kind: string, run: (page: Page, userId: string) => Promise<void>) {
  const email = `e2e-${kind}-${Date.now()}@test.webodevis.local`;
  const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
  await sql(`insert into public.profiles (id, email, first_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Essai', 'user', true, true)`, [user.id, email]);
  const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
  try {
    await run(await context.newPage(), user.id);
  } finally {
    await sql(`delete from public.quotes where owner_user_id = $1`, [user.id]);
    await sql(`delete from public.customers where owner_user_id = $1`, [user.id]);
    await sql(`delete from public.users where id = $1`, [user.id]);
    await context.close();
  }
}

test('modèle de location : la liste de base remplit unités et quantités par couvert', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'location-base', async (page, userId) => {
    await page.goto('/location-templates');
    await page.waitForLoadState('networkidle');
    // La liste de base s'ouvre d'elle-même sur un modèle neuf. (En développement, le rechargement à chaud qui suit
    // la première compilation de la page peut vider la fenêtre : on recommence alors la saisie.)
    const dialog = page.getByRole('dialog', { name: 'Ajouter à « Dîner assis »' });
    await expect(async () => {
      if (!(await page.locator('#set-name').isVisible())) await page.getByRole('button', { name: 'Nouveau modèle' }).first().click();
      await page.locator('#set-name').fill('Dîner assis');
      await page.getByRole('button', { name: 'Créer le modèle' }).click();
      await expect(dialog).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 40_000 });
    await dialog.getByRole('checkbox', { name: 'Assiette plate 27 cm' }).check();
    await dialog.getByRole('checkbox', { name: 'Table ronde 10 personnes' }).check();
    await dialog.getByRole('button', { name: 'Ajouter 2 articles' }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText('Table ronde 10 personnes')).toBeVisible();

    const rows = await sql<{ material_name: string; unit: string; qty_per_guest: string }>(
      `select material_name, unit, qty_per_guest from public.rental_templates where user_id = $1 order by material_name`, [userId]);
    expect(rows.map((r) => [r.material_name, r.unit, Number(r.qty_per_guest)])).toEqual([
      ['Assiette plate 27 cm', 'pièce', 1],
      ['Table ronde 10 personnes', 'pièce', 0.1],
    ]);

    // Saisie à la main : un article connu apporte son unité et sa quantité.
    await page.getByRole('button', { name: 'Ajouter un article' }).click();
    await page.locator('#tpl-name').fill('Tasse et sous-tasse à café');
    await expect(page.locator('#tpl-unit')).toHaveValue('jeu');
  });
});

test('page Matériel : ajout depuis la liste de base, article perso, retrait', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'materiel-page', async (page, userId) => {
    await page.goto('/materiel');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Votre liste de matériel est vide')).toBeVisible();

    await page.getByRole('button', { name: 'Partir de la liste de base' }).click();
    const dialog = page.getByRole('dialog', { name: 'Liste de base' });
    await dialog.getByRole('checkbox', { name: 'Chafing dish', exact: true }).check();
    await expect(dialog.getByRole('spinbutton', { name: 'Quantité, Chafing dish' })).toHaveValue('4');
    await dialog.getByRole('button', { name: 'Ajouter 1 article' }).click();
    await expect(page.getByText('Chafing dish', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Nouvel article' }).click();
    await page.locator('#mat-name').fill('Nappe bordeaux');
    await page.locator('#mat-qty').fill('3');
    await page.locator('#mat-unit').selectOption('carton');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Nappe bordeaux')).toBeVisible({ timeout: 15_000 });
    const saved = await sql<{ name: string; unit: string; default_qty: string }>(`select name, unit, default_qty from public.material_presets where user_id = $1 order by name`, [userId]);
    expect(saved.map((r) => [r.name, r.unit, Number(r.default_qty)])).toEqual([['Chafing dish', 'pièce', 4], ['Nappe bordeaux', 'carton', 3]]);

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Retirer Nappe bordeaux' }).click();
    await expect(page.getByText('Nappe bordeaux')).toBeHidden();
    await expect.poll(async () => (await sql(`select 1 from public.material_presets where user_id = $1`, [userId])).length, { timeout: 15_000 }).toBe(1);
  });
});

test('nouveau devis depuis une fiche client et depuis un jour du calendrier', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'raccourcis', async (page, userId) => {
    const [customer] = await sql<{ id: string }>(
      `insert into public.customers (owner_user_id, user_id, customer_type, email, company_name, contact_person_name, address, siret_number, phone)
       values ($1, $1, 'entreprise', 'contact@maison-essai.test', 'Maison Essai', 'Claire Martin', '12 rue des Lilas, 75011 Paris', '12345678900011', '0102030405') returning id`, [userId]);

    // Depuis la fiche client : le client est déjà choisi.
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Maison Essai/ }).click();
    await page.getByRole('link', { name: 'Nouveau devis pour ce client' }).click();
    await expect(page).toHaveURL(new RegExp(`/devis/nouveau\\?client=${customer.id}`));
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Mariage' }).click();
    await page.locator('#nd-date').fill('2027-06-12');
    await page.locator('#nd-guests').fill('80');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Maison Essai').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Créer le devis' }).click();
    await expect(page).toHaveURL(/\/devis\/[^/]+\/modifier/, { timeout: 20_000 });

    const [quote] = await sql<{ customer_id: string; client_type: string; company_name: string; client_address: string; client_siret: string }>(
      `select customer_id, client_type, company_name, client_address, client_siret from public.quotes where owner_user_id = $1`, [userId]);
    expect(quote).toEqual({ customer_id: customer.id, client_type: 'entreprise', company_name: 'Maison Essai', client_address: '12 rue des Lilas, 75011 Paris', client_siret: '12345678900011' });

    // Depuis le calendrier : la date du jour choisi est reprise.
    await page.goto('/devis/nouveau?date=2027-03-05&couverts=45');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#nd-date')).toHaveValue('2027-03-05');
    await expect(page.locator('#nd-guests')).toHaveValue('45');
  });
});

test('dupliquer un devis pour un autre client, une autre date et un autre nombre de couverts', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'duplication', async (page, userId) => {
    const [other] = await sql<{ id: string }>(
      `insert into public.customers (owner_user_id, user_id, customer_type, email, first_name, last_name, address)
       values ($1, $1, 'particulier', 'lea.moreau@essai.test', 'Léa', 'Moreau', '4 place du Marché, 69002 Lyon') returning id`, [userId]);
    const services = [
      { id: 's1', name: 'Menu Prestige', quantity: 40, unitPrice: 30 },
      { id: 's2', name: 'Forfait livraison', quantity: 1, unitPrice: 150 },
    ];
    await sql(
      `insert into public.quotes (owner_user_id, user_id, client_name, client_first_name, client_last_name, event_date, event_type, guest_count, status, services, template)
       values ($1, $1, 'Paul Durand', 'Paul', 'Durand', '2027-05-01', 'Mariage', 40, 'devis_envoye', $2, 'classique')`, [userId, JSON.stringify(services)]);

    await page.goto('/devis');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^Actions pour/ }).first().click();
    await page.getByRole('button', { name: 'Dupliquer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Dupliquer le devis' });
    await expect(dialog.locator('#dup-guests')).toHaveValue('40');
    await dialog.getByRole('tab', { name: 'Autre client' }).click();
    await dialog.getByLabel('Rechercher un client').fill('Moreau');
    await dialog.getByRole('button', { name: /Léa Moreau/ }).click();
    await dialog.locator('#dup-date').fill('2027-09-18');
    await dialog.locator('#dup-guests').fill('60');
    await dialog.getByRole('button', { name: 'Créer la copie' }).click();
    await expect(page).toHaveURL(/\/devis\/[^/]+\/modifier\?mode=weboword/, { timeout: 20_000 });

    const [copy] = await sql<{ customer_id: string; client_name: string; client_address: string; event_date: string; guest_count: number; services: { name: string; quantity: number }[] }>(
      `select customer_id, client_name, client_address, to_char(event_date, 'YYYY-MM-DD') as event_date, guest_count, services
       from public.quotes where owner_user_id = $1 and client_name <> 'Paul Durand'`, [userId]);
    expect(copy.customer_id).toBe(other.id);
    expect(copy.client_name).toBe('Léa Moreau');
    expect(copy.client_address).toBe('4 place du Marché, 69002 Lyon');
    expect(copy.event_date).toBe('2027-09-18');
    expect(copy.guest_count).toBe(60);
    // Le menu suit les couverts, le forfait reste à 1.
    expect(copy.services.map((s) => [s.name, s.quantity])).toEqual([['Menu Prestige', 60], ['Forfait livraison', 1]]);
  });
});

test('prestations : prix modifié dans la liste, révision de tous les prix en pourcentage', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'prix', async (page, userId) => {
    await sql(`insert into public.prestations (user_id, name, unit_price) values ($1, 'Menu Terroir', 32), ($1, 'Cocktail dînatoire', 18.4), ($1, 'Forfait vaisselle', 0)`, [userId]);
    const price = async (name: string) => Number((await sql<{ unit_price: string }>(`select unit_price from public.prestations where user_id = $1 and name = $2`, [userId, name]))[0].unit_price);

    await page.goto('/prestations');
    await page.waitForLoadState('networkidle');
    const cell = page.getByLabel('Prix HT, Menu Terroir');
    await expect(cell).toHaveValue('32,00');
    await cell.fill('34,5');
    await cell.press('Enter');
    await expect.poll(() => price('Menu Terroir'), { timeout: 15_000 }).toBe(34.5);

    // +10 %, arrondi aux 10 centimes ; la prestation sans prix n'est pas touchée.
    await page.getByRole('button', { name: 'Réviser les prix' }).click();
    const dialog = page.getByRole('dialog', { name: 'Réviser les prix' });
    await dialog.getByLabel('Variation en %').fill('10');
    await dialog.getByRole('button', { name: 'Appliquer à 2 prestations' }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    expect(await price('Menu Terroir')).toBe(38);
    expect(await price('Cocktail dînatoire')).toBe(20.2);
    expect(await price('Forfait vaisselle')).toBe(0);
    await expect(page.getByLabel('Prix HT, Cocktail dînatoire')).toHaveValue('20,20');
    await sql(`delete from public.prestations where user_id = $1`, [userId]);
  });
});

test('éditeur WeboWord : statut, envoi et copie sans repasser par la liste', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'editeur-actions', async (page, userId) => {
    const [quote] = await sql<{ id: string }>(
      `insert into public.quotes (owner_user_id, user_id, client_name, client_email, event_date, event_type, guest_count, status, services, template)
       values ($1, $1, 'Paul Durand', 'paul.durand@essai.test', '2027-05-01', 'Mariage', 40, 'devis_a_faire', '[{"id":"s1","name":"Menu Prestige","quantity":40,"unitPrice":30}]', 'classique') returning id`, [userId]);
    const status = async () => (await sql<{ status: string }>(`select status from public.quotes where id = $1`, [quote.id]))[0].status;

    await page.goto(`/devis/${quote.id}/modifier?mode=weboword`);
    await page.waitForLoadState('networkidle');
    const sidebar = page.locator('aside');

    // Envoi : le document est enregistré, le devis part et passe en « Devis envoyé ».
    await sidebar.getByRole('button', { name: 'Envoyer au client' }).click();
    const send = page.getByRole('dialog', { name: 'Envoyer le devis au client' });
    await expect(send.locator('#send-to')).toHaveValue('paul.durand@essai.test', { timeout: 20_000 });
    await send.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByRole('dialog', { name: 'Devis envoyé' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('dialog', { name: 'Devis envoyé' }).getByRole('button', { name: 'Fermer', exact: true }).last().click();
    expect(await status()).toBe('devis_envoye');
    await expect(sidebar.getByLabel('Statut du devis')).toHaveValue('devis_envoye');

    // Statut changé depuis l'éditeur ; un devis validé mène à son événement.
    await sidebar.getByLabel('Statut du devis').selectOption('valide');
    await expect.poll(status, { timeout: 15_000 }).toBe('valide');
    await expect(sidebar.getByRole('link', { name: 'Préparer l’événement' })).toHaveAttribute('href', `/evenements/${quote.id}`);

    // Copie depuis l'éditeur.
    await sidebar.getByRole('button', { name: 'Dupliquer' }).click();
    await expect(page.getByRole('dialog', { name: 'Dupliquer le devis' })).toBeVisible({ timeout: 20_000 });
  });
});
