// Libellés partagés par les pages de l'espace d'administration.

export const REQUEST_KIND: Record<string, string> = {
  devis: 'Demande de devis',
  message: 'Message',
  demo: 'Essai de la démo',
  service: 'Site web / logiciel',
};

export const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  nouvelle: { label: 'Nouvelle', cls: 'bg-primary-50 text-primary-700' },
  en_cours: { label: 'En cours', cls: 'bg-gray-100 text-gray-700' },
  traitee: { label: 'Traitée', cls: 'bg-sage-100 text-sage' },
  suspecte: { label: 'Suspecte', cls: 'bg-gray-100 text-gray-500' },
};

export const LISTING_STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-500' },
  en_attente: { label: 'À valider', cls: 'bg-primary-50 text-primary-700' },
  publiee: { label: 'Publiée', cls: 'bg-sage-100 text-sage' },
  refusee: { label: 'Refusée', cls: 'bg-gray-100 text-gray-700' },
  suspendue: { label: 'Suspendue', cls: 'bg-gray-100 text-gray-700' },
};
