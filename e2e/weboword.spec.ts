import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { Client } from 'pg';

// Éditeur de devis : rien de ce qui est tapé ne se perd, rien de ce qui est saisi ailleurs ne s'exécute.

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

const LINES = [
  { id: 'l1', name: 'Dîner trois plats', description: '<p>Entrée, plat, dessert</p>', quantity: 40, unitPrice: 50 },
  { id: 'l2', name: 'Forfait boissons', description: null, quantity: 40, unitPrice: 10 },
];

/** Un compte jetable avec un devis, et un navigateur connecté à ce compte. */
async function setup(browser: Browser, quote: { client_name: string; content_html?: string | null }) {
  const email = `e2e-weboword-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.webodevis.local`;
  const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
  await sql(`insert into public.profiles (id, email, first_name, company_name, role, is_active, has_completed_onboarding) values ($1, $2, 'Essai', 'Traiteur Essai', 'user', true, true)`, [user.id, email]);
  const [q] = await sql<{ id: string }>(
    `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services, vat_rate, content_html)
     values ($1, $1, $2, current_date + 60, 'Mariage', 40, 'devis_a_faire', $3::jsonb, 10, $4) returning id`,
    [user.id, quote.client_name, JSON.stringify(LINES), quote.content_html ?? null]);
  const token = await encode({ token: { sub: user.id, email }, secret: envLocal('NEXTAUTH_SECRET') });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
  const page = await context.newPage();
  const cleanup = async () => {
    await context.close();
    await sql(`delete from public.quotes where id = $1`, [q.id]);
    await sql(`delete from public.users where id = $1`, [user.id]);
  };
  const html = async () => (await sql<{ content_html: string | null }>(`select content_html from public.quotes where id = $1`, [q.id]))[0].content_html;
  return { page, quoteId: q.id, cleanup, html };
}

/** Tape une phrase à la fin du premier paragraphe d'introduction. */
async function typeInSheet(page: import('@playwright/test').Page, text: string) {
  const intro = page.locator('#weboword-sheet [data-webo-intro] p').first();
  await intro.click();
  await page.keyboard.press('End');
  await page.keyboard.type(` ${text}`);
}

test.describe('éditeur de devis', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit'); });

  test('un devis déjà mis en forme s’ouvre avec ses actions, quel que soit le lien', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Client Essai', content_html: '<div data-webo-intro="1"><p>Document déjà enregistré.</p></div>' });
    try {
      await t.page.goto(`/devis/${t.quoteId}/modifier`);
      await expect(t.page).toHaveURL(/mode=weboword/, { timeout: 20_000 });
      await expect(t.page.getByText('Document déjà enregistré.')).toBeVisible();
      await expect(t.page.getByRole('button', { name: /Enregistrer/ }).first()).toBeVisible();
    } finally { await t.cleanup(); }
  });

  test('un nom de client ou une description piégés ne s’exécutent ni à l’écran ni à l’impression', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Dupont <img src=x onerror="window.__piege = 1">' });
    try {
      await sql(`update public.quotes set event_location = $2, remarks = $3,
                 services = jsonb_set(services, '{0,description}', to_jsonb($4::text)) where id = $1`,
        [t.quoteId, 'Salle <script>window.__piege = 2</script>', 'Note <iframe srcdoc="<script>parent.__piege = 3</script>"></iframe>', '<p>Entrée <img src=x onerror="window.__piege = 4"></p>']);
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      const sheet = t.page.locator('#weboword-sheet');
      await expect(sheet).toContainText('Dupont', { timeout: 20_000 });
      await t.page.waitForTimeout(1000);
      expect(await t.page.evaluate(() => (window as unknown as { __piege?: number }).__piege)).toBeUndefined();
      // Le nom s'affiche tel qu'il a été saisi, comme du texte.
      await expect(sheet).toContainText('<img src=x');
      expect(await sheet.locator('img[onerror], script, iframe').count()).toBe(0);

      // Fenêtre d'impression : même contrôle sur ce qui y est écrit.
      const printed = await t.page.evaluate(() => {
        const original = URL.createObjectURL;
        let captured: Blob | null = null;
        URL.createObjectURL = (b: Blob | MediaSource) => { captured = b as Blob; return 'blob:capture'; };
        window.open = () => null;
        window.dispatchEvent(new CustomEvent('weboword:print'));
        URL.createObjectURL = original;
        return captured ? (captured as Blob).text() : null;
      });
      expect(printed).not.toBeNull();
      // Le nom piégé y figure comme du texte ; aucun élément actif n'a été créé à partir des données saisies.
      const active = await t.page.evaluate((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const handlers = [...doc.body.querySelectorAll('*')].filter((el) => [...el.attributes].some((at) => at.name.startsWith('on'))).length;
        return { handlers, iframes: doc.body.querySelectorAll('iframe').length, pieges: [...doc.querySelectorAll('script')].filter((x) => x.textContent?.includes('__piege')).length };
      }, printed as string);
      expect(active).toEqual({ handlers: 0, iframes: 0, pieges: 0 });
    } finally { await t.cleanup(); }
  });

  test('panneau Événement : le texte tapé survit à « Appliquer » et au rechargement', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Client Essai' });
    try {
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await expect(t.page.locator('#weboword-sheet [data-webo-intro]')).toBeVisible({ timeout: 20_000 });
      await typeInSheet(t.page, 'Phrase tapée avant le panneau.');
      // Ouvre le panneau sans recharger la page, comme le fait la barre latérale.
      await t.page.getByRole('link', { name: 'Événement', exact: true }).first().click();
      const apply = t.page.getByRole('button', { name: 'Appliquer' }).first();
      await expect(apply).toBeVisible({ timeout: 15_000 });
      await expect(t.page.locator('#weboword-sheet')).toContainText('Phrase tapée avant le panneau.');
      await apply.click();
      await expect.poll(t.html, { timeout: 20_000 }).toContain('Phrase tapée avant le panneau.');
      await expect(t.page.locator('#weboword-sheet')).toContainText('Phrase tapée avant le panneau.', { timeout: 20_000 });
    } finally { await t.cleanup(); }
  });

  test('Ctrl+S enregistre, et aucun brouillon n’est proposé ensuite', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Client Essai' });
    try {
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await expect(t.page.locator('#weboword-sheet [data-webo-intro]')).toBeVisible({ timeout: 20_000 });
      await typeInSheet(t.page, 'Enregistré au clavier.');
      await t.page.keyboard.press('Control+s');
      await expect(t.page.getByText('Devis enregistré')).toBeVisible({ timeout: 15_000 });
      expect(await t.html()).toContain('Enregistré au clavier.');
      // Le devis reste ouvert plus longtemps que l'intervalle du brouillon, puis on recharge.
      await t.page.waitForTimeout(6500);
      await t.page.reload();
      await expect(t.page.locator('#weboword-sheet')).toContainText('Enregistré au clavier.', { timeout: 20_000 });
      await expect(t.page.getByText(/modifications non enregistrées ont été retrouvées/)).toHaveCount(0);
    } finally { await t.cleanup(); }
  });

  test('un texte tapé puis un onglet fermé sans enregistrer : le brouillon est proposé au retour', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Client Essai', content_html: '<div data-webo-intro="1"><p>Base.</p></div>' });
    try {
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await expect(t.page.locator('#weboword-sheet')).toContainText('Base.', { timeout: 20_000 });
      await typeInSheet(t.page, 'Non enregistré.');
      await t.page.waitForTimeout(5500);
      t.page.on('dialog', (d) => d.accept());
      await t.page.reload();
      await expect(t.page.getByText(/modifications non enregistrées ont été retrouvées/)).toBeVisible({ timeout: 20_000 });
    } finally { await t.cleanup(); }
  });

  test('l’éditeur en formulaire met le document à jour au lieu de l’effacer', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Client Essai' });
    try {
      // Un document mis en forme, avec une phrase écrite par le traiteur.
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await expect(t.page.locator('#weboword-sheet [data-webo-intro]')).toBeVisible({ timeout: 20_000 });
      await typeInSheet(t.page, 'Phrase du traiteur.');
      await t.page.keyboard.press('Control+s');
      await expect(t.page.getByText('Devis enregistré')).toBeVisible({ timeout: 15_000 });

      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=wizard`, { waitUntil: 'networkidle' });
      await t.page.getByRole('button', { name: /^Enregistrer/ }).first().click();
      await expect(t.page.getByText(/Enregistré/).first()).toBeVisible({ timeout: 15_000 });
      const after = await t.html();
      expect(after).not.toBeNull();
      expect(after).toContain('Phrase du traiteur.');
      expect(after).toContain('Dîner trois plats');
    } finally { await t.cleanup(); }
  });

  test('impression, page d’impression et lien public : même document, même nombre de pages, police choisie', async ({ browser }, testInfo) => {
    const t = await setup(browser, { client_name: 'Client Sorties' });
    const out = path.join(__dirname, '.results', 'pdf');
    fs.mkdirSync(out, { recursive: true });
    try {
      // Un devis long : 30 prestations avec description, pour plusieurs pages.
      const lines = Array.from({ length: 30 }, (_, i) => ({
        id: `p${i}`, name: `Prestation numéro ${i + 1}`, quantity: 40, unitPrice: 12 + i,
        description: '<p>Une description de deux lignes pour occuper de la place sur la carte, avec des produits de saison et une cuisson lente.</p>',
      }));
      await sql(`update public.quotes set services = $2::jsonb, selected_font = 'Cormorant Garamond', share_token = $3 where id = $1`,
        [t.quoteId, JSON.stringify(lines), `jeton-e2e-${Date.now()}-abcdefgh`]);
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await expect(t.page.locator('#weboword-sheet [data-webo-financials]')).toBeVisible({ timeout: 20_000 });
      await t.page.keyboard.press('Control+s');
      await expect(t.page.getByText('Devis enregistré')).toBeVisible({ timeout: 15_000 });

      // 1. La fenêtre « Imprimer ou PDF » de l'éditeur.
      const printed = await t.page.evaluate(() => {
        const original = URL.createObjectURL;
        let captured: Blob | null = null;
        URL.createObjectURL = (b: Blob | MediaSource) => { captured = b as Blob; return 'blob:capture'; };
        window.open = () => null;
        window.dispatchEvent(new CustomEvent('weboword:print'));
        URL.createObjectURL = original;
        return captured ? (captured as Blob).text() : null;
      });
      expect(printed).not.toBeNull();
      const pdfOptions = { printBackground: true, preferCSSPageSize: true } as const;
      const printPage = await t.page.context().newPage();
      await printPage.setContent((printed as string).replace('window.print()', 'void 0'), { waitUntil: 'networkidle' });
      await printPage.evaluate(() => document.fonts.ready);
      const fromEditor = await printPage.pdf({ ...pdfOptions, path: path.join(out, 'editeur.pdf') });
      expect(await printPage.evaluate(() => getComputedStyle(document.querySelector('.quote-doc p')!).fontFamily)).toContain('Cormorant Garamond');

      // 2. La page d'impression de l'app.
      const appPrint = await t.page.context().newPage();
      await appPrint.addInitScript(() => { window.print = () => {}; });
      await appPrint.goto(`/devis/${t.quoteId}/imprimer`, { waitUntil: 'networkidle' });
      await appPrint.evaluate(() => document.fonts.ready);
      const fromApp = await appPrint.pdf({ ...pdfOptions, path: path.join(out, 'imprimer.pdf') });

      // 3. Le lien envoyé au client, sans session.
      const [{ share_token }] = await sql<{ share_token: string }>(`select share_token from public.quotes where id = $1`, [t.quoteId]);
      const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const publicPage = await visitor.newPage();
      await publicPage.goto(`/d/${share_token}`, { waitUntil: 'networkidle' });
      await publicPage.evaluate(() => document.fonts.ready);
      expect(await publicPage.evaluate(() => getComputedStyle(document.querySelector('.quote-doc p')!).fontFamily)).toContain('Cormorant Garamond');
      const fromLink = await publicPage.pdf({ ...pdfOptions, path: path.join(out, 'lien.pdf') });
      await visitor.close();

      const pages = (pdf: Buffer) => (pdf.toString('latin1').match(new RegExp('/Type\\s*/Page[^s]', 'g')) ?? []).length;
      const counts = { editeur: pages(fromEditor), imprimer: pages(fromApp), lien: pages(fromLink) };
      testInfo.annotations.push({ type: 'pages', description: JSON.stringify(counts) });
      console.log('pages par sortie', JSON.stringify(counts));
      expect(counts.editeur).toBeGreaterThan(2);
      expect(counts.imprimer).toBe(counts.editeur);
      expect(counts.lien).toBe(counts.editeur);
    } finally { await t.cleanup(); }
  });

  test('deux onglets : le second enregistrement prévient au lieu d’écraser', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Client Onglets', content_html: '<div data-webo-intro="1"><p>Base.</p></div>' });
    try {
      const other = await t.page.context().newPage();
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await other.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await expect(t.page.locator('#weboword-sheet')).toContainText('Base.', { timeout: 20_000 });
      await expect(other.locator('#weboword-sheet')).toContainText('Base.', { timeout: 20_000 });
      await typeInSheet(t.page, 'Version A.');
      await t.page.keyboard.press('Control+s');
      await expect(t.page.getByText('Devis enregistré')).toBeVisible({ timeout: 15_000 });
      await typeInSheet(other, 'Version B.');
      let asked = '';
      other.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
      await other.keyboard.press('Control+s');
      await expect.poll(() => asked, { timeout: 15_000 }).toContain('enregistré ailleurs');
      // L'autre version n'a pas été écrasée.
      expect(await t.html()).toContain('Version A.');
      expect(await t.html()).not.toContain('Version B.');
    } finally { await t.cleanup(); }
  });

  test('un collage venant de Word ne garde que la structure du texte', async ({ browser }) => {
    const t = await setup(browser, { client_name: 'Client Collage', content_html: '<div data-webo-intro="1"><p>Base.</p></div>' });
    try {
      await t.page.goto(`/devis/${t.quoteId}/modifier?mode=weboword`);
      await expect(t.page.locator('#weboword-sheet')).toContainText('Base.', { timeout: 20_000 });
      await t.page.locator('#weboword-sheet [data-webo-intro] p').click();
      await t.page.evaluate(() => {
        const data = new DataTransfer();
        data.setData('text/html', '<p class="MsoNormal" style="font-family:Comic Sans MS;color:red;font-size:16pt;background:yellow"><b>Menu</b> du chef <img src="data:image/png;base64,AAAA"></p><table style="width:900px"><tr><td>A</td></tr></table>');
        data.setData('text/plain', 'Menu du chef');
        document.querySelector('#weboword-sheet [data-webo-intro] p')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      });
      const sheet = t.page.locator('#weboword-sheet');
      await expect(sheet).toContainText('Menu du chef');
      expect(await sheet.locator('b', { hasText: 'Menu' }).count()).toBeGreaterThan(0);
      expect(await sheet.evaluate((el) => el.innerHTML)).not.toMatch(/Comic Sans|MsoNormal|background:s*yellow|data:image|900px/);
    } finally { await t.cleanup(); }
  });
});
