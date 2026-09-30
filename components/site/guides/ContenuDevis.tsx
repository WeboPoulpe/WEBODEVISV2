import Link from 'next/link';

// Guide : ce que doit contenir un devis de traiteur.
// Aucune mention légale ni taux n'est affirmé : le texte renvoie au comptable pour ces points.
export default function ContenuDevis() {
  return (
    <>
      <p>
        Le devis est souvent le premier document que votre client lit vraiment. Il le compare à deux ou trois autres, le montre à sa famille ou à sa direction, et s’en sert le jour où un désaccord apparaît. Un bon devis répond sans ambiguïté à trois questions&nbsp;: qu’est-ce que j’aurai, quand, et pour combien.
      </p>

      <h2>L’en-tête&nbsp;: qui, pour qui, pour quel événement</h2>
      <p>Avant les plats, le devis doit situer l’affaire. On y trouve&nbsp;:</p>
      <ul>
        <li>vos coordonnées complètes et celles de votre client, particulier ou entreprise, avec le nom de la personne qui décide&nbsp;;</li>
        <li>la date du devis et un numéro ou une référence, pour s’y retrouver quand il y aura une deuxième version&nbsp;;</li>
        <li>l’événement lui-même&nbsp;: sa nature, sa date, ses horaires, son lieu&nbsp;;</li>
        <li>le nombre de convives, en séparant les adultes et les enfants.</li>
      </ul>
      <p>
        Le nombre de convives mérite une phrase à lui. Écrivez que le devis est établi pour ce nombre, et jusqu’à quelle date le client peut le modifier. C’est la source de litige la plus fréquente, et la plus facile à éviter.
      </p>

      <h2>Les prestations, dans l’ordre où elles seront servies</h2>
      <p>
        Suivez le déroulé de la réception&nbsp;: cocktail, entrée, plat, fromage, dessert, boissons. Le client se projette, et vous vérifiez en même temps que rien ne manque.
      </p>
      <p>
        Chaque prestation se décrit en une ou deux lignes. Assez précis pour qu’on sache ce qu’on achète («&nbsp;douze pièces salées par convive, dont quatre chaudes&nbsp;»), assez sobre pour rester lisible. Indiquez ce qui est compris et qu’on oublie facilement&nbsp;: le pain, le café, l’eau, la mise en place du buffet.
      </p>

      <h2>Tout ce qui entoure l’assiette</h2>
      <p>
        Deux devis au même prix par convive peuvent cacher des prestations très différentes. Ce qui n’est pas écrit sera supposé compris par le client, et supposé en supplément par vous. Détaillez donc&nbsp;:
      </p>
      <ul>
        <li><strong>le personnel</strong>&nbsp;: combien de personnes, pour quelles fonctions, sur quelle plage horaire, et ce qui se passe si la soirée se prolonge&nbsp;;</li>
        <li><strong>le matériel</strong>&nbsp;: vaisselle, verrerie, nappage, mobilier, et qui s’occupe du retour et de la casse&nbsp;;</li>
        <li><strong>la livraison et l’installation</strong>&nbsp;: déplacement, montage, rangement, enlèvement des déchets&nbsp;;</li>
        <li><strong>ce que vous attendez du lieu</strong>&nbsp;: un point d’eau, une alimentation électrique, un espace pour travailler.</li>
      </ul>

      <h2>Les prix&nbsp;: dire l’unité, séparer les options</h2>
      <p>
        Pour chaque ligne, le client doit comprendre comment le prix est calculé&nbsp;: par convive, à la pièce, ou au forfait. Un prix par convive sans le nombre de convives à côté ne veut rien dire.
      </p>
      <ul>
        <li><strong>Le prix enfant</strong> s’indique à part, avec le nombre d’enfants.</li>
        <li><strong>Les options</strong>, comme une animation culinaire ou un bar à cocktails, s’affichent hors du total. Le client voit ce qu’il ajoute s’il les retient, et votre total reste comparable à celui des autres devis.</li>
        <li><strong>Ce que vous offrez</strong> gagne à apparaître comme une ligne «&nbsp;inclus&nbsp;» plutôt qu’à disparaître&nbsp;: un geste commercial qu’on ne voit pas ne sert à rien.</li>
        <li><strong>Les totaux</strong> se présentent hors taxes, puis avec la TVA, puis toutes taxes comprises. Le taux à appliquer dépend de la nature de chaque prestation&nbsp;: faites-le valider par votre comptable.</li>
      </ul>

      <h2>Les conditions, en clair</h2>
      <p>C’est la partie que personne n’aime écrire, et celle qui vous protège. Un devis de traiteur précise au minimum&nbsp;:</p>
      <ul>
        <li>jusqu’à quelle date l’offre est valable&nbsp;;</li>
        <li>ce qui vaut confirmation&nbsp;: la signature, le versement d’un acompte, ou les deux&nbsp;;</li>
        <li>le montant de l’acompte, et quand le solde est dû&nbsp;;</li>
        <li>la date limite pour donner le nombre définitif de convives, et ce qui est facturé si ce nombre baisse ensuite&nbsp;;</li>
        <li>ce qui se passe en cas de report ou d’annulation&nbsp;;</li>
        <li>comment signaler les allergies et les régimes particuliers, et jusqu’à quand.</li>
      </ul>
      <p>
        Les mentions obligatoires d’un devis, les règles sur les acomptes et les conditions d’annulation relèvent du droit. Elles varient selon que votre client est un particulier ou une entreprise. Faites relire votre modèle par votre comptable ou un juriste, une fois, plutôt que de recopier celui d’un confrère.
      </p>

      <h2>Un exemple commenté</h2>
      <p>Voici les lignes d’un devis pour un mariage de 120 convives. Les montants sont fictifs&nbsp;; ce qui compte est la façon de les présenter.</p>
      <table>
        <thead>
          <tr><th>Ligne</th><th>Base</th><th className="num">Montant HT</th></tr>
        </thead>
        <tbody>
          <tr><td>Cocktail, douze pièces salées par convive</td><td>120 × 18 €</td><td className="num">2 160 €</td></tr>
          <tr><td>Dîner&nbsp;: entrée, plat et dessert</td><td>120 × 62 €</td><td className="num">7 440 €</td></tr>
          <tr><td>Service&nbsp;: maîtres d’hôtel et cuisiniers</td><td>forfait</td><td className="num">1 800 €</td></tr>
          <tr><td>Café et mignardises</td><td>inclus</td><td className="num">offert</td></tr>
          <tr><td>Option&nbsp;: bar à cocktails</td><td>forfait</td><td className="num">hors total</td></tr>
        </tbody>
      </table>
      <p>
        Chaque ligne dit sur quelle base elle est calculée. Le café offert se voit. L’option ne gonfle pas le total. Et si le client passe à 110 convives, il sait quelles lignes vont bouger.
      </p>

      <h2>Les erreurs qui coûtent cher</h2>
      <ul>
        <li><strong>Un prix global sans détail.</strong> Le client ne peut rien ajuster, donc il négocie tout.</li>
        <li><strong>Des options mêlées au total.</strong> Votre devis paraît plus cher que celui du voisin, à prestation égale.</li>
        <li><strong>Pas de date de validité.</strong> On vous ressort un prix de l’an dernier.</li>
        <li><strong>Le personnel «&nbsp;compris&nbsp;», sans horaires.</strong> La soirée finit à 4 h, et les heures sont pour vous.</li>
        <li><strong>Plusieurs versions qui circulent.</strong> Sans date ni référence, personne ne sait laquelle a été acceptée.</li>
      </ul>

      <h2>Gagner du temps sans bâcler</h2>
      <p>
        Un devis soigné prend du temps la première fois. Ensuite, l’essentiel se réutilise&nbsp;: vos prestations avec leur description et leur prix, vos conditions, votre mise en page. Partir d’un modèle et l’adapter à l’événement vaut mieux que repartir d’une page blanche, ou pire, d’un ancien devis dont on oublie de changer le nom.
      </p>
      <p>
        C’est ainsi que fonctionnent les <Link href="/fonctionnalites/devis-traiteur">devis dans WeboDevis</Link>&nbsp;: une création guidée, des prestations et des modèles réutilisables, puis un envoi par email avec un lien que le client ouvre en ligne. Et quand les demandes arrivent par votre site, elles peuvent entrer directement dans l’outil&nbsp;: voyez les <Link href="/fonctionnalites/demandes-de-devis">demandes de devis</Link>.
      </p>
    </>
  );
}
