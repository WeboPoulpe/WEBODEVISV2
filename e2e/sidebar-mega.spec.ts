import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { createQuote, sql, withAccount } from './helpers';

// Mégamenu de la barre latérale : survol, clavier, appui long, contenu (explication, actions, aide, aperçu),
// aucune action morte, rail d'icônes, options du compte respectées.
// Captures facultatives : MEGA_SHOTS=<dossier> npx playwright test e2e/sidebar-mega.spec.ts

const item = (page: Page, href: string) => page.locator(`aside nav a[data-mega="${href}"]`);
const panel = (page: Page) => page.locator('[data-sidebar-mega]');

async function snap(page: Page, name: string) {
  if (!process.env.MEGA_SHOTS) return;
  await page.waitForTimeout(400); // fin du fondu d'apparition et de l'aperçu
  await page.screenshot({ path: path.join(process.env.MEGA_SHOTS, `${name}.png`) });
}

/** Déplie les groupes repliés (Catalogue, Paramètres) pour que toutes les entrées soient visibles. */
async function expandGroups(page: Page) {
  for (const title of ['Catalogue', 'Paramètres']) {
    const button = page.locator('aside nav button', { hasText: title });
    if (await button.count() && (await button.getAttribute('aria-expanded')) === 'false') await button.click();
  }
}

async function closePanel(page: Page) {
  await page.mouse.move(1300, 880);
  await expect(panel(page)).toHaveCount(0);
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'les fenêtres sont fixées dans chaque test');
});

test('survol : explication, actions, aperçu vivant et aide de la page', async ({ browser }) => {
  await withAccount(browser, 'mega-survol', async (page, userId) => {
    await createQuote(userId, { client_name: 'Banquet Mégamenu', status: 'devis_a_faire', days: 12 });
    await page.goto('/');
    await expect(item(page, '/devis')).toBeVisible();

    await item(page, '/devis').hover();
    const p = panel(page);
    await expect(p).toBeVisible();
    await expect(p).toHaveAttribute('data-sidebar-mega', '/devis');
    await expect(item(page, '/devis')).toHaveAttribute('aria-expanded', 'true');
    await expect(p.getByText('Tous vos devis, du premier contact au paiement', { exact: false })).toBeVisible();
    for (const label of ['Nouveau devis', 'Partir d’un modèle', 'Importer un devis', 'Devis envoyés']) {
      await expect(p.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    }
    // Aperçu vivant : le devis créé est dans « Derniers devis modifiés ».
    const preview = p.locator('[data-mega-preview]');
    await expect(preview).toContainText('Derniers devis modifiés');
    await expect(preview).toContainText('Banquet Mégamenu');
    await expect(preview).toContainText('en cours');
    await expect(p.getByText('Ctrl')).toBeVisible();

    // Le panneau tient dans l'écran, à droite de la barre.
    const box = (await p.boundingBox())!;
    const bar = (await page.locator('aside').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bar.x + bar.width);
    expect(box.width).toBeGreaterThanOrEqual(520);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    await snap(page, 'bureau-1440-devis');

    // Aide sur cette page : le centre d'aide s'ouvre sur les guides des devis.
    const helpButton = p.getByRole('button', { name: /Aide sur cette page/ });
    const count = Number((await helpButton.innerText()).match(/(\d+) guide/)![1]);
    expect(count).toBeGreaterThan(0);
    await helpButton.click();
    const help = page.getByRole('dialog', { name: 'Aide' });
    await expect(help).toBeVisible();
    await expect(help.getByRole('tab', { name: 'Pour cette page' })).toHaveAttribute('aria-selected', 'true');
    await expect(help.locator('ul > li')).toHaveCount(count);
    await expect(panel(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);

    // Événements : un autre panneau, avec ses propres actions.
    await item(page, '/evenements').hover();
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/evenements');
    await expect(panel(page).getByRole('link', { name: /Imprimer le à faire/ })).toHaveAttribute('href', '/tableau-de-bord/imprimer?auto');
    await expect(panel(page).locator('[data-mega-preview]')).toContainText('Prochains événements');
    await snap(page, 'bureau-1440-evenements');
  });
});

test('on va de l’entrée au panneau sans qu’il se ferme, même en passant sur d’autres entrées', async ({ browser }) => {
  await withAccount(browser, 'mega-trajet', async (page) => {
    await page.goto('/');
    const from = (await item(page, '/devis').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/devis');
    const box = (await panel(page).boundingBox())!;
    // En diagonale vers le bas du panneau : on traverse « Clients » et « Prospects ».
    await page.mouse.move(box.x + 60, box.y + box.height - 40, { steps: 18 });
    await page.waitForTimeout(500);
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/devis');

    // Un arrêt franc sur une autre entrée change de panneau.
    const clients = (await item(page, '/clients').boundingBox())!;
    await page.mouse.move(clients.x + 30, clients.y + clients.height / 2, { steps: 4 });
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/clients');

    // Sortie du panneau : il se ferme après un court délai.
    await page.mouse.move(1300, 880, { steps: 3 });
    await expect(panel(page)).toHaveCount(0);
  });
});

test('clavier : flèche droite ouvre, flèches pour parcourir, Échap ferme et rend le focus', async ({ browser }) => {
  await withAccount(browser, 'mega-clavier', async (page) => {
    await page.goto('/');
    const devis = item(page, '/devis');
    await devis.focus();
    await expect(panel(page)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/devis');
    await expect(page.locator(':focus')).toContainText('Nouveau devis');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(':focus')).toContainText('Partir d’un modèle');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(devis).toBeFocused();

    // Entrée garde la navigation.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/devis$/, { timeout: 30_000 });
  });
});

test('aucune action morte : chaque lien répond, chaque action ouvre ce qu’elle annonce', async ({ browser }) => {
  test.setTimeout(240_000);
  await withAccount(browser, 'mega-liens', async (page) => {
    await page.goto('/');
    await expandGroups(page);
    const hrefs = await page.locator('aside nav a[data-mega]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mega')!));
    expect(hrefs.length).toBeGreaterThanOrEqual(17);

    const links = new Set<string>();
    for (const href of hrefs) {
      await item(page, href).scrollIntoViewIfNeeded();
      await item(page, href).hover();
      await expect(panel(page)).toHaveAttribute('data-sidebar-mega', href);
      await expect(panel(page).getByRole('button', { name: /Aide sur cette page|Ouvrir l’aide/ })).toBeVisible();
      const found = await panel(page).locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
      expect(found.length, `actions de ${href}`).toBeGreaterThanOrEqual(3); // « Ouvrir » et au moins deux actions
      found.forEach((h) => links.add(h));
      await closePanel(page);
    }

    for (const href of links) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBe(200);
    }

    // Chaque ?action= est lue par sa page (le paramètre disparaît) et ouvre la fenêtre annoncée.
    const dialogs: Record<string, RegExp | null> = {
      '/devis?action=modeles': /Partir d’un modèle/,
      '/devis?action=importer': /Importer un devis existant/,
      '/devis?action=envoyes': null,
      '/clients?action=importer': /./,
      '/clients?action=rechercher': null,
      '/prospects?action=nouvelles': null,
      '/prospects?action=formulaire': null,
      '/evenements?action=passes': null,
      '/commandes?action=nouveau': /Nouvelle commande/,
      '/stock?action=alertes': null,
      '/prestations?action=reviser': null,
      // Le sélecteur de fichier ne s'ouvre qu'après un clic dans le menu (vérifié plus bas).
      '/prestations?action=importer': null,
      '/ingredients?action=importer': null,
      '/ingredients?action=nouveau': /./,
      '/extras?action=nouveau': /./,
      '/extras?action=agenda': null,
      '/fournisseurs?action=nouveau': /Nouveau fournisseur/,
      '/materiel?action=liste-de-base': /./,
      '/materiel?action=modeles': null,
      '/parametres/categories?action=nouveau': null,
      '/location-templates?action=nouveau': /Nouveau modèle de location/,
    };
    const actions = [...links].filter((h) => h.includes('action='));
    for (const href of actions) expect(Object.keys(dialogs), `action non vérifiée : ${href}`).toContain(href);
    for (const href of actions) {
      await page.goto(href);
      await expect(page, href).not.toHaveURL(/action=/, { timeout: 15_000 });
      const name = dialogs[href];
      if (name) await expect(page.getByRole('dialog', { name }).first(), href).toBeVisible();
    }
    // Recherche : le champ reçoit le focus.
    await page.goto('/clients?action=rechercher');
    await expect(page.getByRole('textbox', { name: 'Rechercher un client' })).toBeFocused();
    // Catégories : le champ de la nouvelle catégorie s'ouvre.
    await page.goto('/parametres/categories?action=nouveau');
    await expect(page.locator('main input').first()).toBeVisible();
  });
});

test('action vers la page ouverte : la fenêtre s’ouvre sans recharger, et l’import CSV ouvre le sélecteur', async ({ browser }) => {
  await withAccount(browser, 'mega-meme-page', async (page) => {
    await page.goto('/clients');
    await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
    await item(page, '/clients').hover();
    await panel(page).getByRole('link', { name: /Importer des clients/ }).click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await expect(page).toHaveURL(/\/clients$/);
    await page.keyboard.press('Escape');

    await page.goto('/');
    await expandGroups(page);
    await item(page, '/prestations').hover();
    const chooser = page.waitForEvent('filechooser', { timeout: 10_000 });
    await panel(page).getByRole('link', { name: /Importer un CSV/ }).click();
    await chooser;
    await expect(page).toHaveURL(/\/prestations$/);
  });
});

test('rail d’icônes (tablette) : le panneau remplace l’infobulle, l’appui long l’ouvre aussi', async ({ browser }) => {
  await withAccount(browser, 'mega-rail', async (page) => {
    await page.goto('/');
    await snap(page, 'tablette-1024');
    await item(page, '/evenements').hover();
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/evenements');
    await snap(page, 'tablette-1024-evenements');
    await closePanel(page);

    await page.setViewportSize({ width: 900, height: 800 });
    const link = item(page, '/devis');
    await expect(link).toBeVisible();
    await expect(link).not.toHaveAttribute('title');
    await expect(link).toHaveAttribute('aria-label', 'Devis');
    await expect.poll(async () => (await page.locator('aside').boundingBox())!.width).toBeLessThan(100);
    const bar = (await page.locator('aside').boundingBox())!;
    await link.hover();
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/devis');
    const box = (await panel(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bar.x + bar.width);
    expect(box.x + box.width).toBeLessThanOrEqual(900);
    await snap(page, 'rail-900-devis');
    await closePanel(page);

    // Appui long (tactile) : le panneau s'ouvre et l'appui ne navigue pas.
    const r = (await item(page, '/clients').boundingBox())!;
    const at = { pointerType: 'touch', isPrimary: true, clientX: r.x + 20, clientY: r.y + 15, bubbles: true };
    await item(page, '/clients').dispatchEvent('pointerdown', at);
    await page.waitForTimeout(650);
    await expect(panel(page)).toHaveAttribute('data-sidebar-mega', '/clients');
    await item(page, '/clients').dispatchEvent('pointerup', at);
    await item(page, '/clients').dispatchEvent('click');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(panel(page)).toBeVisible();
  }, { viewport: { width: 1024, height: 768 } });
});

test('options du compte : sans l’option Stock, ni l’entrée ni son panneau ni les actions qui y mènent', async ({ browser }) => {
  await withAccount(browser, 'mega-options', async (page, userId) => {
    await sql(`update public.profiles set modules = '["prospects","evenements","extras"]'::jsonb where id = $1`, [userId]);
    await page.goto('/');
    await expandGroups(page);
    await expect(item(page, '/devis')).toBeVisible();
    for (const href of ['/stock', '/commandes', '/fournisseurs']) await expect(item(page, href)).toHaveCount(0);

    const hrefs = await page.locator('aside nav a[data-mega]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mega')!));
    for (const href of hrefs) {
      await item(page, href).scrollIntoViewIfNeeded();
      await item(page, href).hover();
      await expect(panel(page)).toHaveAttribute('data-sidebar-mega', href);
      const found = await panel(page).locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
      for (const h of found) expect(h, `${href} mène à ${h}`).not.toMatch(/^\/(stock|commandes|fournisseurs)(\?|$|\/)/);
      await closePanel(page);
    }
  });
});
