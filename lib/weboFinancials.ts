import { generateQuoteHtml, generatedTextFragments, type QuoteHtmlData, type QuoteHtmlOptions } from './generateQuoteHtml';
import { lineFormulaId, parseFormulas } from './quoteFormulas';

// ═══════════════════════════════════════════════════════════════════════════
// Mise à jour ciblée d'un content_html WeboWord déjà mis en forme, SANS tout
// régénérer :
//   1) le bloc financier (tableau des prestations + totaux) est remplacé par sa
//      version fraîche (repéré par [data-webo-financials]) ;
//   2) le bloc TEXTE des prestations nouvellement ajoutées est ajouté à la carte
//      gastronomique (conteneur .gastro-menu), puis la carte est rangée par formule
//      (plats communs, puis chaque formule sous son titre) ;
//   3) (option `parties`) les cartes Client et Événement sont remplacées par leur
//      version fraîche ; l'intro et l'en-tête de la carte gastro aussi, mais
//      seulement s'ils ont encore la forme du texte généré (sinon le traiteur les
//      a réécrits à la main → on n'y touche pas).
// Tout le reste (page de garde, textes existants, prose manuelle) est préservé.
// ═══════════════════════════════════════════════════════════════════════════

export interface WeboSyncInput {
  /** Données complètes du devis (tableau + totaux, et blocs client/événement si `parties`). */
  all: QuoteHtmlData;
  /** Prestations nouvellement ajoutées (leur bloc texte est ajouté page 2). */
  added?: QuoteHtmlData['services'];
  /** Rafraîchir le tableau + totaux (défaut : oui). À désactiver si seuls client/événement ont changé. */
  financials?: boolean;
  /** À activer quand le client ou l'événement ont changé. */
  parties?: boolean;
  /**
   * La langue du devis a changé : les plats de la carte (fiches dans la nouvelle langue), le cadre « Bon pour
   * accord » et la durée de validité sont refaits.
   */
  relang?: boolean;
  /** Plats (noms des prestations) à refaire seuls, par exemple après la traduction de leur fiche. */
  refreshDishes?: string[];
  /** Lignes supprimées du devis : leur plat quitte la carte (retrouvé par l'identifiant de la ligne, sinon par son nom). */
  removedLines?: { id?: string | null; name: string }[];
  /** Rempli par la synchronisation : blocs de texte laissés tels quels parce que réécrits à la main. */
  kept?: ('intro' | 'menuTitle')[];
}

/** Libellés des cartes, FR et EN (repli pour les documents antérieurs aux balises data-webo-*). */
const CLIENT_LABELS = ['CLIENT'];
const EVENT_LABELS = ['ÉVÉNEMENT', 'EVENT'];

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '');

/** Le texte contient-il, dans l'ordre, tous les fragments fixes du générateur (FR ou EN) ? */
function looksGenerated(text: string | null | undefined, kind: 'intro' | 'menuTitle'): boolean {
  const hay = squash(text);
  return (['fr', 'en'] as const).some((lang) => {
    const frags = generatedTextFragments(lang)[kind];
    if (frags.length === 0) return false;
    let from = 0;
    for (const f of frags) {
      const i = hay.indexOf(squash(f), from);
      if (i < 0) return false;
      from = i + squash(f).length;
    }
    return true;
  });
}

/** Carte dont le 1er paragraphe est l'un des libellés donnés (documents non balisés). */
function findLabeledCard(doc: Document, labels: string[]): Element | null {
  return Array.from(doc.querySelectorAll('div[style*="flex:1"]')).find((div) =>
    labels.includes(norm(div.querySelector('p')?.textContent)),
  ) ?? null;
}

/** Remplace `target` par une copie de `fresh` (qui porte déjà sa balise data-webo-*). */
function replaceWithFresh(doc: Document, target: Element | null, fresh: Element | null): boolean {
  if (!target || !fresh) return false;
  target.replaceWith(doc.importNode(fresh, true));
  return true;
}

/** Extrait le outerHTML du 1er élément correspondant au sélecteur. */
function pick(html: string, selector: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector(selector)?.outerHTML ?? null;
}

/** Extrait le innerHTML du 1er élément correspondant au sélecteur. */
function pickInner(html: string, selector: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector(selector);
  return el ? el.innerHTML : null;
}

/** Retire de la carte le plat de chaque ligne supprimée. Vrai si un plat est parti. */
function removeDishes(doc: Document, removed: { id?: string | null; name: string }[]): boolean {
  const menu = doc.querySelector('.gastro-menu');
  if (!menu) return false;
  let changed = false;
  for (const r of removed) {
    const dishes = Array.from(menu.querySelectorAll(':scope > [data-webo-dish]'));
    const dish = (r.id && dishes.find((d) => d.getAttribute('data-webo-line') === r.id))
      // Repli sur le nom : seulement un plat qui n'est relié à aucune autre ligne par son identifiant.
      || dishes.find((d) => d.getAttribute('data-webo-dish') === r.name && !d.getAttribute('data-webo-line'));
    if (dish) { dish.remove(); changed = true; }
  }
  return changed;
}

/**
 * Changement de langue : chaque plat de la carte (repère data-webo-dish) est remplacé par sa version fraîche,
 * fiche dans la nouvelle langue ; un document d'avant les repères reçoit la carte entière. Le cadre « Bon pour
 * accord » et la durée de validité qui le suit sont refaits aussi. Vrai si quelque chose a changé.
 */
function relangDocument(doc: Document, all: QuoteHtmlData, opts: QuoteHtmlOptions, only?: Set<string>): boolean {
  const fresh = new DOMParser().parseFromString(generateQuoteHtml(all, opts), 'text/html');
  let changed = false;
  const menu = doc.querySelector('.gastro-menu');
  const freshMenu = fresh.querySelector('.gastro-menu');
  if (menu && freshMenu) {
    const byName = new Map<string, Element[]>();
    for (const d of Array.from(freshMenu.querySelectorAll(':scope > [data-webo-dish]'))) {
      const name = d.getAttribute('data-webo-dish') ?? '';
      byName.set(name, [...(byName.get(name) ?? []), d]);
    }
    const dishes = Array.from(menu.querySelectorAll(':scope > [data-webo-dish]'))
      .filter((d) => !only || only.has(d.getAttribute('data-webo-dish') ?? ''));
    if (dishes.length === 0 && !only) {
      menu.innerHTML = freshMenu.innerHTML;
      changed = true;
    }
    for (const d of dishes) {
      const next = byName.get(d.getAttribute('data-webo-dish') ?? '')?.shift();
      if (next) { d.replaceWith(doc.importNode(next, true)); changed = true; }
    }
  }
  const sign = only ? null : doc.querySelector('[data-webo-sign]');
  const freshSign = fresh.querySelector('[data-webo-sign]');
  if (sign && freshSign) {
    const validity = sign.nextElementSibling;
    const freshValidity = freshSign.nextElementSibling;
    if (validity && freshValidity && /valable|valid/i.test(validity.textContent || '')) validity.replaceWith(doc.importNode(freshValidity, true));
    sign.replaceWith(doc.importNode(freshSign, true));
    changed = true;
  }
  return changed;
}

/**
 * Devis à formules : range les plats de la carte. Chaque plat (bloc div de .gastro-menu, avec ce qui le suit
 * jusqu'au plat suivant) prend la formule de sa ligne (repère data-webo-dish = nom de la prestation) ; à défaut,
 * il garde la sienne si elle existe encore, sinon il devient commun. Puis : plats communs, et chaque formule
 * sous son titre (titres refaits, noms à jour). Sans formule : repères et titres retirés, ordre inchangé.
 * Le contenu des plats n'est jamais touché. Vrai si la carte a changé.
 */
function regroupCarte(doc: Document, all: QuoteHtmlData, opts: QuoteHtmlOptions): boolean {
  const menu = doc.querySelector('.gastro-menu');
  if (!menu) return false;
  const before = menu.innerHTML;
  const formulas = parseFormulas(all.formulas);
  const known = new Set(formulas.map((f) => f.id));

  // Formule de chaque ligne : par identifiant (repère data-webo-line), sinon par nom (deux lignes du même nom :
  // dans l'ordre). Un plat relié par identifiant prend aussi le nom actuel de sa ligne (ligne renommée).
  const byId = new Map<string, { formula: string | null; name: string }>();
  const byName = new Map<string, (string | null)[]>();
  for (const s of all.services ?? []) {
    if (!s?.name || s.removed) continue;
    if (s.id) byId.set(s.id, { formula: lineFormulaId(s, formulas), name: s.name });
    const list = byName.get(s.name) ?? [];
    list.push(lineFormulaId(s, formulas));
    byName.set(s.name, list);
  }

  // Blocs : un plat (div) et ce qui le suit ; ce qui précède le premier plat reste en tête.
  const head: Element[] = [];
  const units: { els: Element[]; formula: string | null }[] = [];
  for (const child of Array.from(menu.children)) {
    if (child.classList.contains('webo-formula-title')) { child.remove(); continue; }
    if (child.tagName !== 'DIV') { (units.length ? units[units.length - 1].els : head).push(child); continue; }
    const name = child.getAttribute('data-webo-dish');
    const line = byId.get(child.getAttribute('data-webo-line') ?? '');
    if (line && line.name !== name) child.setAttribute('data-webo-dish', line.name);
    const queue = !line && name != null ? byName.get(name) : undefined;
    const own = child.getAttribute('data-webo-formula');
    const formula = line ? line.formula : queue && queue.length ? queue.shift()! : (own && known.has(own) ? own : null);
    if (formula) child.setAttribute('data-webo-formula', formula); else child.removeAttribute('data-webo-formula');
    units.push({ els: [child], formula });
  }

  if (formulas.length === 0) return menu.innerHTML !== before;

  // Titres frais (nom, mention « à choisir »), tels que le générateur les écrit.
  const fresh = new DOMParser().parseFromString(generateQuoteHtml(all, opts), 'text/html');
  const titleOf = (id: string): Element | null => {
    const t = Array.from(fresh.querySelectorAll('.gastro-menu .webo-formula-title')).find((el) => el.getAttribute('data-webo-formula') === id);
    return t ? doc.importNode(t, true) : null;
  };
  const order: Element[] = [...head, ...units.filter((u) => !u.formula).flatMap((u) => u.els)];
  for (const f of formulas) {
    const own = units.filter((u) => u.formula === f.id);
    if (own.length === 0) continue;
    const title = titleOf(f.id);
    if (title) order.push(title);
    order.push(...own.flatMap((u) => u.els));
  }
  for (const el of order) menu.appendChild(el);
  return menu.innerHTML !== before;
}

export function syncWeboDocument(
  existingHtml: string,
  input: WeboSyncInput,
  opts: QuoteHtmlOptions = {},
): string | null {
  if (!existingHtml || typeof window === 'undefined' || typeof DOMParser === 'undefined') return null;

  const doc = new DOMParser().parseFromString(existingHtml, 'text/html');
  let changed = false;

  // ── 1) Bloc financier (tableau + totaux) ────────────────────────────────────
  const freshFinancials = input.financials === false ? null : pick(generateQuoteHtml(input.all, opts), '[data-webo-financials]');
  if (freshFinancials) {
    const tmp = doc.createElement('div');
    tmp.innerHTML = freshFinancials;
    const freshEl = tmp.firstElementChild;
    if (freshEl) {
      const existing = doc.querySelector('[data-webo-financials]');
      if (existing) {
        existing.replaceWith(freshEl);
        changed = true;
      } else {
        // Ancien document sans balise : remplace la 1re table + son bloc de totaux.
        const table = doc.querySelector('table');
        if (table) {
          const sib = table.nextElementSibling;
          if (sib && sib.tagName === 'DIV' && /Total/i.test(sib.textContent || '')) sib.remove();
          table.replaceWith(freshEl);
          changed = true;
        }
      }
    }
  }

  // ── 2) Bloc texte des prestations ajoutées → fin de la carte gastronomique ──
  const added = (input.added ?? []).filter((s) => s.name && s.name.trim());
  if (added.length > 0) {
    const menu = doc.querySelector('.gastro-menu');
    if (menu) {
      // Génère uniquement les blocs texte des nouvelles prestations.
      const addedItems = pickInner(
        generateQuoteHtml({ ...input.all, services: added }, opts),
        '.gastro-menu',
      );
      if (addedItems) {
        // Retire un éventuel placeholder « menu à compléter » avant d'ajouter.
        if (menu.children.length === 1 && /menu/i.test(menu.textContent || '') && !menu.querySelector('div')) {
          menu.innerHTML = '';
        }
        const holder = doc.createElement('div');
        holder.innerHTML = addedItems;
        // Devis à formules : le titre d'une formule déjà présente dans la carte n'est pas répété.
        holder.querySelectorAll('.webo-formula-title').forEach((title) => {
          const id = title.getAttribute('data-webo-formula');
          // (Identifiants de formule : lettres, chiffres, - et _ seulement, voir parseFormulas.)
          if (id && /^[\w-]+$/.test(id) && menu.querySelector(`.webo-formula-title[data-webo-formula="${id}"]`)) title.remove();
        });
        while (holder.firstChild) menu.appendChild(holder.firstChild);
        changed = true;
      }
    }
  }

  // ── 2 a) Lignes supprimées : leur plat quitte la carte ──
  if (input.removedLines?.length && removeDishes(doc, input.removedLines)) changed = true;

  // ── 2 bis) Nouvelle langue : plats, signature et validité refaits dans cette langue ──
  if (input.relang && relangDocument(doc, input.all, opts)) changed = true;
  else if (input.refreshDishes?.length && relangDocument(doc, input.all, opts, new Set(input.refreshDishes))) changed = true;

  // ── 2 ter) Carte rangée par formule (lignes déplacées, formules ajoutées, renommées ou supprimées) ──
  if (input.financials !== false && regroupCarte(doc, input.all, opts)) changed = true;

  // ── 3) Client / Événement (+ intro et en-tête de carte si non retouchés) ────
  if (input.parties) {
    const fresh = new DOMParser().parseFromString(generateQuoteHtml(input.all, opts), 'text/html');

    // Cartes de données : la source de vérité est le panneau → remplacement direct.
    const cards: [string, string[]][] = [['[data-webo-client]', CLIENT_LABELS], ['[data-webo-event]', EVENT_LABELS]];
    for (const [sel, labels] of cards) {
      const target = doc.querySelector(sel) ?? findLabeledCard(doc, labels);
      if (replaceWithFresh(doc, target, fresh.querySelector(sel))) changed = true;
    }

    // Blocs de prose : remplacés seulement s'ils ont encore la forme générée.
    const prose: [string, string, 'intro' | 'menuTitle'][] = [
      ['[data-webo-intro]', 'div[style*="border-left:4px"]', 'intro'],
      ['.gastro-header', '.gastro-header', 'menuTitle'],
    ];
    for (const [sel, fallback, kind] of prose) {
      const target = doc.querySelector(sel) ?? doc.querySelector(fallback);
      if (target && looksGenerated(target.textContent, kind)) {
        if (replaceWithFresh(doc, target, fresh.querySelector(sel))) changed = true;
      } else if (target) {
        input.kept?.push(kind);
      }
    }
  }

  return changed ? doc.body.innerHTML : null;
}
