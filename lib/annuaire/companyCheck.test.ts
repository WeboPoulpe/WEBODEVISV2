import { describe, expect, it } from 'vitest';
import type { CompanyResult } from '@/lib/companies';
import { ALLOWED_ACTIVITIES, companyCheck } from './companyCheck';

const now = new Date('2026-11-12T10:00:00Z');
const found: CompanyResult = {
  name: 'CONVIVIAL EVENT', siren: '925205767', siret: '92520576700013', address: '1 rue des Lilas 10000 TROYES',
  postalCode: '10000', city: 'TROYES', active: true, activity: '56.21Z', headOffice: true,
};
const input = { siret: '92520576700013', displayName: 'Convivial Event', postalCode: '10120' as string | null };
const run = (f: unknown, o = {}, i = input) => companyCheck(i, f as never, { duplicate: false, now, ...o });

describe('annuaire : contrôle de l’entreprise', () => {
  it('réussit : en activité, métier de bouche, nom proche, même département', () => {
    expect(run(found)).toMatchObject({ ok: true, reason: null, legalName: 'CONVIVIAL EVENT', activity: '56.21Z', checkedAt: now.toISOString() });
  });

  it('doute, avec la raison', () => {
    expect(run('unavailable')).toMatchObject({ ok: false, reason: expect.stringMatching(/ne répond pas/), legalName: null });
    expect(run(null)).toMatchObject({ ok: false, reason: expect.stringMatching(/introuvable/) });
    expect(run({ ...found, active: false }).reason).toMatch(/plus en activité/);
    expect(run({ ...found, activity: '62.01Z' }).reason).toMatch(/activité/);
    expect(run({ ...found, activity: undefined }).reason).toMatch(/activité/);
    expect(run({ ...found, name: 'GARAGE DUPONT' }).reason).toMatch(/nom/);
    expect(run({ ...found, postalCode: '75011' }).reason).toMatch(/département/);
    expect(run(found, { duplicate: true }).reason).toMatch(/déjà/);
  });

  it('rapproche le nom par mot commun ou par inclusion, sans accents', () => {
    expect(run({ ...found, name: 'SARL DUPONT TRAITEUR' }, {}, { ...input, displayName: 'Maison Dupont' }).ok).toBe(true);
    expect(run({ ...found, name: 'ÉLOÏSE' }, {}, { ...input, displayName: 'Eloise' }).ok).toBe(true);
    expect(run({ ...found, name: 'LB' }, {}, { ...input, displayName: 'LB' }).ok).toBe(true);
  });

  it('ignore le département si le code postal de la fiche est absent', () => {
    expect(run({ ...found, postalCode: '75011' }, {}, { ...input, postalCode: null }).ok).toBe(true);
  });

  it('le SIRET doit être l’un de ceux du profil, s’il en a un (chiffres seuls comparés)', () => {
    const mismatch = 'Le SIRET de la fiche n’est pas celui de vos mentions légales.';
    expect(run(found, { profileSirets: ['925 205 767 00013'] }).ok).toBe(true);
    expect(run(found, { profileSirets: ['12345678900011', '925.205.767.00013'] }).ok).toBe(true);
    expect(run(found, { profileSirets: ['12345678900011'] })).toMatchObject({ ok: false, reason: mismatch, legalName: 'CONVIVIAL EVENT' });
    expect(run(found, { profileSirets: ['12345678900011', ''] }).reason).toBe(mismatch);
    // Un profil sans SIRET ne lève aucun doute sur ce critère.
    expect(run(found, { profileSirets: [] }).ok).toBe(true);
    expect(run(found, { profileSirets: ['', '  '] }).ok).toBe(true);
    expect(run(found).ok).toBe(true);
  });

  it('liste les activités de bouche admises', () => {
    expect(ALLOWED_ACTIVITIES).toContain('56.21Z');
    expect(ALLOWED_ACTIVITIES).toHaveLength(8);
  });
});
