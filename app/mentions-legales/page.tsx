import Link from 'next/link';
import HeroPanel from '@/components/site/HeroPanel';
import { JsonLd, container } from '@/components/site/ui';
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

// Éditeur provisoire : Webomax, d'après les mentions légales de webomax.fr. La société qui exploitera WeboDevis
// ouvre le 1er janvier 2027 : ces mentions seront alors mises à jour (raison sociale, immatriculation, TVA).
export default function MentionsLegalesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <HeroPanel crumbs={crumbs} title="Mentions légales" demo={false} narrow />

      <div className={`${container} pt-4 md:pt-8`}>
        <div className="site-legal max-w-[68ch]">
          <p>
            WeboDevis est aujourd’hui édité par Webomax. À partir du 1er janvier 2027, il sera édité par la société créée pour
            l’exploiter&nbsp;; ces mentions seront mises à jour à cette date.
          </p>

          <h2>Éditeur du site</h2>
          <dl>
            <div><dt>Nom de l’entreprise</dt><dd>Webomax</dd></div>
            <div><dt>Forme juridique</dt><dd>Micro-entreprise</dd></div>
            <div><dt>Adresse</dt><dd>1 rue de la Haute Charme, 10000 Troyes</dd></div>
            <div><dt>Téléphone</dt><dd><a href="tel:+33644887039">06 44 88 70 39</a></dd></div>
            <div><dt>Email</dt><dd><a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a></dd></div>
          </dl>

          <h2>Hébergement</h2>
          <dl>
            <div><dt>Hébergeur du site et de l’application</dt><dd>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis, <a href="https://vercel.com" rel="noopener noreferrer" target="_blank">vercel.com</a></dd></div>
            <div><dt>Hébergeur de la base de données</dt><dd>Neon Inc., base hébergée à Londres (Royaume-Uni), <a href="https://neon.tech" rel="noopener noreferrer" target="_blank">neon.tech</a></dd></div>
          </dl>

          <h2>Directeur de la publication</h2>
          <dl>
            <div><dt>Nom</dt><dd>Maxence Medard</dd></div>
            <div><dt>Email</dt><dd><a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a></dd></div>
          </dl>

          <h2>Propriété intellectuelle</h2>
          <p>
            Le nom WeboDevis, le site, l’application et l’ensemble de leurs contenus (textes, images, graphismes, logos, icônes,
            logiciels) sont la propriété exclusive de Webomax ou utilisés avec autorisation. Toute reproduction, même partielle,
            sans autorisation écrite préalable est interdite. Les documents et les données qu’un utilisateur enregistre dans
            l’application restent les siens.
          </p>

          <h2>Données personnelles</h2>
          <p>
            Maxence Medard est responsable du traitement des données, conformément au RGPD et à la loi Informatique et Libertés.
            Vous disposez d’un droit d’accès, de rectification et de suppression de vos données&nbsp;: écrivez à{' '}
            <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>. Le détail des traitements est décrit dans la page{' '}
            <Link href="/confidentialite">Confidentialité</Link>.
          </p>

          <h2>Cookies</h2>
          <p>
            Les pages de présentation du site demandent votre accord avant de déposer des cookies de mesure d’audience. Vous
            pouvez changer d’avis à tout moment avec le lien «&nbsp;Cookies&nbsp;» en bas de page. Voir la page{' '}
            <Link href="/confidentialite#cookies">Confidentialité</Link>.
          </p>

          <h2>Liens hypertextes</h2>
          <p>
            Le site contient des liens vers d’autres ressources internet. La mise en place de liens vers le site ne nécessite pas
            d’autorisation expresse.
          </p>

          <h2>Limitation de responsabilité</h2>
          <p>
            Les informations fournies sont aussi précises que possible et mises à jour régulièrement, bien que des erreurs puissent
            survenir. En cas de problème constaté, écrivez-nous par email.
          </p>

          <h2>Droit applicable</h2>
          <p>Le présent site est soumis au droit français. Tout litige relève de la compétence des tribunaux de Troyes.</p>
        </div>
      </div>
    </>
  );
}
