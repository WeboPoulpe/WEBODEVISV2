// Logo de Choisir Mon Traiteur (« CHOISIR Mon TRAITEUR »). C'est le seul endroit où la marque est définie : en-tête,
// pied de page et panneau de la page de connexion pour un traiteur venu de l'annuaire. Trois teintes, fond transparent :
// pourpre sur blanc et sur les surfaces pâles, blanc sur le pourpre, noir au besoin. La taille vient de l'endroit où il
// est posé (sa hauteur ; la largeur suit le rapport de l'image, 1200 × 333).

export type LogoTone = 'pourpre' | 'blanc' | 'noir';

const LOGO_WIDTH = 1200;
const LOGO_HEIGHT = 333;

export function AnnuaireLogo({ tone = 'pourpre', className, eager = false }: {
  tone?: LogoTone;
  className?: string;
  /** Chargé tout de suite (en-tête), sinon à l'approche. */
  eager?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/annuaire/logo-${tone}.png`}
      alt="Choisir Mon Traiteur"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
