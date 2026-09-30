import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { shot, horizontalOverflow } from './helpers';

// Démonstration : ouverte sans compte depuis /demo ; rien de ce qu'un visiteur y fait n'est enregistré.

const DEMO_USER_ID = '0d3e0000-0000-4000-8000-000000000001';

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

test.describe('démonstration', () => {
  test('page /demo : s’affiche sans débordement', async ({ page }, testInfo) => {
    await page.goto('/demo');
    await expect(page.getByRole('button', { name: 'Ouvrir la démonstration' })).toBeVisible();
    await shot(page, testInfo, 'demo');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('entrée sans compte, modification non enregistrée, envoi d’email fermé, sortie', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const [seeded] = await sql<{ n: number }>(`select count(*)::int as n from public.prestations where user_id = $1`, [DEMO_USER_ID]);
    test.skip(!seeded.n, 'les données de démonstration ne sont pas créées (node scripts/seed-demo.mjs)');

    await page.goto('/demo');
    await page.getByRole('button', { name: 'Ouvrir la démonstration' }).click();
    await expect(page.getByText('Démonstration.')).toBeVisible({ timeout: 30_000 });
    await shot(page, testInfo, 'demo-accueil');

    // Supprimer une prestation : elle disparaît de l'écran, mais reste en base.
    await page.goto('/prestations');
    const remove = page.getByRole('button', { name: /^Supprimer / }).first();
    await expect(remove).toBeVisible({ timeout: 20_000 });
    const name = ((await remove.getAttribute('aria-label')) ?? '').replace(/^Supprimer /, '');
    page.once('dialog', (d) => d.accept());
    await remove.click();
    await expect(page.getByRole('button', { name: `Supprimer ${name}`, exact: true })).toHaveCount(0);
    expect((await sql<{ n: number }>(`select count(*)::int as n from public.prestations where user_id = $1`, [DEMO_USER_ID]))[0].n).toBe(seeded.n);
    await page.reload();
    await expect(page.getByRole('button', { name: `Supprimer ${name}`, exact: true })).toBeVisible({ timeout: 20_000 });

    // L'envoi d'un devis par email est fermé.
    await page.goto('/devis');
    await page.getByRole('button', { name: /^Actions pour / }).first().click();
    await page.getByRole('button', { name: 'Envoyer au client' }).click();
    await page.locator('#send-to').fill('client@exemple.fr');
    await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'pas disponible dans la démonstration' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Annuler' }).click();

    // Quitter ramène au site.
    await page.getByRole('button', { name: 'Quitter' }).click();
    await expect(page.getByText('Démonstration.')).toHaveCount(0, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/devis/, { timeout: 20_000 });
    await page.goto('/devis');
    await expect(page).toHaveURL(/\/login/);
  });
});
