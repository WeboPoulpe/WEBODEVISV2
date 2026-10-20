// Rendez-vous de dégustation sur le vrai schéma en mémoire : création, accès réservé à l'entreprise,
// emails au client, rappels automatiques envoyés une seule fois, annulation.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-00000000dd01';      // titulaire
const MEMBER = '00000000-0000-4000-8000-00000000dd02';  // collaborateur de ME
const READER = '00000000-0000-4000-8000-00000000dd03';  // collaborateur en consultation seule
const OTHER = '00000000-0000-4000-8000-00000000dd09';   // autre entreprise
let current = ME;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'chef@t.fr' }),
  requireWriter: async () => {
    if (current === READER) throw new Error('Votre accès est en consultation seule');
    return { id: current, email: 'chef@t.fr' };
  },
  getSessionUser: async () => null,
}));
interface Sent { to: string; subject: string; html: string; fromName?: string; replyTo?: string | null; attachments?: { filename: string; content: string }[] }
const sent: Sent[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: Sent) => { sent.push(m); return { error: null }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { saveTasting, setTastingStatus, listTastings, getQuoteTastings } = await import('./tastings');
const { runTastingReminders } = await import('./tastingReminders');
const { getQuoteHistory } = await import('./quoteHistory');
const { addDays, parisDate } = await import('./reminders');

const today = parisDate(new Date());
const tomorrow = addDays(today, 1);
let quoteId = '';

const base = (over: Record<string, unknown> = {}) => ({
  client_name: 'Claire Dupont', client_email: 'claire@client.fr', client_phone: '06 12 34 56 78',
  tasting_date: tomorrow, start_time: '14:30', duration_minutes: 90, location: 'Au laboratoire', guest_count: 2,
  notes: 'Allergie aux noix', notify_client: true, send_email: true, ...over,
});

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'chef@t.fr', 'x'), ('${MEMBER}', 'm@t.fr', 'x'), ('${READER}', 'r@t.fr', 'x'), ('${OTHER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name, company_email, company_phone) values ('${ME}', 'chef@t.fr', 'Traiteur Dupuis', 'contact@dupuis.fr', '03 25 00 00 00');
    insert into profiles (id, email, parent_user_id) values ('${MEMBER}', 'm@t.fr', '${ME}');
    insert into profiles (id, email, parent_user_id, company_role) values ('${READER}', 'r@t.fr', '${ME}', 'lecture');
    insert into profiles (id, email, company_name) values ('${OTHER}', 'autre@t.fr', 'Autre');
  `);
  const { rows } = await pg.query<{ id: string }>(`insert into quotes (owner_user_id, user_id, client_name, client_email, client_phone, event_date, event_type, guest_count, status)
    values ($1, $1, 'Dupont', 'claire@client.fr', '06 12 34 56 78', '2027-06-12', 'mariage', 80, 'devis_envoye') returning id`, [ME]);
  quoteId = rows[0].id;
});

beforeEach(() => { sent.length = 0; current = ME; });

describe('dégustations', () => {
  let id = '';

  it('se planifie depuis un devis, pré-remplie avec le client, et envoie la confirmation avec le fichier agenda', async () => {
    const q = (await getQuoteTastings(quoteId))!;
    expect(q.defaults).toMatchObject({ client_name: 'Dupont', client_email: 'claire@client.fr', client_phone: '06 12 34 56 78' });
    expect(q.canEdit).toBe(true);

    current = MEMBER; // un collaborateur crée pour l'entreprise
    const res = await saveTasting({ ...base(), quote_id: quoteId });
    expect(res.error).toBeNull();
    expect(res.mailed).toBe(true);
    id = res.tasting!.id;
    expect(res.tasting).toMatchObject({ quote_id: quoteId, tasting_date: tomorrow, start_time: '14:30', status: 'prevu', notify_client: true });
    const owner = (await pg.query<{ owner_user_id: string; created_by: string }>(`select owner_user_id, created_by from tastings where id = $1`, [id])).rows[0];
    expect(owner).toEqual({ owner_user_id: ME, created_by: MEMBER });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'claire@client.fr', fromName: 'Traiteur Dupuis', replyTo: 'contact@dupuis.fr' });
    expect(sent[0].subject).toMatch(/^Votre dégustation avec Traiteur Dupuis/);
    expect(sent[0].html).toContain('14 h 30');
    expect(sent[0].html).not.toContain('noix'); // les notes restent internes
    const ics = Buffer.from(sent[0].attachments![0].content, 'base64').toString('utf8');
    expect(ics).toContain(`DTSTART;TZID=Europe/Paris:${tomorrow.replace(/-/g, '')}T143000`);
    expect(ics).toContain(`DTEND;TZID=Europe/Paris:${tomorrow.replace(/-/g, '')}T160000`);

    current = ME;
    expect((await listTastings({ from: today, to: addDays(today, 30) })).tastings.map((t) => t.id)).toEqual([id]);
    const history = (await getQuoteHistory(quoteId))!;
    expect(history.find((e) => e.kind === 'degustation')).toMatchObject({ title: 'Dégustation prévue', by: 'm@t.fr' });
  });

  it('sans envoi demandé, aucun email ne part', async () => {
    const res = await saveTasting(base({ client_name: 'Sans email', send_email: false, tasting_date: addDays(today, 20) }));
    expect(res.error).toBeNull();
    expect(res.mailed).toBeUndefined();
    expect(sent).toHaveLength(0);
    await setTastingStatus({ id: res.tasting!.id, status: 'annule', sendEmail: false });
  });

  it('reste invisible et intouchable pour une autre entreprise', async () => {
    current = OTHER;
    expect((await listTastings({ from: today, to: addDays(today, 30) })).tastings).toEqual([]);
    expect(await getQuoteTastings(quoteId)).toBeNull();
    expect((await saveTasting({ ...base(), id })).error).toBe('Rendez-vous introuvable.');
    expect((await setTastingStatus({ id, status: 'annule' })).error).toBe('Rendez-vous introuvable.');
    expect((await saveTasting({ ...base(), quote_id: quoteId })).error).toBe('Devis introuvable.');
    expect(sent).toHaveLength(0);
    const { rows } = await pg.query<{ status: string }>(`select status from tastings where id = $1`, [id]);
    expect(rows[0].status).toBe('prevu');
  });

  it('un compte en consultation seule voit mais ne modifie pas', async () => {
    current = READER;
    const list = await listTastings({ from: today, to: addDays(today, 30) });
    expect(list.canEdit).toBe(false);
    expect(list.tastings.some((t) => t.id === id)).toBe(true);
    await expect(saveTasting({ ...base(), id, client_name: 'Piraté' })).rejects.toThrow(/consultation seule/);
    await expect(setTastingStatus({ id, status: 'annule' })).rejects.toThrow(/consultation seule/);
  });

  it('envoie le rappel de la veille une seule fois', async () => {
    const first = await runTastingReminders();
    expect(first).toEqual({ sent: 1, failed: 0 });
    expect(sent[0].subject).toBe('Rappel : votre dégustation demain à 14 h 30');
    const { rows } = await pg.query<{ reminder_sent_at: string | null }>(`select reminder_sent_at from tastings where id = $1`, [id]);
    expect(rows[0].reminder_sent_at).not.toBeNull();
    sent.length = 0;
    expect(await runTastingReminders()).toEqual({ sent: 0, failed: 0 });
    expect(sent).toHaveLength(0);
    const history = (await getQuoteHistory(quoteId))!;
    expect(history.some((e) => e.title === 'Rappel de dégustation envoyé au client')).toBe(true);
  });

  it('rappelle aussi trois jours avant un rendez-vous pris plus tôt, et pas celui d’un client à ne pas prévenir', async () => {
    const early = await saveTasting(base({ client_name: 'Paul Martin', client_email: 'paul@client.fr', tasting_date: addDays(today, 3), send_email: false }));
    const silent = await saveTasting(base({ client_name: 'Discret', client_email: 'discret@client.fr', tasting_date: tomorrow, notify_client: false }));
    expect(silent.mailed).toBeUndefined();
    await pg.query(`update tastings set created_at = now() - interval '5 days' where id = $1`, [early.tasting!.id]);
    expect(await runTastingReminders()).toEqual({ sent: 1, failed: 0 });
    expect(sent.map((m) => m.to)).toEqual(['paul@client.fr']);
    expect(sent[0].subject).toMatch(/^Votre dégustation approche/);
    sent.length = 0;
    expect(await runTastingReminders()).toEqual({ sent: 0, failed: 0 });
    await setTastingStatus({ id: early.tasting!.id, status: 'annule', sendEmail: false });
  });

  it('un changement d’horaire prévient le client et relance le rappel pour la nouvelle date', async () => {
    const res = await saveTasting({ ...base(), id, start_time: '16:00' });
    expect(res.error).toBeNull();
    expect(res.mailed).toBe(true);
    expect(sent[0].subject).toMatch(/^Votre dégustation est déplacée/);
    expect(sent[0].attachments).toHaveLength(1);
    const { rows } = await pg.query<{ reminder_sent_at: string | null }>(`select reminder_sent_at from tastings where id = $1`, [id]);
    expect(rows[0].reminder_sent_at).toBeNull();
    // Un changement des seules notes ne prévient personne.
    sent.length = 0;
    expect((await saveTasting({ ...base(), id, start_time: '16:00', notes: 'Prévoir du vin' })).mailed).toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('l’annulation prévient le client et exclut le rappel', async () => {
    const res = await setTastingStatus({ id, status: 'annule' });
    expect(res.error).toBeNull();
    expect(res.mailed).toBe(true);
    expect(sent[0].subject).toMatch(/annulée$/);
    sent.length = 0;
    expect(await runTastingReminders()).toEqual({ sent: 0, failed: 0 });
    expect(sent).toHaveLength(0);
    expect((await saveTasting({ ...base(), id })).error).toMatch(/annulé/);
    const history = (await getQuoteHistory(quoteId))!;
    expect(history.find((e) => e.kind === 'degustation' && e.title.startsWith('Dégustation prévue'))!.title).toBe('Dégustation prévue (annulée)');
  });

  it('refuse un rendez-vous incomplet', async () => {
    expect((await saveTasting(base({ client_name: ' ' }))).error).toMatch(/nom du client/);
    expect((await saveTasting(base({ client_email: 'pas-une-adresse' }))).error).toMatch(/n’est pas valide/);
    expect((await saveTasting(base({ start_time: '' }))).error).toMatch(/heure/);
    expect((await saveTasting(base({ duration_minutes: 5 }))).error).toMatch(/durée/);
  });

  it('sans la table (migration pas encore appliquée), les listes sont vides et la tâche planifiée passe son tour', async () => {
    await pg.exec('drop table tastings');
    expect(await listTastings({ from: today, to: tomorrow })).toMatchObject({ tastings: [], available: false });
    expect(await getQuoteTastings(quoteId)).toMatchObject({ tastings: [], available: false });
    expect(await runTastingReminders()).toBeNull();
    expect((await saveTasting(base())).error).toMatch(/prochaine mise à jour/);
    expect((await getQuoteHistory(quoteId))!.some((e) => e.kind === 'degustation')).toBe(false);
  });
});
