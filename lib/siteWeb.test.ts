import { describe, expect, it } from 'vitest';
import { answerSections, answersText, DEFAULT_CATALOG, emptyAnswers, parseCatalog, readAnswers, SOFTWARE } from './siteWeb';

// Onglet « Site web » : catalogue modifiable dans l'admin, questionnaire relu au serveur.

const contact = { name: 'Francis Dupuis', phone: '06 75 33 08 23', email: 'Contact@Convivial.FR' };

describe('catalogue', () => {
  it('valeur initiale si rien n’est enregistré, ou si c’est illisible', () => {
    expect(parseCatalog(null)).toEqual(DEFAULT_CATALOG);
    expect(parseCatalog('x')).toEqual(DEFAULT_CATALOG);
    expect(parseCatalog(DEFAULT_CATALOG)).toEqual(DEFAULT_CATALOG);
  });

  it('nettoie ce que l’admin envoie', () => {
    const c = parseCatalog({
      packs: [{ name: '  Mini  ', price: '900 €', features: ['Une page', '', 3], featured: 'oui' }, { name: '' }],
      options: [{ name: 'Logo', text: 'Un logo' }],
      works: [{ name: 'Site', url: 'javascript:alert(1)' }, { name: 'Bon', url: 'https://bon.fr', image: 'http://x/a.png', tags: ['A'] }],
      software: { title: '', examples: [] },
    });
    expect(c.packs).toEqual([{ key: 'mini', name: 'Mini', price: '900 €', pitch: '', features: ['Une page'], featured: false }]);
    expect(c.works).toEqual([{ key: 'bon', name: 'Bon', url: 'https://bon.fr', image: '', mobileImage: '', tags: ['A'] }]);
    expect(c.software.title).toBe(DEFAULT_CATALOG.software.title);
    expect(c.software.examples).toEqual([]);
  });
});

describe('questionnaire', () => {
  it('un site : les réponses sont gardées et résumées par étape', () => {
    const { answers, error } = readAnswers({
      ...emptyAnswers('vitrine', contact), stage: 'refaire', currentUrl: 'https://ancien.fr', needs: ['galerie', 'formulaire', 'pirate'],
      options: ['photos', 'inconnue'], likeWork: 'lepicure', style: 'Bordeaux et or', callTime: 'matin',
    }, DEFAULT_CATALOG);
    expect(error).toBeNull();
    expect(answers).toMatchObject({ project: 'vitrine', needs: ['galerie', 'formulaire'], options: ['photos'], email: 'contact@convivial.fr', softwareNeed: '' });
    const text = answersText(answers, DEFAULT_CATALOG);
    expect(text).toContain('Projet : Site Vitrine (2 500 €)');
    expect(text).toContain('Site actuel : https://ancien.fr');
    expect(text).toContain('Plutôt comme : L’Épicure');
    expect(text).toContain('Moment idéal : Le matin');
  });

  it('un logiciel : pas d’étape site ni style, le besoin est obligatoire', () => {
    const base = { ...emptyAnswers(SOFTWARE, contact), stage: 'aucun', needs: ['galerie'], likeWork: 'lepicure' };
    expect(readAnswers({ ...base, softwareNeed: 'court' }, DEFAULT_CATALOG).error).toMatch(/besoin/);
    const { answers, error } = readAnswers({ ...base, softwareNeed: 'Un planning de production pour la cuisine' }, DEFAULT_CATALOG);
    expect(error).toBeNull();
    expect(answers).toMatchObject({ stage: null, needs: [], likeWork: null });
    expect(answerSections(answers, DEFAULT_CATALOG).map((s) => s.title)).toEqual(['Le projet', 'Le besoin', 'Être rappelé']);
  });

  it('refuse sans projet, sans téléphone ou avec un email faux', () => {
    expect(readAnswers(emptyAnswers('', contact), DEFAULT_CATALOG).error).toMatch(/projet/);
    expect(readAnswers(emptyAnswers('inconnu', contact), DEFAULT_CATALOG).error).toMatch(/projet/);
    expect(readAnswers(emptyAnswers('essentiel', { ...contact, phone: '06' }), DEFAULT_CATALOG).error).toMatch(/téléphone/);
    expect(readAnswers(emptyAnswers('essentiel', { ...contact, email: 'non' }), DEFAULT_CATALOG).error).toMatch(/email/);
  });
});
