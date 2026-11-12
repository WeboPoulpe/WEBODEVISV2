import { DIRECTORY_NAME } from '@/lib/annuaire/config';

// Marque et décors de Choisir Mon Traiteur. Le logo est une image avec son fond bleu nuit (#011B3D) : il ne se pose
// que sur ce bleu exact (en-tête et pied de page).

export const LOGO_SRC = '/annuaire/logo-choisir-mon-traiteur.png';

export function AnnuaireLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt={DIRECTORY_NAME} width={2172} height={724} className={className} decoding="async" />
  );
}

/** Étoile à quatre branches, en décor. */
export function FourStar({ size = 54, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 54 54" className={className} style={style}>
      <path d="M27 0 L31 23 L54 27 L31 31 L27 54 L23 31 L0 27 L23 23 Z" fill="currentColor" />
    </svg>
  );
}

const SCALLOP_POINTS =
  '120.0,60.0 109.0,69.8 115.4,83.0 101.6,87.8 102.4,102.4 87.8,101.6 83.0,115.4 69.8,109.0 60.0,120.0 50.2,109.0 37.0,115.4 32.2,101.6 17.6,102.4 18.4,87.8 4.6,83.0 11.0,69.8 0.0,60.0 11.0,50.2 4.6,37.0 18.4,32.2 17.6,17.6 32.2,18.4 37.0,4.6 50.2,11.0 60.0,0.0 69.8,11.0 83.0,4.6 87.8,18.4 102.4,17.6 101.6,32.2 115.4,37.0 109.0,50.2';

/** Pastille dentelée jaune, avec la seule touche cursive (Lobster) de la page. */
export function Scallop({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`cmt-scallop ${className ?? ''}`}>
      <svg aria-hidden="true" focusable="false" width="100%" height="100%" viewBox="-2 -2 124 124">
        <polygon points={SCALLOP_POINTS} fill="#F8D04F" stroke="#011B3D" strokeWidth="2" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** Motif de remplacement quand une fiche n'a pas encore de photo : une cloche de service. */
export function ClocheMotif({ size = 96 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 66h68" />
      <path d="M8 74h80" />
      <path d="M20 66c0-17 12.5-30 28-30s28 13 28 30" />
      <path d="M48 36v-6" />
      <circle cx="48" cy="26" r="4" />
      <path d="M32 52c3-5 7-8 12-9.5" />
    </svg>
  );
}
