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
