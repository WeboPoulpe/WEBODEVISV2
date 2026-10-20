// Équipe d'une entreprise, sur le vrai schéma en mémoire : invitation, acceptation, rôle, retrait.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000a0001';
const OTHER = '00000000-0000-4000-8000-0000000a0002';
let current = OWNER;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@t.fr' }), requireWriter: async () => ({ id: current, email: 'x@t.fr' }) }));
const links: string[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { html: string }) => { links.push(/\/invitation\/([A-Za-z0-9_-]+)/.exec(m.html)?.[1] ?? ''); return { error: null }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const team = await import('./team');
let memberId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@t.fr', 'x'), ('${OTHER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name, max_linked_users) values ('${OWNER}', 'chef@t.fr', 'Traiteur Verdier', 2), ('${OTHER}', 'autre@t.fr', 'Autre', 1);
  `);
});

describe('équipe', () => {
  it('invite un collaborateur par email', async () => {
    expect((await team.inviteMember({ email: 'Lea@T.fr', role: 'collaborateur' })).error).toBeNull();
    expect(links.at(-1)).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const t = (await team.getTeam())!;
    expect(t.invitations).toEqual([expect.objectContaining({ email: 'lea@t.fr', role: 'collaborateur' })]);
    expect(t.used).toBe(1);
  });

  it('refuse une adresse qui a déjà un compte', async () => {
    expect((await team.inviteMember({ email: 'autre@t.fr', role: 'lecture' })).error).toMatch(/déjà un compte/);
  });

  it('l’invité crée son accès, rattaché à l’entreprise avec son rôle', async () => {
    const token = links.at(-1)!;
    expect(await team.getInvitation(token)).toMatchObject({ status: 'ok', email: 'lea@t.fr', companyName: 'Traiteur Verdier' });
    expect((await team.acceptInvitation({ token, firstName: 'Léa', lastName: 'Martin', password: 'court' })).error).toMatch(/8 caractères/);
    const res = await team.acceptInvitation({ token, firstName: 'Léa', lastName: 'Martin', password: 'motdepasse' });
    expect(res.error).toBeNull();
    const { rows } = await pg.query<{ id: string; parent_user_id: string; company_role: string }>(`select p.id, p.parent_user_id, p.company_role from profiles p where p.email = 'lea@t.fr'`);
    memberId = rows[0].id;
    expect(rows[0]).toMatchObject({ parent_user_id: OWNER, company_role: 'collaborateur' });
    expect(await team.getInvitation(token)).toEqual({ status: 'used' });
  });

  it('un collaborateur ne gère pas l’équipe', async () => {
    current = memberId;
    expect((await team.inviteMember({ email: 'x@t.fr', role: 'lecture' })).error).toMatch(/titulaire ou un gérant/);
    expect((await team.getTeam())!.canManage).toBe(false);
    current = OWNER;
  });

  it('respecte le nombre de places', async () => {
    expect((await team.inviteMember({ email: 'b@t.fr', role: 'lecture' })).error).toBeNull();
    expect((await team.inviteMember({ email: 'c@t.fr', role: 'lecture' })).error).toMatch(/2 collaborateurs/);
  });

  it('change le rôle, puis retire le collaborateur en rendant ses données au titulaire', async () => {
    expect((await team.setMemberRole(memberId, 'lecture')).error).toBeNull();
    await pg.query(`insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status) values ($1, $1, 'Créé par Léa', '2026-12-01', 'cocktail', 30, 'devis_envoye')`, [memberId]);
    expect((await team.removeMember(memberId)).error).toBeNull();
    const q = await pg.query<{ owner_user_id: string; user_id: string }>(`select owner_user_id, user_id from quotes where client_name = 'Créé par Léa'`);
    expect(q.rows[0]).toEqual({ owner_user_id: OWNER, user_id: OWNER });
    const p = await pg.query<{ is_active: boolean; parent_user_id: string | null }>(`select is_active, parent_user_id from profiles where id = $1`, [memberId]);
    expect(p.rows[0]).toEqual({ is_active: false, parent_user_id: null });
  });

  it('une autre entreprise ne touche pas à cette équipe', async () => {
    current = OTHER;
    expect((await team.setMemberRole(memberId, 'gerant')).error).toMatch(/ne fait pas partie/);
    expect((await team.getTeam())!.members.map((m) => m.email)).toEqual(['autre@t.fr']);
    current = OWNER;
  });
});
