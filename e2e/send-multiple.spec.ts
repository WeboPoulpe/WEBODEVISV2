import { test, expect, type Locator, type Page } from '@playwright/test';
import { createQuote, sql, TEST_EMAIL_DOMAIN, withAccount } from './helpers';

// Envoi d'un devis à plusieurs adresses : saisie en pastilles, adresses connues du client, envoi depuis
// la liste et depuis l'éditeur. Toutes les adresses sont sur le domaine d'essai : aucun email ne part.

const at = (name: string) => `${name}@${TEST_EMAIL_DOMAIN}`;

const quoteRow = async (id: string) => (await sql<{ status: string; client_email: string | null; sent_at: string | null; share_token: string | null }>(
  `select status, client_email, sent_at, share_token from public.quotes where id = $1`, [id]))[0];

/** Colle un texte dans le champ, comme depuis le presse-papiers. */
async function paste(input: Locator, text: string) {
  await input.evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

const pill = (scope: Page | Locator, email: string) => scope.locator(`[data-recipient="${email}"]`);

test.describe('envoi du devis à plusieurs adresses', () => {
  test.describe.configure({ timeout: 180_000 });

  test('depuis la liste : pastilles, liste collée, contacts du client, adresse invalide refusée', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    await withAccount(browser, 'envoi-multi', async (page, userId) => {
      const client = `Société e2e ${Date.now()}`;
      // Client entreprise et deux contacts : leurs adresses sont proposées en un clic.
      const [customer] = await sql<{ id: string }>(
        `insert into public.customers (owner_user_id, user_id, customer_type, email, company_name, contact_person_name, contact_person_email)
         values ($1, $1, 'entreprise', $2, $3, 'Julie Martin', $4) returning id`,
        [userId, at('accueil'), client, at('julie')]);
      await sql(
        `insert into public.customer_contacts (customer_id, owner_user_id, name, role, email, is_primary)
         values ($1, $2, 'Julie Martin', 'Direction', $3, true), ($1, $2, 'Marc Petit', 'Comptabilité', $4, false)`,
        [customer.id, userId, at('julie'), at('compta')]);
      const quoteId = await createQuote(userId, { client_name: client, days: 90, content_html: '<p>Proposition e2e</p>' });
      await sql(`update public.quotes set customer_id = $2, client_email = $3 where id = $1`, [quoteId, customer.id, at('client')]);

      await page.goto('/devis');
      await page.getByLabel('Filtrer les devis').fill(client);
      await expect(async () => {
        await page.getByRole('button', { name: `Actions pour ${client}` }).first().click({ timeout: 5_000 });
        await page.getByRole('button', { name: 'Envoyer au client' }).click({ timeout: 5_000 });
      }).toPass({ timeout: 60_000 });
      const dialog = page.getByRole('dialog', { name: 'Envoyer le devis au client' });
      const input = dialog.locator('#send-to');

      // L'email du client est déjà là ; les autres adresses connues sont proposées avec leur rôle.
      await expect(pill(dialog, at('client'))).toBeVisible({ timeout: 20_000 });
      const suggestion = dialog.getByRole('button', { name: `Ajouter ${at('compta')}` });
      await expect(suggestion).toBeVisible({ timeout: 30_000 });
      await expect(suggestion).toContainText('Marc Petit, Comptabilité');
      await expect(dialog.getByRole('button', { name: `Ajouter ${at('accueil')}` })).toBeVisible();
      await expect(dialog.getByRole('button', { name: `Ajouter ${at('julie')}` })).toContainText('Julie Martin, Direction');

      // Une adresse tapée puis Entrée, une liste collée (dont un doublon et un « Nom <adresse> »), un contact en un clic.
      await input.fill(at('dupont'));
      await input.press('Enter');
      await expect(pill(dialog, at('dupont'))).toBeVisible();
      await expect(input).toHaveValue('');
      await paste(input, `${at('anne')}, Paul Durand <${at('paul')}>; ${at('dupont')}\n`);
      await expect(pill(dialog, at('anne'))).toBeVisible();
      await expect(pill(dialog, at('paul'))).toBeVisible();
      await expect(dialog.locator('[data-recipient]')).toHaveCount(4);
      await suggestion.click();
      await expect(pill(dialog, at('compta'))).toBeVisible();
      await expect(dialog.getByRole('button', { name: `Ajouter ${at('compta')}` })).toHaveCount(0);

      // Adresse invalide : signalée et l'envoi est refusé tant qu'elle reste.
      await input.fill('pas-une-adresse');
      await input.press('Enter');
      await expect(pill(dialog, 'pas-une-adresse')).toBeVisible();
      await expect(dialog.getByText('« pas-une-adresse » n’est pas une adresse valide')).toBeVisible();
      await dialog.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await expect(dialog.locator('p[role="alert"]')).toContainText('« pas-une-adresse » n’est pas valide');
      expect((await quoteRow(quoteId)).status).toBe('devis_a_faire');
      // Retirer une pastille.
      await dialog.getByRole('button', { name: 'Retirer pas-une-adresse' }).click();
      await expect(pill(dialog, 'pas-une-adresse')).toHaveCount(0);
      await dialog.getByRole('button', { name: `Retirer ${at('paul')}` }).click();
      await expect(dialog.locator('[data-recipient]')).toHaveCount(4);

      await dialog.getByRole('button', { name: 'Envoyer', exact: true }).click();
      const done = page.getByRole('dialog', { name: 'Devis envoyé' });
      await expect(done).toBeVisible({ timeout: 60_000 });
      await expect(done).toContainText('L’email est parti à 4 adresses');
      const served = done.getByRole('list', { name: 'Adresses servies' });
      for (const e of [at('client'), at('dupont'), at('anne'), at('compta')]) await expect(served).toContainText(e);
      await expect(served).not.toContainText(at('paul'));

      // Statut passé en « Devis envoyé » ; l'email du client n'est pas remplacé par un contact.
      const row = await quoteRow(quoteId);
      expect(row.status).toBe('devis_envoye');
      expect(row.client_email).toBe(at('client'));
      expect(row.sent_at).not.toBeNull();
      expect(row.share_token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
      await done.getByRole('button', { name: 'Fermer', exact: true }).last().click();
      await expect(done).toHaveCount(0);
    });
  });

  test('depuis l\'éditeur : devis sans email, deux adresses et copie à soi-même', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
    await withAccount(browser, 'envoi-multi-editeur', async (page, userId) => {
      const quoteId = await createQuote(userId, {
        client_name: 'Paul Durand', services: [{ id: 's1', name: 'Menu Prestige', quantity: 40, unitPrice: 30 }],
      });
      await page.goto(`/devis/${quoteId}/modifier?mode=weboword`);
      await page.waitForLoadState('networkidle');
      const sidebar = page.locator('aside');
      await expect(sidebar.getByRole('button', { name: 'Envoyer au client' })).toBeVisible({ timeout: 60_000 });
      await sidebar.getByRole('button', { name: 'Envoyer au client' }).click();
      const dialog = page.getByRole('dialog', { name: 'Envoyer le devis au client' });
      const input = dialog.locator('#send-to');
      await expect(input).toBeVisible({ timeout: 30_000 });
      await expect(dialog.locator('[data-recipient]')).toHaveCount(0);

      // Virgule et espace valident l'adresse ; la dernière, laissée dans le champ, part aussi.
      await input.pressSequentially(`${at('premier')},${at('second')} `);
      await expect(pill(dialog, at('premier'))).toBeVisible();
      await expect(pill(dialog, at('second'))).toBeVisible();
      const copy = dialog.getByLabel(/M’envoyer une copie/);
      await expect(copy).toBeVisible({ timeout: 30_000 });
      await copy.check();
      await input.fill(at('troisieme'));

      await dialog.getByRole('button', { name: 'Envoyer', exact: true }).click();
      const done = page.getByRole('dialog', { name: 'Devis envoyé' });
      await expect(done).toBeVisible({ timeout: 60_000 });
      await expect(done).toContainText('L’email est parti à 3 adresses');
      for (const e of [at('premier'), at('second'), at('troisieme')]) await expect(done.getByRole('list', { name: 'Adresses servies' })).toContainText(e);
      await expect(done).toContainText('Une copie vous a été envoyée.');
      await done.getByRole('button', { name: 'Fermer', exact: true }).last().click();

      // Le devis n'avait pas d'email : la première adresse devient celle du client.
      const row = await quoteRow(quoteId);
      expect(row.status).toBe('devis_envoye');
      expect(row.client_email).toBe(at('premier'));
      await expect(sidebar.getByLabel('Statut du devis')).toHaveValue('devis_envoye');
    });
  });
});
