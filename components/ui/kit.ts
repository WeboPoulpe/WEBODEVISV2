// Styles partagés des contrôles. Un seul endroit pour les boutons, champs et cartes de l'app.

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-white border border-gray-200 text-gray-900 text-[15px] font-medium hover:border-gray-300 disabled:opacity-40 transition-colors';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 h-11 px-3 rounded-xl text-gray-700 text-[15px] font-medium hover:bg-gray-100 disabled:opacity-40 transition-colors';
/** Bouton icône : cible tactile de 40 px. */
export const iconBtn =
  'inline-flex items-center justify-center w-10 h-10 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 transition-colors flex-shrink-0';
export const iconBtnDanger =
  'inline-flex items-center justify-center w-10 h-10 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-danger disabled:opacity-30 transition-colors flex-shrink-0';

export const inputCls =
  'w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 transition-colors';
export const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

export const cardCls = 'bg-white border border-gray-200 rounded-2xl';
export const rowCls = 'flex items-center gap-3 p-3 rounded-2xl bg-gray-50';
export const pill = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap';
export const errorCls = 'text-sm text-danger bg-white border border-danger/30 rounded-xl px-4 py-3';
