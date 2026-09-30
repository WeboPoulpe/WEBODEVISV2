// Centre d'aide : chaque guide explique un geste, avec une courte vidéo enregistrée dans l'app
// (compte de démonstration) et les étapes écrites en regard.

export type HelpCategoryId = 'demarrer' | 'devis' | 'clients' | 'evenements' | 'stock' | 'catalogue' | 'compte';

export interface HelpStep {
  title: string;
  /** Précision facultative, une ou deux phrases. */
  text?: string;
}

export interface HelpGuide {
  /** Identifiant stable : c'est aussi le nom de la vidéo (scripts/help/scenarios). */
  id: string;
  category: HelpCategoryId;
  title: string;
  /** Une phrase : ce que le guide permet de faire. */
  summary: string;
  /** Mots qu'une personne taperait pour trouver ce guide. */
  keywords: string[];
  /** Page de l'app où le geste se fait ; le guide y est proposé en premier. */
  href?: string;
  steps: HelpStep[];
  /** Points à savoir, affichés sous les étapes. */
  notes?: string[];
}

export interface HelpMedia {
  video: string;
  poster: string;
  /** Durée en secondes. */
  seconds: number;
}
