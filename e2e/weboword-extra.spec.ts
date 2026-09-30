import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { Client } from 'pg';

// WeboWord : saut de page, session expirée pendant la saisie, intro réécrite à la main.
// Chaque test travaille sur un compte d'essai créé pour lui, puis supprimé.

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

type Ctx = { page: Page; context: BrowserContext; userId: string; login: () => Promise<void> };

async function withAccount(browser: Browser, kind: string, run: (ctx: Ctx) => Promise<void>) {
  const email = `e2e-${kind}-${Date.now()}@test.webodevis.local`;
  const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
  await sql(`insert into public.profiles (id, email, first_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Essai', 'user', true, true)`, [user.id, email]);
  const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
  const login = () => context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
  await login();
  try {
    await run({ page: await context.newPage(), context, userId: user.id, login });
  } finally {
    await sql(`delete from public.quotes where owner_user_id = $1`, [user.id]);
    await sql(`delete from public.users where id = $1`, [user.id]);
    await context.close();
  }
}

const newQuote = async (userId: string) => (await sql<{ id: string }>(
  `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, event_location, guest_count, status, services, template)
   values ($1, $1, 'Paul Durand', '2027-05-01', 'Mariage', 'Château de Villebougis', 40, 'devis_a_faire', '[{"id":"s1","name":"Menu Prestige","quantity":40,"unitPrice":30}]', 'classique') returning id`, [userId]))[0].id;

const contentOf = async (id: string) => (await sql<{ content_html: string | null }>(`select content_html from public.quotes where id = $1`, [id]))[0].content_html ?? '';

/** Ouvre l'éditeur et attend que le document soit prêt (enregistré une première fois). */
async function openEditor(page: Page, id: string) {
  await page.goto(`/devis/${id}/modifier?mode=weboword`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#weboword-sheet [data-webo-intro]')).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit'); });

test('saut de page inséré au curseur, gardé à l’enregistrement', async ({ browser }) => {
  await withAccount(browser, 'saut-page', async ({ page, userId }) => {
    const id = await newQuote(userId);
    await openEditor(page, id);
    await page.locator('#weboword-sheet [data-webo-intro] p').click();
    await page.getByTitle('Saut de page : la suite commence sur une nouvelle page').click();
    await expect(page.locator('#weboword-sheet .screen-sep', { hasText: /^Saut de page$/ })).toHaveCount(1);
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await contentOf(id)).includes('>Saut de page</div>'), { timeout: 15_000 }).toBe(true);
  });
});

test('session expirée : rien n’est perdu, l’enregistrement reprend après reconnexion', async ({ browser }) => {
  await withAccount(browser, 'session', async ({ page, context, userId, login }) => {
    const id = await newQuote(userId);
    await openEditor(page, id);
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await contentOf(id)).length > 0, { timeout: 15_000 }).toBe(true);

    await context.clearCookies();
    await page.locator('#weboword-sheet [data-webo-intro] p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Texte tapé pendant la coupure.');
    await page.keyboard.press('Control+s');
    await expect(page.getByRole('alert').filter({ hasText: 'Votre session a expiré' })).toBeVisible({ timeout: 15_000 });
    const draft = await page.evaluate((k) => localStorage.getItem(k), `weboword_draft_${id}`);
    expect(draft).toContain('Texte tapé pendant la coupure.');
    expect(await contentOf(id)).not.toContain('Texte tapé pendant la coupure.');

    // Reconnexion (dans un autre onglet, en vrai) puis retour sur l'éditeur.
    await login();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('alert').filter({ hasText: 'Votre session a expiré' })).toBeHidden({ timeout: 15_000 });
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await contentOf(id)).includes('Texte tapé pendant la coupure.'), { timeout: 15_000 }).toBe(true);
  });
});

test('client ou événement changé : l’intro réécrite à la main est signalée', async ({ browser }) => {
  await withAccount(browser, 'intro', async ({ page, userId }) => {
    const id = await newQuote(userId);
    await openEditor(page, id);
    // Le traiteur réécrit l'introduction.
    await page.locator('#weboword-sheet [data-webo-intro] p').evaluate((p) => { p.textContent = 'Chers Paul et Marie, voici notre proposition faite pour vous.'; });
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await contentOf(id)).includes('Chers Paul et Marie'), { timeout: 15_000 }).toBe(true);

    // Le lieu change dans le panneau Événement.
    await page.goto(`/devis/${id}/modifier?mode=weboword&panel=event`);
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Château de Villebougis').fill('Domaine des Tilleuls');
    await page.getByRole('button', { name: /^Appliquer/ }).click();

    await expect(page.getByRole('status').filter({ hasText: 'l’introduction, réécrit à la main, n’a pas été mis à jour' })).toBeVisible({ timeout: 25_000 });
    const html = await contentOf(id);
    expect(html).toContain('Domaine des Tilleuls');
    expect(html).toContain('Chers Paul et Marie');
  });
});
