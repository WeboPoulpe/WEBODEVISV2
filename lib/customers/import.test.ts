import { describe, expect, it } from 'vitest';
import { analyzeCustomerImport, parseTable } from './import';

describe('import de clients', () => {
  it('lit un collage depuis un tableur, avec ligne de titres', () => {
    const text = 'Prénom\tNom\tE-mail\tTéléphone\nClaire\tMartin\tClaire.Martin@Exemple.fr\t06 12 34 56 78\nPaul\tGarnier\tpaul@exemple.fr\t';
    const { customers, skipped, hasHeader } = analyzeCustomerImport(text);
    expect(hasHeader).toBe(true);
    expect(skipped).toEqual([]);
    expect(customers).toEqual([
      { customer_type: 'particulier', first_name: 'Claire', last_name: 'Martin', company_name: null, contact_person_name: null, email: 'claire.martin@exemple.fr', phone: '06 12 34 56 78', address: null },
      { customer_type: 'particulier', first_name: 'Paul', last_name: 'Garnier', company_name: null, contact_person_name: null, email: 'paul@exemple.fr', phone: null, address: null },
    ]);
  });

  it('lit un CSV à points-virgules avec guillemets, et reconnaît une entreprise', () => {
    const text = 'Société;Contact;Email;Adresse\n"Atelier Lenoir; Dijon";Anne Lenoir;contact@lenoir.fr;"12 rue des Forges, 21000 Dijon"';
    const { customers } = analyzeCustomerImport(text);
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({
      customer_type: 'entreprise', company_name: 'Atelier Lenoir; Dijon', contact_person_name: 'Anne Lenoir',
      email: 'contact@lenoir.fr', address: '12 rue des Forges, 21000 Dijon',
    });
  });

  it('sans ligne de titres, reconnaît email et téléphone à leur contenu', () => {
    const { customers, hasHeader } = analyzeCustomerImport('Julie Moreau, julie@exemple.fr, 0612345678\nkarim@exemple.fr,Karim,Haddad');
    expect(hasHeader).toBe(false);
    expect(customers.map((c) => [c.first_name, c.last_name, c.email, c.phone])).toEqual([
      ['Julie', 'Moreau', 'julie@exemple.fr', '0612345678'],
      ['Karim', 'Haddad', 'karim@exemple.fr', null],
    ]);
  });

  it('une colonne « Nom » seule est séparée en prénom et nom', () => {
    const { customers } = analyzeCustomerImport('Nom;Email\nJean-Marc Le Goff;jm@exemple.fr');
    expect(customers[0]).toMatchObject({ first_name: 'Jean-Marc', last_name: 'Le Goff' });
  });

  it('laisse de côté, en disant pourquoi : sans email, email invalide, doublon, déjà client', () => {
    const text = 'Prénom;Nom;Email\nA;Un;\nB;Deux;pas-un-email\nC;Trois;c@exemple.fr\nD;Quatre;C@exemple.fr\nE;Cinq;deja@exemple.fr\n\nF;Six;f@exemple.fr';
    const { customers, skipped } = analyzeCustomerImport(text, ['Deja@exemple.fr']);
    expect(customers.map((c) => c.email)).toEqual(['c@exemple.fr', 'f@exemple.fr']);
    expect(skipped).toEqual([
      { line: 2, label: 'A Un', reason: 'Pas d’adresse email' },
      { line: 3, label: 'B Deux', reason: 'Adresse email invalide' },
      { line: 5, label: 'D Quatre', reason: 'Déjà dans vos clients' },
      { line: 6, label: 'E Cinq', reason: 'Déjà dans vos clients' },
    ]);
  });

  it('parseTable gère les fins de ligne Windows et les guillemets doublés', () => {
    expect(parseTable('a,"b ""c"""\r\nd,e')).toEqual([['a', 'b "c"'], ['d', 'e']]);
  });
});
