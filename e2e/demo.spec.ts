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

const NUMBERS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
/** « Combien font sept plus cinq ? » → 12 */
function solve(question: string): string {
  const [, a, b] = /font (\S+) plus (\S+) \?/.exec(question) ?? [];
  return String(NUMBERS.indexOf(a) + NUMBERS.indexOf(b));
}

test.describe('démonstration', () => {
  test('page /demo : s’affiche sans débordement', async ({ page }, testInfo) => {
    await page.goto('/demo');
    await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible();
    await shot(page, testInfo, 'demo');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('ouvrir la démonstration sans ticket valable est refusé', async ({ page }) => {
    await page.goto('/demo?acces=ticket-invente.signature');
    await expect(page.locator('p[role="alert"]')).toContainText('Ce lien n’est plus valable', { timeout: 20_000 });
    await page.goto('/devis');
    await expect(page).toHaveURL(/\/login/);
  });

  test('coordonnées, vérification, entrée, modification non enregistrée, envoi d’email fermé, sortie, retour', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    const [seeded] = await sql<{ n: number }>(`select count(*)::int as n from public.prestations where user_id = $1`, [DEMO_USER_ID]);
    test.skip(!seeded.n, 'les données de démonstration ne sont pas créées (node scripts/seed-demo.mjs)');

    // Adresse d'un domaine réservé aux essais : aucun email ne part.
    const email = `demo-e2e-${Date.now()}@test.webodevis.local`;
    await page.goto('/demo');
    // Étape 1 : sans nom, on ne passe pas.
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText('prénom et votre nom');
    await page.locator('#demo-first').fill('Camille');
    await page.locator('#demo-last').fill('Essai');
    await page.getByRole('button', { name: 'Continuer' }).click();
    // Étape 2 : email et téléphone vérifiés.
    await page.locator('#demo-email').fill(email);
    await page.locator('#demo-phone').fill('12');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText('téléphone');
    await page.locator('#demo-phone').fill('06 39 98 00 00');
    await page.getByRole('button', { name: 'Continuer' }).click();
    // Étape 3 : une mauvaise réponse donne une nouvelle question, la bonne ouvre la démonstration.
    const label = page.locator('label[for="demo-answer"]');
    await expect(label).toContainText('Combien font');
    await shot(page, testInfo, 'demo-verification');
    await page.waitForTimeout(1600);
    await page.locator('#demo-answer').fill('99');
    await page.getByRole('button', { name: 'Ouvrir la démonstration' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText('n’est pas la bonne', { timeout: 15_000 });
    await expect(page.locator('#demo-answer')).toHaveValue('');
    await page.waitForTimeout(1600);
    await page.locator('#demo-answer').fill(solve((await label.textContent()) ?? ''));
    await page.getByRole('button', { name: 'Ouvrir la démonstration' }).click();
    await expect(page.getByText('Démonstration.')).toBeVisible({ timeout: 30_000 });

    // Les coordonnées sont arrivées dans les demandes de l'administration.
    const leads = await sql<{ kind: string; name: string; phone: string; status: string }>(
      `select kind, name, phone, status from public.site_requests where email = $1`, [email]);
    expect(leads).toEqual([{ kind: 'demo', name: 'Camille Essai', phone: '06 39 98 00 00', status: 'nouvelle' }]);
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
    await expect(page.locator('p[role="alert"]').filter({ hasText: 'pas disponible dans la démonstration' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Annuler' }).click();

    // Quitter ramène au site.
    await page.getByRole('button', { name: 'Quitter' }).click();
    await expect(page.getByText('Démonstration.')).toHaveCount(0, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/devis/, { timeout: 20_000 });
    await page.goto('/devis');
    await expect(page).toHaveURL(/\/login/);

    // Retour sur /demo : l'accès gardé par le navigateur évite de tout ressaisir.
    await page.goto('/demo');
    await expect(page.getByText('Bon retour Camille')).toBeVisible();
    await page.getByRole('button', { name: 'Rouvrir la démonstration' }).click();
    await expect(page.getByText('Démonstration.')).toBeVisible({ timeout: 30_000 });
    await sql(`delete from public.site_requests where email = $1`, [email]);
  });
});
