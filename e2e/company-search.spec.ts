import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect, type Page } from '@playwright/test';
import { DEMO_USER_ID, horizontalOverflow, sessionCookie, sql, withAccount } from './helpers';

// Recherche d'entreprise (nom ou SIRET) pour remplir les clients entreprise.
// L'API publique de l'État n'est jamais appelée ici : une API simulée tourne sur cette machine, et le
// serveur de développement la suit grâce au cookie réservé aux tests (ignoré en production).
// Chaque test travaille sur un compte d'essai créé pour lui, puis supprimé : aucun compte réel n'est touché.

// Réponses au format constaté de l'API (recherche-entreprises.api.gouv.fr, octobre 2026).
const LILAS_SIEGE = {
  siret: '11122233300015', adresse: '12 RUE DES LILAS 75019 PARIS', code_postal: '75019', libelle_commune: 'PARIS',
  etat_administratif: 'A', est_siege: true, activite_principale: '56.21Z',
};
const LILAS_LYON = {
  siret: '11122233300023', adresse: '8 RUE MERCIERE 69002 LYON', code_postal: '69002', libelle_commune: 'LYON',
  etat_administratif: 'A', est_siege: false, activite_principale: '56.21Z',
};
const LILAS = {
  siren: '111222333', nom_complet: 'TRAITEUR DES LILAS (LES LILAS)', nom_raison_sociale: 'TRAITEUR DES LILAS',
  etat_administratif: 'A', activite_principale: '56.21Z', siege: LILAS_SIEGE, matching_etablissements: [] as unknown[],
};
const VIEUX_PORT = {
  siren: '444555666', nom_complet: 'TRAITEUR DU VIEUX PORT', nom_raison_sociale: 'TRAITEUR DU VIEUX PORT',
  etat_administratif: 'C', activite_principale: '56.21Z',
  siege: { siret: '44455566600018', adresse: '3 QUAI DU PORT 13002 MARSEILLE', code_postal: '13002', libelle_commune: 'MARSEILLE', etat_administratif: 'F', est_siege: true },
  matching_etablissements: [],
};

let server: http.Server;
let apiUrl = '';
const received: { q: string; userAgent: string; params: string }[] = [];

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const q = url.searchParams.get('q') ?? '';
    received.push({ q, userAgent: String(req.headers['user-agent'] ?? ''), params: url.search });
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname !== '/search') return send(404, { erreur: 'introuvable' });
    if (/panne/i.test(q)) return send(503, { erreur: 'indisponible' });
    if (q === '11122233300023') return send(200, { results: [{ ...LILAS, matching_etablissements: [LILAS_LYON] }], total_results: 1, page: 1, per_page: 10, total_pages: 1 });
    if (/traiteur/i.test(q)) return send(200, { results: [LILAS, VIEUX_PORT], total_results: 2, page: 1, per_page: 10, total_pages: 1 });
    return send(200, { results: [], total_results: 0, page: 1, per_page: 10, total_pages: 0 });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Ce navigateur fait chercher le serveur dans l'API simulée. */
async function useFakeApi(page: Page) {
  await page.context().addCookies([{ name: 'webodevis_company_search_url', value: apiUrl, domain: 'localhost', path: '/' }]);
}

/** Suggestions de la recherche (les listes déroulantes de la page ont aussi des « option »). */
const suggestions = (page: Page) => page.getByRole('listbox', { name: 'Entreprises trouvées' }).getByRole('option');

/** Tape dans la recherche jusqu'à voir des suggestions (le serveur de développement peut être lent à compiler). */
async function searchFor(page: Page, box: ReturnType<Page['getByRole']>, text: string) {
  await expect(async () => {
    await box.fill('');
    await box.fill(text);
    await expect(suggestions(page).first()).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
}

test.describe('recherche d’entreprise', () => {
  test.setTimeout(150_000);
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit'); });

  test('nouveau client : recherche par nom, établissement fermé signalé, choix au clavier, contact gardé', async ({ browser }) => {
    await withAccount(browser, 'entreprise-nom', async (page, userId) => {
      await useFakeApi(page);
      await page.goto('/clients/nouveau');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /^entreprise$/i }).click();
      await page.getByLabel('Personne de contact').fill('Claire Martin');

      const box = page.getByRole('combobox', { name: /Rechercher l’entreprise/ });
      await searchFor(page, box, 'traiteur lilas');
      const options = suggestions(page);
      await expect(options).toHaveCount(2);
      await expect(options.nth(0)).toContainText('TRAITEUR DES LILAS');
      await expect(options.nth(0)).toContainText('PARIS · SIRET 111 222 333 00015');
      await expect(options.nth(0)).not.toContainText('Établissement fermé');
      await expect(options.nth(1)).toContainText('TRAITEUR DU VIEUX PORT');
      await expect(options.nth(1)).toContainText('Établissement fermé');

      // Clavier : flèche vers le bas puis Entrée choisissent sans envoyer le formulaire.
      await box.press('ArrowDown');
      await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
      await box.press('Enter');
      await expect(suggestions(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/clients\/nouveau/);
      await expect(page.getByLabel('Nom de l\'entreprise *')).toHaveValue('TRAITEUR DES LILAS');
      await expect(page.getByLabel('Numéro SIRET')).toHaveValue('11122233300015');
      await expect(page.getByLabel('Adresse principale')).toHaveValue('12 RUE DES LILAS 75019 PARIS');
      await expect(page.getByLabel('Personne de contact')).toHaveValue('Claire Martin');
      await expect(page.getByText('Informations reprises de')).toBeVisible();

      // L'appel part du serveur, identifié, avec la requête nettoyée.
      const call = received.find((r) => r.q === 'traiteur lilas');
      expect(call?.userAgent).toContain('WeboDevis');
      expect(call?.params).toContain('per_page=10');

      // Échap referme les suggestions sans vider la saisie.
      await searchFor(page, box, 'traiteur port');
      await box.press('Escape');
      await expect(suggestions(page)).toHaveCount(0);
      await expect(box).toHaveValue('traiteur port');

      // Enregistrement : l'entreprise et son contact partent ensemble (contrainte de la base).
      await page.getByLabel('Email *', { exact: true }).fill('contact@lilas.test');
      await page.getByRole('button', { name: 'Créer le client' }).click();
      await expect(page).toHaveURL(/\/clients$/, { timeout: 20_000 });
      const rows = await sql<{ customer_type: string; company_name: string; siret_number: string; address: string; contact_person_name: string }>(
        `select customer_type, company_name, siret_number, address, contact_person_name from public.customers where owner_user_id = $1`, [userId]);
      expect(rows).toEqual([{ customer_type: 'entreprise', company_name: 'TRAITEUR DES LILAS', siret_number: '11122233300015', address: '12 RUE DES LILAS 75019 PARIS', contact_person_name: 'Claire Martin' }]);
    });
  });

  test('recherche par SIRET : l’établissement exact, pas le siège ; API en panne : saisie à la main', async ({ browser }) => {
    await withAccount(browser, 'entreprise-siret', async (page) => {
      await useFakeApi(page);
      await page.goto('/clients/nouveau');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /^entreprise$/i }).click();
      const box = page.getByRole('combobox', { name: /Rechercher l’entreprise/ });

      // Espaces tapés dans le SIRET : retirés avant l'appel.
      await searchFor(page, box, '111 222 333 00023');
      await expect(suggestions(page)).toHaveCount(1);
      await expect(suggestions(page)).toContainText('LYON · SIRET 111 222 333 00023');
      await suggestions(page).click();
      await expect(page.getByLabel('Numéro SIRET')).toHaveValue('11122233300023');
      await expect(page.getByLabel('Adresse principale')).toHaveValue('8 RUE MERCIERE 69002 LYON');
      expect(received.some((r) => r.q === '11122233300023')).toBe(true);

      await expect(async () => {
        await box.fill('');
        await box.fill('traiteur en panne');
        await expect(page.getByText('Recherche indisponible pour le moment, saisissez les informations à la main.')).toBeVisible({ timeout: 8_000 });
      }).toPass({ timeout: 60_000 });
    });
  });

  test('SIRET déjà dans le carnet : signalé, la fiche existante s’ouvre', async ({ browser }) => {
    await withAccount(browser, 'entreprise-doublon', async (page, userId) => {
      await sql(
        `insert into public.customers (owner_user_id, user_id, customer_type, email, company_name, contact_person_name, siret_number)
         values ($1, $1, 'entreprise', 'compta@lilas.test', 'Les Lilas (compta)', 'Paul Durand', '111 222 333 00015')`, [userId]);
      await useFakeApi(page);
      await page.goto('/clients/nouveau');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /^entreprise$/i }).click();
      const box = page.getByRole('combobox', { name: /Rechercher l’entreprise/ });
      await searchFor(page, box, 'traiteur');
      await expect(suggestions(page).nth(0)).toContainText('Déjà dans vos clients');
      await suggestions(page).nth(0).click();
      await expect(page.getByText('Ce SIRET est déjà dans votre carnet')).toBeVisible();
      await expect(page.getByText('Les Lilas (compta)')).toBeVisible();
      await page.getByRole('button', { name: 'Ouvrir cette fiche' }).click();
      await expect(page).toHaveURL(/\/clients\?fiche=/, { timeout: 20_000 });
      await expect(page.getByRole('heading', { name: 'Les Lilas (compta)' })).toBeVisible({ timeout: 20_000 });
    });
  });

  test('fiche client existante : recherche, champs remplis, Échap ne ferme pas la fiche, enregistrement', async ({ browser }) => {
    await withAccount(browser, 'entreprise-fiche', async (page, userId) => {
      const [customer] = await sql<{ id: string }>(
        `insert into public.customers (owner_user_id, user_id, customer_type, email, company_name, contact_person_name)
         values ($1, $1, 'entreprise', 'contact@maison.test', 'Maison Essai', 'Claire Martin') returning id`, [userId]);
      await useFakeApi(page);
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /Maison Essai/ }).click();
      // La fiche s'ouvre par-dessus la liste : ses champs sont les seuls de la page à porter ces libellés.
      const dialog = page;
      await expect(page.getByRole('heading', { name: 'Maison Essai' })).toBeVisible({ timeout: 20_000 });
      const box = dialog.getByRole('combobox', { name: /Rechercher l’entreprise/ });
      await searchFor(page, box, 'traiteur');
      await box.press('Escape');
      await expect(suggestions(page)).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Maison Essai' })).toBeVisible();

      await searchFor(page, box, 'traiteur lilas');
      await suggestions(page).nth(0).click();
      await expect(dialog.getByLabel('Entreprise', { exact: true })).toHaveValue('TRAITEUR DES LILAS');
      await expect(dialog.getByLabel('SIRET', { exact: true })).toHaveValue('11122233300015');
      await expect(dialog.getByLabel('Adresse', { exact: true })).toHaveValue('12 RUE DES LILAS 75019 PARIS');
      await dialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(dialog.getByRole('button', { name: 'Enregistré' })).toBeVisible({ timeout: 20_000 });
      const [row] = await sql<{ company_name: string; siret_number: string; address: string; contact_person_name: string }>(
        `select company_name, siret_number, address, contact_person_name from public.customers where id = $1`, [customer.id]);
      expect(row).toEqual({ company_name: 'TRAITEUR DES LILAS', siret_number: '11122233300015', address: '12 RUE DES LILAS 75019 PARIS', contact_person_name: 'Claire Martin' });
    });
  });

  test('devis, panneau Client : l’entreprise remplace le particulier, qui devient le contact', async ({ browser }) => {
    await withAccount(browser, 'entreprise-weboword', async (page, userId) => {
      const [quote] = await sql<{ id: string }>(
        `insert into public.quotes (owner_user_id, user_id, client_name, client_type, event_date, event_type, guest_count, status, services)
         values ($1, $1, 'Jeanne Petit', 'particulier', current_date + 60, 'Séminaire', 40, 'devis_a_faire', '[]'::jsonb) returning id`, [userId]);
      await useFakeApi(page);
      await page.goto(`/devis/${quote.id}/modifier?mode=weboword&panel=client`);
      const box = page.getByRole('combobox', { name: /Client entreprise/ });
      await expect(box).toBeVisible({ timeout: 40_000 });
      await searchFor(page, box, '11122233300023');
      await suggestions(page).click();
      await expect(page.getByLabel('Entreprise', { exact: true })).toHaveValue('TRAITEUR DES LILAS');
      await expect(page.getByLabel('SIRET', { exact: true })).toHaveValue('11122233300023');
      await expect(page.getByLabel('Adresse', { exact: true })).toHaveValue('8 RUE MERCIERE 69002 LYON');
      await expect(page.getByLabel('Personne de contact')).toHaveValue('Jeanne Petit');
      await page.getByRole('button', { name: 'Appliquer' }).click();
      await expect.poll(async () => (await sql<{ client_type: string }>(`select client_type from public.quotes where id = $1`, [quote.id]))[0].client_type, { timeout: 60_000 }).toBe('entreprise');
      const [row] = await sql<{ client_name: string; company_name: string; client_siret: string; client_address: string; contact_person_name: string }>(
        `select client_name, company_name, client_siret, client_address, contact_person_name from public.quotes where id = $1`, [quote.id]);
      expect(row).toEqual({ client_name: 'TRAITEUR DES LILAS', company_name: 'TRAITEUR DES LILAS', client_siret: '11122233300023', client_address: '8 RUE MERCIERE 69002 LYON', contact_person_name: 'Jeanne Petit' });
    });
  });

  test('compte de démonstration : la recherche fonctionne (simple lecture)', async ({ browser }) => {
    // Session ouverte ici plutôt que reprise du fichier commun, réécrit par les autres passages en parallèle.
    const [demo] = await sql<{ email: string }>(`select email from public.users where id = $1`, [DEMO_USER_ID]);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: { cookies: [], origins: [] } });
    await context.addCookies([await sessionCookie({ id: DEMO_USER_ID, email: demo.email })]);
    try {
      const page = await context.newPage();
      await useFakeApi(page);
      await page.goto('/clients/nouveau');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /^entreprise$/i }).click();
      const box = page.getByRole('combobox', { name: /Rechercher l’entreprise/ });
      await searchFor(page, box, 'traiteur');
      await expect(suggestions(page)).toHaveCount(2);
    } finally { await context.close(); }
  });

  test('téléphone 390 px : suggestions lisibles, cibles au doigt, rien ne déborde', async ({ browser }) => {
    await withAccount(browser, 'entreprise-mobile', async (page) => {
      await useFakeApi(page);
      await page.goto('/clients/nouveau');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /^entreprise$/i }).click();
      const box = page.getByRole('combobox', { name: /Rechercher l’entreprise/ });
      await searchFor(page, box, 'traiteur');
      const boxSize = await box.boundingBox();
      expect(boxSize!.height).toBeGreaterThanOrEqual(40);
      for (const option of await suggestions(page).all()) {
        const r = (await option.boundingBox())!;
        expect(r.height).toBeGreaterThanOrEqual(40);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(390);
      }
      expect(await horizontalOverflow(page)).toBe(0);
      await page.screenshot({ path: test.info().outputPath('recherche-entreprise-390.png') });
      await suggestions(page).nth(1).click();
      await expect(page.getByText('Attention : cet établissement est fermé.')).toBeVisible();
    }, { viewport: { width: 390, height: 844 } });
  });
});
