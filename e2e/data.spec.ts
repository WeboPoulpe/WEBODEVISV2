import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { AUTH_FILE } from '../playwright.config';

// Lectures et écritures réelles sur la base de développement, et étanchéité entre comptes.

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

test.describe('écritures', () => {
  test.use({ storageState: AUTH_FILE });

  test('checklist d\'un événement : ajout, persistance, suppression', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
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

  test('location de matériel : création avec fournisseur lié, puis suppression', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
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

    await sql(`delete from public.rental_items where quote_id = $1 and material_name = $2`, [quoteId, name]);
  });

  test('courses : le recalcul remplace les lignes calculées et garde les lignes manuelles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    await page.goto('/evenements');
    await page.locator('a[href^="/evenements/"]').first().click();
    const quoteId = (await page.waitForURL(/\/evenements\/[^/]+$/), page.url().split('/').pop()!);

    // Jeu de données : une prestation du devis reçoit un ingrédient ; une ligne manuelle et une ancienne ligne calculée existent déjà.
    const [q] = await sql<{ owner: string; guests: number; line: string | null }>(
      `select owner_user_id as owner, guest_count as guests,
              (select s->>'name' from jsonb_array_elements(coalesce(services, '[]'::jsonb)) s where coalesce(s->>'name', '') <> '' and not coalesce((s->>'isPageBreak')::boolean, false) limit 1) as line
       from public.quotes where id = $1`, [quoteId]);
    test.skip(!q.line, 'cet événement n\'a aucune prestation dans son devis');
    const tag = `e2e-${Date.now()}`;
    const ids = await sql<{ auto: string; manual: string; stale: string; presta: string }>(
      `with auto as (insert into public.ingredients (user_id, name, unit) values ($1, $2, 'kg') returning id),
            manual as (insert into public.ingredients (user_id, name, unit) values ($1, $3, 'kg') returning id),
            stale as (insert into public.ingredients (user_id, name, unit) values ($1, $4, 'kg') returning id),
            presta as (insert into public.prestations (user_id, name, unit_price) values ($1, $5, 10) returning id)
       select auto.id as auto, manual.id as manual, stale.id as stale, presta.id as presta from auto, manual, stale, presta`,
      [q.owner, `${tag} calculé`, `${tag} manuel`, `${tag} périmé`, q.line]);
    const { auto, manual, stale, presta } = ids[0];
    try {
      await sql(`insert into public.service_ingredients (user_id, service_id, ingredient_id, qty_per_person, unit) values ($1, $2, $3, 0.5, 'kg')`, [q.owner, presta, auto]);
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
      expect(Number(rows.find((r) => r.ingredient_id === auto)?.quantity)).toBe(0.5 * q.guests);
    } finally {
      await sql(`delete from public.event_ingredients where quote_id = $1 and (ingredient_id = any($2::uuid[]) or source = 'auto')`, [quoteId, [auto, manual, stale]]);
      await sql(`delete from public.prestations where id = $1`, [presta]);
      await sql(`delete from public.ingredients where id = any($1::uuid[])`, [[auto, manual, stale]]);
    }
  });
});

test.describe('envoi du devis au client', () => {
  test.use({ storageState: AUTH_FILE });

  test('le devis part, passe en « envoyé », et son lien s\'ouvre sans compte', async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const client = `Client e2e ${Date.now()}`;
    // Adresse d'un domaine réservé aux essais : rien ne part réellement.
    const email = 'client-e2e@test.webodevis.local';
    const [owner] = await sql<{ id: string }>(
      `select u.id from public.users u left join public.quotes q on q.owner_user_id = u.id group by u.id order by count(q.id) desc limit 1`);
    const [quote] = await sql<{ id: string }>(
      `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, content_html)
       values ($1, $1, $2, current_date + 90, 'Mariage', 40, 'devis_a_faire', '<p>Proposition e2e pour le client</p>') returning id`,
      [owner.id, client]);
    try {
      await page.goto('/devis');
      await page.getByLabel('Filtrer les devis').fill(client);
      await page.getByRole('button', { name: `Actions pour ${client}` }).first().click();
      await page.getByRole('button', { name: 'Envoyer au client' }).click();
      await page.locator('#send-to').fill(email);
      await expect(page.locator('#send-message')).not.toHaveValue('');
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await expect(page.getByText('L’email est parti')).toBeVisible({ timeout: 20_000 });

      const [row] = await sql<{ status: string; share_token: string | null; sent_at: string | null; client_email: string | null }>(
        `select status, share_token, sent_at, client_email from public.quotes where id = $1`, [quote.id]);
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
    } finally {
      await sql(`delete from public.quotes where id = $1`, [quote.id]);
    }
  });
});

test.describe('fichiers', () => {
  test.use({ storageState: AUTH_FILE });

  test('envoi dans son dossier, lecture publique, suppression ; refus hors de son dossier', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    test.skip(!envLocal('BLOB_READ_WRITE_TOKEN'), 'stockage de fichiers non configuré');
    const [owner] = await sql<{ id: string }>(
      `select u.id from public.users u left join public.quotes q on q.owner_user_id = u.id group by u.id order by count(q.id) desc limit 1`);
    const authorize = (pathname: string) => page.request.post('/api/files', {
      data: { type: 'blob.generate-client-token', payload: { pathname, callbackUrl: 'http://localhost:3001/api/files', clientPayload: null, multipart: false } },
    });

    // Le dossier d'un autre compte est refusé.
    const refused = await authorize(`00000000-0000-0000-0000-000000000000/e2e.txt`);
    expect(refused.status()).toBe(400);

    const pathname = `${owner.id}/e2e/essai-${Date.now()}.pdf`;
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

test.describe('étanchéité entre comptes', () => {
  test('un nouveau compte ne voit aucune donnée des autres', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const email = `e2e-iso-${Date.now()}@test.webodevis.local`;
    const password = 'Test-e2e-123456';
    const [foreign] = await sql<{ id: string; client_name: string }>(
      `select id, client_name from public.quotes where event_date is not null order by created_at desc limit 1`);

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
    await expect(page.getByText(foreign.client_name)).toHaveCount(0);

    // Accès direct à la fiche d'un événement d'un autre compte : rien ne doit s'afficher.
    await page.goto(`/evenements/${foreign.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(foreign.client_name)).toHaveCount(0);
  });
});
