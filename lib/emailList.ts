// Listes d'adresses email : saisie de plusieurs destinataires (fenêtre d'envoi du devis, serveur).

/** Nombre maximal de destinataires pour un même envoi. */
export const MAX_RECIPIENTS = 10;

export const isValidEmail = (email: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email);

/** Met une adresse à la forme enregistrée : sans espaces, en minuscules, sans les chevrons d'un « Nom <adresse> » collé. */
export const normalizeEmail = (raw: string) => {
  const inBrackets = /<([^>]+)>/.exec(raw)?.[1];
  return (inBrackets ?? raw).trim().replace(/^mailto:/i, '').replace(/^["'(]+|["').]+$/g, '').toLowerCase();
};

/**
 * Découpe un texte en adresses : séparées par des virgules, points-virgules, espaces ou retours à la ligne.
 * Un « Nom <adresse> » collé depuis une messagerie garde seulement l'adresse.
 */
export function splitEmails(text: string): string[] {
  // Les noms entre guillemets ou avant un chevron contiennent des espaces : on ne garde que l'adresse.
  const withoutNames = text.replace(/"[^"]*"\s*/g, ' ').replace(/[^,;\n<>]*<([^>]+)>/g, ' $1 ');
  return withoutNames.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean);
}

/** Adresses sans doublon, dans l'ordre de saisie. */
export const uniqueEmails = (emails: string[]) => Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)));
