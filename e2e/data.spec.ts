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

    await page.getByPlaceholder('Ajouter une tâche…').fill(label);
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText(label)).toBeVisible();
    await expect(page.getByText('Sauvegarde…')).toBeHidden({ timeout: 15_000 });

    // La tâche est bien en base, pas seulement à l'écran.
    const saved = await sql<{ n: number }>(
      `select count(*)::int as n from public.quotes, jsonb_array_elements(checklist) item where id = $1 and item->>'text' = $2`,
      [quoteId, label],
    );
    expect(saved[0].n).toBe(1);

    await page.reload();
    const row = page.locator('div.group', { hasText: label });
    await expect(row).toBeVisible();

    await row.hover();
    await row.locator('button').last().click();
    await expect(page.getByText(label)).toBeHidden();
    await expect(page.getByText('Sauvegarde…')).toBeHidden({ timeout: 15_000 });
    const after = await sql<{ n: number }>(
      `select count(*)::int as n from public.quotes, jsonb_array_elements(coalesce(checklist, '[]'::jsonb)) item where id = $1 and item->>'text' = $2`,
      [quoteId, label],
    );
    expect(after[0].n).toBe(0);
  });

  test('location de matériel : création avec fournisseur lié, puis suppression', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const name = `Matériel e2e ${Date.now()}`;

    await page.goto('/evenements');
    await page.locator('a[href^="/evenements/"]').first().click();
    const quoteId = (await page.waitForURL(/\/evenements\/[^/]+$/), page.url().split('/').pop()!);
    await page.locator('div.overflow-x-auto > button').nth(1).click();

    await page.getByRole('button', { name: 'Ajouter', exact: true }).last().click();
    await page.getByPlaceholder('Nom du matériel *').fill(name);
    await page.getByPlaceholder('Quantité').fill('12');
    await page.getByPlaceholder('Prix unitaire HT').fill('2.5');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    const rows = await sql<{ qty: string; price_per_unit: string; source: string }>(
      `select qty, price_per_unit, source from public.rental_items where quote_id = $1 and material_name = $2`, [quoteId, name]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].qty)).toBe(12);
    expect(Number(rows[0].price_per_unit)).toBe(2.5);

    await sql(`delete from public.rental_items where quote_id = $1 and material_name = $2`, [quoteId, name]);
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
