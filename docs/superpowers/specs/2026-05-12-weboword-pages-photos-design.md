# WeboWord — Page de garde, Page photos & Photos dans le devis

**Date :** 2026-05-12  
**Statut :** Approuvé

---

## Contexte

WeboWord est l'éditeur de devis principal (`WeboWordEditor.tsx`, 80KB). Il génère un document HTML en plusieurs pages (devis financier + carte gastronomique) via `lib/generateQuoteHtml.ts`. Actuellement, aucune page de garde ni page photos n'existe. Les photos sont gérées dans un système legacy non intégré à WeboWord.

---

## Objectif

Ajouter trois fonctionnalités liées aux images dans WeboWord :
1. Une **page de garde** paramétrable (templates + builder libre)
2. Une **page photos finale** libre
3. Des **photos dans le corps du devis** (par prestation + blocs libres)

Un composant `PhotoBuilder` réutilisable sera partagé par les trois contextes.

---

## Architecture

```
WeboWordEditor.tsx (orchestrateur)
├── CoverPage.tsx         ← NOUVEAU
├── DevisPage (existant)  ← inchangé
│   └── PhotoBlock.tsx    ← NOUVEAU
├── PhotosPage.tsx        ← NOUVEAU
└── PhotoBuilder.tsx      ← NOUVEAU (modal global)
```

L'éditeur gère une liste ordonnée de pages. La page de garde et la page photos sont optionnelles, activables via les sidepanels.

**Indicateurs de rupture de page :** marqueurs visuels non imprimables affichés en dehors de la zone page (bord latéral), style dot + label "Page N", pour repérer les sauts de page dans l'éditeur.

---

## Stockage Supabase

### Table `quotes` — 2 nouvelles colonnes JSONB

**`cover_page_config`**
```json
{
  "enabled": true,
  "template": "mariage",
  "clientName": "M. et Mme Dupont",
  "address": "Château de Versailles, 78000",
  "eventDate": "2026-09-15",
  "title": "Proposition gastronomique",
  "subtitle": "Mariage — 120 couverts",
  "photoUrl": "https://...",
  "photoTransform": { "zoom": 1.2, "x": 0, "y": -10, "rotation": 0 },
  "customLayout": null
}
```

**`photos_page_config`**
```json
[
  {
    "pageIndex": 0,
    "layout": "2col",
    "cells": [
      { "photoId": "uuid", "url": "https://...", "caption": "Buffet froid", "size": "medium", "transform": { "zoom": 1, "x": 0, "y": 0 } }
    ]
  }
]
```

### Table `prestations` — 1 nouvelle colonne

- `photo_url TEXT` — URL Supabase Storage de la photo associée à la prestation

---

## Composant 1 : `CoverPage`

### Templates (5 designs)

| Nom | Style |
|-----|-------|
| Mariage | Fond crème/ivoire, typographie serif, photo pleine largeur en haut |
| Gastronomique | Fond sombre, accent doré, photo centrée avec overlay |
| Business | Fond blanc épuré, bande couleur latérale, photo en vignette |
| Provence | Tons verts/ocres, photo encadrée |
| Luxe | Fond noir, texte blanc, photo pleine page avec texte en overlay |

### Champs configurables (tous templates)
- Nom du client
- Adresse / lieu de l'événement
- Date de l'événement
- Photo principale (ouvre `PhotoBuilder`)
- Titre et sous-titre personnalisables

### Mode builder libre
Canevas A4 avec éléments drag-and-drop : blocs texte, blocs photo, formes décoratives. Chaque élément stocke `{ type, x, y, width, height, content }` dans `cover_page_config.customLayout`.

---

## Composant 2 : `PhotoBuilder`

Modal réutilisable appelé depuis n'importe quel contexte.

### Fonctionnalités
- **Upload** : drag & drop ou sélection fichier → upload Supabase Storage
- **Recadrage** : zone libre avec poignées de resize (ratio libre ou verrouillé)
- **Repositionnement** : drag de l'image dans son cadre
- **Zoom** : slider de zoom
- **Rotation** : paliers 90° + rotation libre
- **Légende** : champ texte optionnel

### Interface
- Panneau gauche : aperçu temps réel dans le cadre cible (proportions A4)
- Panneau droit : contrôles (sliders, ratio, boutons)
- Bouton "Appliquer" → callback avec `{ url, transform, caption }`

### Hors scope
- Filtres / effets couleur
- Annotations ou texte sur l'image

---

## Composant 3 : `PhotosPage`

Page optionnelle ajoutée après le devis.

### Ajout de photos
- Bouton "+ Ajouter une photo" → ouvre `PhotoBuilder`
- Nombre illimité de photos

### Mise en page
- Layout par page : 1 colonne / 2 colonnes / 3 colonnes / mosaïque (2 grandes + 2 petites)
- Drag & drop pour réordonner
- Taille par cellule : petite / moyenne / grande

### Plusieurs pages photos
- Bouton "+ Nouvelle page photos" pour ajouter une 2e page
- Chaque page a son propre layout

---

## Composant 4 : `PhotoBlock` (photos dans le devis)

### A) Photo par prestation
- Chaque prestation peut avoir une `photo_url` (colonne sur `prestations`)
- Ajout via le sidepanel prestation : bouton "Ajouter une photo" → `PhotoBuilder`
- Rendu PDF : vignette à droite du nom (≈60×60px) ou sous la description selon le template

### B) Blocs photos libres
- Bouton "Insérer un bloc photo" dans la barre d'outils
- Insère un bloc HTML au niveau du curseur dans l'éditeur contentEditable
- Repositionnement : sélection + couper/coller dans l'éditeur (pas de drag-and-drop, trop complexe dans un contentEditable)
- 1 à 4 photos en grille par bloc, légende optionnelle sur le bloc
- Clic sur une photo → `PhotoBuilder`
- Stocké inline dans `content_html` (HTML éditable WeboWord)

### Rendu PDF
- Images référencées par URL Supabase Storage (pas de base64 — les URLs sont stables et évitent de gonfler le HTML)

---

## Indicateurs visuels de rupture de page

- Affichés en dehors de la zone page (marge latérale gauche ou droite)
- Non imprimables (`@media print { display: none }`)
- Style : dot coloré + label "● Page 2", "● Page 3", etc.
- Un indicateur par transition entre composants de page

---

## Ce qui n'est PAS dans ce spec
- Éditeur de texte enrichi sur la page de garde (hors scope, les templates gèrent le style)
- Intégration avec le système legacy de photos (QuoteDocument V1) — aucune migration, les deux coexistent
- Internationalisation des légendes (FR uniquement pour l'instant)
