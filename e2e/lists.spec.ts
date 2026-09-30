import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { AUTH_FILE } from '../playwright.config';

// Listes de base : modèle de location rempli en quelques coches, page Matériel du compte.

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

test.describe('listes de base', () => {
  test.use({ storageState: AUTH_FILE });

  test('modèle de location : la liste de base remplit unités et quantités par couvert', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const setName = `Modèle e2e ${Date.now()}`;
    await page.goto('/location-templates');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Nouveau modèle' }).first().click();
    await page.locator('#set-name').fill(setName);
    await page.getByRole('button', { name: 'Créer le modèle' }).click();

    // La liste de base s'ouvre d'elle-même sur un modèle neuf.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`Ajouter à « ${setName} »`)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('checkbox', { name: 'Assiette plate 27 cm' }).check();
    await dialog.getByRole('checkbox', { name: 'Table ronde 10 personnes' }).check();
    await dialog.getByRole('button', { name: 'Ajouter 2 articles' }).click();
    await expect(page.getByText('Table ronde 10 personnes')).toBeVisible({ timeout: 15_000 });

    const rows = await sql<{ material_name: string; unit: string; qty_per_guest: string }>(
      `select t.material_name, t.unit, t.qty_per_guest from public.rental_templates t join public.rental_template_sets s on s.id = t.set_id where s.name = $1 order by t.material_name`, [setName]);
    expect(rows.map((r) => [r.material_name, r.unit, Number(r.qty_per_guest)])).toEqual([
      ['Assiette plate 27 cm', 'pièce', 1],
      ['Table ronde 10 personnes', 'pièce', 0.1],
    ]);

    // Saisie à la main : un article connu apporte son unité et sa quantité.
    await page.getByRole('button', { name: 'Ajouter un article' }).click();
    await page.locator('#tpl-name').fill('Flûte à champagne');
    await expect(page.locator('#tpl-unit')).toHaveValue('pièce');

    await sql(`delete from public.rental_templates where set_id in (select id from public.rental_template_sets where name = $1)`, [setName]);
    await sql(`delete from public.rental_template_sets where name = $1`, [setName]);
  });

  test('page Matériel : ajout depuis la liste de base, article perso, retrait', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const custom = `Matériel e2e ${Date.now()}`;
    await page.goto('/materiel');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Matériel', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Depuis la liste' }).click();
    const dialog = page.getByRole('dialog');
    const chafing = dialog.getByRole('checkbox', { name: 'Chafing dish', exact: true });
    const hadChafing = (await chafing.count()) === 0;
    if (!hadChafing) {
      await chafing.check();
      await expect(dialog.getByRole('spinbutton', { name: 'Quantité, Chafing dish' })).toHaveValue('4');
      await dialog.getByRole('button', { name: 'Ajouter 1 article' }).click();
      await expect(page.getByText('Chafing dish', { exact: true })).toBeVisible({ timeout: 15_000 });
    } else {
      await dialog.getByRole('button', { name: 'Fermer', exact: true }).last().click();
    }

    await page.getByRole('button', { name: 'Nouvel article' }).click();
    await page.locator('#mat-name').fill(custom);
    await page.locator('#mat-qty').fill('3');
    await page.locator('#mat-unit').selectOption('carton');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(custom)).toBeVisible({ timeout: 15_000 });
    const saved = await sql<{ unit: string; default_qty: string }>(`select unit, default_qty from public.material_presets where name = $1`, [custom]);
    expect(saved.map((r) => [r.unit, Number(r.default_qty)])).toEqual([['carton', 3]]);

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: `Retirer ${custom}` }).click();
    await expect(page.getByText(custom)).toBeHidden();
    await expect.poll(async () => (await sql(`select 1 from public.material_presets where name = $1`, [custom])).length, { timeout: 15_000 }).toBe(0);

    if (!hadChafing) {
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'Retirer Chafing dish' }).click();
      await expect(page.getByText('Chafing dish', { exact: true })).toBeHidden();
    }
  });
});
