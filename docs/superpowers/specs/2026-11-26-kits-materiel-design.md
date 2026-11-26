# Kits dans les modèles de matériel

## Intention
Un modèle de matériel (« Kit café ») peut être inclus dans d'autres modèles (« Brunch », « Mariage ») ; un modèle peut
contenir plusieurs kits. Dans un événement, onglet Matériel, on applique au choix un kit seul ou un modèle complet
(ses articles + ceux de tous ses kits). Évite de ressaisir le même matériel dans chaque type de réception.

## Décisions (Maxence)
- Lien vivant : modifier le Kit café modifie tous les modèles qui l'incluent.
- Un même article présent dans plusieurs kits : les quantités s'additionnent (ce que fait déjà `mergeIncoming`).

## Approches
- **A, retenue** : table de liens `material_template_set_children (parent_id, child_id, sort_order)`. Rien ne change
  pour les articles ; le modèle est mis à plat au moment de l'appliquer.
- B, écartée : un kit comme « ligne » de `material_templates` (colonne vers un autre modèle). Mélange deux sortes de
  lignes ; duplication, « Depuis une liste », doublons et historique seraient à reprendre.

## Conception
- Migration 0060 : la table, clés étrangères en cascade vers `material_template_sets` (supprimer un kit le retire des
  modèles qui l'incluent), unicité (parent, enfant), parent ≠ enfant.
- Règle d'accès (`server/compat/rules.ts`) : parent et kit doivent appartenir à l'entreprise.
- `lib/materialKits.ts` : `flattenSet` (articles du modèle puis de ses kits, récursif, à l'abri des boucles) et
  `wouldCycle` (refuse d'inclure un modèle qui contient déjà, même indirectement, le modèle parent). Testé avec vitest.
- Écran Modèles : rubrique « Kits inclus » sous les articles, bouton « Ajouter un kit » (liste des autres modèles,
  ceux qui créeraient une boucle exclus), retrait d'un kit. Le compteur d'une pastille compte les articles du modèle
  mis à plat. Dupliquer un modèle copie aussi ses kits.
- Événement : chaque modèle proposé est mis à plat ; le reste (ajouter / remplacer) est inchangé.
- Plusieurs niveaux sont permis (Mariage → Brunch → Kit café).

## Laissé au builder
Libellés exacts, ordre d'affichage des kits (ordre d'ajout).
