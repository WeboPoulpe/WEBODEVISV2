import Link from 'next/link';

// Guide : la réforme de la facturation électronique, vue par un traiteur. Volontairement général et prudent :
// le calendrier est celui annoncé par l'administration, aucun conseil juridique ni fiscal n'est donné,
// et le texte renvoie aux sources officielles et au comptable.
export default function FactureElectronique() {
  return (
    <>
      <p>
        La France généralise la facture électronique entre entreprises. Pour un traiteur, la réforme ne change ni les menus ni les devis, mais elle change la façon dont les factures partent chez les clients professionnels, et ce que l’administration reçoit de vos ventes. Voici l’essentiel, à vérifier ensuite avec votre comptable.
      </p>

      <h2>Ce qu’est une facture électronique</h2>
      <p>
        Un PDF envoyé par email n’est pas une facture électronique au sens de la réforme. Il en faut deux choses de plus&nbsp;:
      </p>
      <ul>
        <li><strong>Un format structuré.</strong> Les données de la facture (vendeur, client, lignes, TVA, totaux) sont lisibles par un logiciel, sans ressaisie. Trois formats sont retenus&nbsp;: UBL, CII et Factur-X. Factur-X a l’avantage d’être aussi un PDF ordinaire, lisible par une personne.</li>
        <li><strong>Un circuit.</strong> La facture ne part plus directement de votre boîte mail&nbsp;: elle passe par une plateforme agréée par l’administration, qui la remet à la plateforme de votre client et transmet certaines de ses données au fisc.</li>
      </ul>

      <h2>Le calendrier</h2>
      <p>
        La réforme s’applique par étapes. Selon le calendrier annoncé par l’administration, toutes les entreprises assujetties à la TVA doivent d’abord être en mesure de recevoir des factures électroniques&nbsp;; l’obligation d’en émettre arrive ensuite, plus tard pour les petites entreprises. Pour les PME et les micro-entreprises, l’émission devient obligatoire à partir de septembre 2027.
      </p>
      <p>
        Ce calendrier a déjà été décalé par le passé. Vérifiez les dates qui vous concernent sur impots.gouv.fr avant de vous organiser.
      </p>

      <h2>Vos clients professionnels et vos clients particuliers</h2>
      <p>
        La plupart des traiteurs travaillent pour les deux. La réforme ne les traite pas de la même façon&nbsp;:
      </p>
      <ul>
        <li><strong>Une entreprise cliente</strong> (un séminaire, un cocktail de fin d’année, des plateaux-repas)&nbsp;: la facture devient électronique et passe par les plateformes agréées, une fois l’obligation d’émettre entrée en vigueur pour vous.</li>
        <li><strong>Un particulier</strong> (un mariage, un anniversaire)&nbsp;: il ne reçoit pas de facture électronique. La réforme prévoit en revanche de transmettre à l’administration des données sur ces ventes. C’est ce qu’on appelle le e-reporting.</li>
      </ul>
      <p>
        Entre les deux, certains clients demandent réflexion&nbsp;: une association, une collectivité, une entreprise étrangère. Posez la question à votre comptable pour vos cas habituels, une fois pour toutes.
      </p>
      <p>
        Être en franchise de TVA ne fait pas sortir de la réforme&nbsp;: une micro-entreprise qui facture sans TVA reste une entreprise, avec ses clients professionnels. Là encore, faites confirmer votre situation.
      </p>

      <h2>Choisir une plateforme agréée</h2>
      <p>
        L’administration publie la liste des plateformes agréées sur impots.gouv.fr. Votre banque, votre expert-comptable ou votre logiciel de facturation peuvent vous en proposer une, ou s’y raccorder. Avant de choisir, posez quelques questions simples&nbsp;:
      </p>
      <ul>
        <li>reçoit-elle aussi les factures de vos fournisseurs, puisque la réception est la première obligation&nbsp;?</li>
        <li>se raccorde-t-elle au logiciel où vous faites vos factures, ou faudra-t-il déposer chaque fichier à la main&nbsp;?</li>
        <li>votre comptable y a-t-il accès&nbsp;?</li>
        <li>que coûte-t-elle, et pour quel volume de factures&nbsp;?</li>
      </ul>

      <h2>Ce que vous pouvez préparer dès maintenant</h2>
      <ol>
        <li><strong>Complétez votre fichier clients.</strong> Pour une entreprise cliente, notez son nom exact, son adresse et son numéro SIREN ou SIRET. Ces informations seront demandées sur la facture.</li>
        <li><strong>Vérifiez vos mentions.</strong> Forme juridique, capital, RCS, numéro de TVA ou mention de franchise, conditions de paiement&nbsp;: faites relire votre pied de facture par votre comptable.</li>
        <li><strong>Gardez une numérotation continue.</strong> Une facture par numéro, sans trou ni doublon, et un avoir pour annuler plutôt qu’une facture modifiée après coup.</li>
        <li><strong>Regardez ce que fait votre logiciel.</strong> Sait-il produire un format structuré&nbsp;? Se raccorde-t-il à une plateforme agréée, ou le prévoit-il&nbsp;?</li>
      </ol>

      <h2>Où vérifier</h2>
      <p>
        Les sources qui font foi sont celles de l’administration&nbsp;: la rubrique consacrée à la facturation électronique sur impots.gouv.fr, où figurent aussi le calendrier et la liste des plateformes agréées, et les pages d’information d’economie.gouv.fr. Ce guide donne des repères, pas un avis juridique ni fiscal&nbsp;: pour votre cas, votre comptable reste l’interlocuteur.
      </p>

      <h2>Dans WeboDevis</h2>
      <p>
        Vos <Link href="/fonctionnalites/facturation">factures</Link> partent du devis, avec des numéros qui se suivent, la TVA ventilée par taux et vos mentions légales. Chaque facture émise se télécharge au <Link href="/fonctionnalites/facture-electronique">format Factur-X</Link>, au profil EN 16931. Le raccordement à une plateforme agréée est prévu, mais pas encore disponible&nbsp;: nous l’annoncerons sur la page des <Link href="/nouveautes">nouveautés</Link>.
      </p>
    </>
  );
}
