// Compte de démonstration : un traiteur fictif, ouvert à tous depuis /demo.
// Tout s'y consulte ; rien de ce qu'un visiteur y fait n'est enregistré.
// Ses données sont créées par `node scripts/seed-demo.mjs`.

export const DEMO_USER_ID = '0d3e0000-0000-4000-8000-000000000001';
export const DEMO_EMAIL = 'demo@webodevis.fr';

export const isDemoUser = (userId: string | null | undefined) => userId === DEMO_USER_ID;

/** Réponse des actions fermées dans la démonstration (envois d'emails, fichiers, calculs enregistrés). */
export const DEMO_BLOCKED = 'Cette action n’est pas disponible dans la démonstration.';
