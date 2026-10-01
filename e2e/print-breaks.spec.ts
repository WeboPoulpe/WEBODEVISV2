import { test, expect, type Page } from '@playwright/test';
import { createAccount, deleteAccount, openSession, sql } from './helpers';
import { generateQuoteHtml } from '../lib/generateQuoteHtml';

// Sauts de page de la carte gastronomique. Cas signalé : une fiche longue enveloppée dans un seul bloc, en premier
// plat. Le bandeau « Menu de votre … » occupait alors toute une page (fond étiré), et le plat commençait page suivante.
// On vérifie, dans les trois sorties (fenêtre d'impression de l'éditeur, /imprimer, lien public /d), que le bandeau
// tient sur une seule page, que le premier plat commence sous lui, et que le nombre de pages est le même.
// Compte d'essai créé pour le test, puis supprimé.

const M = 'https://repere.test/';
/** Un repère invisible dans le document : un lien, que Chrome écrit dans le PDF avec la page où il se trouve. */
const mark = (name: string, text: string) => `<a href="${M}${name}" style="color:inherit;text-decoration:none;">${text}</a>`;

const longCard = `<div><h3 style="text-align:center;font-size:16px;margin:0 0 8px;">${mark('plat1', 'M. Ateliers des Rêves vin d’honneur compris 84 €/pers')}</h3>`
  + Array.from({ length: 40 }, (_, i) => `<p style="margin:0 0 4px;text-align:center;">Atelier ${i + 1} : bouchée de saison, condiment maison et herbes fraîches</p>`).join('')
  + '</div>';
const short = (i: number) => ({
  name: `Plat court ${i}`, quantity: 40, unitPrice: 20,
  description: '<p>Une description de deux lignes pour occuper de la place sur la carte, avec des produits de saison et une cuisson lente.</p>',
});
const SERVICES = [{ name: 'Ateliers des Rêves', quantity: 80, unitPrice: 84, gastroCardHtml: longCard }, ...[1, 2, 3, 4, 5].map(short)];

function documentHtml(template: 'mariage' | 'classique') {
  const html = generateQuoteHtml({
    companyName: 'Traiteur Essai', clientName: 'Client Sauts', eventType: 'Mariage', eventDate: '2027-06-12',
    eventLocation: 'Château des Essais', guestCount: 80, vatRate: 10, services: SERVICES,
  }, { template });
  // Repères en haut et en bas du bandeau, et sur le dernier plat.
  return html
    .replace(/(<div class="gastro-header"[^>]*>\s*<p[^>]*>)/, `$1${mark('bandeau-haut', '·')}`)
    .replace(/(<div class="gastro-header"[\s\S]*?)Château des Essais/, `$1${mark('bandeau-bas', 'Château des Essais')}`)
    .replace(/(<div class="gastro-menu"[\s\S]*?)Plat court 5</, `$1${mark('dernier', 'Plat court 5')}<`);
}

/** Page (1, 2, …) de chaque repère dans un PDF produit par Chrome. */
function markerPages(pdf: Buffer): { pages: number; at: Record<string, number> } {
  const s = pdf.toString('latin1');
  const objects = new Map<string, string>();
  for (const m of s.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objects.set(m[1], m[2]);
  const kids = /\/Type \/Pages[\s\S]*?\/Kids \[([^\]]*)\]/.exec(s)![1].match(/\d+(?= 0 R)/g)!;
  const at: Record<string, number> = {};
  kids.forEach((id, i) => {
    const annots = /\/Annots \[([^\]]*)\]/.exec(objects.get(id) ?? '')?.[1].match(/\d+(?= 0 R)/g) ?? [];
    for (const a of annots) {
      const uri = /\/URI \(([^)]*)\)/.exec(objects.get(a) ?? '')?.[1];
      if (uri?.startsWith(M)) at[uri.slice(M.length)] ??= i + 1;
    }
  });
  return { pages: kids.length, at };
}

const PDF = { printBackground: true, preferCSSPageSize: true } as const;

async function pdfOf(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  return markerPages(await page.pdf(PDF));
}

test.describe('sauts de page de la carte', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit'); });

  for (const template of ['mariage', 'classique'] as const) {
    test(`modèle ${template} : fiche longue en premier plat, bandeau entier et suivi du plat, mêmes pages partout`, async ({ browser }) => {
      test.setTimeout(120_000);
      const user = await createAccount('print-breaks', { companyName: 'Traiteur Essai' });
      const context = await openSession(browser, user);
      try {
        const token = `jeton-e2e-${Date.now()}-sauts${template}`;
        const [q] = await sql<{ id: string }>(
          `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, event_location, guest_count, status, services, vat_rate, content_html, share_token)
           values ($1, $1, 'Client Sauts', '2027-06-12', 'Mariage', 'Château des Essais', 80, 'devis_a_faire', $2::jsonb, 10, $3, $4) returning id`,
          [user.id, JSON.stringify(SERVICES.map((s, i) => ({ id: `l${i}`, ...s }))), documentHtml(template), token]);
        const page = await context.newPage();

        // 1. La fenêtre « Imprimer ou PDF » de l'éditeur.
        await page.goto(`/devis/${q.id}/modifier?mode=weboword`);
        await expect(page.locator('#weboword-sheet .gastro-menu')).toBeVisible({ timeout: 20_000 });
        const printed = await page.evaluate(() => {
          const original = URL.createObjectURL;
          let captured: Blob | null = null;
          URL.createObjectURL = (b: Blob | MediaSource) => { captured = b as Blob; return 'blob:capture'; };
          window.open = () => null;
          window.dispatchEvent(new CustomEvent('weboword:print'));
          URL.createObjectURL = original;
          return captured ? (captured as Blob).text() : null;
        });
        expect(printed).not.toBeNull();
        expect(printed).toContain(`${M}plat1`);
        const printPage = await context.newPage();
        await printPage.setContent((printed as string).replace('window.print()', 'void 0'), { waitUntil: 'networkidle' });
        const editeur = await pdfOf(printPage);

        // 2. La page d'impression de l'app.
        const appPrint = await context.newPage();
        await appPrint.addInitScript(() => { window.print = () => {}; });
        await appPrint.goto(`/devis/${q.id}/imprimer`, { waitUntil: 'networkidle' });
        const imprimer = await pdfOf(appPrint);

        // 3. Le lien envoyé au client, sans session.
        const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const publicPage = await visitor.newPage();
        await publicPage.goto(`/d/${token}`, { waitUntil: 'networkidle' });
        const lien = await pdfOf(publicPage);
        await visitor.close();

        const sorties = { editeur, imprimer, lien };
        console.log(template, JSON.stringify(sorties));
        for (const [nom, r] of Object.entries(sorties)) {
          const { at } = r;
          expect(at['bandeau-haut'], `${nom} : repère du bandeau`).toBeGreaterThan(0);
          // Le bandeau n'est pas coupé : son haut et son bas sont sur la même page (sinon son fond s'étire).
          expect(at['bandeau-bas'], `${nom} : bandeau coupé`).toBe(at['bandeau-haut']);
          // Le premier plat commence sous le bandeau : pas de page avec le bandeau seul.
          expect(at.plat1, `${nom} : premier plat`).toBe(at['bandeau-haut']);
          expect(at.dernier, `${nom} : dernier plat`).toBeGreaterThanOrEqual(at.plat1);
        }
        expect(imprimer.pages).toBe(editeur.pages);
        expect(lien.pages).toBe(editeur.pages);

        // La fiche longue est repérée dans la page imprimée, et seulement là : rien n'en reste dans le devis.
        expect(await printPage.locator('.gastro-menu > .webo-long').count()).toBe(1);
        expect(printed).not.toMatch(/class="[^"]*webo-(long|keep-next)/);
        const [{ content_html }] = await sql<{ content_html: string }>(`select content_html from public.quotes where id = $1`, [q.id]);
        expect(content_html).not.toMatch(/webo-(long|keep-next)/);
      } finally {
        await context.close().catch(() => undefined);
        await deleteAccount(user.id);
      }
    });
  }
});
