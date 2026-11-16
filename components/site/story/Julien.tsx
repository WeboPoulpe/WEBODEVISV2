import { cn } from '@/lib/utils';

// Julien, le traiteur qui raconte sa semaine sur l'accueil. Un seul dessin, à plat, aux couleurs du site,
// et une pose par moment de l'histoire. Tout est tracé ici : ni image, ni bibliothèque.
// Le mouvement (respiration, clignement, vapeur du café) est dans site.css, et s'arrête si la personne
// a demandé moins d'animations.

export type JulienPose = 'cafe' | 'bureau' | 'caisse' | 'detente' | 'plateau' | 'victoire';

const SKIN = '#e3b08c';
const SKIN_SHADE = '#cf9873';
const HAIR = '#3a2a20';
const INK = 'rgb(var(--n-900))';
const APRON = 'rgb(var(--p-700))';
const APRON_DARK = 'rgb(var(--p-800))';
const SHIRT = '#ffffff';
const SHIRT_SHADE = 'rgb(var(--n-200))';
const TROUSERS = '#5b6b62';
const WOOD = '#c9a27c';
const WOOD_DARK = '#a9825e';

/** Bras : de l'épaule au coude, du coude à la main. */
type Arm = [elbowX: number, elbowY: number, handX: number, handY: number];

function ArmShape({ shoulder, arm }: { shoulder: number; arm: Arm }) {
  const [ex, ey, hx, hy] = arm;
  return (
    <>
      <path d={`M${shoulder} 132 L${ex} ${ey} L${hx} ${hy}`} fill="none" stroke={SHIRT_SHADE} strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${shoulder} 132 L${ex} ${ey} L${hx} ${hy}`} fill="none" stroke={SHIRT} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={hx} cy={hy} r="9.5" fill={SKIN} />
    </>
  );
}

/** La tête, réutilisée en petit au volant du camion. */
export function JulienHead({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="-30" cy="5" r="5.5" fill={SKIN_SHADE} />
      <circle cx="30" cy="5" r="5.5" fill={SKIN_SHADE} />
      <circle r="30" fill={SKIN} />
      <path d="M-31 2 Q-34 -34 0 -35 Q34 -34 31 2 Q25 -15 4 -17 Q-18 -19 -31 2Z" fill={HAIR} />
      <path d="M-17 -5 q6 -4 12 0 M5 -5 q6 -4 12 0" fill="none" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse className="julien-eye" cx="-11" cy="5" rx="3" ry="3.4" fill={INK} />
      <ellipse className="julien-eye" cx="11" cy="5" rx="3" ry="3.4" fill={INK} />
      <path d="M-11 15 Q0 25 11 15" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Mug({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 11} ${y - 28})`}>
      <path className="julien-steam" d="M6 -5 q-5 -6 0 -13" fill="none" stroke="rgb(var(--n-400))" strokeWidth="2.5" strokeLinecap="round" />
      <path className="julien-steam julien-steam-2" d="M15 -5 q5 -6 0 -13" fill="none" stroke="rgb(var(--n-400))" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M21 6 q10 0 10 7 t-10 7" fill="none" stroke={SHIRT} strokeWidth="4" />
      <rect width="22" height="24" rx="5" fill={SHIRT} stroke="rgb(var(--n-300))" strokeWidth="1.5" />
    </g>
  );
}

interface Pose {
  left: Arm;
  right: Arm;
  /** Les bras passent derrière le corps (mains derrière la tête). */
  behind?: boolean;
  /** Dessiné entre le corps et les bras : ce qu'il tient contre lui. */
  held?: React.ReactNode;
  /** Dessiné par-dessus tout : ce qui est devant lui. */
  front?: React.ReactNode;
}

const POSES: Record<JulienPose, Pose> = {
  // Lundi, 7 h 30 : le café dans une main, le téléphone dans l'autre.
  cafe: {
    left: [48, 164, 44, 132],
    right: [152, 164, 158, 134],
    held: (
      <>
        <rect x="33" y="104" width="22" height="36" rx="5" fill={INK} />
        <rect x="36" y="108" width="16" height="24" rx="2" fill="rgb(var(--p-300))" />
      </>
    ),
    front: <Mug x={160} y={132} />,
  },
  // Lundi, 9 h : au bureau, derrière son ordinateur.
  bureau: {
    left: [54, 166, 82, 190],
    right: [146, 166, 118, 190],
    front: (
      <>
        <rect x="68" y="142" width="64" height="48" rx="6" fill="rgb(var(--n-800))" />
        <circle cx="100" cy="166" r="5" fill={APRON} />
        <rect x="58" y="188" width="84" height="8" rx="3" fill="rgb(var(--n-600))" />
        <rect x="6" y="196" width="188" height="11" rx="5" fill={WOOD} />
        <rect x="20" y="207" width="9" height="46" fill={WOOD_DARK} />
        <rect x="171" y="207" width="9" height="46" fill={WOOD_DARK} />
      </>
    ),
  },
  // Jeudi : la caisse du marché dans les bras.
  caisse: {
    left: [50, 172, 62, 200],
    right: [150, 172, 138, 200],
    held: (
      <>
        <circle cx="78" cy="180" r="10" fill="#c43a3a" />
        <circle cx="98" cy="176" r="12" fill="rgb(var(--sage))" />
        <circle cx="118" cy="181" r="10" fill="rgb(var(--p-400))" />
        <path d="M128 184 q6 -18 14 -14 q-2 10 -14 14Z" fill="#6f9a56" />
        <rect x="58" y="184" width="84" height="36" rx="4" fill={WOOD} />
        <path d="M58 196 H142 M58 208 H142" stroke={WOOD_DARK} strokeWidth="2" />
      </>
    ),
  },
  // Vendredi : les mains derrière la tête, personne n'appelle.
  detente: { behind: true, left: [36, 96, 76, 66], right: [164, 96, 124, 66] },
  // Samedi : le plateau sous cloche, à bout de bras.
  plateau: {
    left: [48, 162, 66, 184],
    right: [156, 152, 164, 116],
    front: (
      <>
        <path d="M138 106 a26 24 0 0 1 52 0Z" fill="rgb(var(--n-300))" />
        <path d="M146 100 a18 17 0 0 1 14 -14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <circle cx="164" cy="80" r="4.5" fill="rgb(var(--n-400))" />
        <ellipse cx="164" cy="107" rx="36" ry="5.5" fill="rgb(var(--n-400))" />
      </>
    ),
  },
  // Lundi suivant : le poing levé, et le café du lundi.
  victoire: {
    left: [48, 164, 42, 134],
    right: [158, 122, 150, 84],
    front: <Mug x={40} y={132} />,
  },
};

/**
 * `title` : description lue par les lecteurs d'écran. Sans elle, Julien est décoratif et leur est caché.
 * `disc` : couleur de la pastille derrière lui, selon le fond de la section.
 */
export default function Julien({
  pose, className, title, disc = 'light',
}: { pose: JulienPose; className?: string; title?: string; disc?: 'light' | 'dark' | 'sage' | 'none' }) {
  const p = POSES[pose];
  const arms = (
    <>
      <ArmShape shoulder={72} arm={p.left} />
      <ArmShape shoulder={128} arm={p.right} />
    </>
  );
  const discFill = { light: 'rgb(var(--p-100))', dark: 'rgb(255 255 255 / 0.08)', sage: '#cfdcc0', none: 'none' }[disc];
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const };
  return (
    <svg viewBox="0 0 200 262" className={cn('julien block h-auto overflow-visible', className)} {...a11y}>
      <circle cx="100" cy="150" r="100" fill={discFill} />
      <ellipse cx="100" cy="253" rx="58" ry="7" fill="rgb(0 0 0 / 0.12)" />
      <g className="julien-body">
        <rect x="76" y="194" width="21" height="54" rx="8" fill={TROUSERS} />
        <rect x="103" y="194" width="21" height="54" rx="8" fill={TROUSERS} />
        <ellipse cx="84" cy="250" rx="15" ry="7" fill={INK} />
        <ellipse cx="116" cy="250" rx="15" ry="7" fill={INK} />
        {p.behind && arms}
        <rect x="64" y="112" width="72" height="94" rx="24" fill={SHIRT} />
        <rect x="92" y="94" width="16" height="22" fill={SKIN_SHADE} />
        <path d="M86 112 L100 126 L114 112" fill="none" stroke={SHIRT_SHADE} strokeWidth="3" strokeLinejoin="round" />
        <path d="M84 130 L92 110 M116 130 L108 110" stroke={APRON} strokeWidth="4" strokeLinecap="round" />
        <path d="M82 128 H118 L124 152 Q140 160 138 216 H62 Q60 160 76 152Z" fill={APRON} />
        <rect x="88" y="170" width="24" height="18" rx="4" fill={APRON_DARK} />
        <JulienHead x={100} y={70} />
        {p.held}
        {!p.behind && arms}
        {p.front}
      </g>
    </svg>
  );
}
