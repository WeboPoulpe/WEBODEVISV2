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
          <p><Todo>raison sociale, adresse et email de contact du responsable du traitement</Todo></p>

          <h2>Données traitées</h2>
          <ul>
            <li>Les données de votre compte&nbsp;: nom, prénom, adresse email, nom de votre entreprise.</li>
            <li>Les données que vous enregistrez dans l’application&nbsp;: clients, demandes, devis, événements, prestations, fournisseurs, extras.</li>
            <li>Les données des personnes qui remplissent votre formulaire de demande&nbsp;: coordonnées et description de leur événement.</li>
            <li>Les données du formulaire de contact de ce site&nbsp;: nom, adresse email, téléphone, entreprise et message.</li>
            <li><Todo>autres données collectées, par exemple journaux techniques ou mesure d’audience</Todo></li>
          </ul>

          <h2>Finalités et bases légales</h2>
          <p><Todo>pour chaque usage des données (fourniture du service, envoi des emails, réponse aux demandes de contact, assistance), la base légale retenue</Todo></p>

          <h2>Rôle de WeboDevis pour les données de vos clients</h2>
          <p>
            Les données de vos clients, de vos prospects et de vos extras sont enregistrées par vous, pour votre activité. <Todo>préciser la répartition des rôles (responsable du traitement, sous-traitant) et le contrat qui l’encadre</Todo>
          </p>

          <h2>Destinataires et sous-traitants</h2>
          <p><Todo>liste des prestataires qui traitent des données&nbsp;: hébergement, base de données, stockage des fichiers, envoi des emails</Todo></p>

          <h2>Hébergement des données</h2>
          <p><Todo>lieu d’hébergement</Todo></p>
          <p><Todo>hébergeur, pays et région&nbsp;; transferts éventuels hors de l’Union européenne et garanties associées</Todo></p>

          <h2>Durées de conservation</h2>
          <p><Todo>durée de conservation de chaque catégorie de données, et ce qu’il advient des données à la fermeture d’un compte</Todo></p>

          <h2>Cookies</h2>
          <p>L’application utilise un cookie de session, nécessaire pour vous garder connecté.</p>
          <p><Todo>autres cookies ou traceurs éventuels, et la manière de les refuser</Todo></p>

          <h2>Vos droits</h2>
          <p>
            Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, la limitation ou l’opposition à leur traitement, ainsi que leur portabilité. Vous pouvez aussi adresser une réclamation à la CNIL.
          </p>
          <p>Pour exercer ces droits&nbsp;: <Todo>adresse email ou postale de contact</Todo></p>

          <h2>Mise à jour</h2>
          <p>Dernière mise à jour&nbsp;: <Todo>date</Todo></p>
        </div>
      </div>
    </>
  );
}
