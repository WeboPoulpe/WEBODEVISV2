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
