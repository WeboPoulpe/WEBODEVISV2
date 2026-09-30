import { test, expect } from '@playwright/test';
import { shot, horizontalOverflow } from './helpers';

// Pages accessibles sans être connecté.
test.describe('pages publiques', () => {
  test('login : s\'affiche sans débordement', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await shot(page, testInfo, 'login');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('register : s\'affiche sans débordement', async ({ page }, testInfo) => {
    await page.goto('/register');
    await shot(page, testInfo, 'register');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('lien extra /e/<token> : ne doit pas renvoyer vers /login', async ({ page }) => {
    // Le lien copié depuis la page Extras est destiné à quelqu'un qui n'a pas de compte.
    await page.goto('/e/jeton-inexistant');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('lien devis /d/<token> : un jeton inconnu donne une page introuvable, pas /login', async ({ page }) => {
    // Le lien reçu par email est destiné au client du traiteur, qui n'a pas de compte.
    const response = await page.goto('/d/jeton-inconnu-0123456789');
    await expect(page).not.toHaveURL(/\/login/);
    expect(response?.status()).toBe(404);
  });

  test('site de présentation : visible à la racine sans compte, sans débordement', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Le logiciel des traiteurs');
    await expect(page.getByRole('link', { name: 'Essayer la démo' }).first()).toHaveAttribute('href', '/demo');
    await shot(page, testInfo, 'site');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('site : plan du site, consignes aux robots et pages clés répondent', async ({ request }) => {
    test.setTimeout(180_000);
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const urls = [...(await sitemap.text()).matchAll(new RegExp('<loc>https://webodevis\\.fr([^<]*)</loc>', 'g'))].map((m) => m[1] || '/');
    expect(urls.length).toBeGreaterThan(15);
    for (const url of urls) expect((await request.get(url)).status(), url).toBe(200);
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap: https://webodevis.fr/sitemap.xml');
  });

  test('app installée : sans session, elle s\'ouvre sur la connexion', async ({ page }) => {
    await page.goto('/?source=pwa');
    await expect(page).toHaveURL(/\/login/);
  });

  test('une page privée renvoie vers /login', async ({ page }) => {
    await page.goto('/evenements');
    await expect(page).toHaveURL(/\/login/);
  });
});
