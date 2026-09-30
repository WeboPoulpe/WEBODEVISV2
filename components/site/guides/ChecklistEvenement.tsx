import Link from 'next/link';

// Guide : la checklist d'un événement, de la validation au jour J.
// Les échéances sont des repères d'organisation ; les règles d'hygiène et de droit sont renvoyées à qui de droit.
export default function ChecklistEvenement() {
  return (
    <>
      <p>
        Un événement réussi est rarement celui où tout s’est bien passé par chance. C’est celui où chaque point a été réglé à temps, par quelqu’un qui savait que c’était à lui de le faire. La checklist sert à cela&nbsp;: sortir l’organisation de votre tête pour qu’elle tienne même pendant la semaine où vous avez trois réceptions.
      </p>
      <p>
        Les échéances ci-dessous sont des repères. Un mariage de 200 convives se prépare plus tôt qu’un déjeuner de séminaire&nbsp;: déplacez les curseurs, mais gardez l’ordre.
      </p>

      <h2>À la validation du devis</h2>
      <p>Le client a dit oui. Avant de passer à autre chose, verrouillez ce qui ne pourra plus l’être plus tard.</p>
      <ul>
        <li>La confirmation est écrite, et l’acompte prévu par vos conditions est demandé.</li>
        <li>La date est bloquée dans votre calendrier, avec le lieu et le nombre de convives annoncé.</li>
        <li>Vous connaissez le lieu&nbsp;: accès pour le véhicule, distance entre le parking et la salle, point d’eau, puissance électrique, cuisine ou office sur place, horaires autorisés.</li>
        <li>Vous avez le nom et le téléphone de la personne qui décidera le jour J, et ce n’est pas forcément celle qui a signé.</li>
        <li>Le matériel à louer et les extras dont vous aurez besoin sont pressentis, surtout en haute saison.</li>
      </ul>

      <h2>Trois à quatre semaines avant</h2>
      <ul>
        <li>Le menu définitif est arrêté, options comprises.</li>
        <li>Les allergies et les régimes particuliers sont recensés par écrit.</li>
        <li>Le déroulé est calé avec le client&nbsp;: heure d’arrivée des invités, durée du cocktail, heure du passage à table, discours, pièce montée, fin de service.</li>
        <li>Les produits à long délai sont commandés.</li>
        <li>La location est réservée&nbsp;: vaisselle, verrerie, nappage, mobilier, matériel de cuisson.</li>
      </ul>

      <h2>Deux semaines avant</h2>
      <ul>
        <li>Le nombre définitif de convives est confirmé, adultes et enfants, à la date prévue au devis.</li>
        <li>La <Link href="/guides/liste-de-courses-evenement">liste de courses</Link> est établie, et les commandes fournisseurs partent.</li>
        <li>Chaque extra a reçu sa mission&nbsp;: lieu, heure d’arrivée, heure de fin prévue, fonction, tenue, contact sur place.</li>
        <li>Le plan de salle et le nombre de tables sont connus, s’ils conditionnent le service.</li>
      </ul>

      <h2>La semaine de l’événement</h2>
      <ul>
        <li>Les marchandises sont réceptionnées et contrôlées à la livraison.</li>
        <li>Le planning de production est affiché&nbsp;: qui prépare quoi, quel jour.</li>
        <li>Le matériel loué est réceptionné et compté.</li>
        <li>La feuille de route est prête&nbsp;: adresse, plan d’accès, déroulé minute par minute, contacts, liste de ce qui part dans le véhicule.</li>
        <li>Un dernier appel au client confirme les horaires et lève les questions en suspens.</li>
      </ul>

      <h2>La veille</h2>
      <ul>
        <li>Les préparations sont conditionnées et étiquetées par service.</li>
        <li>Le chargement est préparé dans l’ordre inverse du déchargement.</li>
        <li>Le petit matériel est vérifié. C’est lui qui manque&nbsp;: couteaux, planches, torchons, sacs-poubelle, rallonges, allume-gaz, trousse de secours.</li>
        <li>Les extras ont confirmé leur présence.</li>
      </ul>

      <h2>Le jour J</h2>
      <ul>
        <li>À l’arrivée, vous faites le tour du lieu avec votre contact et signalez tout de suite ce qui ne correspond pas à ce qui était prévu.</li>
        <li>L’équipe reçoit un brief&nbsp;: déroulé, rôle de chacun, plats, allergies, qui décide en cas d’imprévu.</li>
        <li>Pendant le service, une seule personne parle au client.</li>
        <li>En fin de service, le matériel est compté avant d’être rechargé, et la casse est notée.</li>
      </ul>
      <p>
        Les règles d’hygiène, de transport et de conservation des denrées s’appliquent à chaque étape. Cette checklist porte sur l’organisation et ne les remplace pas.
      </p>

      <h2>Après l’événement</h2>
      <p>C’est la partie qu’on saute, et celle qui rend le prochain événement plus facile.</p>
      <ul>
        <li>Le matériel loué est rendu, et le retour est pointé.</li>
        <li>Le solde est facturé selon vos conditions.</li>
        <li>Les heures réelles des extras et les dépenses sont relevées, pour connaître la <Link href="/guides/calculer-marge-traiteur">marge réelle</Link>.</li>
        <li>Vous notez ce qui est revenu en cuisine, ce qui a manqué, ce que vous feriez autrement.</li>
      </ul>

      <h2>Une checklist par événement, un modèle pour tous</h2>
      <p>
        Refaire cette liste de mémoire à chaque fois, c’est s’assurer d’oublier un point différent à chaque fois. Écrivez votre modèle une bonne fois, avec vos mots et vos habitudes. À chaque nouvel événement, vous partez de ce modèle et vous ajoutez ce qui lui est propre&nbsp;: le traiteur du vin d’honneur, le code du portail, la grand-mère qui ne mange pas de poisson.
      </p>
      <p>
        Deux règles la gardent utile. Chaque ligne a un responsable, sinon elle n’est à personne. Et une ligne cochée l’est vraiment&nbsp;: on ne coche pas «&nbsp;extras confirmés&nbsp;» quand on a seulement envoyé le message.
      </p>
      <p>
        Dans WeboDevis, un devis validé devient un <Link href="/fonctionnalites/evenements">événement</Link> qui porte sa checklist, son matériel, sa liste de courses et ses <Link href="/fonctionnalites/extras">extras</Link>. Chaque extra dispose d’un lien où il retrouve ses missions.
      </p>
    </>
  );
}
