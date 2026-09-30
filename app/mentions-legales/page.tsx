import Link from 'next/link';
import HeroPanel from '@/components/site/HeroPanel';
import { JsonLd, Todo, container } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { HOME, LEGAL } from '@/lib/site/pages';
import { breadcrumbSchema } from '@/lib/site/schema';

const PAGE = LEGAL[0];
const TITLE = 'Mentions légales | WeboDevis';
const DESCRIPTION = 'Éditeur, hébergeur et contact du site et de l’application WeboDevis.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PAGE.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: PAGE.label, path: PAGE.href },
];

// Structure seulement : chaque information propre à l'éditeur reste à fournir (marqueurs « À COMPLÉTER »).
export default function MentionsLegalesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <HeroPanel crumbs={crumbs} title="Mentions légales" demo={false} narrow />

      <div className={`${container} pt-4 md:pt-8`}>
        <div className="site-legal max-w-[68ch]">
          <h2>Éditeur du site</h2>
          <dl>
            <div><dt>Raison sociale</dt><dd><Todo>raison sociale ou nom de l’entrepreneur</Todo></dd></div>
            <div><dt>Forme juridique et capital social</dt><dd><Todo>forme juridique, montant du capital le cas échéant</Todo></dd></div>
            <div><dt>Siège social</dt><dd><Todo>adresse complète</Todo></dd></div>
            <div><dt>Immatriculation</dt><dd><Todo>numéro SIRET, ville du RCS ou du répertoire concerné</Todo></dd></div>
            <div><dt>Numéro de TVA intracommunautaire</dt><dd><Todo>numéro de TVA, ou mention de la franchise en base</Todo></dd></div>
            <div><dt>Directeur de la publication</dt><dd><Todo>nom et prénom</Todo></dd></div>
            <div><dt>Contact</dt><dd><Todo>adresse email et numéro de téléphone</Todo></dd></div>
          </dl>

          <h2>Hébergement</h2>
          <dl>
            <div><dt>Hébergeur du site et de l’application</dt><dd><Todo>nom de l’hébergeur, adresse, téléphone</Todo></dd></div>
            <div><dt>Hébergeur de la base de données</dt><dd><Todo>nom de l’hébergeur, adresse, région d’hébergement</Todo></dd></div>
          </dl>

          <h2>Propriété intellectuelle</h2>
          <p>
            Le nom WeboDevis, le site, l’application et leurs contenus appartiennent à l’éditeur. Les documents et les données qu’un utilisateur enregistre dans l’application restent les siens.
          </p>
          <p><Todo>préciser si la marque est déposée, et les conditions de réutilisation des contenus</Todo></p>

          <h2>Conditions d’utilisation</h2>
          <p><Todo>lien vers les conditions générales d’utilisation et de vente, une fois rédigées</Todo></p>

          <h2>Données personnelles</h2>
          <p>
            Le traitement des données personnelles est décrit dans la page <Link href="/confidentialite">Confidentialité</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
