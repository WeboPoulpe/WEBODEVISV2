import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Webo et la gestion d'un événement : lecture, puis check-list, matériel, déroulé, heure d'arrivée, contact sur place,
// extras (et leur invitation), courses — toujours après validation, toujours dans l'entreprise.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000901';
const OTHER = '00000000-0000-4000-8000-000000000902';
const EV = '00000000-0000-4000-8000-000000000911';
const THEIRS = '00000000-0000-4000-8000-000000000912';
const PAUL = '00000000-0000-4000-8000-000000000921';
const LEA = '00000000-0000-4000-8000-000000000922';
const ALIEN = '00000000-0000-4000-8000-000000000923';
vi.mock('../session', () => ({
  requireUser: async () => ({ id: CHEF, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: CHEF, email: 'x@y.fr' }),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
const invited: string[][] = [];
let unreachable: string[] = [];
vi.mock('../extras', () => ({ inviteToMissions: async (ids: string[]) => { invited.push(ids); return { error: null, emailed: ids.length - unreachable.length, notified: 0, unreachable }; } }));
const recalcs: string[] = [];
vi.mock('../events', () => ({ recalculateCourses: async (id: string) => { recalcs.push(id); return { error: null, lines: 3, unmatched: [], withoutIngredients: [] }; } }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool, toolsFor } = await import('./tools');
const { decideProposal } = await import('./execute');
let conv = '';
const call = async (name: string, input: unknown) => JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, name, input));
const upd = (over: Record<string, unknown> = {}) => ({
  quote_id: EV, add_checklist: [], check_checklist: [], add_materials: [], run_sheet: null, team_arrival_time: null, onsite_contact: null,
  assign_extras: [], invite_extras: false, ...over,
});
const ev = async () => (await pg.query<{ checklist: { text: string; done: boolean }[]; event_materials: { name: string; qty: number }[]; run_sheet: { time: string; label: string }[]; team_arrival_time: string | null; onsite_contact: string | null }>(
  `select checklist, event_materials, run_sheet, to_char(team_arrival_time, 'HH24:MI') team_arrival_time, onsite_contact from quotes where id = $1`, [EV])).rows[0];

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@e.fr', 'x'), ('${OTHER}', 'o@e.fr', 'x');
    insert into profiles (id, email) values ('${CHEF}', 'c@e.fr'), ('${OTHER}', 'o@e.fr');
    insert into quotes (id, owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services, checklist) values
      ('${EV}', '${CHEF}', '${CHEF}', 'Mariage Lenoir', current_date + 10, 'Mariage', 100, 'valide', '[]', '[{"id":"c1","text":"Nappes blanches","done":false}]'),
      ('${THEIRS}', '${OTHER}', '${OTHER}', 'Autre Gala', current_date + 12, 'Gala', 50, 'valide', '[]', '[]');
    insert into extras (id, user_id, name, role, email, access_token) values
      ('${PAUL}', '${CHEF}', 'Paul Serveur', 'Serveur', 'paul@e.fr', 'tok-paul'), ('${LEA}', '${CHEF}', 'Léa Cuisine', 'Cuisinière', 'lea@e.fr', 'tok-lea'),
      ('${ALIEN}', '${OTHER}', 'Extra Ailleurs', 'Serveur', 'x@e.fr', 'tok-alien');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);
beforeEach(() => { invited.length = 0; recalcs.length = 0; });

describe('Webo et les événements', () => {
  it('lecture limitée à l’entreprise : événements à venir, détail, extras', async () => {
    expect(toolsFor('evenements').map((t) => t.name)).toEqual(expect.arrayContaining(['list_events', 'get_event', 'list_extras', 'propose_event_update', 'propose_courses_recalc']));
    const list = await call('list_events', { from: null, to: null });
    expect(list.results.map((e: { client: string }) => e.client)).toEqual(['Mariage Lenoir']);
    expect((await call('get_event', { quote_id: THEIRS })).error).toBeTruthy();
    const detail = await call('get_event', { quote_id: EV });
    expect(JSON.stringify(detail)).toContain('Nappes blanches');
    const extras = await call('list_extras', { query: null, date: null });
    expect(extras.results.map((x: { name: string }) => x.name).sort()).toEqual(['Léa Cuisine', 'Paul Serveur']);
  });

  it('check-list, matériel, déroulé, arrivée, contact : appliqués seulement à la validation', async () => {
    const r = await call('propose_event_update', upd({
      add_checklist: ['Confirmer le plan de table'], check_checklist: ['nappes blanches'],
      add_materials: [{ name: 'Verres à vin', qty: 120, unit: 'pièce' }],
      run_sheet: [{ time: '18:00', label: 'Vin d’honneur', note: '' }, { time: '20:00', label: 'Dîner', note: 'Service à l’assiette' }],
      team_arrival_time: '15:30', onsite_contact: 'M. Lenoir 06 12 34 56 78',
    }));
    expect(r.proposal_id).toBeTruthy();
    expect((await ev()).team_arrival_time).toBeNull();
    expect((await decideProposal(r.proposal_id, 'accept')).error).toBeNull();
    const e = await ev();
    expect(e.checklist.map((c) => [c.text, c.done])).toEqual([['Nappes blanches', true], ['Confirmer le plan de table', false]]);
    expect(e.event_materials.map((m) => [m.name, m.qty])).toEqual([['Verres à vin', 120]]);
    expect(e.run_sheet.map((s) => s.label)).toEqual(['Vin d’honneur', 'Dîner']);
    expect(e.team_arrival_time).toBe('15:30');
    expect(e.onsite_contact).toBe('M. Lenoir 06 12 34 56 78');
  });

  it('extras : affectés sans doublon ; invités seulement si la carte le dit, une fois', async () => {
    const assign = [{ extra_id: PAUL, arrival_time: '16:00', departure_time: '01:00', mission_notes: 'Service' }];
    await decideProposal((await call('propose_event_update', upd({ assign_extras: assign }))).proposal_id, 'accept');
    expect(invited).toHaveLength(0);
    const r = await call('propose_event_update', upd({ assign_extras: [...assign, { extra_id: LEA, arrival_time: null, departure_time: null, mission_notes: null }], invite_extras: true }));
    expect(JSON.stringify(r.summary)).toMatch(/invit/i);
    await decideProposal(r.proposal_id, 'accept');
    await decideProposal(r.proposal_id, 'accept');
    const rows = (await pg.query<{ extra_id: string; status: string }>(`select extra_id, status from event_extras where quote_id = $1 order by extra_id`, [EV])).rows;
    expect(rows.map((x) => x.extra_id)).toEqual([PAUL, LEA].sort());
    expect(invited).toHaveLength(1);
    expect(invited[0]).toHaveLength(2);
  });

  it('extra ou événement d’une autre entreprise, heure invalide : refusés', async () => {
    expect((await call('propose_event_update', upd({ assign_extras: [{ extra_id: ALIEN, arrival_time: null, departure_time: null, mission_notes: null }] }))).error).toBeTruthy();
    expect((await call('propose_event_update', upd({ quote_id: THEIRS, add_checklist: ['x'] }))).error).toBeTruthy();
    expect((await call('propose_event_update', upd({ team_arrival_time: '25:99' }))).error).toBeTruthy();
  });

  it('déroulé vide : ne remplace rien (null), et seul il n’est pas une modification', async () => {
    expect((await call('propose_event_update', upd({ run_sheet: [] }))).error).toBeTruthy();
    const before = (await ev()).run_sheet;
    const r = await call('propose_event_update', upd({ run_sheet: [{ time: '', label: '', note: '' }], add_checklist: ['Vérifier les fleurs'] }));
    await decideProposal(r.proposal_id, 'accept');
    expect((await ev()).run_sheet).toEqual(before);
  });

  it('devis non confirmé : extras refusés (proposition et validation), check-list permise', async () => {
    await pg.exec(`begin; select set_config('app.user_id', '${CHEF}', true); update quotes set status = 'devis_envoye' where id = '${EV}'; commit;`);
    expect((await call('propose_event_update', upd({ assign_extras: [{ extra_id: LEA, arrival_time: null, departure_time: null, mission_notes: null }] }))).error).toMatch(/confirm/i);
    expect((await call('propose_event_update', upd({ add_checklist: ['Relancer le client'] }))).error).toBeUndefined();
    await pg.exec(`begin; select set_config('app.user_id', '${CHEF}', true); update quotes set status = 'valide' where id = '${EV}'; commit;`);
    const r = await call('propose_event_update', upd({ assign_extras: [{ extra_id: LEA, arrival_time: null, departure_time: null, mission_notes: null }], invite_extras: true }));
    await pg.exec(`begin; select set_config('app.user_id', '${CHEF}', true); update quotes set status = 'refus_client' where id = '${EV}'; commit;`);
    expect((await decideProposal(r.proposal_id, 'accept')).error).toMatch(/confirm/i);
    expect(invited).toHaveLength(0);
    await pg.exec(`begin; select set_config('app.user_id', '${CHEF}', true); update quotes set status = 'valide' where id = '${EV}'; commit;`);
  });

  it('extra injoignable : signalé à la proposition et dans le résultat', async () => {
    const MUET = '00000000-0000-4000-8000-000000000924';
    await pg.exec(`insert into extras (id, user_id, name, role, access_token) values ('${MUET}', '${CHEF}', 'Muet Sansmail', 'Plonge', 'tok-muet')`);
    unreachable = ['Muet Sansmail'];
    const r = await call('propose_event_update', upd({ assign_extras: [{ extra_id: MUET, arrival_time: null, departure_time: null, mission_notes: null }], invite_extras: true }));
    expect(JSON.stringify(r.summary)).toMatch(/sans email/i);
    const res = await decideProposal(r.proposal_id, 'accept');
    expect(res.result?.label).toMatch(/prévenir/i);
    unreachable = [];
  });

  it('extra supprimé entre la proposition et la validation : le reste est appliqué, sans erreur', async () => {
    const TEMP = '00000000-0000-4000-8000-000000000925';
    await pg.exec(`insert into extras (id, user_id, name, role, email, access_token) values ('${TEMP}', '${CHEF}', 'Temp Extra', 'Serveur', 't@e.fr', 'tok-temp')`);
    const r = await call('propose_event_update', upd({ add_checklist: ['Prévoir des glaçons'], assign_extras: [{ extra_id: TEMP, arrival_time: null, departure_time: null, mission_notes: null }] }));
    await pg.exec(`delete from extras where id = '${TEMP}'`);
    expect((await decideProposal(r.proposal_id, 'accept')).error).toBeNull();
    expect((await ev()).checklist.map((c) => c.text)).toContain('Prévoir des glaçons');
  });

  it('courses : recalcul proposé puis lancé à la validation', async () => {
    const r = await call('propose_courses_recalc', { quote_id: EV });
    expect(recalcs).toHaveLength(0);
    await decideProposal(r.proposal_id, 'accept');
    expect(recalcs).toEqual([EV]);
  });
});
