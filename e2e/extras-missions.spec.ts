import { test, expect } from '@playwright/test';
import { createAccount, createQuote, deleteAccount, envLocal, sql } from './helpers';

// Page de missions de l'extra (sans compte) : répondre, prévenir le traiteur, jours indisponibles,
// installation (manifeste propre à l'extra) et ajout à l'agenda. Compte d'essai créé puis supprimé.

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name === 'tablet', 'téléphone et ordinateur suffisent'); });

test('l’extra répond depuis sa page, le traiteur est prévenu ; jours indisponibles ; app installable ; agenda', async ({ browser }, testInfo) => {
  const owner = await createAccount('missions', { companyName: 'Maison Essai' });
  try {
    await sql(`update public.profiles set company_phone = '01 02 03 04 05' where id = $1`, [owner.id]);
    const quoteId = await createQuote(owner.id, { client_name: 'Famille Durand', status: 'valide', event_type: 'Mariage', days: 12, guest_count: 80 });
    await sql(`update public.quotes set event_location = 'Domaine des Tilleuls' where id = $1`, [quoteId]);
    const [extra] = await sql<{ id: string; access_token: string }>(
      `insert into public.extras (user_id, name, role, email) values ($1, 'Léa Martin', 'Serveur', 'lea@test.webodevis.local') returning id, access_token`, [owner.id]);
    const [assignment] = await sql<{ id: string }>(
      `insert into public.event_extras (quote_id, extra_id, status, arrival_time, departure_time, mission_notes) values ($1, $2, 'a_solliciter', '17:30', '01:00', 'Tenue noire') returning id`,
      [quoteId, extra.id]);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`/e/${extra.access_token}`);
    await expect(page.getByRole('heading', { name: 'Bonjour Léa' })).toBeVisible();
    await expect(page.getByText('1 mission attend votre réponse.')).toBeVisible();
    await expect(page.getByText('17:30 à 01:00')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Appeler' })).toHaveAttribute('href', 'tel:0102030405');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);

    // Elle accepte : statut enregistré, notification pour le traiteur.
    await page.getByRole('button', { name: 'Je suis disponible' }).click();
    await expect.poll(async () => (await sql<{ status: string; responded_at: string | null }>(`select status, responded_at from public.event_extras where id = $1`, [assignment.id]))[0], { timeout: 15_000 })
      .toMatchObject({ status: 'confirme' });
    const [notif] = await sql<{ title: string; action_url: string; type: string }>(`select title, action_url, type from public.notifications where user_id = $1`, [owner.id]);
    expect(notif).toEqual({ title: 'Léa Martin a confirmé', action_url: `/evenements/${quoteId}?onglet=extras`, type: 'extra_response' });

    // Puis se désiste : le traiteur est prévenu en priorité haute.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Je ne peux plus venir' }).click();
    await expect.poll(async () => (await sql<{ priority: string }>(`select priority from public.notifications where user_id = $1 and title like '%pas disponible'`, [owner.id])).map((n) => n.priority), { timeout: 15_000 })
      .toEqual(['high']);
    await expect(page.getByRole('button', { name: 'Finalement, je suis disponible' })).toBeVisible();

    // Jour indisponible.
    const day = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel('Jour indisponible').fill(day);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect.poll(async () => (await sql<{ d: string[] }>(`select array(select to_char(x, 'YYYY-MM-DD') from unnest(unavailable_dates) x) as d from public.extras where id = $1`, [extra.id]))[0].d, { timeout: 15_000 })
      .toEqual([day]);

    // Installable : la page annonce son propre manifeste, qui s'ouvre sur ses missions.
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe(`/e/${extra.access_token}/manifest.webmanifest`);
    const manifest = await (await page.request.get(manifestHref!)).json();
    expect(manifest).toMatchObject({ start_url: `/e/${extra.access_token}`, scope: `/e/${extra.access_token}`, display: 'standalone', short_name: 'Mes missions' });

    // Agenda : horaires de Paris, fin après minuit le lendemain.
    const ics = await (await page.request.get(`/e/${extra.access_token}/agenda/${assignment.id}`)).text();
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toMatch(/DTSTART;TZID=Europe\/Paris:\d{8}T173000/);
    expect(ics).toContain('LOCATION:Domaine des Tilleuls');

    // Un mauvais lien ne montre rien.
    expect((await page.request.get('/e/0000000000000000/manifest.webmanifest')).status()).toBe(404);
    await context.close();
  } finally {
    await deleteAccount(owner.id);
  }
});

test('rappel de la veille : réservé à la tâche planifiée, envoyé une seule fois', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'un seul passage suffit');
  const owner = await createAccount('rappel', { companyName: 'Maison Essai' });
  try {
    const quoteId = await createQuote(owner.id, { client_name: 'Famille Petit', status: 'valide', days: 1 });
    // « Demain » à l'heure de Paris, comme la tâche.
    const parisToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    const tomorrow = new Date(parisToday + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await sql(`update public.quotes set event_date = $2 where id = $1`, [quoteId, tomorrow.toISOString().slice(0, 10)]);
    const [extra] = await sql<{ id: string }>(`insert into public.extras (user_id, name, email) values ($1, 'Hugo Bernard', 'hugo@test.webodevis.local') returning id`, [owner.id]);
    const [a] = await sql<{ id: string }>(`insert into public.event_extras (quote_id, extra_id, status, arrival_time) values ($1, $2, 'confirme', '18:00') returning id`, [quoteId, extra.id]);

    expect((await request.get('/api/cron/rappels-extras')).status()).toBe(401);
    const auth = { Authorization: `Bearer ${envLocal('CRON_SECRET')}` };
    expect((await request.get('/api/cron/rappels-extras', { headers: auth })).ok()).toBe(true);
    const [first] = await sql<{ reminded_at: string | null }>(`select reminded_at from public.event_extras where id = $1`, [a.id]);
    expect(first.reminded_at).not.toBeNull();
    await request.get('/api/cron/rappels-extras', { headers: auth });
    const [second] = await sql<{ reminded_at: string | null }>(`select reminded_at from public.event_extras where id = $1`, [a.id]);
    expect(String(second.reminded_at)).toBe(String(first.reminded_at));
  } finally {
    await deleteAccount(owner.id);
  }
});
