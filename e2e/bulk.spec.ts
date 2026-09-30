import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { Client } from 'pg';

// Changement de mot de passe, actions groupées (devis, prestations) et formulaire public /p.
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

const TEST_EMAIL = /^e2e-[^@]+@test\.webodevis\.local$/;

async function withAccount(
  browser: Browser,
  kind: string,
  run: (page: Page, userId: string) => Promise<void>,
  options: { passwordHash?: string; viewport?: { width: number; height: number }; mobile?: boolean } = {},
) {
  const email = `e2e-${kind}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.webodevis.local`;
  const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, $2) returning id`, [email, options.passwordHash ?? 'x']);
  await sql(`insert into public.profiles (id, email, first_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Essai', 'user', true, true)`, [user.id, email]);
  const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    hasTouch: !!options.mobile, isMobile: !!options.mobile,
    storageState: { cookies: [], origins: [] },
  });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
  try {
    await run(await context.newPage(), user.id);
  } finally {
    // La fermeture peut échouer (trace, navigateur tombé) : le nettoyage a lieu quand même.
    await context.close().catch(() => {});
    // Garde-fou : ne supprime que si le compte est bien un compte d'essai.
    const [row] = await sql<{ email: string }>(`select email from public.users where id = $1`, [user.id]);
    if (row && TEST_EMAIL.test(row.email)) {
      await sql(`delete from public.prospect_requests where owner_user_id = $1`, [user.id]);
      await sql(`delete from public.user_prospect_tokens where user_id = $1`, [user.id]);
      await sql(`delete from public.quotes where owner_user_id = $1 or user_id = $1`, [user.id]);
      await sql(`delete from public.quote_folders where owner_user_id = $1`, [user.id]);
      await sql(`delete from public.customers where owner_user_id = $1`, [user.id]);
      await sql(`delete from public.prestations where user_id = $1`, [user.id]);
      await sql(`delete from public.prestation_subcategories where user_id = $1`, [user.id]);
      await sql(`delete from public.prestation_categories where user_id = $1`, [user.id]);
      await sql(`delete from public.users where id = $1 and email like 'e2e-%@test.webodevis.local'`, [user.id]);
    }
  }
}

/** Devis d'essai minimal. */
async function quote(userId: string, name: string, status: string, extra: { prospectId?: string; folderId?: string } = {}) {
  const [row] = await sql<{ id: string }>(
    `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services, template, prospect_id, folder_id)
     values ($1, $1, $2, '2027-06-12', 'Mariage', 50, $3, '[]', 'classique', $4, $5) returning id`,
    [userId, name, status, extra.prospectId ?? null, extra.folderId ?? null]);
  return row.id;
}

test('paramètres : changer son mot de passe une fois connecté', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  const passwordHash = await bcrypt.hash('ancien-mdp', 10);
  await withAccount(browser, 'mot-de-passe', async (page, userId) => {
    const hash = async () => (await sql<{ password_hash: string }>(`select password_hash from public.users where id = $1`, [userId]))[0].password_hash;
    await page.goto('/parametres');
    await page.waitForLoadState('networkidle');
    const form = page.getByRole('form', { name: 'Changer le mot de passe' });
    const submit = form.getByRole('button', { name: 'Changer le mot de passe' });

    // Les deux nouveaux ne correspondent pas : refusé avant tout envoi.
    await expect(async () => {
      await form.getByLabel('Mot de passe actuel').fill('ancien-mdp');
      await form.getByLabel('Nouveau mot de passe', { exact: true }).fill('nouveau-mdp');
      await form.getByLabel('Confirmer le nouveau mot de passe').fill('autre-chose');
      await submit.click();
      await expect(form.getByRole('alert')).toHaveText('Les deux nouveaux mots de passe ne correspondent pas.', { timeout: 5_000 });
    }).toPass({ timeout: 40_000 });

    // Mauvais mot de passe actuel : refusé par le serveur, rien ne change.
    await form.getByLabel('Mot de passe actuel').fill('pas-le-bon');
    await form.getByLabel('Confirmer le nouveau mot de passe').fill('nouveau-mdp');
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('Le mot de passe actuel n’est pas le bon.', { timeout: 15_000 });
    expect(await bcrypt.compare('ancien-mdp', await hash())).toBe(true);

    // Trop court.
    await form.getByLabel('Mot de passe actuel').fill('ancien-mdp');
    await form.getByLabel('Nouveau mot de passe', { exact: true }).fill('abc');
    await form.getByLabel('Confirmer le nouveau mot de passe').fill('abc');
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('Le nouveau mot de passe doit faire au moins 6 caractères.');

    // Le bon : enregistré, les champs se vident.
    await form.getByLabel('Nouveau mot de passe', { exact: true }).fill('nouveau-mdp');
    await form.getByLabel('Confirmer le nouveau mot de passe').fill('nouveau-mdp');
    await submit.click();
    await expect(form.getByRole('status')).toContainText('Mot de passe changé', { timeout: 15_000 });
    expect(await bcrypt.compare('nouveau-mdp', await hash())).toBe(true);
    await expect(form.getByLabel('Mot de passe actuel')).toHaveValue('');
  }, { passwordHash });
});

test('liste des devis : statut, dossier et suppression en groupe', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'devis-groupes', async (page, userId) => {
    const [prospect] = await sql<{ id: string }>(
      `insert into public.prospect_requests (first_name, last_name, email, status, owner_user_id) values ('Claire', 'Martin', 'claire@essai.test', 'devis_envoye', $1) returning id`, [userId]);
    const [folder] = await sql<{ id: string }>(`insert into public.quote_folders (owner_user_id, name) values ($1, 'Mariages 2027') returning id`, [userId]);
    const a = await quote(userId, 'Alice Brouillon', 'devis_a_faire');
    const b = await quote(userId, 'Bruno Brouillon', 'devis_a_faire');
    const c = await quote(userId, 'Claire Martin', 'devis_envoye', { prospectId: prospect.id });
    const d = await quote(userId, 'Denis Glissé', 'devis_a_faire');
    const row = async (id: string) => (await sql<{ status: string; folder_id: string | null }>(`select status, folder_id from public.quotes where id = $1`, [id]))[0];

    await page.goto('/devis');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('checkbox', { name: 'Sélectionner Alice Brouillon' })).toBeVisible({ timeout: 20_000 });

    // Le menu « Actions pour … » et le glisser-déposer vers un dossier marchent toujours.
    await page.getByRole('button', { name: 'Actions pour Alice Brouillon' }).click();
    await expect(page.getByRole('dialog', { name: 'Alice Brouillon' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Alice Brouillon' }).getByRole('button', { name: 'Fermer' }).click();
    await page.locator('li', { hasText: 'Denis Glissé' }).dragTo(page.locator('div[title="Ouvrir « Mariages 2027 »"]'));
    await expect.poll(async () => (await row(d)).folder_id, { timeout: 15_000 }).toBe(folder.id);

    // Statut : Alice et Claire passent en « Devis final » ; la demande de Claire suit.
    const toolbar = page.getByRole('toolbar', { name: 'Actions sur la sélection' });
    await page.getByRole('checkbox', { name: 'Sélectionner Alice Brouillon' }).check();
    await page.getByRole('checkbox', { name: 'Sélectionner Claire Martin' }).check();
    await expect(toolbar).toContainText('2 sélectionnés');
    await toolbar.getByLabel('Changer le statut des devis sélectionnés').selectOption('devis_final');
    await expect.poll(async () => (await row(a)).status, { timeout: 15_000 }).toBe('devis_final');
    expect((await row(c)).status).toBe('devis_final');
    expect((await row(b)).status).toBe('devis_a_faire');
    expect((await sql<{ status: string }>(`select status from public.prospect_requests where id = $1`, [prospect.id]))[0].status).toBe('devis_final');
    await expect(toolbar).toContainText('Tout cocher (4)');

    // Dossier : Bruno et Claire rangés dans « Mariages 2027 ».
    await page.getByRole('checkbox', { name: 'Sélectionner Bruno Brouillon' }).check();
    await page.getByRole('checkbox', { name: 'Sélectionner Claire Martin' }).check();
    await toolbar.getByRole('button', { name: 'Déplacer' }).click();
    await expect(page.getByText('2 devis sélectionnés')).toBeVisible();
    await page.getByRole('button', { name: 'Mariages 2027', exact: true }).click();
    await expect.poll(async () => (await row(b)).folder_id, { timeout: 15_000 }).toBe(folder.id);
    expect((await row(c)).folder_id).toBe(folder.id);
    expect((await row(a)).folder_id).toBeNull();

    // Suppression : tout cocher ; la confirmation dit combien ne sont pas des brouillons (Alice et Claire).
    await toolbar.getByRole('checkbox', { name: 'Tout cocher' }).check();
    await expect(toolbar).toContainText('4 sélectionnés');
    await toolbar.getByRole('button', { name: 'Supprimer' }).click();
    const confirm = page.getByRole('dialog', { name: 'Supprimer 4 devis ?' });
    await expect(confirm).toContainText('Dont 2 qui ne sont pas des brouillons');
    await confirm.getByRole('button', { name: 'Supprimer 4 devis' }).click();
    await expect(confirm).toBeHidden({ timeout: 15_000 });
    await expect.poll(async () => (await sql(`select 1 from public.quotes where owner_user_id = $1`, [userId])).length, { timeout: 15_000 }).toBe(0);
    await expect(page.getByText('Aucun devis en cours')).toBeVisible();
  });
});

test('prestations : changer la catégorie et supprimer en groupe', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  await withAccount(browser, 'prestations-groupes', async (page, userId) => {
    const [cat] = await sql<{ id: string }>(`insert into public.prestation_categories (user_id, name) values ($1, 'Buffets essai') returning id`, [userId]);
    const [sub] = await sql<{ id: string }>(`insert into public.prestation_subcategories (user_id, category_id, name) values ($1, $2, 'Froid') returning id`, [userId, cat.id]);
    await sql(`insert into public.prestations (user_id, name, unit_price, category, sub_category) values
      ($1, 'Plateau charcuterie', 12, 'cocktail', 'Buffet'), ($1, 'Plateau fromages', 14, 'cocktail', 'Buffet'), ($1, 'Forfait service', 250, 'personnel', null)`, [userId]);
    const rows = async () => sql<{ name: string; category: string | null; sub_category: string | null; category_id: string | null; sub_category_id: string | null }>(
      `select name, category, sub_category, category_id, sub_category_id from public.prestations where user_id = $1 order by name`, [userId]);

    await page.goto('/prestations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('checkbox', { name: 'Sélectionner Plateau charcuterie' }).check({ timeout: 20_000 });
    await page.getByRole('checkbox', { name: 'Sélectionner Plateau fromages' }).check();
    const toolbar = page.getByRole('toolbar', { name: 'Actions sur la sélection' });
    await expect(toolbar).toContainText('2 sélectionnées');
    await toolbar.getByRole('button', { name: 'Changer de catégorie' }).click();
    const dialog = page.getByRole('dialog', { name: 'Changer de catégorie' });
    await dialog.getByLabel('Catégorie', { exact: true }).selectOption(cat.id);
    await dialog.getByLabel('Sous-catégorie').selectOption(sub.id);
    await dialog.getByRole('button', { name: 'Appliquer à 2 prestations' }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    const after = await rows();
    expect(after.map((r) => [r.name, r.category, r.sub_category, r.category_id, r.sub_category_id])).toEqual([
      ['Forfait service', 'personnel', null, null, null],
      ['Plateau charcuterie', 'Buffets essai', 'Froid', cat.id, sub.id],
      ['Plateau fromages', 'Buffets essai', 'Froid', cat.id, sub.id],
    ]);
    await expect(page.getByRole('heading', { name: /Buffets essai/ })).toBeVisible();

    // Le prix reste modifiable dans la ligne.
    const cell = page.getByLabel('Prix HT, Forfait service');
    await cell.fill('260');
    await cell.press('Enter');
    await expect.poll(async () => Number((await sql<{ unit_price: string }>(`select unit_price from public.prestations where user_id = $1 and name = 'Forfait service'`, [userId]))[0].unit_price), { timeout: 15_000 }).toBe(260);

    // Suppression groupée, après confirmation.
    await toolbar.getByRole('checkbox', { name: 'Tout cocher' }).check();
    await page.getByRole('checkbox', { name: 'Sélectionner Forfait service' }).uncheck();
    await toolbar.getByRole('button', { name: 'Supprimer' }).click();
    const confirm = page.getByRole('dialog', { name: 'Supprimer 2 prestations ?' });
    await expect(confirm).toContainText('Plateau fromages');
    await confirm.getByRole('button', { name: 'Supprimer 2 prestations' }).click();
    await expect(confirm).toBeHidden({ timeout: 15_000 });
    expect((await rows()).map((r) => r.name)).toEqual(['Forfait service']);
  });
});

test('formulaire public /p : aux couleurs de la charte', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' && testInfo.project.name !== 'mobile', 'bureau et téléphone');
  const mobile = testInfo.project.name === 'mobile';
  await withAccount(browser, 'formulaire-public', async (page, userId) => {
    const token = `e2e${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    await sql(`insert into public.user_prospect_tokens (user_id, token, is_active) values ($1, $2, true)`, [userId, token]);
    await page.goto(`/p/${token}`);
    await expect(page.getByRole('heading', { name: 'Demande de devis' })).toBeVisible({ timeout: 20_000 });
    // Aucun violet de l'ancienne charte : l'icône est sur le vert sapin.
    const html = await page.evaluate(() => { const b = document.body.cloneNode(true) as HTMLElement; b.querySelectorAll('script, next-route-announcer').forEach((n) => n.remove()); return b.innerHTML; });
    expect(html).not.toMatch(/9c27b0|ce93d8|violet|purple|indigo/i);
    const iconBg = await page.locator('h1').locator('xpath=preceding-sibling::div[1]').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(iconBg).toBe('rgb(28, 38, 33)');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath('formulaire-public.png'), fullPage: true });
  }, mobile ? { viewport: { width: 360, height: 740 }, mobile: true } : {});
});

test('téléphone : cases à cocher et barre d’actions utilisables au doigt', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'passage téléphone');
  await withAccount(browser, 'groupes-mobile', async (page, userId) => {
    await quote(userId, 'Alice Brouillon', 'devis_a_faire');
    await quote(userId, 'Bruno Brouillon', 'devis_envoye');
    await sql(`insert into public.prestations (user_id, name, unit_price, category) values ($1, 'Plateau charcuterie', 12, 'cocktail'), ($1, 'Forfait service', 250, 'personnel')`, [userId]);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    for (const [url, name] of [['/devis', 'Alice Brouillon'], ['/prestations', 'Plateau charcuterie']] as const) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const box = page.getByRole('checkbox', { name: `Sélectionner ${name}` });
      await expect(box).toBeVisible({ timeout: 20_000 });
      // La cible tactile est la zone de 40 px autour de la case.
      const target = await box.locator('xpath=..').boundingBox();
      expect(target!.width).toBeGreaterThanOrEqual(40);
      expect(target!.height).toBeGreaterThanOrEqual(40);
      await box.tap();
      await expect(box).toBeChecked();
      const toolbar = page.getByRole('toolbar', { name: 'Actions sur la sélection' });
      for (const button of await toolbar.getByRole('button').all()) {
        const b = await button.boundingBox();
        expect(b!.height).toBeGreaterThanOrEqual(40);
      }
      expect(await overflow()).toBeLessThanOrEqual(0);
      await page.screenshot({ path: testInfo.outputPath(`selection${url.replace('/', '-')}.png`), fullPage: true });
    }

    await page.goto('/parametres');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('form', { name: 'Changer le mot de passe' })).toBeVisible({ timeout: 20_000 });
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath('parametres.png'), fullPage: true });
  }, { viewport: { width: 360, height: 740 }, mobile: true });
});
