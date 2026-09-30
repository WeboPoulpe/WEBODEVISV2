import Link from 'next/link';

// Guide : calculer les quantités par convive.
// Les grammages donnés sont des repères de métier à ajuster, pas des normes : le texte le dit.
export default function QuantitesParConvive() {
  return (
    <>
      <p>
        Trop peu, et le buffet est vide à 21 h 30. Trop, et la marge part à la poubelle. Entre les deux, il n’y a pas de formule magique, mais il y a une méthode&nbsp;: raisonner par convive, écrire le calcul une fois, et le corriger après chaque événement.
      </p>

      <h2>Partir de ce qui arrive dans l’assiette</h2>
      <p>
        La première erreur consiste à confondre la portion servie et la quantité achetée. Ce que vous servez est un poids net&nbsp;: la viande parée et cuite, le légume épluché, le poisson sans arêtes. Ce que vous achetez est un poids brut. Entre les deux, il y a les pertes&nbsp;: épluchage, parage, désossage, réduction à la cuisson.
      </p>
      <p>Le passage de l’un à l’autre tient en une ligne&nbsp;:</p>
      <p className="site-formula">quantité à acheter par convive = portion servie ÷ rendement</p>
      <p>
        Le rendement est la part du produit acheté qui finit réellement dans l’assiette. Si un kilo d’asperges vous donne 600 g après épluchage et parage, le rendement est de 60 %. Pour servir 80 g par convive, il faut donc en acheter 80 ÷ 0,6, soit environ 135 g.
      </p>
      <p>
        Ce rendement dépend de votre fournisseur, de la saison et de votre façon de travailler. Le seul chiffre fiable est celui que vous mesurez&nbsp;: pesez avant, pesez après, notez-le sur la fiche de la prestation.
      </p>

      <h2>Des repères pour démarrer</h2>
      <p>
        Si vous n’avez pas encore vos propres chiffres, voici des ordres de grandeur couramment utilisés par les traiteurs pour un repas assis, en poids brut par adulte. Ce sont des points de départ, pas des règles&nbsp;: ajustez-les à votre cuisine et à votre clientèle.
      </p>
      <table>
        <thead>
          <tr><th>Élément</th><th className="num">Par adulte</th></tr>
        </thead>
        <tbody>
          <tr><td>Viande sans os, en plat principal</td><td className="num">150 à 200 g</td></tr>
          <tr><td>Poisson en filet, en plat principal</td><td className="num">130 à 180 g</td></tr>
          <tr><td>Légumes d’accompagnement</td><td className="num">150 à 250 g</td></tr>
          <tr><td>Féculents secs (riz, pâtes, semoule)</td><td className="num">60 à 80 g</td></tr>
          <tr><td>Fromage, en plateau</td><td className="num">40 à 70 g</td></tr>
          <tr><td>Pièces salées, apéritif avant un repas</td><td className="num">4 à 6 pièces</td></tr>
          <tr><td>Pièces, cocktail dînatoire</td><td className="num">15 à 20 pièces</td></tr>
        </tbody>
      </table>
      <p>
        Les fourchettes sont larges parce que tout dépend de ce qu’il y a autour. Une viande servie après un cocktail copieux et une entrée n’a pas besoin du même grammage qu’un plat unique.
      </p>

      <h2>Ce qui fait bouger les quantités</h2>
      <ul>
        <li><strong>Le format.</strong> À l’assiette, vous maîtrisez la portion. Au buffet, les premiers se servent largement&nbsp;: il faut plus de volume, et des plats qui restent présentables quand ils sont à moitié vides.</li>
        <li><strong>La durée.</strong> Un cocktail d’une heure et un cocktail de trois heures n’ont rien à voir. Comptez en pièces par convive et par heure plutôt qu’en pièces tout court.</li>
        <li><strong>Le nombre de services.</strong> Plus il y a de plats, plus chaque portion peut être réduite.</li>
        <li><strong>L’heure et la saison.</strong> Un déjeuner de séminaire en juillet ne se mange pas comme un dîner de mariage en novembre.</li>
        <li><strong>Le public.</strong> Un club de rugby et un comité de direction ne vident pas le même buffet. Posez la question à votre client.</li>
      </ul>

      <h2>Les enfants se comptent à part</h2>
      <p>
        Additionner adultes et enfants dans un seul chiffre fausse tout&nbsp;: les quantités, et souvent le prix. Demandez les deux nombres dès la demande de devis. Pour les enfants, deux approches existent&nbsp;: une portion réduite du menu adulte, ou un menu enfant distinct avec sa propre fiche. La seconde est plus simple à chiffrer et à produire.
      </p>

      <h2>La marge de sécurité, une seule fois</h2>
      <p>
        Prévoir un peu plus est sain. Le faire à chaque étape ne l’est pas&nbsp;: si le cuisinier arrondit la recette, puis l’acheteur arrondit la commande, puis le chef ajoute «&nbsp;au cas où&nbsp;», vous vous retrouvez avec 25 % de trop sans que personne ne l’ait décidé.
      </p>
      <p>
        Fixez la marge de sécurité à un seul endroit, de préférence sur la quantité par convive de la fiche, et faites-la varier selon le produit. Elle a du sens sur ce qui ne se refait pas sur place, comme une viande longuement cuite. Elle en a beaucoup moins sur ce qui se complète facilement.
      </p>

      <h2>Un exemple, du début à la fin</h2>
      <p>
        Prenons un dîner de mariage pour 120 adultes, avec un filet de bœuf, des pommes grenaille et des asperges vertes. Les quantités par convive sont celles de la fiche, en poids à acheter.
      </p>
      <table>
        <thead>
          <tr><th>Ingrédient</th><th className="num">Par convive</th><th className="num">Pour 120</th></tr>
        </thead>
        <tbody>
          <tr><td>Filet de bœuf</td><td className="num">180 g</td><td className="num">21,6 kg</td></tr>
          <tr><td>Pommes grenaille</td><td className="num">200 g</td><td className="num">24 kg</td></tr>
          <tr><td>Asperges vertes</td><td className="num">135 g</td><td className="num">16,2 kg</td></tr>
          <tr><td>Crème liquide</td><td className="num">5 cl</td><td className="num">6 L</td></tr>
        </tbody>
      </table>
      <p>
        Le calcul est une multiplication. Ce qui demande du métier, c’est la colonne du milieu. Une fois qu’elle est juste, passer de 120 à 95 convives parce que le client a revu sa liste ne prend plus une soirée&nbsp;: il suffit de changer un nombre.
      </p>

      <h2>Écrire la fiche une fois, la corriger souvent</h2>
      <p>
        Une quantité par convive qui reste dans la tête du chef ne sert qu’au chef. Écrite sur la fiche de la prestation, elle sert à celui qui commande, à celui qui prépare et à celui qui chiffre le devis.
      </p>
      <p>
        Après chaque événement, notez ce qui est revenu en cuisine. Trois plateaux de fromage intacts ou un plat de légumes vide au bout de vingt minutes sont de meilleures sources que n’importe quel tableau. Corrigez la fiche dans la foulée&nbsp;: dans six mois, vous ne vous en souviendrez plus.
      </p>
      <p>
        C’est le principe de la <Link href="/fonctionnalites/liste-de-courses">liste de courses de WeboDevis</Link>&nbsp;: chaque prestation porte ses ingrédients et leur quantité par convive, et la liste d’un événement se calcule à partir des prestations de son devis. Pour la suite, voyez le guide <Link href="/guides/liste-de-courses-evenement">Préparer la liste de courses d’un événement</Link>.
      </p>
    </>
  );
}
