// Options d'un compte. Le cœur de l'app (devis, clients, calendrier, prestations, ingrédients, réglages)
// est toujours là ; les options ci-dessous s'activent compte par compte depuis l'espace d'administration.

export interface AppModule {
  key: string;
  label: string;
  description: string;
  /** Pages du menu qui dépendent de l'option. */
  routes: string[];
  /** Activée quand rien n'a été choisi pour le compte. */
  standard: boolean;
  /** Annoncée mais pas encore livrée : le réglage est déjà enregistré, sans effet dans l'app. */
  upcoming?: boolean;
}

export const MODULES: AppModule[] = [
  {
    key: 'prospects',
    label: 'Demandes de devis',
    description: 'Formulaire à intégrer au site du traiteur, demandes reçues dans l’app.',
    routes: ['/prospects'],
    standard: true,
  },
  {
    key: 'evenements',
    label: 'Événements',
    description: 'Checklist, matériel et location, liste de courses calculée depuis le devis.',
    routes: ['/evenements', '/courses-globales', '/location-globale', '/location-templates', '/materiel'],
    standard: true,
  },
  {
    key: 'stock',
    label: 'Stock et fournisseurs',
    description: 'Stock des ingrédients, fournisseurs et commandes.',
    routes: ['/stock', '/commandes', '/fournisseurs'],
    standard: true,
  },
  {
    key: 'extras',
    label: 'Extras',
    description: 'Personnel en extra, affectation aux événements, lien de mission.',
    routes: ['/extras'],
    standard: true,
  },
  {
    key: 'assistant',
    label: 'Assistant Claude',
    description: 'Création de devis et gestion par l’assistant. Pas encore disponible.',
    routes: [],
    standard: false,
    upcoming: true,
  },
];

const KEYS = new Set(MODULES.map((m) => m.key));

/** Options actives d'un compte : celles choisies, ou les options standard si rien n'a été choisi. */
export function enabledModules(stored: unknown): string[] {
  if (Array.isArray(stored)) return stored.filter((k): k is string => typeof k === 'string' && KEYS.has(k));
  return MODULES.filter((m) => m.standard).map((m) => m.key);
}

export const hasModule = (stored: unknown, key: string) => enabledModules(stored).includes(key);

/** Pages masquées pour un compte, d'après ses options. */
export function hiddenRoutes(stored: unknown): string[] {
  const enabled = enabledModules(stored);
  return MODULES.filter((m) => !enabled.includes(m.key)).flatMap((m) => m.routes);
}
