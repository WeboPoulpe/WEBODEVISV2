// Flux d'agenda (iCal) sur le vrai schéma en mémoire : accès par jeton et choix des événements.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { calendarFeed, newCalendarToken, calendarFeedUrl } = await import('./calendarFeed');

const A = '00000000-0000-4000-8000-0000000000a1';
const M = '00000000-0000-4000-8000-0000000000a2';   // collaborateur de A
const B = '00000000-0000-4000-8000-0000000000b1';
const TOKEN = newCalendarToken();
const TOKEN_M = newCalendarToken();
const NOW = new Date('2026-10-20T10:00:00Z');
const ORIGIN = 'https://webodevis.fr';
let confirmedId = '';

async function quote(owner: string, client: string, status: string, date: string, extra: { sentAt?: string; arrival?: string; archived?: boolean } = {}) {
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, sent_at, team_arrival_time, event_location, is_archived)
    values ($1, $1, $2, $3, 'Mariage', 120, $4, $5, $6, 'Domaine des Tilleuls, Reims', $7) returning id`,
  [owner, client, date, status, extra.sentAt ?? null, extra.arrival ?? null, extra.archived ?? false]);
  return rows[0].id;
}

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${M}', 'm@t.fr', 'x'), ('${B}', 'b@t.fr', 'x');
    insert into profiles (id, email, company_name, ical_token) values ('${A}', 'a@t.fr', 'Traiteur A', '${TOKEN}');
    insert into profiles (id, email, parent_user_id, ical_token) values ('${M}', 'm@t.fr', '${A}', '${TOKEN_M}');
    insert into profiles (id, email, company_name) values ('${B}', 'b@t.fr', 'Traiteur B');
  `);
  confirmedId = await quote(A, 'Dupont', 'valide', '2026-12-12', { arrival: '17:30' });
  await quote(M, 'Leroy', 'acompte', '2027-02-01');                                        // devis du collaborateur
  await quote(A, 'Option', 'devis_envoye', '2026-11-15', { sentAt: '2026-10-01T10:00:00Z' });
  await quote(A, 'Brouillon', 'devis_a_faire', '2026-11-16');                              // jamais envoyé
  await quote(A, 'Refuse', 'refus_client', '2026-11-17');
  await quote(A, 'Ancien', 'paye', '2025-06-01');                                          // plus de 12 mois
  await quote(A, 'Archive', 'valide', '2026-11-18', { archived: true });
  await quote(B, 'Autre', 'valide', '2026-12-01');                                         // autre traiteur
});

describe('abonnement agenda', () => {
  it('refuse un jeton inconnu ou mal formé', async () => {
    expect(await calendarFeed(newCalendarToken(), ORIGIN, NOW)).toBeNull();
    expect(await calendarFeed('court', ORIGIN, NOW)).toBeNull();
    expect(await calendarFeed("x' or '1'='1", ORIGIN, NOW)).toBeNull();
  });

  it('donne les événements confirmés et les options, pas le reste', async () => {
    const ics = (await calendarFeed(TOKEN, ORIGIN, NOW))!;
    const unfolded = ics.replace(/\r\n /g, '');
    const summaries = unfolded.split('\r\n').filter((l) => l.startsWith('SUMMARY:'));
    expect(summaries).toEqual(['SUMMARY:(option) Mariage – Option', 'SUMMARY:Mariage – Dupont', 'SUMMARY:Mariage – Leroy']);
    expect(unfolded).toContain('X-WR-CALNAME:Traiteur A – événements');
    expect(unfolded).toContain(`UID:evenement-${confirmedId}@webodevis.fr`);
    expect(unfolded).toContain('DTSTART;TZID=Europe/Paris:20261212T173000');
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20270201');
    expect(unfolded).toContain('LOCATION:Domaine des Tilleuls\\, Reims');
    expect(unfolded).toContain(`URL:${ORIGIN}/evenements/${confirmedId}`);
    expect(unfolded).toContain('120 couverts');
    expect(unfolded).toContain('STATUS:TENTATIVE');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it('un collaborateur voit les événements de son entreprise', async () => {
    const ics = (await calendarFeed(TOKEN_M, ORIGIN, NOW))!;
    expect(ics).toContain('Dupont');
    expect(ics).not.toContain('Autre');
  });

  it('un jeton changé cesse de marcher', async () => {
    const next = newCalendarToken();
    await pg.query(`update profiles set ical_token = $2 where id = $1`, [A, next]);
    expect(await calendarFeed(TOKEN, ORIGIN, NOW)).toBeNull();
    expect(await calendarFeed(next, ORIGIN, NOW)).toContain('BEGIN:VCALENDAR');
    expect(calendarFeedUrl(ORIGIN, next)).toBe(`${ORIGIN}/api/agenda/${next}.ics`);
  });
});
