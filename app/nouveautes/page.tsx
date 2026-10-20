import HeroPanel from '@/components/site/HeroPanel';
import LinkList from '@/components/site/LinkList';
import { JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { RELEASE } from '@/lib/site/config';
import { featureBySlug } from '@/lib/site/features';
import { guideBySlug } from '@/lib/site/guides';
import { pageMetadata } from '@/lib/site/metadata';
import { CONTACT, DEMO, FEATURE_COLUMNS, HOME, RELEASES, type SiteLink } from '@/lib/site/pages';
import { breadcrumbSchema } from '@/lib/site/schema';
import { fr } from '@/lib/site/typo';

const TITLE = `Nouveautés : WeboDevis ${RELEASE.version} sort le ${RELEASE.dateLabel}`;
const DESCRIPTION = `La version ${RELEASE.version} de WeboDevis, le logiciel des traiteurs, sort le ${RELEASE.dateLabel}. Voici ce qu’elle contient, fonction par fonction.`;

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: RELEASES.href });

/** Entrée du 20 octobre 2026 : ce qui a été ajouté, en une phrase par point. */
const UPDATE_POINTS = [
  'Signature en ligne : le client accepte le devis depuis son lien et le signe au doigt ou à la souris. Le devis passe en « Validé » et vous êtes prévenu.',
  'Factures : acompte, solde qui déduit les acomptes, facture complète et avoir, avec une numérotation continue propre à votre entreprise, la TVA ventilée par taux, les paiements et un export CSV pour le comptable.',
  'Facture électronique : chaque facture émise se télécharge au format Factur-X. Le raccordement à une plateforme agréée est prévu.',
  'Allergènes : les 14 allergènes réglementaires sur vos ingrédients et vos prestations, et une fiche allergènes imprimable par événement.',
  'Vos documents : des numéros de devis propres à votre entreprise, avec le préfixe de votre choix, et vos mentions légales en bas de vos factures (forme juridique, capital, RCS, TVA ou franchise, IBAN).',
  'Vos données : l’export de toutes vos données et la suppression de votre compte, depuis l’application.',
];

const UPDATE_LINKS: SiteLink[] = [
  ...['signature-devis-en-ligne', 'facturation', 'facture-electronique', 'allergenes'].flatMap((slug) => {
    const f = featureBySlug(slug);
    return f ? [{ href: f.href, label: f.label, blurb: f.blurb }] : [];
  }),
  ...['facture-electronique-traiteur', 'allergenes-traiteur'].flatMap((slug) => {
    const g = guideBySlug(slug);
    return g ? [{ href: g.href, label: `Guide : ${g.title}`, blurb: g.blurb }] : [];
  }),
];

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: RELEASES.label, path: RELEASES.href },
];

export default function ReleasesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <HeroPanel
        crumbs={crumbs}
        title="Nouveautés de WeboDevis"
        lead="Les versions du logiciel, de la plus récente à la plus ancienne. La première arrive."
        demo={false}
      />

      {/* Entrée du 20 octobre 2026 : la plus récente, en premier. */}
      <section aria-labelledby="titre-octobre-2026" className="pt-12 md:pt-20">
        <div className={container}>
          <p className="text-base text-gray-600">
            <time dateTime="2026-10-20">20 octobre 2026</time>
          </p>
          <h2 id="titre-octobre-2026" className="site-h1 font-display mt-2">Factures, signature en ligne, allergènes</h2>
          <p className="site-lead text-gray-700 mt-6 max-w-[58ch]">
            Avant sa sortie, la version {RELEASE.version} s’enrichit de quoi finir une affaire dans WeboDevis&nbsp;: le devis signé en ligne par le client, les factures qui en découlent, et les allergènes du menu.
          </p>
          <ul className="mt-6 space-y-2.5 max-w-[60ch]">
            {UPDATE_POINTS.map((pt) => (
              <li key={pt} className="flex gap-3 text-base leading-relaxed text-gray-900">
                <span className="flex-shrink-0 mt-[0.6em] w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                {fr(pt)}
              </li>
            ))}
          </ul>
          <LinkList links={UPDATE_LINKS} columns={2} className="mt-10" />
        </div>
      </section>

      <section aria-labelledby="titre-version" className="pt-14 md:pt-20">
        <div className={container}>
          <p className="text-base text-gray-600">
            <time dateTime={RELEASE.date}>{RELEASE.dateLabel}</time>
          </p>
          <h2 id="titre-version" className="site-h1 font-display mt-2">Version {RELEASE.version}</h2>
          <p className="site-lead text-gray-700 mt-6 max-w-[58ch]">
            La première version publique de WeboDevis sort le {RELEASE.dateLabel}. Elle couvre le métier de traiteur d’un bout à l’autre : de la demande reçue jusqu’à l’événement servi.
          </p>
          <p className="site-body text-gray-700 mt-4 max-w-[58ch]">
            En attendant, la démonstration est ouverte : <TextLink href={DEMO.href}>essayer la démo</TextLink>, sur un compte rempli de données fictives.
          </p>
        </div>
      </section>

      {FEATURE_COLUMNS.map((group, i) => (
        <section key={group.title} aria-labelledby={`contenu-${i}`} className="pt-14 md:pt-20">
          <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-6`}>
            <h3 id={`contenu-${i}`} className="site-h2 font-display max-w-[12ch]">{group.title}</h3>
            <LinkList links={group.links} columns={1} />
          </div>
        </section>
      ))}

      <section aria-label="Une question" className={sectionGap}>
        <div className={container}>
          <p className="site-lead text-gray-700 max-w-[56ch]">
            Une question sur cette version, ou sur ce qu’il vous faudrait ? <TextLink href={CONTACT.href}>Écrivez-nous</TextLink>.
          </p>
        </div>
      </section>
    </>
  );
}
