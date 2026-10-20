import Link from 'next/link';

// Guide : l'information sur les allergènes due aux clients d'un traiteur. Général et prudent : la liste des
// 14 allergènes est celle de l'annexe II du règlement (UE) n° 1169/2011 ; pour le reste, le texte renvoie
// aux sources officielles, sans adresse inventée ni conseil juridique.
export default function AllergenesTraiteur() {
  return (
    <>
      <p>
        Un convive allergique ne peut pas lire l’étiquette d’un plat servi sur un buffet. C’est au traiteur de lui dire ce que contiennent ses plats. La règle tient en peu de mots&nbsp;; la tenir à jour demande surtout de la méthode.
      </p>

      <h2>Les 14 allergènes à déclarer</h2>
      <p>
        La liste est fixée au niveau européen, à l’annexe II du règlement (UE) n° 1169/2011 concernant l’information des consommateurs sur les denrées alimentaires, dit règlement «&nbsp;INCO&nbsp;». Ce sont&nbsp;:
      </p>
      <ol>
        <li>les céréales contenant du gluten (blé, seigle, orge, avoine, épeautre, kamut)&nbsp;;</li>
        <li>les crustacés&nbsp;;</li>
        <li>les œufs&nbsp;;</li>
        <li>les poissons&nbsp;;</li>
        <li>les arachides&nbsp;;</li>
        <li>le soja&nbsp;;</li>
        <li>le lait, y compris le lactose&nbsp;;</li>
        <li>les fruits à coque (amandes, noisettes, noix, noix de cajou, de pécan, du Brésil, de macadamia, pistaches)&nbsp;;</li>
        <li>le céleri&nbsp;;</li>
        <li>la moutarde&nbsp;;</li>
        <li>les graines de sésame&nbsp;;</li>
        <li>l’anhydride sulfureux et les sulfites, au-delà d’un seuil fixé par le règlement&nbsp;;</li>
        <li>le lupin&nbsp;;</li>
        <li>les mollusques.</li>
      </ol>
      <p>
        L’annexe prévoit quelques exceptions pour des produits dérivés très transformés. Elles concernent surtout l’industrie&nbsp;; dans le doute, déclarez.
      </p>

      <h2>Ce qui vaut pour un traiteur</h2>
      <p>
        Le règlement INCO impose d’informer le consommateur de la présence de ces allergènes, y compris pour les denrées non préemballées&nbsp;: les plats servis, les buffets, les préparations faites à la demande. Un traiteur est donc concerné, qu’il serve sur place ou qu’il livre.
      </p>
      <p>
        En France, un décret de 2015 précise comment cette information est donnée pour les denrées non préemballées. Elle se donne par écrit, de façon lisible&nbsp;; elle peut aussi se donner oralement, à condition qu’un affichage indique clairement au client qu’il peut l’obtenir. Dans les deux cas, l’information doit être exacte et disponible au moment où le client en a besoin, pas après le repas.
      </p>
      <p>
        Pour un traiteur, la solution la plus sûre reste l’écrit&nbsp;: une fiche remise avec le menu, et la même fiche affichée près du buffet.
      </p>

      <h2>Du produit au plat&nbsp;: tenir l’information à jour</h2>
      <p>
        Une fiche allergènes n’est juste que si chaque recette l’est. Les erreurs viennent rarement du plat principal, plutôt de ce qui l’accompagne&nbsp;:
      </p>
      <ul>
        <li><strong>Les produits achetés tout prêts.</strong> Un fond de sauce, une pâte, une charcuterie, une glace&nbsp;: lisez leur étiquette ou leur fiche technique, et reportez leurs allergènes dans la recette.</li>
        <li><strong>Les changements de fournisseur.</strong> Le même produit, chez un autre fournisseur, n’a pas toujours la même composition. Relisez la fiche à chaque changement.</li>
        <li><strong>Les finitions.</strong> Une huile de sésame, un éclat de noisette, un trait de sauce soja ajoutés au dressage comptent autant que la recette.</li>
        <li><strong>Les traces.</strong> Un plat préparé sur le même plan de travail qu’un autre peut en garder des traces. Si vous ne pouvez pas l’exclure, dites-le.</li>
      </ul>

      <h2>Sur un buffet</h2>
      <p>
        Sur un buffet, les invités se servent seuls. L’information doit donc être là sans qu’ils la demandent&nbsp;:
      </p>
      <ul>
        <li>nommez les plats sur le buffet comme sur la fiche, pour que l’invité les retrouve&nbsp;;</li>
        <li>affichez la fiche près des plats, à hauteur de lecture&nbsp;;</li>
        <li>briefez l’équipe&nbsp;: qui répond aux questions, et ce qu’on répond quand on ne sait pas («&nbsp;je vérifie&nbsp;», jamais «&nbsp;je pense que non&nbsp;»).</li>
      </ul>

      <h2>Demander au client, avant l’événement</h2>
      <p>
        La fiche informe les convives&nbsp;; elle ne remplace pas la question posée au client. Prévoyez-la dans votre devis&nbsp;: les allergies et régimes connus parmi les invités, et la date limite pour vous les signaler. Le guide <Link href="/guides/contenu-devis-traiteur">Ce que doit contenir un devis de traiteur</Link> en parle. Gardez ensuite les réponses par écrit, et adaptez les assiettes concernées.
      </p>

      <h2>Où vérifier</h2>
      <p>
        Le texte du règlement (UE) n° 1169/2011 est publié sur EUR-Lex, le site du droit de l’Union européenne. Les textes français sont sur Légifrance, et les fiches pratiques de la DGCCRF, sur economie.gouv.fr, expliquent ce qui est attendu des professionnels. Ce guide donne des repères, pas un avis juridique&nbsp;: en cas de doute, renseignez-vous auprès de ces sources ou de la direction départementale chargée de la protection des populations.
      </p>

      <h2>Dans WeboDevis</h2>
      <p>
        Les <Link href="/fonctionnalites/allergenes">allergènes</Link> se notent sur chaque ingrédient, avec des suggestions d’après son nom que vous confirmez. Vos prestations les reprennent depuis leur recette, vous les marquez comme vérifiées, et chaque événement a sa fiche allergènes à imprimer&nbsp;: les plats du menu en lignes, les 14 allergènes en colonnes.
      </p>
    </>
  );
}
