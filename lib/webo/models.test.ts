import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { modelCostUsd, WEBO_MODELS } from './models';

describe('Webo : modèles et coût réel', () => {
  it('Haiku pour l’aiguilleur et l’aide, Sonnet pour les spécialistes', () => {
    expect(WEBO_MODELS).toEqual({ router: 'claude-haiku-5-5', help: 'claude-haiku-5-5', specialist: 'claude-sonnet-5-5' });
  });

  it('coût par modèle ; un modèle inconnu prend le tarif de Sonnet', () => {
    expect(modelCostUsd('claude-haiku-5-5', { input: 4000, output: 2000 })).toBeCloseTo(0.0014, 6);
    expect(modelCostUsd('claude-sonnet-5-5', { input: 1000, output: 1000 })).toBeCloseTo(0.012, 6);
    expect(modelCostUsd('claude-sonnet-5-5', { input: 0, output: 0, cacheWrite: 1_000_000, cacheRead: 1_000_000 })).toBeCloseTo(2.5 + 0.2, 6);
    expect(modelCostUsd('claude-inconnu', { input: 1000, output: 1000 })).toBeCloseTo(0.012, 6);
  });

  it('tables : une proposition ne prend que les sortes et statuts prévus', async () => {
    const pg = await createTestDb();
    const U = '00000000-0000-4000-8000-0000000000c9';
    await pg.exec(`insert into users (id, email, password_hash) values ('${U}', 'w@a.fr', 'x');`);
    const [{ id }] = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id, title) values ($1, $1, 'Essai') returning id`, [U])).rows;
    const ins = (kind: string, status = 'proposed') => pg.query(
      `insert into webo_proposals (conversation_id, company_id, user_id, kind, payload, summary, status) values ($1, $2, $2, $3, '{}', '{}', $4)`, [id, U, kind, status]);
    await ins('quote');
    await expect(ins('delete_all')).rejects.toThrow();
    await expect(ins('quote', 'fait')).rejects.toThrow();
  }, 30_000);
});
