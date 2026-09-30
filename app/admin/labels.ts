// Libellés partagés par les pages de l'espace d'administration.

export const REQUEST_KIND: Record<string, string> = {
  devis: 'Demande de devis',
  message: 'Message',
};

export const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  nouvelle: { label: 'Nouvelle', cls: 'bg-primary-50 text-primary-700' },
  en_cours: { label: 'En cours', cls: 'bg-gray-100 text-gray-700' },
  traitee: { label: 'Traitée', cls: 'bg-sage-100 text-sage' },
};
