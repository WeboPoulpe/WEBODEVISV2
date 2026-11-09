import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Travail à plusieurs sur une brochure du Studio : versions, commentaires, validation, modèles d'entreprise.

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
const pushes: { userId: string; title: string }[] = [];
vi.mock('@/lib/push', () => ({ pushToUser: async (userId: string, m: { title: string }) => { pushes.push({ userId, title: m.title }); return 1; } }));
const CHEF = '00000000-0000-4000-8000-0000000000d1';
const ADJOINT = '00000000-0000-4000-8000-0000000000d2';
const AUTRE = '00000000-0000-4000-8000-0000000000d3';
let current = CHEF;
vi.mock('./session', () => ({
  getSessionUser: async () => null,
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const br = await import('./brochures');
const co = await import('./brochureCollab');

const page = (id: string, text: string) => ({ id, els: [{ id: `t${id}`, type: 'text', html: `<p>${text}</p>`, x: 1, y: 1, w: 50 }] });

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'chef@c.fr', 'x'), ('${ADJOINT}', 'adj@c.fr', 'x'), ('${AUTRE}', 'autre@c.fr', 'x');
    insert into profiles (id, email, first_name, last_name, company_name) values ('${CHEF}', 'chef@c.fr', 'Camille', 'Chef', 'Traiteur'), ('${AUTRE}', 'autre@c.fr', 'Alex', 'Autre', 'Autre');
    insert into profiles (id, email, first_name, parent_user_id) values ('${ADJOINT}', 'adj@c.fr', 'Dominique', '${CHEF}');
  `);
});

describe('versions', () => {
  it('l’état d’avant est gardé à l’enregistrement (une version par demi-heure), on en nomme, on revient à l’une d’elles', async () => {
    current = CHEF;
    const { id } = await br.createBrochure({ name: 'Versions', editor: 'studio' });
    await br.saveBrochure(id!, { studio: { pages: [page('a', 'Un')] } });
    await br.saveBrochure(id!, { studio: { pages: [page('a', 'Deux')] } });
    let list = (await co.listVersions(id!))!;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ auto: true, author: 'Camille Chef' });
    expect((await co.saveVersion(id!, 'Avant le salon')).error).toBeNull();
    await br.saveBrochure(id!, { studio: { pages: [page('a', 'Trois')] } });
    list = (await co.listVersions(id!))!;
    const named = list.find((v) => v.label === 'Avant le salon')!;
    expect((await co.restoreVersion(named.id)).error).toBeNull();
    const row = (await pg.query<{ studio: { pages: { els: { html: string }[] }[] } }>(`select studio from brochures where id = $1`, [id])).rows[0];
    expect(row.studio.pages[0].els[0].html).toBe('<p>Deux</p>');
    // Les pages d'avant le retour sont gardées.
    expect((await co.listVersions(id!))!.some((v) => v.label?.startsWith('Avant de revenir'))).toBe(true);
    // Une autre entreprise ne voit ni ne restaure rien.
    current = AUTRE;
    expect(await co.listVersions(id!)).toBeNull();
    expect((await co.restoreVersion(named.id)).error).toBeTruthy();
  });
});

describe('commentaires et validation', () => {
  it('commentaire : les collègues sont prévenus, résolu par tous, supprimé par son auteur seulement', async () => {
    current = CHEF;
    const { id } = await br.createBrochure({ name: 'Relue', editor: 'studio' });
    pushes.length = 0;
    expect((await co.addComment(id!, { pageId: 'a', body: 'Le prix est faux page 2' })).error).toBeNull();
    expect(pushes.map((p) => p.userId)).toEqual([ADJOINT]);
    current = ADJOINT;
    const [c] = (await co.listComments(id!))!;
    expect(c).toMatchObject({ author: 'Camille Chef', mine: false, pageId: 'a' });
    expect((await co.setCommentResolved(c.id, true)).error).toBeNull();
    expect((await co.deleteComment(c.id)).error).toMatch(/auteur/);
    current = CHEF;
    expect((await co.deleteComment(c.id)).error).toBeNull();
    current = AUTRE;
    expect(await co.listComments(id!)).toBeNull();
  });

  it('validation : demandée, refusée à son auteur, validée par un collègue, à refaire après un changement', async () => {
    current = CHEF;
    const { id } = await br.createBrochure({ name: 'À valider', editor: 'studio' });
    pushes.length = 0;
    expect((await co.requestReview(id!, 'Vérifie les prix')).error).toBeNull();
    expect(pushes).toEqual([{ userId: ADJOINT, title: 'Brochure à valider' }]);
    expect((await co.getReview(id!))!).toMatchObject({ status: 'pending', canDecide: false, requestedBy: 'Camille Chef' });
    expect((await co.decideReview(id!, 'approved')).error).toMatch(/collègue/);
    current = ADJOINT;
    expect((await co.decideReview(id!, 'changes')).error).toMatch(/changer/);
    expect((await co.decideReview(id!, 'approved')).error).toBeNull();
    expect((await co.getReview(id!))!).toMatchObject({ status: 'approved', by: 'Dominique' });
    expect(pushes.at(-1)).toEqual({ userId: CHEF, title: 'Brochure validée' });
    current = CHEF;
    await br.saveBrochure(id!, { studio: { pages: [page('a', 'Modifiée')] } });
    expect((await co.getReview(id!))!.status).toBe('none');
  });
});

describe('modèles de pages de l’entreprise', () => {
  it('enregistrés pour toute l’entreprise (titulaire et collaborateurs), invisibles ailleurs, HTML nettoyé', async () => {
    current = ADJOINT;
    expect((await co.saveStudioTemplate('Page menu', { id: 'x', bg: '#ffffff', els: [{ id: 't', type: 'text', html: '<p>Menu<script>x()</script></p>', x: 1, y: 1, w: 50 }] })).error).toBeNull();
    expect((await co.saveStudioTemplate('', {})).error).toBeTruthy();
    current = CHEF;
    const [t] = await co.listStudioTemplates();
    expect(t).toMatchObject({ name: 'Page menu', author: 'Dominique' });
    expect(JSON.stringify(t.page)).not.toContain('script');
    current = AUTRE;
    expect(await co.listStudioTemplates()).toEqual([]);
    expect((await co.deleteStudioTemplate(t.id)).error).toBeTruthy();
    current = CHEF;
    expect((await co.deleteStudioTemplate(t.id)).error).toBeNull();
  });
});
