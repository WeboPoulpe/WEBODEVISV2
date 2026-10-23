import { test, expect, type Browser } from '@playwright/test';
import { horizontalOverflow, sql, withAccount } from './helpers';

// Assistant Webo : serveur lancé avec WEBO_FAKE=1 (spécialistes simulés, aucun appel payant). Comptes d'essai jetables.

const ASK = 'Prépare un devis pour le mariage de Claire Dupont, 50 personnes le 12 juin 2027, menu Tentation, claire@exemple.fr';

test.describe('assistant Webo', () => {
  test('demander un devis, le valider ; une autre proposition annulée ne crée rien', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(180_000);
    await withAccount(browser, 'webo-assistant', async (page, userId) => {
      await sql(`insert into public.prestations (user_id, name, unit_price, category) values ($1, 'Menu Tentation', 76, 'dîner')`, [userId]);
      await page.goto('/');
      await expect(page.getByLabel('Solde : 200 WeboCoins')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      const panel = page.getByRole('dialog', { name: 'Webo' });
      await expect(panel).toBeVisible();

      await panel.getByRole('textbox', { name: 'Votre message à Webo' }).fill(ASK);
      await panel.getByRole('button', { name: 'Envoyer' }).click();
      const card = panel.getByRole('article', { name: 'Nouveau devis' });
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText('Claire Dupont');
      await expect(card).toContainText('50');
      await expect(card).toContainText('Menu Tentation');
      await page.screenshot({ path: 'e2e/screenshots/webo-assistant-desktop.png' });
      expect(Number((await sql<{ n: string }>(`select count(*) n from public.quotes where owner_user_id = $1`, [userId]))[0].n)).toBe(0);

      await card.getByRole('button', { name: 'Valider' }).click();
      await expect(card.getByRole('link', { name: 'Ouvrir le devis' })).toBeVisible({ timeout: 20_000 });
      const [q] = await sql<{ guest_count: number; status: string }>(`select guest_count, status from public.quotes where owner_user_id = $1`, [userId]);
      expect(q).toMatchObject({ guest_count: 50, status: 'devis_a_faire' });
      await expect(page.getByLabel(/^Solde : 19\d WeboCoins$/)).toBeVisible({ timeout: 15_000 });

      await panel.getByRole('textbox', { name: 'Votre message à Webo' }).fill(ASK.replace('Claire Dupont', 'Paul Martin'));
      await panel.getByRole('button', { name: 'Envoyer' }).click();
      const second = panel.getByRole('article', { name: 'Nouveau devis' }).last();
      await expect(second).toContainText('Paul Martin', { timeout: 30_000 });
      await second.getByRole('button', { name: 'Annuler' }).click();
      await expect(second).toContainText('Annulée');
      expect(Number((await sql<{ n: string }>(`select count(*) n from public.quotes where owner_user_id = $1`, [userId]))[0].n)).toBe(1);

      // L'historique garde la conversation.
      await page.reload();
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      await expect(page.getByRole('dialog', { name: 'Webo' }).getByText('Paul Martin').first()).toBeVisible({ timeout: 20_000 });
    });
  });

  test('modifier un devis déjà mis en forme : validé, son document est remis à jour', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(180_000);
    await withAccount(browser, 'webo-modif', async (page, userId) => {
      const [q] = await sql<{ id: string }>(
        `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, vat_rate, services)
         values ($1, $1, 'Famille Lenoir', current_date + 90, 'Mariage', 80, 'devis_a_faire', 10, $2::jsonb) returning id`,
        [userId, JSON.stringify([{ id: 'l1', name: 'Menu Tentation', quantity: 80, unitPrice: 76 }])]);
      // Le document mis en forme existe : ouvert puis enregistré dans WeboWord.
      await page.goto(`/devis/${q.id}/modifier?mode=weboword`);
      await expect(page.locator('#weboword-sheet [data-webo-intro]')).toBeVisible({ timeout: 30_000 });
      await page.keyboard.press('Control+s');
      await expect.poll(async () => (await sql<{ c: string | null }>(`select content_html c from public.quotes where id = $1`, [q.id]))[0].c ?? '', { timeout: 20_000 }).toMatch(/6[\s  .]?688/);
      // Une proposition de Webo (passer à 100 couverts), dans une conversation.
      const [c] = await sql<{ id: string }>(`insert into public.webo_conversations (company_id, user_id, title) values ($1, $1, 'Couverts') returning id`, [userId]);
      const [p] = await sql<{ id: string }>(
        `insert into public.webo_proposals (conversation_id, company_id, user_id, kind, payload, summary) values ($1, $2, $2, 'quote_update', $3::jsonb, $4::jsonb) returning id`,
        [c.id, userId, JSON.stringify({ quoteId: q.id, guestCount: 100, eventDate: null, eventLocation: null, add: [], remove: [] }), JSON.stringify({ title: 'Modifier le devis', fields: [{ label: 'Couverts', value: '80 → 100' }] })]);
      await sql(`update public.webo_conversations set transcript = $2::jsonb where id = $1`, [c.id, JSON.stringify([
        { role: 'user', text: 'Passe à 100 couverts', at: new Date().toISOString() },
        { role: 'assistant', text: 'Je vous propose ce changement.', agent: 'devis', proposalIds: [p.id], coins: 3, at: new Date().toISOString() },
      ])]);
      await page.evaluate((id) => localStorage.setItem('webo:last-conversation', id), c.id);
      await page.goto('/devis');
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      const card = page.getByRole('article', { name: 'Modifier le devis' });
      await card.getByRole('button', { name: 'Valider' }).click();
      await expect(card.getByRole('link', { name: 'Ouvrir le devis' })).toBeVisible({ timeout: 20_000 });
      // 100 × 76 × 1,10 = 8 360 € TTC, dans le tableau du document.
      await expect.poll(async () => (await sql<{ c: string }>(`select content_html c from public.quotes where id = $1`, [q.id]))[0].c, { timeout: 20_000 }).toMatch(/8[\s  .]?360/);
    });
  });

  test('photo jointe : envoyée à Webo ; micro présent seulement si le navigateur sait dicter', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    await withAccount(browser, 'webo-photo', async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      const panel = page.getByRole('dialog', { name: 'Webo' });
      const canDictate = await page.evaluate(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
      await expect(panel.getByRole('button', { name: 'Dicter' })).toHaveCount(canDictate ? 1 : 0);
      // Une petite image PNG (1 × 1 pixel).
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
      await panel.getByLabel('Choisir une photo').setInputFiles({ name: 'menu.png', mimeType: 'image/png', buffer: png });
      await expect(panel.getByAltText('Photo jointe')).toBeVisible();
      await panel.getByRole('textbox', { name: 'Votre message à Webo' }).fill('Tire les prestations de ce menu');
      await panel.getByRole('button', { name: 'Envoyer' }).click();
      await expect(panel.getByText(/bien reçu la photo/)).toBeVisible({ timeout: 30_000 });
      await expect(panel.getByText(/\[photo jointe\]/)).toBeVisible();
    });
  });

  test('Paramètres : ce que Webo retient, et l’oublier', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    await withAccount(browser, 'webo-memoire', async (page, userId) => {
      await sql(`insert into public.webo_memories (company_id, text) values ($1, 'Acompte toujours à 40 %')`, [userId]);
      await page.goto('/parametres');
      const list = page.getByRole('list', { name: 'Ce que Webo retient' });
      await expect(list).toContainText('Acompte toujours à 40 %', { timeout: 30_000 });
      await page.getByRole('button', { name: 'Oublier « Acompte toujours à 40 % »' }).click();
      await expect(page.getByText('Rien pour l’instant.')).toBeVisible();
      expect(await sql(`select 1 from public.webo_memories where company_id = $1`, [userId])).toHaveLength(0);
    });
  });

  test('téléphone : la bulle et le panneau plein écran, sans débordement', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    await withAccount(browser, 'webo-assistant-tel', async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Ouvrir Webo' }).click();
      const panel = page.getByRole('dialog', { name: 'Webo' });
      await expect(panel).toBeVisible({ timeout: 20_000 });
      const box = await panel.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(355);
      expect(await horizontalOverflow(page)).toBe(0);
      await page.screenshot({ path: 'e2e/screenshots/webo-assistant-mobile.png' });
    }, { viewport: { width: 360, height: 780 } });
  });
});
