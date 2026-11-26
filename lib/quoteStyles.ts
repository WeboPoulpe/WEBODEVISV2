// Styles de devis réservés à un compte : la mise en page sur mesure d'un traiteur (palette Prestige, noir et or, avec
// son logo dans les bandeaux). Ils ne sont proposés qu'à ce compte (titulaire et collaborateurs) ; un devis qui en
// porte un s'affiche partout avec lui (generateQuoteHtml).

export type AccountStyleKey = 'epicure';

export interface AccountStyle {
  key: AccountStyleKey;
  label: string;
  desc: string;
  /** Pastille et bandeau des listes de styles. */
  color: string;
  gradient: string;
  /** Compte (identifiant du titulaire) à qui le style est proposé. */
  account: string;
  /** Logo des bandeaux. Largeur fixe à l'affichage : en largeur relative, Chrome le met en PDF sans sa transparence. */
  logoUrl: string;
}

export const ACCOUNT_STYLES: AccountStyle[] = [
  {
    key: 'epicure', label: 'L’Épicure', desc: 'Noir et or, avec le logo de L’Épicure.', color: '#c9a96e', gradient: '#0a0a0a',
    account: '4c8aea69-c781-4779-a653-71c33b4ce803', logoUrl: 'https://www.lepicure-rg.fr/images/logos/logo.webp',
  },
];

/** Compte d'un profil : le titulaire pour un collaborateur. */
export function companyIdOf(profile: unknown): string | null {
  const p = profile as { id?: string | null; parent_user_id?: string | null } | null;
  return p?.parent_user_id ?? p?.id ?? null;
}

/** Styles réservés proposés à ce compte. */
export function accountStylesFor(companyId: string | null | undefined): AccountStyle[] {
  return companyId ? ACCOUNT_STYLES.filter((s) => s.account === companyId) : [];
}

/** Le style réservé portant cette clé, s'il existe. */
export function accountStyle(key: string | null | undefined): AccountStyle | null {
  return ACCOUNT_STYLES.find((s) => s.key === key) ?? null;
}
