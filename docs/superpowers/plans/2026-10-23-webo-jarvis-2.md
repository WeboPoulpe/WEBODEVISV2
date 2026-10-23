# Webo « Jarvis » (suite) : clients, prospects, stock, commandes, brochures, factures — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Intention (Maxence, 2026-10-23, « ok vas-y ») :** Webo couvre le reste du logiciel. Règles inchangées : Webo lit et
propose, le traiteur valide la carte, du code déterministe écrit (fonctions serveur existantes quand il y en a).

## Global Constraints
- Nouvelles sortes de propositions (migration 0041) : `customer_upsert, prospect_status, prospect_to_quote,
  stock_movement, supplier_order, supplier_order_send, supplier_order_receive, event_orders, brochure_send,
  invoice_issue, invoice_payment`.
- Clients : contraintes `particulier` (prénom, nom) / `entreprise` (raison sociale, contact) ; email obligatoire,
  unique par compte ; notes ajoutées à la suite (jamais écrasées).
- Stock : mouvements `in | out | adjust` (le déclencheur applique) ; sortie ≤ stock ; ajustement ≥ 0 ; ingrédients du
  catalogue commun ou de l'entreprise.
- Commandes : brouillon créé en transaction (commande + lignes) ; envoi par `sendSupplierOrder` ; réception en
  transaction (entrées de stock + statut `received`) ; besoins d'un événement par `createSupplierOrders`.
- Brochures : envoi par `sendBrochure({ brochureId, to, message, prospectId })`.
- Factures : émission par `issueInvoice` (irréversible : la carte le dit) ; paiement par `recordPayment`.
- Prospects : statut (et devis lié, avec `app.user_id` pour l'historique) ; transformation en devis comme la page
  Prospects (client retrouvé par email ou créé, devis « à faire », prospect passé « devis à faire »).
- Spécialistes : `clients` (clients et prospects), `stock` (stock et commandes) ; Factures et Prospects reçoivent
  leurs nouveaux outils.

## Review Focus
1. Données d'une autre entreprise (client, ingrédient, fournisseur, commande, facture, brochure, prospect) → refus.
2. Sortie de stock supérieure au stock, ou commande déjà reçue reçue deux fois → refus, aucun mouvement.
3. Émission de facture : seulement d'un brouillon de l'entreprise, la carte annonce l'irréversibilité.
4. Fiche client : doublon d'email ou de SIRET → message clair, rien d'écrit ; notes jamais écrasées.
5. Prospect transformé deux fois → un seul devis.

### Task 1: Clients et prospects
### Task 2: Stock et commandes fournisseurs
### Task 3: Factures (émission, paiement) et brochures
### Task 4: Aiguilleur, spécialistes, interface, e2e
Chaque tâche : tests unitaires (PGlite) d'abord, puis outils + exécutions ; commit `feat(webo): …`.
