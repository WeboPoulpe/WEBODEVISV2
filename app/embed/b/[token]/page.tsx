// La brochure intégrée au site du traiteur (balise iframe) : la même page que le lien, servie sous /embed/ où
// l'affichage dans le cadre d'un autre site est permis (voir next.config.ts). Ouvertures et demandes comptées comme
// sur le lien (prendre un lien « Site web » pour les distinguer).

export { default, generateMetadata } from '../../../b/[token]/page';
export const dynamic = 'force-dynamic';
