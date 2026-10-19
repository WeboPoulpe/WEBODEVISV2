# Sortie v0.1 (1er décembre 2026) : facturation et conformité

Date : 2026-10-19. Décisions de Maxence prises le même jour, après l'audit complet du SaaS.

Ce document couvre la liste « indispensable avant la sortie ». La sécurité urgente est déjà faite (commit `c75d240`, en production).

| # | Chantier | Base de données | État |
|---|---|---|---|
| 0 | Base de développement (branche Neon) | — | **à faire par Maxence** |
| 1 | TVA par ligne | non (JSON des lignes) | en cours |
| 2 | Numérotation des devis et factures, préfixe réglable | oui | à faire |
| 3 | Identité légale du traiteur (TVA intracom., RCS, IBAN…) | oui (colonnes existantes en partie) | à faire |
| 4 | Factures : acompte, solde, avoir, Factur-X | oui | à faire |
| 5 | Acceptation du devis en ligne (bon pour accord signé) | oui | à faire |
| 6 | Allergènes (règlement INCO) | oui | à faire |
| 7 | Pages légales, CGU/CGV du logiciel, RGPD | oui (suppression, export) | infos à fournir par Maxence |

## 0. Prérequis : une base de développement

Aujourd'hui `.env.local` pointe sur la base Neon **de production**. Chaque essai en local écrit donc dans les données réelles, et Claude Code n'a pas le droit d'y accéder en mode automatique. Les chantiers 2 à 7 ajoutent des tables et des colonnes.

- Créer une **branche Neon** `dev`, qui est une copie instantanée de la production. Sur l'offre gratuite, ça ne coûte rien.
- Mettre son URL dans `.env.local` (`DATABASE_URL`, `DATABASE_URL_POOLED`), et garder l'URL de production ailleurs, par exemple dans `.env.production.local`, non versionné.
- Les migrations (`npm run db:migrate`) sont d'abord jouées sur `dev`. Elles ne sont appliquées en production qu'au moment de la mise en ligne, sur demande de Maxence.

## 1. TVA par ligne

- Chaque ligne de `quotes.services` (JSON) reçoit un champ optionnel `vatRate`. S'il est absent, la ligne prend le taux du devis, qui devient le « taux par défaut du devis ». Les devis existants ne changent pas d'un centime.
- Tous les calculs passent par une seule fonction de `lib/quoteTotals.ts`. Elle donne la ventilation par taux, avec la TVA calculée par taux sur la base HT de ce taux et arrondie au centime.
- Le document affiche « Total HT », puis une ligne « TVA x % » par taux présent, puis « Total TTC ».
- Plus tard, une prestation du catalogue pourra porter son propre taux par défaut, par exemple 20 % pour les boissons alcoolisées et la location. Ça demande une colonne sur `prestations` et viendra après la branche `dev`.

## 2. Numérotation

**Le problème aujourd'hui :** le déclencheur `set_quote_number` donne `AAAA-0001` en prenant le maximum sur **tous les comptes**. Résultat : les numéros ne sont pas propres à chaque traiteur, ils laissent deviner le volume des autres, et deux créations simultanées peuvent obtenir le même numéro. En plus, le numéro n'est affiché nulle part.

**La solution :**
- Une table `document_counters (owner_user_id, kind, year, last_value)` avec la clé primaire `(owner_user_id, kind, year)`. Le numéro est pris par `insert … on conflict do update set last_value = last_value + 1 returning last_value`, **dans la même transaction** que l'insertion du document. Si l'insertion échoue, le compteur revient en arrière : il n'y a jamais de trou.
- Le compteur appartient à l'entreprise : le compte parent si le compte est rattaché (`parent_user_id`), sinon le compte lui-même.
- Le format est réglable dans Paramètres, dans une nouvelle section « Numérotation », et stocké dans `profiles.numbering` (jsonb) :
  - préfixe libre (par défaut `D-` pour les devis, `F-` pour les factures, `AV-` pour les avoirs) ;
  - année incluse, oui ou non (par défaut oui ; le compteur repart alors à 1 chaque année) ;
  - nombre de chiffres (par défaut 4).
  - Un aperçu affiche le prochain numéro.
- Pour les factures, le préfixe peut changer, mais seulement pour les factures **futures** : un numéro émis ne change jamais.
- Les devis existants gardent leur numéro actuel. Le compteur de chaque compte part de 0.
- Le numéro s'affiche :
  - sur le document : « Devis n° D-2026-0007 » ;
  - dans la liste des devis, où l'on peut aussi le rechercher ;
  - sur la page publique ;
  - dans l'email d'envoi.
- Le déclencheur global est remplacé par une fonction `next_document_number(owner, kind)` appelée par le déclencheur `before insert` de `quotes`.

## 3. Identité légale du traiteur

Nouvelle section « Mentions légales de vos documents » dans Paramètres :
- forme juridique et capital ;
- RCS ou RM, avec la ville ;
- n° de TVA intracommunautaire, ou case « TVA non applicable, art. 293 B du CGI » pour les micro-entreprises en franchise ;
- IBAN et BIC (les colonnes `company_iban` et `company_bic` existent déjà) ;
- conditions de paiement par défaut (délai en jours, pénalités) ;
- pourcentage d'acompte par défaut (30 % proposé).

Ces champs alimentent le pied de page des devis et des factures. Les doublons de colonnes (`company_siret`/`siret`…) sont lus avec une préférence fixe, sans être supprimés pour l'instant.

## 4. Factures

### Données
L'ancienne table `invoices` (v1) est supprimée en cascade avec son devis et porte un numéro unique sur toute la plateforme. Elle est renommée `legacy_invoices` et n'est plus utilisée. Les nouvelles tables :

- **`invoices`** :
  - `id`, `owner_user_id`, `quote_id` (`on delete restrict`), `kind` (`acompte` | `solde` | `facture` | `avoir`), `credited_invoice_id` (pour un avoir), `number` (vide tant que la facture est un brouillon), `status` (`brouillon` | `emise` | `payee_partiellement` | `payee` | `annulee_par_avoir`) ;
  - `issue_date`, `due_date`, `service_date` (date de l'événement) ;
  - un **instantané figé** au moment de l'émission : vendeur, client (nom, adresse, SIRET et n° TVA si c'est une entreprise), `lines` (jsonb : désignation, quantité, PU HT, taux de TVA, total HT), totaux HT, TVA et TTC, ventilation par taux, mentions ;
  - `pdf_url` (Vercel Blob, PDF Factur-X archivé à l'émission), `created_at`, `issued_at`.
- **`invoice_payments`** : `invoice_id`, `date`, `amount`, `method` (virement, chèque, espèces, carte, autre), `note`.

### Règles légales
- **Numérotation chronologique et continue**, attribuée seulement à l'**émission**. Un brouillon n'a pas de numéro et peut être supprimé.
- **Une facture émise ne se modifie pas et ne se supprime pas.** On l'annule par un **avoir**, qui a son propre numéro, référence la facture et reprend ses lignes en négatif. La couche d'accès refuse `update` et `delete` sur une facture émise, en dehors du statut de paiement.
- **Mentions obligatoires :**
  - n°, date, vendeur complet (SIRET, TVA intracom. ou mention 293 B), client ;
  - date de la prestation, désignation, quantités, PU HT, taux et montant de TVA par taux, totaux ;
  - date d'échéance, pénalités de retard et indemnité forfaitaire de 40 € pour les professionnels ;
  - escompte : « pas d'escompte pour paiement anticipé » ;
  - à partir de 2026, catégorie de l'opération (« prestation de services ») et adresse de livraison si elle diffère.
- **Facture d'acompte :** un pourcentage ou un montant du devis, avec la TVA ventilée au prorata. **Facture de solde :** le total du devis moins les acomptes déjà facturés, rappelés en déduction avec leur numéro.

### Interface
- Sur un devis confirmé : bouton « Facturer », avec le choix « Acompte (30 %) », « Solde » ou « Facture complète ». Un brouillon prérempli s'ouvre, on vérifie, puis on clique sur « Émettre ».
- Une page **Factures** dans la barre latérale : liste, filtres (à encaisser, en retard, payées), totaux, et « Enregistrer un paiement ».
- Envoi par email avec le PDF joint et le lien public, comme pour le devis.
- Export CSV des factures (et des paiements) pour le comptable, sur une période. L'export FEC vient plus tard.

### Factur-X
- Le PDF de facture est **généré côté serveur** avec `pdf-lib`, en mise en page simple et sobre aux couleurs de l'app, et non par l'impression du navigateur, qui ne peut pas embarquer de pièce jointe.
- On y joint `factur-x.xml` (CII, profil **EN 16931**) avec les métadonnées XMP Factur-X, au format PDF/A-3. Le fichier est archivé sur Blob à l'émission et n'est jamais régénéré.
- La validation se fait avec un validateur Factur-X (Mustang ou FNFE-MPE) sur un jeu de factures types : acompte, solde, avoir, plusieurs taux, client particulier et client entreprise.
- **Plus tard :** branchement à une plateforme agréée (PDP). L'émission électronique devient obligatoire pour les PME et micro-entreprises en septembre 2027.

## 5. Acceptation du devis en ligne

Sur `/d/[token]`, un bloc « Accepter ce devis » propose :
- nom et prénom du signataire, et qualité s'il s'agit d'une entreprise ;
- la case « J'ai lu et j'accepte le devis et les conditions générales de vente », avec un lien vers les CGV du traiteur ;
- une **signature tracée** au doigt ou à la souris (canvas, enregistrée en PNG sur Blob) ;
- le bouton « Accepter et signer ».

À la validation :
- `quote_acceptances` enregistre `quote_id`, nom, qualité, signature, IP, navigateur, horodatage serveur, et **l'empreinte SHA-256 du devis accepté** (lignes, totaux, conditions) : on peut ainsi prouver ce qui a été signé ;
- le devis passe au statut `valide`, et le traiteur reçoit une notification et un email ;
- le client reçoit une confirmation avec un récapitulatif ;
- si le traiteur modifie le devis après la signature, l'acceptation est marquée « porte sur une version précédente » et le statut repasse à `devis_envoye`, avec un avertissement avant l'enregistrement ;
- le document imprimé affiche « Accepté le … par … » avec la signature, à la place de l'encart vide « Bon pour accord ».

À côté :
- **Validité :** une colonne `valid_until` (par défaut à J+30, réglable dans Paramètres). Une fois la date passée, le bouton est remplacé par « Ce devis a expiré, contactez … ».
- **Suivi :** `viewed_at` (première ouverture) et le nombre de consultations sont affichés au traiteur.
- **Limite :** 5 tentatives d'acceptation par heure et par jeton.
- **Plus tard :** paiement de l'acompte en ligne (Stripe), après l'acceptation.

## 6. Allergènes

Les 14 allergènes réglementaires : gluten, crustacés, œufs, poissons, arachides, soja, lait, fruits à coque, céleri, moutarde, sésame, sulfites, lupin, mollusques.
- `ingredients.allergens text[]`, saisis sur la fiche ingrédient par cases à cocher. Les ingrédients communs sont préremplis par l'admin.
- `prestations.allergens_extra text[]` pour ce qui n'est pas dans la recette, et `prestations.allergens_override` pour forcer la liste. Les allergènes d'une prestation sont l'union de ceux de ses ingrédients (`service_ingredients`) et de `allergens_extra`.
- Ils s'affichent :
  - dans l'éditeur de prestation (« Contient : … ») ;
  - en option sur le devis, par une icône ou une mention sous chaque plat ;
  - dans une **fiche allergènes** imprimable par devis ou par événement (tableau plats × allergènes), à remettre au client ou à afficher sur le buffet.
- Un avertissement apparaît si une prestation n'a ni recette ni allergènes renseignés : « Allergènes non renseignés ».

## 7. Légal du site, CGU/CGV du logiciel, RGPD

**À fournir par Maxence :** il ne faut rien inventer.
- Pour Webomax : SIRET, n° de TVA ou mention de franchise, adresse.
- Hébergeur : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. À confirmer.
- Le **texte des CGU/CGV** : trame à rédiger par Claude puis à relire, idéalement par un juriste. Elle couvre l'objet, l'accès, les données, la disponibilité, la responsabilité, la réversibilité, la durée et la résiliation, sans prix tant qu'ils ne sont pas décidés.
- **Contrat de sous-traitance des données (DPA, art. 28 RGPD) :** le traiteur est responsable du traitement des données de ses clients, et WeboDevis est sous-traitant. Ses sous-traitants ultérieurs sont Neon, Vercel et Resend.

**Dans l'app :**
- Une case obligatoire à l'inscription : « J'accepte les CGU et la politique de confidentialité ». La date et la version acceptées sont enregistrées.
- Paramètres → « Mes données » : **Exporter mes données** (archive ZIP de JSON et CSV de toutes les tables du compte, plus la liste des fichiers) et **Supprimer mon compte** (confirmation par mot de passe, délai de 30 jours, puis suppression des lignes et des fichiers Blob).
- Une purge planifiée (cron) supprime les jetons de réinitialisation expirés, les notifications de plus de 12 mois et les demandes du site de plus de 3 ans.

## Ordre de réalisation

1. TVA par ligne (en cours, sans base).
2. **Branche Neon `dev`.** Ça bloque la suite.
3. Numérotation et identité légale : une seule migration, base des factures.
4. Factures, sans Factur-X, puis Factur-X et sa validation.
5. Acceptation en ligne.
6. Allergènes.
7. Légal et RGPD, dès que Maxence a fourni les informations.

Chaque chantier fait l'objet d'un ou plusieurs commits livrables, avec des tests vitest pour les calculs et les règles d'accès (PGlite) et des tests Playwright pour les parcours. Les migrations ne sont appliquées en production qu'à la mise en ligne, sur demande.
