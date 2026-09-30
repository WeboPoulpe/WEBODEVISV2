import Link from 'next/link';

// Guide : préparer la liste de courses d'un événement, étape par étape.
export default function ListeDeCourses() {
  return (
    <>
      <p>
        La liste de courses est le moment où le devis devient de la marchandise. Faite trop tôt, elle sera fausse. Faite trop tard, elle se transforme en tournée de dépannage la veille de l’événement. Voici une façon de la construire qui tient en sept étapes, que vous travailliez sur papier, sur un tableur ou dans un logiciel.
      </p>

      <h2>1. Attendre le bon nombre de convives</h2>
      <p>
        Toute la liste découle d’un chiffre&nbsp;: le nombre de convives. Tant qu’il bouge, elle bouge avec lui. C’est pour cela que votre devis doit fixer une date limite de confirmation. Avant cette date, vous pouvez préparer la liste. Vous ne passez les commandes fermes qu’après.
      </p>
      <p>
        Les produits à long délai font exception&nbsp;: une pièce de viande particulière, un poisson à réserver, un fromage affiné. Ceux-là se commandent sur une estimation prudente, quitte à compléter.
      </p>

      <h2>2. Repartir du devis validé, pas de mémoire</h2>
      <p>
        Relisez la dernière version du devis, celle que le client a acceptée. Relevez chaque prestation, y compris les options finalement retenues et ce qui a été offert&nbsp;: un café «&nbsp;inclus&nbsp;» consomme autant de café qu’un café facturé.
      </p>

      <h2>3. Décomposer chaque prestation en ingrédients</h2>
      <p>
        Pour chaque prestation, listez les ingrédients et leur quantité par convive, en poids à acheter, pertes comprises. Multipliez par le nombre de convives. Si vous n’avez pas encore de fiche par prestation, c’est le moment de les écrire&nbsp;: le guide <Link href="/guides/calculer-quantites-par-convive">Calculer les quantités par convive</Link> explique comment.
      </p>
      <p>
        Comptez les enfants à part s’ils ont un menu différent ou une portion réduite.
      </p>

      <h2>4. Regrouper ce qui revient plusieurs fois</h2>
      <p>
        La crème apparaît dans le gratin, dans la sauce et dans le dessert. Le beurre est partout. Additionnez les quantités d’un même ingrédient pour n’avoir qu’une ligne par produit, dans une seule unité. Mélanger des grammes, des kilos et «&nbsp;trois bottes&nbsp;» sur la même liste est le meilleur moyen de se tromper au moment de commander.
      </p>

      <h2>5. Déduire ce que vous avez déjà</h2>
      <p>
        Avant d’acheter, regardez la réserve. L’épicerie sèche, les huiles, les fonds, les surgelés, le vin&nbsp;: une partie de la liste est peut-être déjà sur vos étagères. Déduisez-la, à une condition&nbsp;: que ce stock ne soit pas déjà promis à un autre événement de la semaine.
      </p>

      <h2>6. Arrondir au conditionnement</h2>
      <p>
        Vous avez besoin de 5,4 L de crème, et elle se vend par bidons de 5 L ou par briques d’un litre. Votre fournisseur livre les asperges par bottes, pas au gramme. Arrondissez chaque ligne à ce qui s’achète réellement. C’est ici, et seulement ici, que votre marge de sécurité se matérialise. Inutile d’en rajouter ensuite.
      </p>

      <h2>7. Répartir par fournisseur, et dater</h2>
      <p>Une liste utile ne se lit pas dans l’ordre des recettes, mais dans l’ordre des achats. Triez-la&nbsp;:</p>
      <ul>
        <li><strong>par fournisseur</strong>&nbsp;: le boucher, le primeur, le grossiste, la cave. Chaque groupe devient une commande&nbsp;;</li>
        <li><strong>par date</strong>&nbsp;: le sec et les boissons se commandent tôt, le frais au plus près, en tenant compte des jours de livraison de chacun&nbsp;;</li>
        <li><strong>par catégorie</strong> pour ce que vous achetez vous-même, afin de ne pas traverser trois fois le magasin.</li>
      </ul>
      <p>
        Notez pour chaque commande la date à laquelle elle doit être passée et celle où la marchandise doit arriver. Une commande oubliée se rattrape le mardi. Rarement le vendredi soir.
      </p>

      <h2>Quand plusieurs événements tombent la même semaine</h2>
      <p>
        Deux mariages et un séminaire en quatre jours, ce sont trois listes qui partagent la moitié de leurs lignes. Les traiter séparément, c’est passer trois commandes chez le même fournisseur et manquer les conditionnements avantageux. Fusionnez les listes par produit pour commander. Gardez le détail par événement pour préparer.
      </p>

      <h2>Le jour des achats et de la réception</h2>
      <p>
        Une liste sert jusqu’au bout si on la coche. Au marché ou chez le grossiste, cochez ce qui est pris. À la livraison, vérifiez les quantités et la qualité ligne par ligne, tant que le livreur est là. Une caisse manquante découverte le matin de l’événement n’a plus de solution simple.
      </p>
      <p>
        Gardez une trace des écarts&nbsp;: le produit remplacé, la quantité livrée en moins, le prix qui a changé. Ils vous serviront à corriger la fiche de la prestation, et à connaître le vrai coût de l’événement.
      </p>

      <h2>Ce que fait un outil à votre place</h2>
      <p>
        Les étapes 3 et 4 sont du calcul pur&nbsp;: multiplier, additionner, convertir. C’est là qu’un tableur ou un logiciel fait gagner le plus de temps et évite le plus d’erreurs. Votre jugement reste nécessaire pour le reste&nbsp;: le bon moment, le bon fournisseur, la qualité à la réception.
      </p>
      <p>
        Dans WeboDevis, la <Link href="/fonctionnalites/liste-de-courses">liste de courses</Link> d’un événement se calcule à partir des prestations de son devis et des quantités par convive, puis se coche depuis le téléphone. Le <Link href="/fonctionnalites/stock-et-fournisseurs">stock et les fournisseurs</Link> sont suivis dans le même outil.
      </p>
    </>
  );
}
