import HeroPanel from '@/components/site/HeroPanel';
import { JsonLd, Todo, container } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { HOME, LEGAL } from '@/lib/site/pages';
import { breadcrumbSchema } from '@/lib/site/schema';

const PAGE = LEGAL[1];
const TITLE = 'Confidentialité | WeboDevis';
const DESCRIPTION = 'Quelles données WeboDevis traite, pourquoi, et comment exercer vos droits.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PAGE.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: PAGE.label, path: PAGE.href },
];

// Structure seulement : ce texte doit être complété et relu par l'éditeur avant la mise en ligne.
export default function ConfidentialitePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <HeroPanel
        crumbs={crumbs}
        title="Confidentialité"
        lead="Quelles données personnelles WeboDevis traite, dans quel but, et comment exercer vos droits."
        demo={false}
        narrow
      />

      <div className={`${container} pt-4 md:pt-8`}>
        <div className="site-legal max-w-[68ch]">
          <h2>Responsable du traitement</h2>
          <p>
            Webomax (micro-entreprise), 1 rue de la Haute Charme, 10000 Troyes. Responsable du traitement&nbsp;: Maxence Medard, <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>.
          </p>

          <h2>Données traitées</h2>
          <ul>
            <li>Les données de votre compte&nbsp;: nom, prénom, adresse email, nom de votre entreprise.</li>
            <li>Les données que vous enregistrez dans l’application&nbsp;: clients, demandes, devis, événements, prestations, fournisseurs, extras.</li>
            <li>Les données des personnes qui remplissent votre formulaire de demande&nbsp;: coordonnées et description de leur événement.</li>
            <li>Les données du formulaire de contact de ce site&nbsp;: nom, adresse email, téléphone, entreprise et message.</li>
            <li>Les données laissées pour essayer la démonstration&nbsp;: prénom, nom, adresse email, téléphone et, si vous l’indiquez, votre entreprise.</li>
            <li>Pour limiter les envois abusifs des formulaires, une empreinte de votre adresse IP est conservée avec la demande&nbsp;; l’adresse elle-même ne l’est pas.</li>
            <li>Le site et l’application n’utilisent aucun outil de mesure d’audience ni de publicité.</li>
          </ul>

          <h2>Finalités et bases légales</h2>
          <p><Todo>pour chaque usage des données (fourniture du service, envoi des emails, réponse aux demandes de contact, assistance), la base légale retenue</Todo></p>

          <h2>Rôle de WeboDevis pour les données de vos clients</h2>
          <p>
            Les données de vos clients, de vos prospects et de vos extras sont enregistrées par vous, pour votre activité. <Todo>préciser la répartition des rôles (responsable du traitement, sous-traitant) et le contrat qui l’encadre</Todo>
          </p>

          <h2>Destinataires et sous-traitants</h2>
          <ul>
            <li>Vercel&nbsp;: hébergement du site et de l’application, stockage des fichiers (logos, photos, devis importés).</li>
            <li>Neon&nbsp;: base de données.</li>
            <li>Resend&nbsp;: envoi des emails (devis, accusés de réception, mot de passe).</li>
          </ul>

          <h2>Hébergement des données</h2>
          <p>L’application et la base de données sont hébergées à Londres (Royaume-Uni).</p>
          <p><Todo>lieu de stockage des fichiers&nbsp;; transferts éventuels hors de l’Union européenne (Vercel et Resend sont des sociétés américaines) et garanties associées</Todo></p>

          <h2>Durées de conservation</h2>
          <p><Todo>durée de conservation de chaque catégorie de données, et ce qu’il advient des données à la fermeture d’un compte</Todo></p>

          <h2>Cookies</h2>
          <p>L’application utilise un cookie de session, nécessaire pour vous garder connecté.</p>
          <p>Aucun cookie de publicité ni de mesure d’audience n’est déposé. Votre navigateur garde aussi, sans les transmettre, quelques préférences d’affichage et, si vous avez essayé la démonstration, de quoi la rouvrir sans ressaisir vos coordonnées.</p>

          <h2>Vos droits</h2>
          <p>
            Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, la limitation ou l’opposition à leur traitement, ainsi que leur portabilité. Vous pouvez aussi adresser une réclamation à la CNIL.
          </p>
          <p>Pour exercer ces droits&nbsp;: <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>, ou par courrier à Webomax, 1 rue de la Haute Charme, 10000 Troyes.</p>

          <h2>Mise à jour</h2>
          <p>Dernière mise à jour&nbsp;: 30 septembre 2026.</p>
        </div>
      </div>
    </>
  );
}
