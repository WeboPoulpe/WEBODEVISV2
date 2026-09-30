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

// Éditeur provisoire : Webomax, d'après les mentions légales de webomax.fr, le temps que la société dédiée soit créée.
// Ce qui n'y figure pas (SIRET, TVA) garde son marqueur « À COMPLÉTER ».
export default function MentionsLegalesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <HeroPanel crumbs={crumbs} title="Mentions légales" demo={false} narrow />

      <div className={`${container} pt-4 md:pt-8`}>
        <div className="site-legal max-w-[68ch]">
          <h2>Éditeur du site</h2>
          <dl>
            <div><dt>Raison sociale</dt><dd>Webomax</dd></div>
            <div><dt>Forme juridique</dt><dd>Micro-entreprise</dd></div>
            <div><dt>Siège social</dt><dd>1 rue de la Haute Charme, 10000 Troyes</dd></div>
            <div><dt>Immatriculation</dt><dd><Todo>numéro SIRET, ville du RCS ou du répertoire concerné</Todo></dd></div>
            <div><dt>Numéro de TVA intracommunautaire</dt><dd><Todo>numéro de TVA, ou mention de la franchise en base</Todo></dd></div>
            <div><dt>Directeur de la publication</dt><dd>Maxence Medard</dd></div>
            <div><dt>Contact</dt><dd><a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>, 06 44 88 70 39</dd></div>
          </dl>

          <h2>Hébergement</h2>
          <dl>
            <div><dt>Hébergeur du site et de l’application</dt><dd>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis, <a href="https://vercel.com" rel="noopener">vercel.com</a></dd></div>
            <div><dt>Hébergeur de la base de données</dt><dd>Neon, base hébergée à Londres (Royaume-Uni). <Todo>adresse de l’hébergeur</Todo></dd></div>
          </dl>

          <h2>Propriété intellectuelle</h2>
          <p>
            Le nom WeboDevis, le site, l’application et leurs contenus (textes, images, graphismes, logiciels) sont la propriété de Webomax. Les documents et les données qu’un utilisateur enregistre dans l’application restent les siens.
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
