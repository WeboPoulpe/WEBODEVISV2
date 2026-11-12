import Link from 'next/link';
import PageHead from '@/components/annuaire/PageHead';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME } from '@/lib/annuaire/config';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { directoryHref } from '@/lib/annuaire/routing';
import { SITE_URL } from '@/lib/site/config';

// Mentions légales de l'annuaire. Éditeur réel : Webomax jusqu'au 1er janvier 2027, puis Webosoft. Le partenariat
// avec WeboDevis est une présentation commerciale, pas une façon de taire qui édite le site. À relire par Maxence.

export const metadata = directoryMetadata({
  title: 'Mentions légales',
  description: `Éditeur, hébergeur et contact de ${DIRECTORY_NAME}.`,
  path: '/mentions-legales',
});

export default async function MentionsLegalesPage() {
  const base = await directoryBase();
  const href = (p: string) => directoryHref(base, p);
  return (
    <>
      <PageHead base={base} crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Mentions légales', path: '/mentions-legales' }]} title="Mentions légales" />
      <div className={container}>
        <div className="cmt-prose">
          <p>
            {DIRECTORY_NAME} est un annuaire de traiteurs, publié en partenariat avec <a href={SITE_URL}>WeboDevis</a>, le logiciel
            des traiteurs. Il est aujourd’hui édité par Webomax&nbsp;; à partir du 1er janvier 2027, il sera édité par la société
            Webosoft, et ces mentions seront mises à jour à cette date.
          </p>

          <h2>Éditeur du site</h2>
          <dl>
            <div><dt>Nom de l’entreprise</dt><dd>Webomax</dd></div>
            <div><dt>Forme juridique</dt><dd>Micro-entreprise</dd></div>
            <div><dt>SIRET</dt><dd>925 205 767 00013</dd></div>
            <div><dt>Adresse</dt><dd>1 rue de la Haute Charme, 10000 Troyes</dd></div>
            <div><dt>E-mail</dt><dd><a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a></dd></div>
          </dl>

          <h2>Directeur de la publication</h2>
          <p>Maxence Medard, <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>.</p>

          <h2>Hébergement</h2>
          <dl>
            <div><dt>Hébergeur du site</dt><dd>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis, <a href="https://vercel.com" rel="noopener noreferrer" target="_blank">vercel.com</a></dd></div>
            <div><dt>Hébergeur de la base de données</dt><dd>Neon Inc., base hébergée à Londres (Royaume-Uni), <a href="https://neon.tech" rel="noopener noreferrer" target="_blank">neon.tech</a></dd></div>
          </dl>

          <h2>Contenu des fiches</h2>
          <p>
            Chaque fiche est rédigée par le traiteur qu’elle présente : textes, photos, prix de départ et brochures sont sous sa
            responsabilité. L’entreprise est contrôlée avant la publication, mais {DIRECTORY_NAME} ne garantit ni les prestations ni
            les prix annoncés. Pour signaler une fiche inexacte ou un contenu qui pose problème, écrivez à{' '}
            <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>.
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>
            Le nom {DIRECTORY_NAME}, le logo et la présentation du site appartiennent à Webomax. Les textes et les photos des fiches
            restent la propriété des traiteurs qui les publient. Toute reproduction sans autorisation écrite est interdite.
          </p>

          <h2>Données personnelles et cookies</h2>
          <p>
            {DIRECTORY_NAME} lui-même ne dépose aucun cookie et n’utilise aucun outil de publicité&nbsp;; seule l’ouverture d’une
            brochure protégée par un code pose un cookie technique. Ce cookie, le traitement des demandes envoyées aux traiteurs,
            la mesure d’audience sans cookie et vos droits sont décrits dans la page{' '}
            <Link href={href('/confidentialite')}>Confidentialité</Link>.
          </p>

          <h2>Droit applicable</h2>
          <p>Le présent site est soumis au droit français. Tout litige relève de la compétence des tribunaux de Troyes.</p>
        </div>
      </div>
    </>
  );
}
