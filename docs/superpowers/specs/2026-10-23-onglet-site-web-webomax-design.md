# Onglet « Site web » : vente des services Webomax dans WeboDevis

Conception validée en conversation avec Maxence le 2026-10-23. Maquettes de travail dans `.superpowers/brainstorm/` (non versionnées).

## Pourquoi

Webomax, la micro-entreprise de Maxence, réalise des sites web (exemples : convivialwedding.fr, lepicure-rg.fr) et des logiciels sur mesure. Les traiteurs qui utilisent WeboDevis sont des clients tout trouvés. On veut un parcours de vente rapide dans l'app, qui donne envie et qui aboutit à **une demande de rappel**. Le projet se discute ensuite au téléphone avec Webomax.

L'argument central : **le site Webomax est relié à WeboDevis**. Le formulaire de demande de devis du site, que l'app sait déjà intégrer (option « Demandes de devis », `/prospects`), envoie chaque demande d'un visiteur directement dans les Demandes du traiteur.

## Objectifs

- Un onglet « Site web » dans le menu de l'app, visible des utilisateurs connectés de WeboDevis.
- Une page **vitrine d'abord**, la version A retenue par Maxence. Elle se lit dans cet ordre :
  1. un titre « Votre site web », avec le sous-titre « Conçu par Webomax, relié à vos devis » ;
  2. un bandeau sombre (vert sapin) « Les demandes de votre site arrivent ici », avec une phrase d'explication et **un seul** bouton d'action ;
  3. les réalisations : de grandes cartes avec capture d'écran, nom de domaine cliquable (nouvel onglet) et pastilles (« Mariages », « Restaurant », « Galerie », « Menus ») ;
  4. trois étapes : un échange, la maquette, la mise en ligne ;
  5. les **packs de sites** en trois cartes, celle du milieu mise en avant (fond sombre, pastille « Le plus demandé ») ;
  6. les **options** à ajouter ;
  7. un bloc **logiciels sur mesure**.
- Les packs et les prix fixés par Maxence :
  - **Essentiel, 1 500 €** : une page soignée (présentation, photos, coordonnées), le formulaire de devis relié à WeboDevis, la fiche Google et le référencement local, l'adresse .fr et l'hébergement.
  - **Vitrine, 2 500 €**, mis en avant : jusqu'à 6 pages (prestations, menus, galerie, avis…), le formulaire de devis relié, les brochures et menus en téléchargement, un référencement local soigné, l'adresse .fr et l'hébergement.
  - **Sur mesure, sur devis** : pages et design entièrement sur mesure, plusieurs langues, réservation, paiement ou espace client, accompagnement continu.
- Les options, sans prix : maintenance (mises à jour, sauvegardes, petites retouches chaque mois), photos, rédaction des textes pensés pour Google, traduction anglaise.
- Le bloc logiciels sur mesure : « un outil fait pour votre façon de travailler, l'outil qui manque à WeboDevis ». Il donne des exemples de besoins (planning de production, commandes, application pour vos clients), mais **aucun client réel n'est cité ou montré**. Maxence refuse en particulier qu'on montre l'app de la boulangerie de Saint-Lye. Le prix est « sur devis », avec un bouton « Décrire mon besoin ».
- Les visuels de départ des réalisations sont **des captures prises par le builder sur les sites en ligne**, convivialwedding.fr et lepicure-rg.fr, avec l'accord de Maxence. Elles sont faites avec Playwright, en version ordinateur et en version téléphone, puis converties en WebP et livrées comme valeur initiale du catalogue. Les pastilles sont « Mariages » et « Galerie » pour Convivial Wedding, « Restaurant » et « Menus » pour L'Épicure.
- **Un questionnaire de rappel** s'ouvre depuis le bouton du bandeau, un bouton de pack ou le bouton du bloc logiciel. Il arrive chez Maxence dans `/admin/demandes` et lui est envoyé par e-mail.
- **Le contenu est modifiable par Maxence depuis l'admin, sans passer par le code** : packs (nom, prix ou « sur devis », phrase, liste de ce qui est compris, mise en avant), options, réalisations (nom, adresse, capture, pastilles) et texte du bloc logiciel.

## Hors périmètre

- **Le paiement en ligne et l'acompte** : Maxence veut parler du projet avant toute chose.
- **L'annuaire public de traiteurs** sur webodevis.fr, façon Mariages.net, où des particuliers trouvent un traiteur. C'est un projet à part, à concevoir juste après celui-ci.
- La vente aux visiteurs du site public ou à des personnes sans compte WeboDevis : l'onglet vit seulement dans l'app.
- La fabrication des sites eux-mêmes. Webomax les réalise en dehors de WeboDevis.

## À ne surtout pas faire

- **Inventer des promesses** : pas de « gratuit », pas de délai chiffré comme « réponse sous 48 h », pas d'avis clients, pas d'autre prix que ceux donnés ci-dessus. Le seul engagement affiché est « Webomax vous rappelle pour parler de votre projet ».
- **Mettre le même bouton en double**, ou ajouter une bannière insistante ailleurs dans l'app. L'onglet est la seule entrée.
- **Faire une page « trop IA »**, simpliste ou générique. Elle suit la direction artistique de l'app (voir plus bas) et doit donner une impression sérieuse.
- Afficher l'onglet en mode démonstration (`/demo`, compte « Maison Verdier ») d'une façon qui laisserait partir une vraie demande. En démo, l'envoi est joué puis annulé, comme les autres écritures (`lib/demo.ts`).

## Le questionnaire

Il s'ouvre dans une fenêtre ou une page en étapes, avec une barre de progression (« Étape 1 sur 4 »). Il se souvient de ce qui a été cliqué pour l'ouvrir : pack Essentiel, Vitrine, Sur mesure, logiciel, ou rien de précis depuis le bandeau. Le choix reste modifiable dans le questionnaire.

1. **Le projet** : quel pack ou quel logiciel. Puis, pour un site, « Où en êtes-vous ? » : pas encore de site, un site à refaire, ou une simple page. Si le site est à refaire, un champ facultatif demande l'adresse actuelle.
2. **Ce que le site doit faire**, en choix multiples : vitrine, galerie photos, cartes et menus, formulaire de devis relié à WeboDevis (coché d'office), plusieurs langues, autre (texte libre). Les options (maintenance, photos, rédaction, traduction) se cochent ici. Pour un logiciel, cette étape devient un champ libre « Décrivez votre besoin ».
3. **Le style** : « Plutôt comme… » une des réalisations (cartes cliquables), ou « je ne sais pas encore ». Puis des couleurs ou des remarques en texte libre. Le logo du compte est rappelé s'il existe. Pour un logiciel, cette étape est sautée.
4. **Être rappelé** : nom, téléphone et e-mail, pré-remplis depuis le compte et modifiables. Puis le moment idéal pour l'appel (matin, après-midi, soir, peu importe) et un message libre facultatif.

Ensuite vient un écran de confirmation : « C'est envoyé. Webomax vous rappelle pour parler de votre projet. » Si le compte a déjà une demande en cours, la page le signale discrètement (« Votre demande du 12 novembre est bien reçue »), mais rien n'empêche d'en envoyer une autre.

**Le pré-remplissage** reprend ce que l'app connaît déjà : nom de l'entreprise, logo, nom, e-mail et téléphone du profil. Attention au piège du schéma : les colonnes réelles de `profiles` ne correspondent pas toutes au type `Profile` (logo, CGV). Il faut vérifier dans `db/schema/tables.ts`.

## Côté Maxence

- La demande s'enregistre dans **`site_requests`**, la table des demandes du site public déjà affichée dans `/admin/demandes`, avec un nouveau type `service`. Il faut y **ajouter** par migration additive :
  - le compte d'où vient la demande (`user_id`, facultatif, nul pour les demandes du site public) ;
  - les réponses du questionnaire en `jsonb` ;
  - la valeur `service` dans la contrainte de `kind`.
  
  Le champ `message`, obligatoire, reçoit un résumé lisible des réponses.
- Dans `/admin/demandes`, ce type est libellé « Site web / logiciel » (`app/admin/labels.ts`). Le détail montre les réponses rangées par étape et un lien vers le compte du traiteur.
- **Les e-mails** reprennent le modèle de `server/site.ts` : une notification aux administrateurs (ou à `CONTACT_EMAIL`), avec `replyTo` sur l'adresse du traiteur, et un accusé de réception au traiteur. Une adresse d'essai ne prévient personne (`isTestAddress`). Un envoi d'e-mail qui échoue ne fait pas échouer la demande.
- On limite les envois à quelques demandes par heure et par compte.
- **Le catalogue**, c'est-à-dire packs, options, réalisations et bloc logiciel, est stocké dans **`app_settings`** (une ligne JSON). Une nouvelle page d'admin permet de le modifier ; le plus naturel est de la placer à côté de `/admin/reglages`. Le contenu décrit dans ce document sert de valeur initiale. Les captures des réalisations se téléversent comme les autres images de l'app.
- **Une option de compte** `siteweb` (« Site web Webomax ») est ajoutée dans `lib/modules.ts`, active par défaut. Elle permet de masquer l'onglet chez un client qui a déjà son site chez Webomax. L'option suit la logique des autres : `routes` liste la page, et le menu cache ce qui n'est pas activé.

## Direction artistique

On applique celle de l'app (`app/globals.css`, `tailwind.config.ts`) :
- fond crème, cartes blanches, bandeau et carte mise en avant en vert sapin sombre ;
- accent terracotta pour le bouton et les prix, pastilles terracotta clair et sauge ;
- titres et prix en Bricolage Grotesque, texte en Instrument Sans.

La page doit rendre aussi bien sur téléphone, à 360 px : les cartes passent en une colonne et la carte mise en avant reste en premier ou au milieu, au choix du builder. Vérifier le rendu avec des captures avant de montrer à Maxence. Il teste sur son téléphone.

## Décisions prises par Claude (à relire par Maxence)

- Le nom de l'onglet est « Site web », comme dans sa demande, même si la page parle aussi de logiciels.
- On réutilise `site_requests` et `/admin/demandes` plutôt qu'un nouvel écran. On garde les trois statuts existants (nouvelle, en cours, traitée) ; le suivi plus fin passe par les notes d'administration. Les statuts « signé / abandonné » évoqués en conversation sont abandonnés pour rester simple.
- Le catalogue est modifiable dans l'admin plutôt qu'écrit en dur.
- L'option de compte `siteweb` est active par défaut.
- Le formulaire relié à WeboDevis est coché d'office à l'étape 2.
- **Les équipes** : seul le titulaire du compte, ou un gérant, voit l'onglet. Les employés (sous-comptes avec `profiles.parent_user_id`) ne le voient pas. L'option `siteweb` se lit sur le compte principal. La demande est rattachée à l'entreprise : `user_id` vaut le compte principal, et le nom de la personne qui l'a envoyée est gardé dans les réponses. La limite d'envois et le message « demande déjà reçue » se comptent par entreprise.
- **Les comptes existants** : `enabledModules()` ne prend les options standard que pour un compte sans liste enregistrée. Une migration ajoute donc `siteweb` à toutes les listes déjà enregistrées, pour que l'onglet soit bien visible partout dès le premier jour. Maxence le coupe ensuite compte par compte.
- **Le mode démonstration** : l'envoi fait semblant de réussir et n'enregistre rien, comme dans `server/brochureRequests.ts`. Aucun e-mail ne part.
- **« Demande en cours »** veut dire une demande au statut « nouvelle » ou « en cours ».

## Laissé au builder

- La place exacte de l'entrée dans le menu et le mégamenu (`lib/navMega.ts`, `components/layout/nav.ts`), ainsi que l'icône.
- La forme du questionnaire : grande fenêtre ou page dédiée, à condition qu'elle tienne bien sur téléphone.
- La forme exacte du JSON du catalogue et l'écran d'édition dans l'admin.
- Le texte des e-mails, dans le ton des modèles existants (`lib/mail/templates`).
