import type { Metadata } from 'next';
import LegalPage, { Todo } from '@/components/site/LegalPage';

const TITLE = 'Confidentialité | WeboDevis';
const DESCRIPTION = 'Quelles données WeboDevis traite, pourquoi, où elles sont hébergées et comment exercer vos droits.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'WeboDevis', locale: 'fr_FR', type: 'website' },
};

// Structure seulement : ce texte doit être complété et relu par l'éditeur avant la mise en ligne.
export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Confidentialité"
      intro={<p>Cette page explique quelles données personnelles WeboDevis traite, dans quel but, et comment exercer vos droits.</p>}
    >
      <h2>Responsable du traitement</h2>
      <p><Todo>raison sociale, adresse et email de contact du responsable du traitement</Todo></p>

      <h2>Données traitées</h2>
      <ul>
        <li>Les données de votre compte : nom, prénom, adresse email, nom de votre entreprise.</li>
        <li>Les données que vous enregistrez dans l’application : clients, demandes, devis, événements, prestations, fournisseurs, extras.</li>
        <li>Les données des personnes qui remplissent votre formulaire de demande : coordonnées et description de leur événement.</li>
        <li><Todo>autres données collectées, par exemple journaux techniques ou mesure d’audience</Todo></li>
      </ul>

      <h2>Finalités et bases légales</h2>
      <p><Todo>pour chaque usage des données (fourniture du service, envoi des emails, assistance), la base légale retenue</Todo></p>

      <h2>Rôle de WeboDevis pour les données de vos clients</h2>
      <p>
        Les données de vos clients, de vos prospects et de vos extras sont enregistrées par vous, pour votre activité. <Todo>préciser la répartition des rôles (responsable du traitement, sous-traitant) et le contrat qui l’encadre</Todo>
      </p>

      <h2>Destinataires et sous-traitants</h2>
      <p><Todo>liste des prestataires qui traitent des données : hébergement, base de données, stockage des fichiers, envoi des emails</Todo></p>

      <h2>Hébergement des données</h2>
      <p>Les données sont hébergées en Europe.</p>
      <p><Todo>hébergeur, pays et région d’hébergement ; transferts éventuels hors de l’Union européenne et garanties associées</Todo></p>

      <h2>Durées de conservation</h2>
      <p><Todo>durée de conservation de chaque catégorie de données, et ce qu’il advient des données à la fermeture d’un compte</Todo></p>

      <h2>Cookies</h2>
      <p>L’application utilise un cookie de session, nécessaire pour vous garder connecté.</p>
      <p><Todo>autres cookies ou traceurs éventuels, et la manière de les refuser</Todo></p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, la limitation ou l’opposition à leur traitement, ainsi que leur portabilité. Vous pouvez aussi adresser une réclamation à la CNIL.
      </p>
      <p>Pour exercer ces droits : <Todo>adresse email ou postale de contact</Todo></p>

      <h2>Mise à jour</h2>
      <p>Dernière mise à jour : <Todo>date</Todo></p>
    </LegalPage>
  );
}
