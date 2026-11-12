import Link from 'next/link';
import PageHead from '@/components/annuaire/PageHead';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME } from '@/lib/annuaire/config';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { directoryHref } from '@/lib/annuaire/routing';

// Conditions d'utilisation de l'annuaire, dont la règle de classement des fiches (date de publication, aucun paiement),
// que la loi demande d'écrire en clair. À relire par Maxence avant l'ouverture.

export const metadata = directoryMetadata({
  title: 'Conditions d’utilisation',
  description: `Comment fonctionne ${DIRECTORY_NAME} : qui publie les fiches, comment elles sont vérifiées et classées.`,
  path: '/conditions',
});

export default async function ConditionsPage() {
  const base = await directoryBase();
  const href = (p: string) => directoryHref(base, p);
  return (
    <>
      <PageHead
        base={base}
        crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Conditions d’utilisation', path: '/conditions' }]}
        title="Conditions d’utilisation"
      />
      <div className={container}>
        <div className="cmt-prose">
          <h2>Ce qu’est {DIRECTORY_NAME}</h2>
          <p>
            {DIRECTORY_NAME} est un annuaire de traiteurs. Il permet de trouver un traiteur qui se déplace dans votre
            département, de consulter sa fiche et de lui écrire. Il est gratuit pour les visiteurs, sans inscription. L’annuaire
            ne vend aucune prestation&nbsp;: le devis, la réservation et le paiement se font directement entre vous et le traiteur.
          </p>

          <h2>Qui publie les fiches</h2>
          <p>
            Chaque fiche est créée et tenue à jour par le traiteur qu’elle présente. Avant la première publication, le numéro
            SIRET de l’entreprise est contrôlé automatiquement, et une personne relit les cas où le contrôle a un doute. Une fiche
            modifiée après sa publication reste en ligne&nbsp;; elle peut être suspendue si elle ne respecte plus ces conditions.
          </p>
          <p>
            Les prix affichés sont des prix de départ indicatifs, donnés par le traiteur. Seul son devis vous engage.
          </p>

          <h2>Comment les fiches sont classées</h2>
          <p>
            Les fiches apparaissent par date de publication, la plus récente d’abord. Le classement ne dépend d’aucun paiement&nbsp;:
            aucun traiteur ne peut payer pour être mieux placé, et il n’y a ni publicité ni mise en avant sponsorisée.
          </p>
          <p>
            Une recherche par département montre les traiteurs qui déclarent s’y déplacer. Une recherche par type d’événement
            montre ceux qui déclarent servir ce type d’événement.
          </p>

          <h2>Écrire à un traiteur</h2>
          <p>
            Le formulaire d’une fiche envoie votre demande à ce seul traiteur. Merci de n’y écrire que pour un vrai projet&nbsp;:
            les envois répétés depuis une même connexion sont limités. Ce que deviennent vos informations est décrit dans la page{' '}
            <Link href={href('/confidentialite')}>Confidentialité</Link>.
          </p>

          <h2>Pour les traiteurs</h2>
          <p>
            La fiche est offerte aux abonnés de WeboDevis, le logiciel partenaire de l’annuaire. Le traiteur s’engage à publier des
            informations exactes sur son entreprise, des photos dont il détient les droits, et à répondre aux demandes reçues.
            Une fiche est retirée de l’annuaire si l’abonnement prend fin, ou sur simple demande.
          </p>

          <h2>Signaler un problème</h2>
          <p>
            Une fiche inexacte, une photo qui n’a rien à faire là, un traiteur injoignable&nbsp;? Écrivez à{' '}
            <a href="mailto:maxence@webomax.fr">maxence@webomax.fr</a>. Voir aussi les{' '}
            <Link href={href('/mentions-legales')}>mentions légales</Link>.
          </p>

          <h2>Mise à jour</h2>
          <p>Dernière mise à jour&nbsp;: 12 novembre 2026.</p>
        </div>
      </div>
    </>
  );
}
