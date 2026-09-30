import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { Client } from 'pg';
import { shot, horizontalOverflow } from './helpers';

// Espace d'administration : pages, création et gestion d'un compte, ouverture du compte d'un client, demandes du site.

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

/** Ouvre un navigateur connecté avec le compte d'un administrateur (session signée localement). */
async function adminPage(browser: Browser, viewport: { width: number; height: number } | null) {
  const [admin] = await sql<{ id: string; email: string }>(
    `select id, email from public.profiles where role = 'admin' and is_active order by created_at limit 1`);
  test.skip(!admin, 'aucun compte administrateur dans la base de développement');
  const token = await encode({ token: { sub: admin.id, email: admin.email }, secret: envLocal('NEXTAUTH_SECRET') });
  const context = await browser.newContext({ viewport: viewport ?? undefined, storageState: { cookies: [], origins: [] } });
  await context.addCookies([{
    name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/',
    httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
  return { context, page: await context.newPage(), admin };
}

test.describe('administration', () => {
  for (const { name, url, heading } of [
    { name: 'admin-vue-d-ensemble', url: '/admin', heading: 'Vue d’ensemble' },
    { name: 'admin-comptes', url: '/admin/comptes', heading: 'Comptes' },
    { name: 'admin-demandes', url: '/admin/demandes', heading: 'Demandes' },
    { name: 'admin-reglages', url: '/admin/reglages', heading: 'Réglages' },
  ]) {
    test(`${name} : s'affiche sans débordement`, async ({ browser, viewport }, testInfo) => {
      const { context, page } = await adminPage(browser, viewport);
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 20_000 });
      await shot(page, testInfo, name);
      expect(await horizontalOverflow(page)).toBe(0);
      await context.close();
    });
  }

  test('un compte sans droits d’administration est renvoyé vers l’app', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const [user] = await sql<{ id: string; email: string }>(`select id, email from public.profiles where role <> 'admin' and is_active limit 1`);
    test.skip(!user, 'aucun compte non administrateur');
    const token = await encode({ token: { sub: user.id, email: user.email }, secret: envLocal('NEXTAUTH_SECRET') });
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
    const page = await context.newPage();
    await page.goto('/admin/comptes');
    await expect(page).not.toHaveURL(/\/admin/);
    await context.close();
  });

  test('compte : création, options, ouverture du compte, retour, suppression', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const { context, page } = await adminPage(browser, { width: 1440, height: 900 });
    // Domaine réservé aux essais : l'email d'invitation n'est pas envoyé.
    const email = `e2e-admin-${Date.now()}@test.webodevis.local`;
    const company = `Traiteur e2e ${Date.now()}`;
    try {
      await page.goto('/admin/comptes');
      await page.getByRole('button', { name: 'Nouveau compte' }).click();
      await page.locator('#new-email').fill(email);
      await page.locator('#new-first').fill('Essai');
      await page.locator('#new-company').fill(company);
      await page.getByRole('button', { name: 'Créer le compte' }).click();
      await expect(page.getByRole('button', { name: new RegExp(company) })).toBeVisible({ timeout: 20_000 });

      const [created] = await sql<{ id: string; role: string; is_active: boolean; modules: string[] }>(
        `select p.id, p.role, p.is_active, p.modules from public.profiles p where p.email = $1`, [email]);
      expect(created.role).toBe('user');
      expect(created.is_active).toBe(true);
      expect(created.modules).toEqual(['prospects', 'evenements', 'stock', 'extras']);
      // Un lien pour choisir le mot de passe a été préparé.
      expect((await sql<{ n: number }>(`select count(*)::int as n from public.password_reset_tokens where user_id = $1`, [created.id]))[0].n).toBe(1);

      // Retirer l'option Extras.
      await page.getByRole('button', { name: new RegExp(company) }).click();
      await page.getByRole('switch', { name: 'Extras' }).click();
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByText('Modifications enregistrées.')).toBeVisible({ timeout: 15_000 });
      expect((await sql<{ modules: string[] }>(`select modules from public.profiles where id = $1`, [created.id]))[0].modules).toEqual(['prospects', 'evenements', 'stock']);

      // Entrer dans le compte du client : bandeau, menu sans Extras, données du client (aucun devis).
      await page.getByRole('button', { name: 'Ouvrir le compte' }).click();
      await expect(page.getByText('Vous êtes dans le compte de')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(company).first()).toBeVisible();
      await page.goto('/prestations');
      await expect(page.getByRole('link', { name: 'Prestations' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Extras' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Fournisseurs' }).first()).toBeAttached();
      await expect(page.getByText('Votre catalogue est vide')).toBeVisible({ timeout: 20_000 });
      // Dans le compte d'un client, l'espace d'administration est fermé.
      await page.goto('/admin/comptes');
      await expect(page).not.toHaveURL(/\/admin/);

      // Revenir à l'administration.
      await page.getByRole('button', { name: 'Revenir' }).click();
      await expect(page).toHaveURL(/\/admin\/comptes/, { timeout: 20_000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Comptes' })).toBeVisible();

      // Supprimer le compte, vide.
      await page.getByRole('button', { name: new RegExp(company) }).click();
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'Supprimer' }).click();
      await expect(page.getByRole('button', { name: new RegExp(company) })).toHaveCount(0, { timeout: 15_000 });
      expect(await sql(`select 1 from public.users where email = $1`, [email])).toHaveLength(0);
    } finally {
      await sql(`delete from public.users where email = $1`, [email]);
      await context.close();
    }
  });

  test('demande du site : visible, puis marquée traitée', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const { context, page } = await adminPage(browser, { width: 1440, height: 900 });
    const name = `Demande e2e ${Date.now()}`;
    const [request] = await sql<{ id: string }>(
      `insert into public.site_requests (kind, name, email, company, team_size, message)
       values ('devis', $1, 'demande-e2e@test.webodevis.local', 'Maison Essai', '2 à 5 personnes', 'Nous cherchons un logiciel pour nos devis de mariage.') returning id`, [name]);
    try {
      await page.goto('/admin/demandes');
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await expect(page.getByText('Nous cherchons un logiciel pour nos devis de mariage.').last()).toBeVisible();
      await expect(page.getByRole('link', { name: /Répondre à demande-e2e@test\.webodevis\.local/ })).toHaveAttribute('href', /^mailto:demande-e2e@test\.webodevis\.local/);
      await page.getByRole('radio', { name: 'Traitée' }).click();
      await page.locator('#req-notes').fill('Rappelée, démo prévue.');
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0, { timeout: 15_000 });

      const [row] = await sql<{ status: string; admin_notes: string; handled_at: string | null }>(
        `select status, admin_notes, handled_at from public.site_requests where id = $1`, [request.id]);
      expect(row.status).toBe('traitee');
      expect(row.admin_notes).toBe('Rappelée, démo prévue.');
      expect(row.handled_at).not.toBeNull();
    } finally {
      await sql(`delete from public.site_requests where id = $1`, [request.id]);
      await context.close();
    }
  });

  test('import de clients : collage depuis un tableur, doublons et lignes sans email laissés de côté', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const email = `e2e-import-${Date.now()}@test.webodevis.local`;
    const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
    await sql(`insert into public.profiles (id, email, first_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Import', 'user', true, true)`, [user.id, email]);
    const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
    const page = await context.newPage();
    try {
      await page.goto('/clients');
      await page.getByRole('button', { name: 'Importer' }).click();
      await page.locator('#import-clients').fill([
        'Prénom	Nom	Entreprise	Email	Téléphone',
        'Claire	Martin		claire.martin@exemple.fr	06 12 34 56 78',
        'Anne	Lenoir	Atelier Lenoir	contact@lenoir.exemple.fr	',
        'Sans	Email			',
        'Claire	Bis		CLAIRE.MARTIN@exemple.fr	',
      ].join('\n'));
      await expect(page.getByText('2 clients prêts à importer')).toBeVisible();
      await expect(page.getByText('Pas d’adresse email')).toBeVisible();
      await expect(page.getByText('Déjà dans vos clients')).toBeVisible();
      await page.getByRole('button', { name: 'Importer 2 clients' }).click();
      await expect(page.getByText('2 clients ajoutés.')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Atelier Lenoir')).toBeVisible();

      const rows = await sql<{ customer_type: string; first_name: string | null; company_name: string | null; contact_person_name: string | null; email: string; phone: string | null }>(
        `select customer_type, first_name, company_name, contact_person_name, email, phone from public.customers where owner_user_id = $1 order by email`, [user.id]);
      expect(rows).toEqual([
        { customer_type: 'particulier', first_name: 'Claire', company_name: null, contact_person_name: null, email: 'claire.martin@exemple.fr', phone: '06 12 34 56 78' },
        { customer_type: 'entreprise', first_name: 'Anne', company_name: 'Atelier Lenoir', contact_person_name: 'Anne Lenoir', email: 'contact@lenoir.exemple.fr', phone: null },
      ]);
    } finally {
      await sql(`delete from public.customers where owner_user_id = $1`, [user.id]);
      await sql(`delete from public.users where id = $1`, [user.id]);
      await context.close();
    }
  });

  test('matériel à préparer : choisi dans la liste, quantité par couvert, saisie à la main retenue', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const email = `e2e-materiel-${Date.now()}@test.webodevis.local`;
    const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
    await sql(`insert into public.profiles (id, email, first_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Matériel', 'user', true, true)`, [user.id, email]);
    const [quote] = await sql<{ id: string }>(
      `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status)
       values ($1, $1, 'Client matériel', current_date + 30, 'Mariage', 40, 'valide') returning id`, [user.id]);
    const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
    const page = await context.newPage();
    try {
      await page.goto(`/evenements/${quote.id}`);
      await page.getByRole('tab', { name: 'Matériel' }).click();
      await page.getByRole('button', { name: 'Choisir dans ma liste' }).click();
      const dialog = page.getByRole('dialog', { name: 'Ma liste de matériel' });
      await expect(dialog.getByText('Votre liste est vide')).toBeVisible({ timeout: 15_000 });

      // Deux articles ajoutés à la liste : l'un en quantité fixe, l'autre par couvert (1,5 × 40 couverts = 60).
      await dialog.getByLabel('Nom du matériel').fill('Chafing dish');
      await dialog.getByLabel('Quantité', { exact: true }).fill('2');
      await dialog.getByRole('button', { name: 'Ajouter à ma liste' }).click();
      await expect(dialog.getByLabel('Quantité de Chafing dish')).toHaveValue('2', { timeout: 15_000 });
      await dialog.getByLabel('Nom du matériel').fill('Verre à pied');
      await dialog.getByLabel('Quantité', { exact: true }).fill('1.5');
      await dialog.getByLabel('Cette quantité est par couvert').check();
      await dialog.getByRole('button', { name: 'Ajouter à ma liste' }).click();
      await expect(dialog.getByLabel('Quantité de Verre à pied')).toHaveValue('60', { timeout: 15_000 });
      await dialog.getByRole('button', { name: 'Ajouter 2 articles' }).click();

      await expect(page.getByText('Verre à pied')).toBeVisible();
      await expect.poll(async () => (await sql<{ m: { name: string; qty: number }[] }>(`select event_materials as m from public.quotes where id = $1`, [quote.id]))[0].m.map((x) => [x.name, x.qty]), { timeout: 15_000 })
        .toEqual([['Chafing dish', 2], ['Verre à pied', 60]]);

      // Un article tapé à la main rejoint la liste.
      await page.getByLabel('Nom du matériel').fill('Nappe blanche');
      await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
      await expect.poll(async () => (await sql<{ name: string }>(`select name from public.material_presets where user_id = $1 order by name`, [user.id])).map((r) => r.name), { timeout: 15_000 })
        .toEqual(['Chafing dish', 'Nappe blanche', 'Verre à pied']);

      // À la réouverture, ce qui est déjà dans l'événement est signalé.
      await page.getByRole('button', { name: 'Choisir dans ma liste' }).click();
      await expect(dialog.getByText('Déjà ajouté')).toHaveCount(3);
    } finally {
      await sql(`delete from public.quotes where id = $1`, [quote.id]);
      await sql(`delete from public.users where id = $1`, [user.id]);
      await context.close();
    }
  });

  test('modèles de location : plusieurs modèles, choix dans l’événement, quantités selon les couverts', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const email = `e2e-location-${Date.now()}@test.webodevis.local`;
    const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
    await sql(`insert into public.profiles (id, email, first_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Location', 'user', true, true)`, [user.id, email]);
    const [quote] = await sql<{ id: string }>(
      `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status)
       values ($1, $1, 'Client location', current_date + 30, 'Cocktail', 50, 'valide') returning id`, [user.id]);
    const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
    const page = await context.newPage();
    const addItem = async (name: string, qty: string, price: string) => {
      await page.getByRole('button', { name: 'Ajouter un article' }).click();
      await page.locator('#tpl-name').fill(name);
      await page.locator('#tpl-qty').fill(qty);
      await page.locator('#tpl-price').fill(price);
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 });
    };
    const createSet = async (name: string) => {
      await page.getByRole('button', { name: 'Nouveau modèle' }).first().click();
      await page.locator('#set-name').fill(name);
      await page.getByRole('button', { name: 'Créer le modèle' }).click();
      await expect(page.getByRole('tab', { name: new RegExp(name) })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
    };
    try {
      await page.goto('/location-templates');
      await expect(page.getByText('Aucun modèle de location')).toBeVisible({ timeout: 20_000 });
      await createSet('Dîner assis');
      await addItem('Assiette plate', '1', '0.3');
      await createSet('Cocktail');
      await addItem('Flûte', '1.5', '0.25');
      await addItem('Mange-debout', '0.1', '14');
      // 150 flûtes et 10 mange-debout pour 100 couverts : 37,50 + 140.
      await expect(page.getByText('environ 177,50')).toBeVisible();
      await testInfo.attach('modeles', { body: await page.screenshot(), contentType: 'image/png' });

      // Dans l'événement : deux modèles, donc un choix ; le cocktail pour 50 couverts donne 75 flûtes et 5 mange-debout.
      await page.goto(`/evenements/${quote.id}`);
      await page.getByRole('tab', { name: 'Matériel' }).click();
      await page.getByRole('button', { name: 'Appliquer un modèle' }).click();
      const dialog = page.getByRole('dialog', { name: 'Quel modèle appliquer ?' });
      await expect(dialog.getByText('Quantités calculées pour 50 couverts.')).toBeVisible();
      await dialog.getByRole('button', { name: /Cocktail/ }).click();
      await expect(page.getByText('Mange-debout')).toBeVisible({ timeout: 15_000 });
      const rows = await sql<{ material_name: string; qty: string; source: string }>(
        `select material_name, qty, source from public.rental_items where quote_id = $1 order by material_name`, [quote.id]);
      expect(rows.map((r) => [r.material_name, Number(r.qty), r.source])).toEqual([['Flûte', 75, 'template'], ['Mange-debout', 5, 'template']]);

      // Changer d'avis : le dîner assis remplace ce qui avait été généré.
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'Appliquer un modèle' }).click();
      await dialog.getByRole('button', { name: /Dîner assis/ }).click();
      await expect(page.getByText('Assiette plate')).toBeVisible({ timeout: 15_000 });
      const after = await sql<{ material_name: string; qty: string }>(`select material_name, qty from public.rental_items where quote_id = $1`, [quote.id]);
      expect(after.map((r) => [r.material_name, Number(r.qty)])).toEqual([['Assiette plate', 50]]);
    } finally {
      await sql(`delete from public.quotes where id = $1`, [quote.id]);
      await sql(`delete from public.users where id = $1`, [user.id]);
      await context.close();
    }
  });

  test('notifications : chacune mène à une page qui existe, y compris les anciens liens', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const email = `e2e-notif-${Date.now()}@test.webodevis.local`;
    const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
    await sql(`insert into public.profiles (id, email, first_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Notif', 'user', true, true)`, [user.id, email]);
    const cases = [
      ['prospect_request', 'Ancienne demande', '/prospect-requests', new RegExp('/prospects$')],
      ['stock_alert', 'Stock bas', '/stock?ing=00000000-0000-4000-8000-000000000000', new RegExp('/stock')],
      ['task_reminder', 'Relance', '/devis', new RegExp('/devis$')],
      ['system_update', 'Lien perdu', '/page-qui-n-existe-pas', new RegExp('/notifications$')],
    ] as const;
    for (const [type, title, url] of cases) {
      await sql(`insert into public.notifications (user_id, title, message, type, priority, action_url) values ($1, $2, 'Essai', $3, 'medium', $4)`, [user.id, title, type, url]);
    }
    const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
    const page = await context.newPage();
    try {
      for (const [, title, , expected] of cases) {
        await page.goto('/notifications');
        await page.getByRole('button', { name: new RegExp('^' + title) }).click();
        await expect(page).toHaveURL(expected, { timeout: 20_000 });
        await expect(page.getByText(/introuvable|could not be found|404/i)).toHaveCount(0);
      }
      // Ouvertes, elles sont marquées comme lues.
      expect((await sql<{ n: number }>(`select count(*)::int as n from public.notifications where user_id = $1 and not is_read`, [user.id]))[0].n).toBe(0);
    } finally {
      await sql(`delete from public.notifications where user_id = $1`, [user.id]);
      await sql(`delete from public.users where id = $1`, [user.id]);
      await context.close();
    }
  });
});
