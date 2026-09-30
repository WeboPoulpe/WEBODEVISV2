import Link from 'next/link';

// Guide : calculer et suivre sa marge. Les montants de l'exemple sont fictifs ; aucun taux fiscal n'est donné.
export default function MargeTraiteur() {
  return (
    <>
      <p>
        Un agenda plein ne dit rien de ce qu’il reste à la fin du mois. Deux mariages facturés le même prix peuvent laisser l’un 4 000 €, l’autre 900 €, selon le menu, le lieu et le nombre d’extras. Pour le savoir, il faut compter, événement par événement.
      </p>

      <h2>Ce que coûte vraiment une prestation</h2>
      <p>Le coût d’un événement se range en quatre postes. Si l’un manque, la marge est fausse.</p>
      <ul>
        <li><strong>La matière.</strong> Tous les ingrédients, au prix d’achat hors taxes, pertes comprises. C’est le poste le mieux connu, et rarement le seul qui dérape.</li>
        <li><strong>Le personnel.</strong> Les extras en salle et en cuisine, avec les heures réellement faites, installation et rangement compris. Pensez aussi à vos propres heures&nbsp;: un événement qui vous mobilise trois jours n’a pas le même coût qu’un événement préparé en une matinée.</li>
        <li><strong>Le matériel et la location.</strong> Vaisselle, nappage, mobilier, matériel de cuisson, et la casse.</li>
        <li><strong>Le déplacement et la logistique.</strong> Véhicule, carburant, péages, temps de trajet, glace, consommables.</li>
      </ul>
      <p>
        Restent les frais fixes&nbsp;: laboratoire, assurances, véhicule, abonnements. Ils ne dépendent pas d’un événement en particulier, mais chaque événement doit en payer une part. Nous y revenons plus bas.
      </p>

      <h2>La marge brute, et comment la lire</h2>
      <p className="site-formula">marge brute = prix de vente hors taxes − coûts directs de l’événement</p>
      <p>
        Le taux de marge est cette marge divisée par le prix de vente hors taxes. Prenons un mariage de 120 convives, avec des montants d’exemple&nbsp;:
      </p>
      <table>
        <thead>
          <tr><th>Poste</th><th className="num">Montant HT</th></tr>
        </thead>
        <tbody>
          <tr><td>Prix de vente</td><td className="num">11 400 €</td></tr>
          <tr><td>Matière</td><td className="num">3 600 €</td></tr>
          <tr><td>Extras</td><td className="num">1 900 €</td></tr>
          <tr><td>Location et matériel</td><td className="num">900 €</td></tr>
          <tr><td>Déplacement</td><td className="num">300 €</td></tr>
          <tr><td><strong>Marge brute</strong></td><td className="num"><strong>4 700 €</strong></td></tr>
        </tbody>
      </table>
      <p>
        La marge brute est de 4 700 €, soit 41 % du prix de vente. Ce chiffre ne dit pas encore ce que vous gagnez&nbsp;: il dit ce que l’événement apporte pour payer vos frais fixes, puis vous rémunérer.
      </p>
      <p>
        Raisonnez toujours hors taxes. La TVA que vous facturez ne vous appartient pas, et celle que vous payez sur vos achats se traite à part. Les taux applicables à vos prestations et la façon de les déclarer sont à voir avec votre comptable.
      </p>

      <h2>Le coefficient, utile mais trompeur</h2>
      <p>
        Beaucoup de traiteurs fixent leurs prix en multipliant le coût matière par un coefficient. C’est rapide, et cela fonctionne tant que les prestations se ressemblent. Le coefficient devient trompeur dès que la part de main-d’œuvre change&nbsp;: des pièces cocktail façonnées une à une et un plat mijoté peuvent avoir le même coût matière et demander trois fois plus d’heures.
      </p>
      <p>
        Gardez le coefficient comme première estimation, et vérifiez avec le coût complet sur vos prestations les plus vendues. Ce sont elles qui font votre résultat.
      </p>

      <h2>Marge prévue, marge réelle</h2>
      <p>
        La marge du devis est une prévision. La vraie se connaît après l’événement, quand les factures des fournisseurs et les heures des extras sont arrivées. L’écart entre les deux est l’information la plus utile que vous puissiez produire. Il vient presque toujours des mêmes endroits&nbsp;:
      </p>
      <ul>
        <li>des convives ajoutés à la dernière minute et servis, mais jamais facturés&nbsp;;</li>
        <li>des heures d’extras qui dépassent, parce que le service a fini tard ou que le rangement a été sous-estimé&nbsp;;</li>
        <li>des achats de dépannage la veille, au prix fort&nbsp;;</li>
        <li>de la casse ou du matériel loué rendu en retard&nbsp;;</li>
        <li>une prestation «&nbsp;offerte&nbsp;» pour conclure la vente, dont le coût n’a pas été compté.</li>
      </ul>
      <p>
        Aucun de ces points n’est grave une fois. Répétés sur vingt événements, ils représentent un salaire.
      </p>

      <h2>Et les frais fixes&nbsp;?</h2>
      <p>
        Additionnez vos frais fixes de l’année et divisez-les par le nombre d’événements que vous réalisez, ou mieux, par votre chiffre d’affaires prévu. Vous obtenez la part que chaque événement doit couvrir avant de vous rapporter quoi que ce soit.
      </p>
      <p>
        Ce calcul donne un seuil&nbsp;: en dessous d’une certaine marge brute, un événement vous coûte de l’argent même s’il remplit l’agenda. Le connaître aide à refuser une affaire, ou à la renégocier, sans état d’âme.
      </p>

      <h2>Trois habitudes qui changent le résultat</h2>
      <ol>
        <li><strong>Chiffrez le coût avant d’envoyer le prix.</strong> Un devis parti sans estimation de coût est un pari.</li>
        <li><strong>Saisissez les dépenses au fil de l’eau.</strong> Reconstituer les coûts d’un mariage trois semaines après, de mémoire, ne marche pas.</li>
        <li><strong>Relisez la marge de chaque événement terminé.</strong> Cinq minutes suffisent. Notez ce qui a dérapé et corrigez la fiche de la prestation ou le prix.</li>
      </ol>
      <p>
        Dans WeboDevis, le <Link href="/fonctionnalites/suivi-financier">suivi financier</Link> d’un devis met en regard le chiffre d’affaires hors taxes, les coûts et la marge brute&nbsp;: vous saisissez une fois le coût de revient de chaque prestation, puis les frais propres à l’événement. Pour établir ce coût de revient, commencez par les quantités&nbsp;: voyez le guide <Link href="/guides/calculer-quantites-par-convive">Calculer les quantités par convive</Link>.
      </p>
    </>
  );
}
