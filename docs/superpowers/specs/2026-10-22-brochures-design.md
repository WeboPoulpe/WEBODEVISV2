# Module Brochures — conception

Date : 2026-10-22. Demandé par Maxence (WeboDevis v2, en bêta, sortie prévue le 1er décembre 2026).

## Intention

Un traiteur qui utilise WeboDevis doit pouvoir présenter son offre **avant tout devis** : un catalogue de ses
prestations, mis en page comme une belle brochure, qu'on **feuillette à l'écran comme un livre** (pages qui tournent)
et qu'on **envoie par un lien**. Aujourd'hui, l'appli n'a qu'un champ « URL brochure » saisi à la main sur la page
Prospects (un PDF fait ailleurs), et l'étape de pipeline « Brochure envoyée » existe sans outil derrière.

Le traiteur crée **plusieurs brochures** (par exemple « Mariages 2027 », « Entreprises », « Cocktails »), chacune à
partir de son catalogue : il pioche des prestations, l'appli les met en page toute seule, il retouche s'il veut. Il
l'envoie à **n'importe qui** : client, prospect, lieu de réception partenaire. À la fin du livre, la personne trouve
un **formulaire de demande** ; sa demande arrive dans les Prospects du traiteur.

« Clients » dans les échanges = **les traiteurs** utilisateurs de WeboDevis. Ceux qui reçoivent le lien sont appelés
ici « lecteurs ».

## Objectifs

1. Créer, nommer, dupliquer, supprimer plusieurs brochures par entreprise (équipe comprise, comme les devis).
2. Choisir pour chaque brochure **un style parmi trois** (maquettes validées par Maxence, voir
   `.superpowers/brainstorm/*/content/styles-brochure.html`) :
   - **Éditorial** : grande photo en couverture, une prestation par page, beaucoup d'air.
   - **Carte** : comme une carte de restaurant, prestations groupées par catégorie avec leurs prix, dense.
   - **Magazine** : photos en avant, textes courts, plusieurs prestations par page.
   Le traiteur peut changer de style à tout moment : le contenu reste, la mise en page suit.
3. Composer le contenu en **piochant des prestations du catalogue** (recherche, catégories, cocher), dans l'ordre
   voulu ; l'appli génère les pages selon le style.
4. **Retoucher** : textes d'une prestation propres à la brochure (sans toucher au catalogue), titres de section,
   photos, ordre ; ajouter/retirer des pages fixes.
5. Pages fixes proposées : **couverture** (photo, nom de l'entreprise, titre de la brochure, logo), **« qui
   sommes-nous »** (texte libre + photo), **contact** (coordonnées de l'entreprise), **formulaire de demande** (toujours
   la dernière page).
6. **Prix affichés ou non**, au choix par brochure ; s'ils sont affichés, **HT ou TTC au choix du traiteur**
   (Maxence). Le catalogue stocke des prix HT (`unit_price`, `child_unit_price`) : en TTC, la brochure applique un taux
   de TVA réglé sur la brochure (par défaut le taux par défaut de l'entreprise, `defaultVatRate`). La mention « HT »
   ou « TTC » accompagne toujours les prix.
7. **Lien public** à envoyer : lecture sans compte, feuilletage animé sur ordinateur (double page), page par page sur
   téléphone (glisser), lisible à 360 px de large.
8. **Envoi** depuis l'appli : copier le lien, ou envoyer par email (même mécanique que l'envoi de devis, `lib/mail`) ;
   depuis une demande de Prospects, l'envoi passe la demande à l'étape « Brochure envoyée ».
9. **Suivi** : comme le lien d'un devis, nombre d'ouvertures et date de dernière ouverture, visibles sur la brochure.
10. **Formulaire de fin** : mêmes champs et même enregistrement que le formulaire de prospection existant
    (`app/p/[token]`, table `prospect_requests`) ; la demande reçue indique de quelle brochure elle vient.

## Hors sujet (pour cette version)

- Export PDF de la brochure (le lien suffit ; l'impression navigateur peut venir plus tard).
- Traduction automatique de la brochure (le module de traduction des devis existe ; à brancher plus tard).
- Statistiques fines (temps par page, pages vues).
- Éditeur de mise en page libre façon WeboWord page par page : on retouche le contenu, pas la géométrie.
- Plus de trois styles, couleurs/polices personnalisées au-delà de celles de l'entreprise.

## À ne surtout pas faire (anti-objectifs)

- **Modifier le catalogue** en retouchant une brochure : les retouches restent dans la brochure.
- Un rendu qui fait « gabarit générique » ou « trop IA » : la direction artistique est celle de WeboDevis (crème,
  vert sapin, terracotta ; voir la mémoire « design-direction-webodevis »), sobre, beaucoup d'air, pas d'emojis.
- Un lien qui expose autre chose que la brochure (pas d'identifiants internes, pas de prix si masqués, pas d'accès
  aux autres données du traiteur).
- Un bouton en double pour la même action (règle de la direction artistique).

## Contraintes

- Pile existante : Next.js (app router), Neon Postgres via Drizzle, couche de compatibilité `createClient().from()`
  avec règles d'accès dans `server/compat/rules.ts`, stockage de fichiers Vercel Blob, emails Resend (`lib/mail`).
- Migrations **additives** seulement, testées sur PGlite (tests `server/*.test.ts`) puis `npm run db:migrate`
  avant tout envoi sur `main` (voir mémoire « build-before-push »).
- Les données du catalogue lues en direct : prix et photos à jour sans republier la brochure (voir « Contenu »).
- Mode démo (`lib/demo`) : un compte démo voit et crée des brochures mais n'envoie pas d'email.
- Disque de la machine de dev très plein (≈ 1 Go libre) : éviter les nouvelles dépendances lourdes.

## Décisions prises avec Maxence

- Feuilletage animé type livre, envoi par lien, plusieurs brochures. (Maxence)
- Contenu = prestations du catalogue mises en page automatiquement, retouchables. (Maxence)
- Les trois styles, au choix du traiteur pour chaque brochure. (Maxence)
- Formulaire en dernière page. (Maxence)
- Prix au choix, pages couverture / qui sommes-nous / contact, suivi des ouvertures, étape « Brochure envoyée » :
  proposés par Claude, validés par Maxence (« c'est good »).

## Contenu et données (choix de Claude, à confirmer en relisant)

- Nouvelle table `brochures` : `id`, `owner_user_id`, `user_id`, `name`, `style` (`editorial` | `carte` | `magazine`),
  `show_prices`, `price_mode` (`ht` | `ttc`), `vat_rate`, `language` (`fr` | `en`), `is_active`,
  `share_token` (unique, aléatoire), `content` (jsonb : liste ordonnée de pages/sections, voir
  ci-dessous), `cover` (jsonb : photo, titre, sous-titre), `view_count`, `viewed_at`, `created_at`, `updated_at`.
  Règles d'accès : équipe de l'entreprise, comme `devis_templates` ; lecture publique uniquement par une page serveur
  qui lit par `share_token` (pas via `/api/db`).
- `content` référence les prestations **par identifiant** (lecture en direct : nom, description ou fiche de carte,
  prix, photo, catégorie) et garde à côté les **retouches propres à la brochure** (texte de remplacement, photo de
  remplacement, prix masqué pour cette prestation). Une prestation supprimée du catalogue disparaît de la brochure,
  et l'éditeur le signale.
- Sections : titre de section (par défaut la catégorie de la prestation), puis ses prestations. Le style décide de la
  pagination (une prestation par page en Éditorial ; remplissage par catégorie en Carte ; grilles en Magazine).
- Texte d'une prestation : sa fiche de carte (`gastro_card_html`) si elle existe, sinon nom + description ; en style
  Carte, version courte (nom, première ligne de description, prix).
- Photos : `prestations.photo_url`, la banque de photos de l'entreprise (`user_photo_categories` et ses photos), ou
  un envoi (Vercel Blob, comme les pages photos de WeboWord).
- `prospect_requests` : nouvelle colonne nullable `brochure_id` pour savoir d'où vient la demande.
- Le champ existant « URL brochure » de la page Prospects pourra proposer de choisir une brochure du module (son lien
  public) au lieu d'une adresse saisie à la main.

## Décisions de Claude après relecture (à vérifier par Maxence)

- **Unité des prix** : le catalogue n'a pas d'unité. « / pers. » est affiché pour une prestation tarifée au couvert,
  reconnue comme à l'ajout d'une prestation dans un devis (`addPrestation` de `WeboWordSidePanels` : catégorie hors
  matériel/personnel/logistique, nom sans « forfait », prix < 150 €) ; sinon le prix seul. Le prix enfant est affiché
  à côté (« enfant : … ») quand il existe.
- **Contenu = prestations du catalogue uniquement.** Les menus de la maquette (Tentation Prestige, Champêtre chic…) sont
  des prestations du catalogue. Les formules au choix des devis et les modèles de devis n'entrent pas dans les
  brochures.
- **Formulaire de fin indépendant du lien de prospection** : il marche même si le traiteur n'a pas de lien de
  prospection ou l'a désactivé. Envoi par une route dédiée qui lit la brochure par son `share_token` (active), crée la
  demande avec `owner_user_id` = propriétaire de la brochure, `user_token` null et `brochure_id` renseigné ; mêmes
  champs, mêmes contrôles anti-abus et mêmes notifications (et emails) que le formulaire existant.
- **Lien désactivable et remplaçable** : colonne `is_active` (activé par défaut) et action « Nouveau lien » qui change
  le `share_token` (l'ancien lien cesse de marcher). Lien désactivé, brochure supprimée ou jeton inconnu : page « Cette
  brochure n'est plus disponible », avec le nom et le contact de l'entreprise quand on les connaît.
- **Langue** : réglage par brochure, français ou anglais. En anglais, chaque prestation prend sa fiche anglaise
  (`gastro_card_html_en`) quand elle existe, sinon le texte français ; textes fixes de la brochure (titres, formulaire,
  mentions HT/TTC) dans la langue choisie. Pas de traduction automatique dans cette version.
- Les ouvertures par le traiteur connecté (aperçu) ne comptent pas dans le suivi.

## Écrans

1. **Liste des brochures** (nouvelle entrée de navigation « Brochures », à côté de Prospects) : cartes avec
   miniature de couverture, style, nombre d'ouvertures ; créer, dupliquer, supprimer.
2. **Éditeur de brochure** : à gauche la composition (pages fixes, sections, prestations cochées et ordonnées,
   réglages : style, prix affichés) ; à droite l'aperçu feuilletable en direct. Clic sur une prestation de l'aperçu :
   retouche de son texte/photo pour cette brochure.
3. **Envoyer** : copier le lien ; email (destinataire, message) ; choisir une demande de Prospects.
4. **Lien public** `/b/[token]` : le livre, sans en-tête de l'appli ; dernière page = formulaire ; message de
   confirmation après envoi.

## Laissé au constructeur

- La technique du feuilletage (CSS 3D maison ou petite bibliothèque), pourvu qu'elle soit fluide, accessible au
  clavier (flèches), avec repli « page par page » sur téléphone et en cas de mouvement réduit
  (`prefers-reduced-motion`).
- Le détail de la pagination de chaque style, les tailles de police, l'emplacement exact des contrôles.
- Le découpage en lots livrables (Maxence aime des passes courtes et visibles, testées sur téléphone).
