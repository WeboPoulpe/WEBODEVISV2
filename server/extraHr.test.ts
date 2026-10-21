// Contrats d'extra et DPAE sur le vrai schéma en mémoire : réglages d'employeur, fiche administrative réservée à
// l'entreprise (pas en consultation seule), envoi du contrat, signature en ligne par le lien de l'extra, DPAE,
// rappel de la tâche planifiée envoyé une seule fois, export et purge du compte.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'Test' }) }));
vi.mock('@/lib/push', () => ({
  pushToUser: async () => false, pushToExtra: async () => false, pushEnabled: () => false,
  saveSubscription: async () => ({ error: null }), forgetSubscription: async () => undefined,
}));
const ME = '00000000-0000-4000-8000-00000000ee01';      // titulaire
const MEMBER = '00000000-0000-4000-8000-00000000ee02';  // collaborateur de ME
const READER = '00000000-0000-4000-8000-00000000ee03';  // collaborateur en consultation seule
const OTHER = '00000000-0000-4000-8000-00000000ee09';   // autre entreprise
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

const hr = await import('./extraHr');
const { signExtraContract } = await import('./extraContractSign');
const { runDpaeReminders, exportHrData, contractForExtra } = await import('./extraHrCore');
const { getMissionPage } = await import('./missions');
const { RULES } = await import('./compat/rules');
const { purgeAccount } = await import('./accountPurge');
const { addDays, parisDate } = await import('./reminders');

const today = parisDate(new Date());
const NIR = '185057800608491';
const PNG = `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.padEnd(240, 'A')}`;
let extraId = '', token = '', soonId = '', laterId = '', otherAssignment = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'chef@t.fr', 'x'), ('${MEMBER}', 'm@t.fr', 'x'), ('${READER}', 'r@t.fr', 'x'), ('${OTHER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name, company_email, siret, company_address, first_name, last_name)
      values ('${ME}', 'chef@t.fr', 'Traiteur Dupuis', 'contact@dupuis.fr', '12345678900012', '3 rue Haute, 10000 Troyes', 'Paul', 'Dupuis');
    insert into profiles (id, email, parent_user_id, company_role) values ('${MEMBER}', 'm@t.fr', '${ME}', 'collaborateur');
    insert into profiles (id, email, parent_user_id, company_role) values ('${READER}', 'r@t.fr', '${ME}', 'lecture');
    insert into profiles (id, email, company_name) values ('${OTHER}', 'autre@t.fr', 'Autre');
  `);
  const x = await pg.query<{ id: string; access_token: string }>(`insert into extras (user_id, name, email, role, hourly_rate) values ($1, 'Julie M.', 'julie@extra.fr', 'Serveur', 13.5) returning id, access_token`, [ME]);
  extraId = x.rows[0].id; token = x.rows[0].access_token;
  const quote = async (owner: string, date: string) => (await pg.query<{ id: string }>(`insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, event_location, guest_count, status)
    values ($1, $1, 'Dupont', $2, 'Mariage', 'Château de Pont', 80, 'valide') returning id`, [owner, date])).rows[0].id;
  const assign = async (q: string, e: string, status = 'confirme') => (await pg.query<{ id: string }>(`insert into event_extras (quote_id, extra_id, status, arrival_time, departure_time)
    values ($1, $2, $3, '17:30', '01:30') returning id`, [q, e, status])).rows[0].id;
  soonId = await assign(await quote(ME, addDays(today, 3)), extraId);
  laterId = await assign(await quote(ME, addDays(today, 20)), extraId);
  const otherExtra = (await pg.query<{ id: string }>(`insert into extras (user_id, name) values ($1, 'Autre extra') returning id`, [OTHER])).rows[0].id;
  otherAssignment = await assign(await quote(OTHER, addDays(today, 2)), otherExtra);
});

beforeEach(() => { sent.length = 0; current = ME; });

const details = {
  birth_name: 'Martin', first_names: 'Julie', sex: 'F' as const, birth_date: '1998-04-02', birth_city: 'Reims', birth_department: '51',
  birth_country: 'France', nationality: 'Française', social_security_number: '1 85 05 78 006 084 91', address: '12 rue des Lilas', postal_code: '10000', city: 'Troyes',
};

describe('contrats d’extra et DPAE', () => {
  it('les données sensibles ne passent pas par /api/db', () => {
    for (const t of ['extra_hr_details', 'extra_contracts', 'employer_settings']) expect(RULES[t]).toBeUndefined();
  });

  it('fiche administrative : vérifiée, réservée à l’entreprise et refusée en consultation seule', async () => {
    expect((await hr.saveExtraHrDetails(extraId, { ...details, social_security_number: '185057800608492' })).error).toMatch(/sécurité sociale/);
    expect((await hr.saveExtraHrDetails(extraId, { ...details, iban: 'FR76 0000' })).error).toMatch(/IBAN/);
    current = MEMBER;
    expect((await hr.saveExtraHrDetails(extraId, details)).error).toBeNull();
    const back = await hr.getExtraHrDetails(extraId);
    expect(back.error).toBeNull();
    expect(back.details).toMatchObject({ birth_name: 'Martin', social_security_number: NIR, birth_date: '1998-04-02', sex: 'F' });
    const row = (await pg.query<{ owner_user_id: string }>(`select owner_user_id from extra_hr_details where extra_id = $1`, [extraId])).rows[0];
    expect(row.owner_user_id).toBe(ME);

    current = READER;
    expect((await hr.getExtraHrDetails(extraId)).error).toMatch(/consultation seule/);
    expect('error' in (await hr.getMissionHr(soonId)) && (await hr.getMissionHr(soonId)).error).toMatch(/consultation seule/);
    await expect(hr.saveExtraHrDetails(extraId, details)).rejects.toThrow(/consultation seule/);
    current = OTHER;
    expect((await hr.getExtraHrDetails(extraId)).error).toBe('Extra introuvable.');
    expect((await hr.saveExtraHrDetails(extraId, details)).error).toBe('Extra introuvable.');
  });

  it('réglages d’employeur : par le titulaire seulement', async () => {
    current = MEMBER;
    expect((await hr.saveEmployerSettings({ retirement_fund: 'X' })).error).toMatch(/titulaire/);
    current = ME;
    expect((await hr.saveEmployerSettings({ naf_code: '56.21' })).error).toMatch(/APE/);
    expect((await hr.saveEmployerSettings({ naf_code: '5621z', retirement_fund: 'Malakoff Humanis', convention: 'Restauration rapide, IDCC 1501', signature_city: 'Troyes' })).error).toBeNull();
    current = MEMBER;
    const s = await hr.getEmployerSettings();
    expect(s.settings).toMatchObject({ naf_code: '5621Z', retirement_fund: 'Malakoff Humanis' });
    expect(s.identity.siret).toBe('12345678900012');
    expect(s.canEdit).toBe(false);
  });

  it('contrat : brouillon complet, conditions ajustées, puis envoi avec le PDF et sans donnée personnelle dans l’email', async () => {
    const m = await hr.getMissionHr(soonId);
    if (m.error !== null) throw new Error(m.error);
    expect(m.missing).toEqual([]);
    expect(m.contract.status).toBe('brouillon');
    expect(m.terms).toMatchObject({ position: 'Serveur', hourly_rate: 13.5, start: '17:30', end: '01:30', location: 'Château de Pont' });
    expect(m.doc.employee.name).toBe('Julie Martin');
    expect(JSON.stringify(m.doc)).toContain('IDCC 1501');
    expect(m.dpae.alert.level).toBe('open');
    expect(m.sheet[1].fields.find((f) => f.label === 'N° de sécurité sociale')?.value).toBe(NIR);

    expect((await hr.saveContractTerms(soonId, { ...m.terms, position: 'Chef de rang', hourly_rate: 14.25 })).error).toBeNull();
    const res = await hr.sendContract(soonId);
    expect(res).toMatchObject({ error: null, emailed: true });
    expect(res.link).toMatch(new RegExp(`^https://webodevis.fr/e/${token}/contrat/[0-9a-f-]{36}$`));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'julie@extra.fr', fromName: 'Traiteur Dupuis', replyTo: 'contact@dupuis.fr' });
    expect(Buffer.from(sent[0].attachments![0].content, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    for (const secret of [NIR, '1998', 'Reims', 'Lilas']) expect(sent[0].html).not.toContain(secret);

    const after = await hr.getMissionHr(soonId);
    if (after.error !== null) throw new Error(after.error);
    expect(after.contract.status).toBe('envoye');
    expect(after.doc.subtitle).toContain('Chef de rang');
    expect((await hr.saveContractTerms(soonId, after.terms)).error).toMatch(/déjà été envoyé/);
    // Une autre entreprise ne voit pas la mission.
    current = OTHER;
    expect((await hr.getMissionHr(soonId)).error).toBe('Mission introuvable.');
    expect((await hr.sendContract(soonId)).error).toBe('Mission introuvable.');
  });

  it('signature en ligne par le lien de l’extra, une seule fois', async () => {
    const page = (await getMissionPage(token))!;
    const mission = page.missions.find((x) => x.id === soonId)!;
    expect(mission.contract?.status).toBe('envoye');
    const contractId = mission.contract!.id;
    expect(await contractForExtra('0'.repeat(32), contractId)).toBeNull();

    const sign = (o: Partial<Parameters<typeof signExtraContract>[0]> = {}) =>
      signExtraContract({ token, contractId, signerName: 'Julie Martin', signature: PNG, accept: true, ...o });
    expect((await sign({ token: 'a'.repeat(32) })).error).toMatch(/plus accès/);
    expect((await sign({ accept: false })).error).toMatch(/Cochez/);
    expect((await sign({ signature: 'x' })).error).toMatch(/Signez/);
    expect((await sign()).error).toBeNull();
    expect((await sign()).error).toBe('Ce contrat est déjà signé.');

    const row = (await pg.query<{ status: string; signer_name: string; signer_ip: string; signed_at: string | null }>(`select status, signer_name, signer_ip, signed_at from extra_contracts where id = $1`, [contractId])).rows[0];
    expect(row).toMatchObject({ status: 'signe', signer_name: 'Julie Martin', signer_ip: '203.0.113.7' });
    expect(row.signed_at).not.toBeNull();
    const note = (await pg.query<{ title: string }>(`select title from notifications where user_id = $1 and type = 'extra_response'`, [ME])).rows;
    expect(note.map((n) => n.title)).toContain('Julie M. a signé son contrat');
    const statuses = await hr.getHrStatuses([soonId, laterId, otherAssignment]);
    expect(Object.keys(statuses).sort()).toEqual([soonId, laterId].sort());
    expect(statuses[soonId].contract).toBe('signe');
    expect(statuses[laterId]).toMatchObject({ contract: null, dpae: { level: 'early' } });
  });

  it('nouveau contrat : la signature est effacée et l’ancien lien ne marche plus', async () => {
    const contractId = (await pg.query<{ id: string }>(`select id from extra_contracts where event_extra_id = $1`, [laterId])).rows[0]?.id;
    expect(contractId).toBeUndefined();
    expect((await hr.markContractSigned(laterId)).error).toBeNull();
    const paper = (await pg.query<{ id: string; status: string; signed_on_paper: boolean }>(`select id, status, signed_on_paper from extra_contracts where event_extra_id = $1`, [laterId])).rows[0];
    expect(paper).toMatchObject({ status: 'signe', signed_on_paper: true });
    expect((await hr.resetContract(laterId)).error).toBeNull();
    expect(await contractForExtra(token, paper.id)).toBeNull();
    const m = await hr.getMissionHr(laterId);
    if (m.error !== null) throw new Error(m.error);
    expect(m.contract.status).toBe('brouillon');
    current = READER;
    await expect(hr.resetContract(laterId)).rejects.toThrow(/consultation seule/);
  });

  it('rappel de DPAE au traiteur, une seule fois par mission, puis DPAE notée faite', async () => {
    const run = await runDpaeReminders({ origin: 'https://webodevis.fr' });
    // Un email par entreprise : la mission dans 3 jours chez ME (celle dans 20 jours attend), et celle de l'autre entreprise.
    expect(run).toEqual({ companies: 2, missions: 2, failed: 0 });
    expect(sent.map((m) => m.to).sort()).toEqual(['autre@t.fr', 'contact@dupuis.fr']);
    const mine = sent.find((m) => m.to === 'contact@dupuis.fr')!;
    expect(mine.subject).toBe('Déclaration d’embauche (DPAE) à faire : Julie M.');
    expect(mine.html).not.toContain(NIR);
    expect(mine.html).not.toContain('Autre extra');
    sent.length = 0;
    expect(await runDpaeReminders({ origin: 'https://webodevis.fr' })).toEqual({ companies: 0, missions: 0, failed: 0 });
    expect(sent).toHaveLength(0);

    expect((await hr.saveDpae(soonId, { done: true, ack: 'DPAE-123456', date: today })).error).toBeNull();
    expect((await hr.saveDpae(soonId, { done: true, date: addDays(today, 5) })).error).toMatch(/date/);
    const m = await hr.getMissionHr(soonId);
    if (m.error !== null) throw new Error(m.error);
    expect(m.dpae).toMatchObject({ done: true, ack: 'DPAE-123456', date: today, alert: { level: 'done' } });
  });

  it('export des données : tout pour le titulaire, pas les données personnelles en consultation seule', async () => {
    const mine = await exportHrData(ME);
    expect(Object.keys(mine).sort()).toEqual(['employer_settings', 'extra_contracts', 'extra_hr_details']);
    expect(JSON.stringify(mine.extra_hr_details)).toContain(NIR);
    const reader = await exportHrData(READER);
    expect(Object.keys(reader)).toEqual(['employer_settings']);
  });

  it('la purge du compte efface fiches, contrats et réglages', async () => {
    await purgeAccount(ME);
    for (const t of ['extra_hr_details', 'extra_contracts', 'employer_settings']) {
      expect((await pg.query(`select 1 from ${t} where ${t === 'employer_settings' ? 'user_id' : 'owner_user_id'} = $1`, [ME])).rows).toHaveLength(0);
    }
    expect((await pg.query(`select 1 from extras where user_id = $1`, [ME])).rows).toHaveLength(0);
    // L'autre entreprise n'est pas touchée.
    expect((await pg.query(`select 1 from event_extras where id = $1`, [otherAssignment])).rows).toHaveLength(1);
  });

  it('sans la migration 0030, rien ne casse : listes vides, enregistrement refusé', async () => {
    await pg.exec(`drop table extra_contracts; drop table extra_hr_details; drop table employer_settings;`);
    current = OTHER;
    const m = await hr.getMissionHr(otherAssignment);
    if (m.error !== null) throw new Error(m.error);
    expect(m.available).toBe(false);
    expect(m.canEdit).toBe(false);
    expect((await hr.saveDpae(otherAssignment, { done: true })).error).toMatch(/mise à jour de la base/);
    expect(['open', 'urgent']).toContain((await hr.getHrStatuses([otherAssignment]))[otherAssignment].dpae.level);
    expect((await hr.getEmployerSettings()).available).toBe(false);
    expect(await runDpaeReminders({ origin: 'https://webodevis.fr' })).toBeNull();
    expect(await exportHrData(OTHER)).toEqual({});
    const token2 = (await pg.query<{ access_token: string }>(`select access_token from extras where user_id = $1`, [OTHER])).rows[0].access_token;
    expect((await getMissionPage(token2))!.missions[0].contract).toBeNull();
  });
});
