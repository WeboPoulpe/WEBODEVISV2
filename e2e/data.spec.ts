import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createAccount, createQuote, deleteAccount, deleteAccountByEmail, envLocal, sql, testEmail, withAccount } from './helpers';

// Lectures et écritures réelles sur la base, et étanchéité entre comptes.
// Chaque test crée son compte d'essai et ses données, puis supprime le tout : aucun compte réel n'est lu ni modifié.

test.describe('écritures', () => {
  test('checklist d\'un événement : ajout, persistance, suppression', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    await withAccount(browser, 'checklist', async (page, userId) => {
      await createQuote(userId, { client_name: 'Client checklist', status: 'valide' });
      const label = `Tâche e2e ${Date.now()}`;

      await page.goto('/evenements');
      await page.locator('a[href^="/evenements/"]').first().click();
      await expect(page).toHaveURL(/\/evenements\/[^/]+$/);
      const quoteId = page.url().split('/').pop()!;

      const inBase = async () => (await sql<{ n: number }>(
        `select count(*)::int as n from public.quotes, jsonb_array_elements(coalesce(checklist, '[]'::jsonb)) item where id = $1 and item->>'text' = $2`,
        [quoteId, label],
      ))[0].n;

      await page.getByPlaceholder('Ajouter une tâche').fill(label);
      await page.getByPlaceholder('Ajouter une tâche').press('Enter');
      await expect(page.getByText(label)).toBeVisible();
      // La tâche est bien en base, pas seulement à l'écran.
      await expect.poll(inBase, { timeout: 15_000 }).toBe(1);

      await page.reload();
      await expect(page.getByText(label)).toBeVisible();

      // Bouton de suppression visible sans survol (utilisable au doigt).
      await page.getByRole('button', { name: `Supprimer ${label}` }).click();
      await expect(page.getByText(label)).toBeHidden();
      await expect.poll(inBase, { timeout: 15_000 }).toBe(0);
    });
  });

  test('location de matériel : création d\'un article, enregistré en base', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    await withAccount(browser, 'location-evt', async (page, userId) => {
      await createQuote(userId, { client_name: 'Client location', status: 'valide' });
      const name = `Matériel e2e ${Date.now()}`;

      await page.goto('/evenements');
      await page.locator('a[href^="/evenements/"]').first().click();
      const quoteId = (await page.waitForURL(/\/evenements\/[^/]+$/), page.url().split('/').pop()!);
      await page.getByRole('tab', { name: 'Matériel' }).click();

      await page.getByRole('button', { name: 'Ajouter un article' }).click();
      await page.locator('#rent-name').fill(name);
      await page.locator('#rent-qty').fill('12');
      await page.locator('#rent-price').fill('2.5');
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

      const rows = await sql<{ qty: string; price_per_unit: string; source: string }>(
        `select qty, price_per_unit, source from public.rental_items where quote_id = $1 and material_name = $2`, [quoteId, name]);
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].qty)).toBe(12);
      expect(Number(rows[0].price_per_unit)).toBe(2.5);
    });
  });

  test('courses : le recalcul remplace les lignes calculées et garde les lignes manuelles', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    await withAccount(browser, 'courses', async (page, userId) => {
      const line = 'Menu e2e courses';
      const guests = 40;
      const quoteId = await createQuote(userId, {
        client_name: 'Client courses', status: 'valide', guest_count: guests,
        services: [{ id: 's1', name: line, quantity: guests, unitPrice: 30 }],
      });
      await page.goto(`/evenements/${quoteId}`);
      await expect(page.getByRole('tab', { name: 'Courses' })).toBeVisible({ timeout: 20_000 });

      // Jeu de données : la prestation du devis reçoit un ingrédient ; une ligne manuelle et une ancienne ligne calculée existent déjà.
      const tag = `e2e-${Date.now()}`;
      const [{ auto, manual, stale, presta }] = await sql<{ auto: string; manual: string; stale: string; presta: string }>(
        `with auto as (insert into public.ingredients (user_id, name, unit) values ($1, $2, 'kg') returning id),
              manual as (insert into public.ingredients (user_id, name, unit) values ($1, $3, 'kg') returning id),
              stale as (insert into public.ingredients (user_id, name, unit) values ($1, $4, 'kg') returning id),
              presta as (insert into public.prestations (user_id, name, unit_price) values ($1, $5, 10) returning id)
         select auto.id as auto, manual.id as manual, stale.id as stale, presta.id as presta from auto, manual, stale, presta`,
        [userId, `${tag} calculé`, `${tag} manuel`, `${tag} périmé`, line]);
      await sql(`insert into public.service_ingredients (user_id, service_id, ingredient_id, qty_per_person, unit) values ($1, $2, $3, 0.5, 'kg')`, [userId, presta, auto]);
      await sql(`insert into public.event_ingredients (quote_id, ingredient_id, quantity, unit, source) values ($1, $2, 3, 'kg', 'manuelle'), ($1, $3, 99, 'kg', 'auto')`, [quoteId, manual, stale]);

      await page.reload();
      await page.getByRole('tab', { name: 'Courses' }).click();
      await expect(page.getByText(`${tag} manuel`)).toBeVisible();
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'Calculer depuis le devis' }).click();
      await expect(page.getByText(`${tag} calculé`)).toBeVisible({ timeout: 20_000 });

      const rows = await sql<{ ingredient_id: string; quantity: string; source: string }>(
        `select ingredient_id, quantity, source from public.event_ingredients where quote_id = $1 and ingredient_id = any($2::uuid[])`, [quoteId, [auto, manual, stale]]);
      expect(rows.find((r) => r.ingredient_id === manual)?.source).toBe('manuelle');
      expect(rows.find((r) => r.ingredient_id === stale)).toBeUndefined();
      expect(Number(rows.find((r) => r.ingredient_id === auto)?.quantity)).toBe(0.5 * guests);
      // Lignes de courses, prestation et ingrédients partent avec le compte d'essai.
    });
  });
});

test.describe('envoi du devis au client', () => {
  test('le devis part, passe en « envoyé », et son lien s\'ouvre sans compte', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const client = `Client e2e ${Date.now()}`;
    // Adresse d'un domaine réservé aux essais : rien ne part réellement.
    const email = 'client-e2e@test.webodevis.local';
    await withAccount(browser, 'envoi', async (page, userId) => {
      const quoteId = await createQuote(userId, { client_name: client, days: 90, content_html: '<p>Proposition e2e pour le client</p>' });

      await page.goto('/devis');
      await page.getByLabel('Filtrer les devis').fill(client);
      await page.getByRole('button', { name: `Actions pour ${client}` }).first().click();
      await page.getByRole('button', { name: 'Envoyer au client' }).click();
      await page.locator('#send-to').fill(email);
      await expect(page.locator('#send-message')).not.toHaveValue('');
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await expect(page.getByText('L’email est parti')).toBeVisible({ timeout: 20_000 });

      const [row] = await sql<{ status: string; share_token: string | null; sent_at: string | null; client_email: string | null }>(
        `select status, share_token, sent_at, client_email from public.quotes where id = $1`, [quoteId]);
      expect(row.status).toBe('devis_envoye');
      expect(row.client_email).toBe(email);
      expect(row.sent_at).not.toBeNull();
      expect(row.share_token).toMatch(/^[A-Za-z0-9_-]{16,}$/);

      // Le client n'a pas de compte : le lien doit s'ouvrir dans un navigateur sans session.
      const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const publicPage = await visitor.newPage();
      await publicPage.goto(`/d/${row.share_token}`);
      await expect(publicPage).not.toHaveURL(/\/login/);
      await expect(publicPage.getByText('Proposition e2e pour le client')).toBeVisible();
      await expect(publicPage.getByRole('button', { name: 'Enregistrer en PDF' })).toBeVisible();
      await publicPage.screenshot({ path: path.join(__dirname, 'screenshots', 'desktop', 'devis-public.png'), fullPage: true });
      await visitor.close();
    }, { companyName: 'Traiteur Essai' });
  });
});

test.describe('fichiers', () => {
  test('envoi dans son dossier, lecture publique, suppression ; refus hors de son dossier', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    test.skip(!envLocal('BLOB_READ_WRITE_TOKEN'), 'stockage de fichiers non configuré');
    await withAccount(browser, 'fichiers', async (page, userId) => {
      // La session du navigateur (cookie du compte d'essai) accompagne ces requêtes.
      await page.goto('/');
      const authorize = (pathname: string) => page.request.post('/api/files', {
        data: { type: 'blob.generate-client-token', payload: { pathname, callbackUrl: 'http://localhost:3001/api/files', clientPayload: null, multipart: false } },
      });

      // Le dossier d'un autre compte est refusé.
      const refused = await authorize(`00000000-0000-0000-0000-000000000000/e2e.txt`);
      expect(refused.status()).toBe(400);

      const pathname = `${userId}/e2e/essai-${Date.now()}.pdf`;
      const granted = await authorize(pathname);
      expect(granted.status()).toBe(200);
      const { clientToken } = await granted.json();

      const { put } = await import('@vercel/blob/client');
      const content = `%PDF-1.4 essai e2e ${Date.now()}`;
      const blob = await put(pathname, new Blob([content], { type: 'application/pdf' }), { access: 'public', token: clientToken });
      expect(blob.pathname).toBe(pathname);
      expect(await (await fetch(blob.url)).text()).toBe(content);

      const removed = await page.request.delete('/api/files', { data: { paths: [pathname] } });
      expect(removed.status()).toBe(200);
      expect((await removed.json()).deleted).toBe(1);
    });
  });
});

test.describe('étanchéité entre comptes', () => {
  test('un nouveau compte ne voit aucune donnée des autres', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const email = testEmail('iso');
    const password = 'Test-e2e-123456';
    // Un autre compte d'essai, avec son client et son événement : c'est lui que le nouveau compte ne doit pas voir.
    const other = await createAccount('iso-autre');
    try {
      const clientName = `Client caché ${Date.now()}`;
      await sql(`insert into public.customers (owner_user_id, user_id, customer_type, email, first_name, last_name)
                 values ($1, $1, 'particulier', 'cache@essai.test', 'Client', $2)`, [other.id, `caché ${Date.now()}`]);
      const foreignId = await createQuote(other.id, { client_name: clientName, status: 'valide' });

      await page.goto('/register');
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await expect(page.getByText('Compte créé avec succès')).toBeVisible({ timeout: 20_000 });
      await page.goto('/login');
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

      await page.goto('/devis');
      await expect(page.getByText('0 devis au total')).toBeVisible({ timeout: 20_000 });

      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(clientName)).toHaveCount(0);
      await expect(page.getByText('cache@essai.test')).toHaveCount(0);

      // Accès direct à la fiche d'un événement d'un autre compte : rien ne doit s'afficher.
      await page.goto(`/evenements/${foreignId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(clientName)).toHaveCount(0);
    } finally {
      await deleteAccountByEmail(email);
      await deleteAccount(other.id);
    }
  });
});
