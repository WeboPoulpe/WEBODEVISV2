import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildContract, contractMissing, contractText, DEFAULT_CONVENTION, defaultTerms, dpaeAlert, dpaeMissing, dpaeNeedsAction, dpaeSheet,
  EMPTY_EMPLOYER_SETTINGS, formatNir, isValidIban, isValidNir, maskNir, parisLocal, plannedHours, type Employer, type ExtraHrDetails, type MissionInfo,
} from './extraContract';
import { renderContractPdf } from './extraContractPdf';
import { dpaeReminderEmail, extraContractEmail } from './mail/extraContracts';

const employer: Employer = {
  ...EMPTY_EMPLOYER_SETTINGS,
  company_name: 'Traiteur Dupuis', legal_form: 'SARL', address: '3 rue Haute, 10000 Troyes', siret: '123 456 789 00012', phone: '03 25 00 00 00',
  naf_code: '5621Z', urssaf: 'Champagne-Ardenne', retirement_fund: 'Malakoff Humanis, 21 rue Laffitte, 75009 Paris',
  signatory_name: 'Paul Dupuis', signatory_title: 'Gérant', signature_city: 'Troyes',
};
const extra: ExtraHrDetails = {
  birth_name: 'Martin', usage_name: null, first_names: 'Julie', sex: 'F', birth_date: '1998-04-02', birth_city: 'Reims', birth_department: '51',
  birth_country: 'France', nationality: 'Française', social_security_number: '185057800608491', address: '12 rue des Lilas', postal_code: '10000',
  city: 'Troyes', iban: 'FR7630006000011234567890189',
};
const mission: MissionInfo = {
  extraName: 'Julie M.', role: 'Serveur', eventType: 'Mariage', eventDate: '2027-06-12', location: 'Château de Pont, 10400 Pont-sur-Seine',
  arrival: '17:30', departure: '01:30', notes: 'Tenue noire', hourlyRate: 13.5,
};

describe('n° de sécurité sociale et IBAN', () => {
  it('vérifie la clé, y compris pour la Corse', () => {
    expect(isValidNir('1 85 05 78 006 084 91')).toBe(true);
    expect(isValidNir('185057800608492')).toBe(false);
    expect(isValidNir('2 90 02 2A 004 123 04')).toBe(true);
    expect(isValidNir('12345')).toBe(false);
    expect(formatNir('185057800608491')).toBe('1 85 05 78 006 084 91');
    expect(maskNir('185057800608491')).toBe('1 85 •• •• ••• ••• 91');
  });
  it('vérifie un IBAN', () => {
    expect(isValidIban('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(isValidIban('FR76 3000 6000 0112 3456 7890 188')).toBe(false);
  });
});

describe('contrat d’extra', () => {
  const terms = defaultTerms(mission);
  const doc = buildContract(employer, extra, terms, mission, { issuedOn: '2027-06-01' });
  const text = contractText(doc);

  it('reprend les conditions de la mission, une soirée qui finit après minuit comprise', () => {
    expect(terms).toEqual({ position: 'Serveur', classification: null, hourly_rate: 13.5, location: 'Château de Pont, 10400 Pont-sur-Seine', start: '17:30', end: '01:30' });
    expect(plannedHours('17:30', '01:30')).toBe(8);
    expect(plannedHours('09:00', '13:15')).toBe(4.25);
    expect(plannedHours(null, '13:00')).toBeNull();
  });

  it('est un CDD d’usage avec les mentions attendues', () => {
    expect(doc.title).toBe('Contrat de travail à durée déterminée d’usage');
    expect(text).toContain('L. 1242-2, 3° et D. 1242-1');
    expect(text).toContain('Traiteur Dupuis engage Julie Martin');
    expect(text).toContain('en qualité de Serveur');
    expect(text).toContain('samedi 12 juin 2027, jusqu’au lendemain');
    expect(text).toContain('de 17 h 30 à 1 h 30, soit 8 h de travail prévues');
    expect(text).toContain('Château de Pont');
    expect(text).toMatch(/13,50\s€/);
    expect(text).toMatch(/108,00\s€ brut pour les 8 h prévues/);
    expect(text).toContain('10 % de la rémunération brute totale');
    expect(text).toContain(`convention collective nationale applicable à l’entreprise : ${DEFAULT_CONVENTION}`);
    expect(text).toContain('Malakoff Humanis');
    expect(text).toContain('ne comporte pas de période d’essai');
    expect(text).toContain('Consignes de la mission : Tenue noire');
    expect(text).toContain('Code APE/NAF 5621Z');
    expect(text).toContain('Née le 2 avril 1998 à Reims (51)');
    expect(doc.madeAt).toBe('Fait à Troyes, le 1er juin 2027.');
    expect(doc.employerSigner).toBe('Paul Dupuis, Gérant');
  });

  it('ne contient ni le n° de sécurité sociale ni l’IBAN', () => {
    expect(text).not.toContain('185057800608491');
    expect(text).not.toContain('006 084');
    expect(text).not.toContain('FR76');
  });

  it('suit les réglages du traiteur : autre convention, essai, repas, clauses', () => {
    const custom = buildContract({
      ...employer, convention: 'Restauration rapide, IDCC 1501', trial_terms: 'Période d’essai de deux heures.',
      meal_terms: 'Le repas est fourni par l’employeur.', extra_clauses: 'Clause un.\n\nClause deux.',
    }, extra, terms, mission, { issuedOn: '2027-06-01' });
    const t = contractText(custom);
    expect(t).toContain('Restauration rapide, IDCC 1501');
    expect(t).not.toContain('IDCC 1979');
    expect(t).toContain('Période d’essai de deux heures.');
    expect(t).toContain('Le repas est fourni par l’employeur.');
    expect(custom.articles.at(-1)).toEqual({ title: 'Clauses particulières', paragraphs: ['Clause un.', 'Clause deux.'] });
  });

  it('liste ce qui manque avant l’envoi', () => {
    expect(contractMissing(employer, extra, terms, mission)).toEqual([]);
    const missing = contractMissing({ ...employer, siret: null, retirement_fund: null }, { ...extra, birth_date: null, nationality: '' },
      { ...terms, hourly_rate: null, end: null }, mission);
    expect(missing).toEqual([
      'SIRET de l’entreprise (Paramètres)', 'Caisse de retraite complémentaire (Paramètres, Employeur)', 'Date de naissance de l’extra',
      'Nationalité de l’extra', 'Heures de début et de fin', 'Taux horaire brut',
    ]);
  });

  it('se génère en PDF, signé ou non', async () => {
    const dir = path.join(__dirname, 'facturx/fonts');
    const fonts = { regular: fs.readFileSync(path.join(dir, 'DejaVuSans.ttf')), bold: fs.readFileSync(path.join(dir, 'DejaVuSans-Bold.ttf')) };
    const draft = await renderContractPdf(doc, fonts, { draft: true });
    expect(Buffer.from(draft).subarray(0, 5).toString()).toBe('%PDF-');
    // Une signature tracée d'un pixel (PNG valide).
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const signed = await renderContractPdf(doc, fonts, { hash: 'abc', sentAt: '2027-06-01T08:00:00Z', signature: { signerName: 'Julie Martin', image: png, signedAt: '2027-06-01T09:00:00Z', ip: '1.2.3.4' } });
    expect(signed.length).toBeGreaterThan(draft.length / 2);
  });
});

describe('fiche DPAE', () => {
  const sheet = dpaeSheet(employer, extra, defaultTerms(mission), mission);

  it('rassemble les informations par rubrique, dans l’ordre du formulaire', () => {
    expect(sheet.map((s) => s.title)).toEqual(['Employeur', 'Salarié', 'Embauche']);
    expect(sheet[0].fields.map((f) => f.label)).toEqual(['SIRET', 'Raison sociale', 'Adresse', 'Code APE/NAF', 'URSSAF', 'Téléphone']);
    const v = Object.fromEntries(sheet.flatMap((s) => s.fields.map((f) => [f.label, f.value])));
    expect(v).toMatchObject({
      SIRET: '12345678900012', 'Nom de naissance': 'MARTIN', Prénom: 'Julie', Sexe: 'Féminin', 'N° de sécurité sociale': '185057800608491',
      'Date de naissance': '02/04/1998', 'Commune de naissance': 'Reims', 'Département de naissance': '51', Nationalité: 'Française',
      'Date d’embauche': '12/06/2027', 'Heure d’embauche': '17:30', 'Date de fin du contrat': '13/06/2027', 'Période d’essai': 'Aucune',
    });
  });

  it('signale ce qui manque, sans exiger le n° de sécurité sociale', () => {
    expect(dpaeMissing(sheet)).toEqual(['Service de santé au travail']);
    const partial = dpaeSheet(employer, { ...extra, social_security_number: null, birth_city: null }, defaultTerms(mission), mission);
    expect(dpaeMissing(partial)).toEqual(['Commune de naissance', 'Service de santé au travail']);
  });
});

describe('alertes DPAE', () => {
  // Le 21 octobre 2026 à 16 h, heure de Paris.
  const now = new Date('2026-10-21T14:00:00Z');
  const alert = (eventDate: string, arrival: string | null, o: { status?: string; done?: boolean } = {}) =>
    dpaeAlert({ eventDate, arrival, status: o.status ?? 'confirme', done: o.done ?? false }, now);

  it('compte en heure de Paris', () => {
    expect(parisLocal(now)).toBe('2026-10-21T16:00');
    expect(parisLocal(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01T00:30');
  });

  it('suit la fenêtre : trop tôt, à faire, urgent, en retard', () => {
    expect(alert('2026-11-05', '10:00')).toMatchObject({ level: 'early', opensOn: '2026-10-28', label: 'DPAE à partir du 28 octobre' });
    expect(alert('2026-10-29', '10:00').level).toBe('open'); // fenêtre ouverte le 21 (J-8)
    expect(alert('2026-10-30', '10:00').level).toBe('early');
    expect(alert('2026-10-26', '18:00').level).toBe('open');
    expect(alert('2026-10-23', '16:00').level).toBe('urgent'); // 48 h pile
    expect(alert('2026-10-23', '16:30').level).toBe('open');
    expect(alert('2026-10-22', null).level).toBe('urgent'); // sans heure : minuit
    expect(alert('2026-10-21', '09:00').level).toBe('late');
  });

  it('ne dit rien pour une mission pas confirmée, et rien de plus une fois faite', () => {
    expect(alert('2026-10-22', '10:00', { status: 'a_solliciter' }).level).toBe('none');
    expect(alert('2026-10-22', '10:00', { status: 'refuse' }).level).toBe('none');
    expect(alert('2026-10-22', '10:00', { status: 'present' }).level).toBe('urgent');
    expect(alert('2026-10-21', '09:00', { done: true }).level).toBe('done');
    expect(['early', 'none', 'done'].map((l) => dpaeNeedsAction(l as never))).toEqual([false, false, false]);
    expect(['open', 'urgent', 'late'].map((l) => dpaeNeedsAction(l as never))).toEqual([true, true, true]);
  });
});

describe('emails', () => {
  it('le contrat part sans aucune donnée personnelle dans le message', () => {
    const mail = extraContractEmail({ companyName: 'Traiteur Dupuis', extraName: 'Julie Martin', eventType: 'Mariage', eventDate: '2027-06-12', link: 'https://webodevis.fr/e/abc/contrat/1' });
    expect(mail.subject).toBe('Votre contrat de travail avec Traiteur Dupuis');
    expect(mail.html).toContain('Bonjour Julie');
    expect(mail.html).toContain('href="https://webodevis.fr/e/abc/contrat/1"');
    expect(mail.html).toContain('display:none'); // aperçu (preheader)
    for (const secret of ['1998', 'Reims', 'Lilas', '1850578']) expect(mail.html).not.toContain(secret);
  });

  it('le rappel de DPAE liste les missions', () => {
    const mail = dpaeReminderEmail({ companyName: 'Traiteur Dupuis', link: 'https://webodevis.fr/extras', missions: [
      { extraName: 'Julie Martin', eventType: 'Mariage', eventDate: '2026-10-24', arrival: '17:30' },
      { extraName: 'Marc Petit', eventType: null, eventDate: '2026-10-25', arrival: null },
    ] });
    expect(mail.subject).toBe('2 déclarations d’embauche (DPAE) à faire');
    expect(mail.html).toContain('Julie Martin');
    expect(mail.html).toContain('samedi 24 octobre 2026, à 17 h 30');
    expect(mail.html).toContain('href="https://webodevis.fr/extras"');
  });
});
