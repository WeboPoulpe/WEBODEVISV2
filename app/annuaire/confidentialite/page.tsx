import Link from 'next/link';
import PageHead from '@/components/annuaire/PageHead';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME } from '@/lib/annuaire/config';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { directoryHref } from '@/lib/annuaire/routing';

// Confidentialité de l'annuaire : la demande de contact (transmise au seul traiteur choisi), l'empreinte de l'adresse
// IP, les statistiques sans cookie, les favoris gardés dans le navigateur. À relire par Maxence avant l'ouverture.

export const metadata = directoryMetadata({
  title: 'Confidentialité',
  description: `Quelles données ${DIRECTORY_NAME} traite quand vous écrivez à un traiteur, et comment exercer vos droits.`,
  path: '/confidentialite',
});

export default async function ConfidentialitePage() {
  const base = await directoryBase();
  const href = (p: string) => directoryHref(base, p);
  return (
    <>
      <PageHead
        base={base}
        crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Confidentialité', path: '/confidentialite' }]}
        title="Confidentialité"
        lead={`Ce que ${DIRECTORY_NAME} fait de vos données, en clair : très peu, et jamais de publicité.`}
      />
      <div className={container}>
        <div className="cmt-prose">
          <h2>Responsable du traitement</h2>
          <p>
            Webomax (micro-entreprise), 1 rue de la Haute Charme, 10000 Troyes, représentée par Maxence Medard,{' '}
            <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>. À partir du 1er janvier 2027, la société Webosoft prend le
            relais.
          </p>

          <h2>Quand vous écrivez à un traiteur</h2>
          <p>
            Le formulaire d’une fiche recueille votre prénom, votre nom, votre adresse e-mail et, si vous les indiquez, votre
            téléphone, le type et la date de votre événement, le nombre d’invités, le lieu et votre message. Ces informations sont
            transmises au seul traiteur que vous avez choisi&nbsp;: votre demande s’enregistre dans son espace et il la reçoit par
            e-mail, pour vous répondre. Vous recevez un récapitulatif à votre adresse.
          </p>
          <p>
            Une fois la demande reçue, le traiteur en devient responsable pour la suite de vos échanges et la conserve selon ses
            propres règles. Pour qu’elle soit effacée chez lui, adressez-vous à lui, ou écrivez-nous et nous transmettrons.
          </p>
          <p>Base légale&nbsp;: votre demande (mesures précontractuelles prises à votre initiative).</p>

          <h2>Contre les envois abusifs</h2>
          <p>
            Pour limiter le nombre de demandes envoyées depuis une même connexion, une empreinte de votre adresse IP est gardée avec
            la demande. C’est un code calculé à partir de l’adresse, qui ne permet pas de la retrouver&nbsp;; l’adresse elle-même
            n’est pas conservée. Base légale&nbsp;: notre intérêt légitime à protéger les traiteurs des messages indésirables.
          </p>

          <h2>Mesure d’audience, sans cookie</h2>
          <p>
            Nous comptons les pages vues avec notre propre outil, sans cookie et sans garder votre adresse IP&nbsp;: un visiteur
            n’est reconnu que le temps d’une journée, par une empreinte qui ne permet ni de l’identifier ni de le suivre sur
            d’autres sites. Ces chiffres anonymes (pages vues, site d’où vous venez, type d’appareil) servent à améliorer
            l’annuaire et à montrer à chaque traiteur combien de fois sa fiche a été vue. Ils sont conservés 13 mois.
          </p>

          <h2>Vos favoris restent chez vous</h2>
          <p>
            Les traiteurs que vous gardez en favori sont notés dans votre navigateur (stockage local), sur votre appareil. Ils ne
            nous sont pas transmis pour être enregistrés&nbsp;: la page Mes favoris les envoie seulement pour afficher les fiches
            correspondantes. Vider les données du site dans votre navigateur les efface.
          </p>

          <h2>Cookies</h2>
          <p>{DIRECTORY_NAME} ne dépose aucun cookie, ni de mesure d’audience, ni de publicité. Il n’y a donc pas de bandeau à accepter.</p>

          <h2>Prestataires</h2>
          <ul>
            <li>Vercel&nbsp;: hébergement du site et des photos des fiches.</li>
            <li>Neon&nbsp;: base de données, hébergée à Londres (Royaume-Uni).</li>
            <li>Resend&nbsp;: envoi des e-mails (votre récapitulatif, la demande reçue par le traiteur).</li>
          </ul>
          <p>
            Vercel et Resend sont des sociétés américaines&nbsp;; les transferts de données qu’elles réalisent sont encadrés par les
            clauses contractuelles types de la Commission européenne.
          </p>

          <h2>Vos droits</h2>
          <p>
            Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, la limitation ou l’opposition à leur
            traitement. Écrivez à <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>, ou par courrier à Webomax, 1 rue de
            la Haute Charme, 10000 Troyes. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).
          </p>
          <p>
            Voir aussi les <Link href={href('/mentions-legales')}>mentions légales</Link> et les{' '}
            <Link href={href('/conditions')}>conditions d’utilisation</Link>.
          </p>

          <h2>Mise à jour</h2>
          <p>Dernière mise à jour&nbsp;: 12 novembre 2026.</p>
        </div>
      </div>
    </>
  );
}
