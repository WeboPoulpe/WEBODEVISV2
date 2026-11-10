import { describe, expect, it } from 'vitest';
import { spamReason } from './siteSpam';

const base = { name: 'Alexis Felten', company: 'Secafi Expertise', elapsedMs: 60_000 };

describe('spamReason', () => {
  it('repère le spam reçu le 10 novembre (lien vers une page à notre nom)', () => {
    expect(spamReason({ ...base, message: 'Quel est le tarif de la licence ?\nhttps://gopartage.online/fr/sw/webodevis' })).toBe('le message contient un lien');
    expect(spamReason({ ...base, message: 'Voir jepartage.online/fr/sw/webodevis' })).toBe('le message contient un lien');
    expect(spamReason({ ...base, message: 'Allez sur www.exemple.com' })).toBe('le message contient un lien');
  });

  it('laisse passer un message normal, même avec une adresse email', () => {
    expect(spamReason({ ...base, message: 'Bonjour, je suis traiteur à Troyes, écrivez-moi à contact@traiteur-dupont.fr.' })).toBeNull();
    expect(spamReason({ ...base, message: 'Nous faisons 40 mariages par an, 2 à 5 personnes.' })).toBeNull();
  });

  it('repère un lien dans le nom ou l’entreprise', () => {
    expect(spamReason({ ...base, company: 'https://seo-pas-cher.xyz', message: 'Bonjour, un devis svp.' })).toBe('le message contient un lien');
  });

  it('repère un formulaire rempli trop vite, mais pas un envoi sans mesure', () => {
    expect(spamReason({ ...base, elapsedMs: 1200, message: 'Bonjour, un devis svp.' })).toBe('formulaire rempli en moins de 4 secondes');
    expect(spamReason({ ...base, elapsedMs: undefined, message: 'Bonjour, un devis svp.' })).toBeNull();
  });
});
