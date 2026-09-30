// Scénarios des vidéos de la rubrique « Devis ». Un scénario par guide, même identifiant.
//
// Le compte de démonstration n'enregistre rien : chaque vidéo s'arrête avant les boutons qui ouvrent un devis
// tout juste créé (« Créer la copie », « Créer le devis ») et avant ceux qui sont fermés dans la démonstration
// (« Envoyer », « Importer le devis »). Les écritures qui restent sur la page (statut, dossier) vont jusqu'au bout.

/** Bouton « ⋯ » d'un devis de la liste. */
const menuOf = (page, name) => page.getByRole('button', { name: `Actions pour ${name}`, exact: true });
/** Entrée de la fenêtre d'actions ouverte par « ⋯ ». */
const action = (page, name) => page.getByRole('dialog').getByText(name, { exact: true });
/** Ligne d'un devis dans la liste (le bouton qui ouvre sa fiche). */
const rowOf = (page, name) => page.locator('li').filter({ hasText: name }).getByRole('button').first();
/** Fiche latérale d'un devis (aperçu, suivi commercial). */
const ficheOf = (page) => page.locator('.animate-slide-in-right');

/**
 * Liste déroulante du navigateur : son menu ne s'enregistre pas (et resterait ouvert par-dessus la page).
 * Le curseur va donc sur la liste, puis la valeur change, sans clic.
 */
async function choose(act, select, label) {
  await act.hover(select);
  await act.pause(250);
  await select.selectOption({ label });
  await act.pause(900);
}

/** Pose une valeur d'un coup dans un champ (date, nombre à remplacer) après y avoir cliqué. */
async function put(act, field, value) {
  await act.click(field);
  await field.fill(value);
  await act.pause(500);
}

/**
 * Montre un bouton sans cliquer : le curseur s'arrête sur son bord droit, pour que le libellé reste lisible
 * (`act.hover` vise le milieu et cache le texte des petits boutons).
 */
async function pointAt(page, act, target) {
  await target.waitFor({ state: 'visible', timeout: 20_000 });
  await target.scrollIntoViewIfNeeded();
  await act.pause(150);
  const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height - 6, { steps: 32 });
  await act.pause(300);
}

/**
 * Glisser-déposer. Pendant le geste, le navigateur n'émet plus de mouvements de souris : le curseur dessiné
 * par l'enregistreur resterait figé, on le fait donc suivre le survol.
 */
async function drag(page, act, from, to) {
  await page.evaluate(() => {
    if (window.__helpDragCursor) return;
    window.__helpDragCursor = true;
    document.addEventListener('dragover', (e) => {
      const cursor = document.getElementById('__help_cursor');
      if (cursor) { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; }
    }, true);
  });
  await act.hover(from);
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  const start = { x: a.x + Math.min(a.width / 2, 160), y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 230) };
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y + 6, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 45 });
  await act.pause(500);
  await page.mouse.up();
  await act.pause(900);
}

/** Ouvre un devis dans l'éditeur depuis son menu « ⋯ » et attend que le document et le menu de gauche soient prêts. */
async function openEditor(page, act, name, { phone = false } = {}) {
  await act.click(menuOf(page, name));
  await act.pause(400);
  await act.click(page.getByRole('dialog').getByRole('link', { name: 'Modifier le devis' }));
  await page.waitForURL(/\/modifier/);
  await page.locator('#weboword-sheet').waitFor({ timeout: 45_000 });
  // Sur téléphone, le statut n'est affiché qu'à l'ouverture du menu du bas.
  if (!phone) await page.getByLabel('Statut du devis').first().waitFor({ timeout: 45_000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await act.pause(1500);
}

/** Place le point d'insertion à la fin d'un élément du document (le clic tombe au milieu du texte). */
async function caretAtEnd(el) {
  await el.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
}

export default {
  // S'y retrouver dans la page Devis : volets, filtre par statut, tri, recherche.
  'page-devis': {
    start: '/devis',
    async run({ page, act }) {
      const volets = page.getByRole('tablist', { name: 'Devis affichés' });
      await act.click(volets.getByRole('tab', { name: /^Confirmés/ }));
      await act.pause(500);
      await act.click(volets.getByRole('tab', { name: /^Refusés/ }));
      await act.pause(500);
      await act.click(volets.getByRole('tab', { name: /^En cours/ }));
      await choose(act, page.getByLabel('Statut', { exact: true }), 'Devis envoyé');
      await act.pause(500);
      await choose(act, page.getByLabel('Statut', { exact: true }), 'Tous les statuts');
      await choose(act, page.getByLabel('Tri', { exact: true }), 'Montant');
      await act.pause(500);
      await act.type(page.getByLabel('Filtrer les devis'), 'mariage');
      await act.pause(1200);
    },
  },

  // Changer le statut d'un devis depuis sa fiche ; validé, il passe dans les confirmés.
  'statut-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(rowOf(page, 'Thomas Perrin-Vidal'));
      await act.pause(700);
      const fiche = ficheOf(page);
      await act.click(fiche.getByRole('button', { name: 'Devis envoyé', exact: true }));
      await act.pause(700);
      await act.click(fiche.getByRole('button', { name: 'Validé', exact: true }));
      await act.pause(900);
      await act.click(fiche.locator('button').first()); // la croix de la fiche
      await act.click(page.getByRole('tab', { name: /^Confirmés/ }));
      await act.hover(rowOf(page, 'Thomas Perrin-Vidal'));
      await act.pause(1200);
    },
  },

  // Vue Pipeline : une colonne par statut, un devis glissé d'une colonne à l'autre.
  'pipeline-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(page.getByRole('tab', { name: 'Pipeline' }));
      await act.pause(1200);
      // La colonne se reconnaît à son titre (le même libellé existe aussi dans les listes de statut des prospects).
      const column = page.locator('div.w-64').filter({ has: page.locator('span.font-bold', { hasText: /^Brochure envoyée$/ }) });
      const board = page.locator('div.overflow-x-auto').filter({ has: column });
      // Les colonnes suivantes sont à droite : aller-retour pour les montrer.
      await act.hover(page.locator('div.w-64').filter({ has: page.locator('span.font-bold', { hasText: /^Devis à faire$/ }) }).locator('span.font-bold'));
      await board.evaluate((el) => el.scrollTo({ left: 760, behavior: 'smooth' }));
      await act.pause(1900);
      await board.evaluate((el) => el.scrollTo({ left: 0, behavior: 'smooth' }));
      await act.pause(1500);
      const card = page.locator('[draggable="true"]').filter({ hasText: 'Afterwork clients Orvane' });
      await drag(page, act, card, column);
      await act.pause(1300);
    },
  },

  // Noter ses relances dans la fiche du devis.
  'suivi-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(rowOf(page, 'Nadia Benali'));
      await act.pause(700);
      const fiche = ficheOf(page);
      await act.click(fiche.getByRole('button', { name: 'Suivi commercial' }));
      await act.pause(900);
      const notes = fiche.locator('textarea');
      await act.click(notes);
      await page.keyboard.press('Control+End');
      await page.keyboard.type('\nRelance par téléphone : réponse attendue lundi.', { delay: 50 });
      await act.pause(500);
      await act.click(fiche.getByRole('button', { name: 'Sauvegarder les notes' }));
      await act.pause(900);
    },
  },

  // Créer un dossier, y ranger un devis, l'ouvrir.
  'dossiers-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Nouveau dossier' }));
      await act.type(page.getByPlaceholder('Nom du dossier'), 'Anniversaires');
      await act.click(page.getByRole('button', { name: 'Créer', exact: true }));
      await act.pause(900);
      await act.click(menuOf(page, 'Soirée de fin de vendanges'));
      await act.click(action(page, 'Déplacer vers un dossier'));
      await act.pause(500);
      // Le devis est rangé dans un dossier qui existait déjà : le dossier créé à l'instant n'est pas
      // enregistré dans la démonstration.
      await act.click(page.getByRole('button', { name: 'Entreprises', exact: true }));
      await act.pause(900);
      await act.click(page.getByTitle('Ouvrir « Entreprises »'));
      await act.pause(1200);
    },
  },

  // Ouvrir un devis dans l'éditeur et corriger le texte dans la page.
  // La vidéo n'ouvre pas les panneaux de gauche (Client, Prestations…) : ils se rechargent en boucle
  // aujourd'hui. Elle s'arrête avant « Enregistrer », qui affiche une fenêtre de félicitations de test.
  'modifier-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(menuOf(page, 'Soirée de fin de vendanges'));
      await act.pause(400);
      await act.click(action(page, 'Modifier le devis'));
      await page.waitForURL(/\/modifier/);
      const intro = page.getByText('Nous vous remercions de votre confiance');
      await intro.waitFor({ timeout: 30_000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      await act.pause(1500);
      // Le texte se corrige directement dans la page.
      await act.click(intro);
      // Le clic tombe au milieu du paragraphe : le point d'insertion est ramené à la fin de la phrase.
      await intro.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
      await page.keyboard.type(' Les vins sont fournis par le domaine.', { delay: 50 });
      await act.pause(900);
      // Mise en forme : la phrase ajoutée est sélectionnée, puis mise en gras.
      await intro.evaluate((el, phrase) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const at = node.textContent.indexOf(phrase);
          if (at < 0) continue;
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + phrase.length);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
      }, 'Les vins sont fournis par le domaine.');
      await act.pause(700);
      await act.click(page.getByTitle('Gras (Ctrl+B)'));
      await act.pause(500);
      await page.keyboard.press('ArrowRight'); // la sélection est relâchée : le gras se voit
      await act.pause(900);
      await pointAt(page, act, page.getByRole('button', { name: 'Enregistrer', exact: true }));
      await act.pause(1300);
    },
  },

  // Envoyer un devis au client par email (la vidéo s'arrête avant « Envoyer », fermé dans la démonstration).
  'envoyer-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(menuOf(page, 'Journée des associés'));
      await act.pause(500);
      await act.click(action(page, 'Envoyer au client'));
      await act.pause(900);
      await act.hover(page.getByLabel('Email du client'));
      await act.pause(900);
      await act.hover(page.getByLabel('Message'));
      await act.pause(1500);
      await pointAt(page, act, page.getByRole('button', { name: 'Envoyer', exact: true }));
      await act.pause(1200);
    },
  },

  // Imprimer ou enregistrer en PDF : le chemin jusqu'à l'entrée du menu (l'impression s'ouvre dans un autre onglet).
  'imprimer-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.pause(600);
      await act.click(menuOf(page, 'Journée des associés'));
      await act.pause(1200);
      await pointAt(page, act, page.getByRole('dialog').getByRole('link', { name: 'Imprimer ou enregistrer en PDF' }));
      await act.pause(4000);
    },
  },

  // Dupliquer pour un autre client, une autre date, d'autres couverts (la vidéo s'arrête avant « Créer la copie »,
  // qui ouvre le nouveau devis : il n'existe pas en base dans la démonstration).
  'dupliquer-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(menuOf(page, 'Mariage Sophie et Arnaud'));
      await act.pause(400);
      await act.click(action(page, 'Dupliquer'));
      const win = page.getByRole('dialog', { name: 'Dupliquer le devis' });
      await win.getByLabel('Couverts').waitFor();
      await act.pause(900);
      await act.click(win.getByRole('tab', { name: 'Autre client' }));
      await act.type(win.getByLabel('Rechercher un client'), 'rous');
      await act.pause(600);
      await act.click(win.getByRole('button', { name: /Antoine Rousselot/ }));
      await act.pause(500);
      await put(act, win.getByLabel('Date'), '2027-09-18');
      await act.click(win.getByLabel('Couverts'));
      await page.keyboard.press('Control+A');
      await page.keyboard.type('110', { delay: 120 });
      await act.pause(500);
      await act.click(win.getByLabel('Garder aussi ce devis comme modèle'));
      await act.type(win.getByLabel('Nom du modèle'), 'Mariage champêtre');
      await pointAt(page, act, win.getByRole('button', { name: 'Créer la copie' }));
      await act.pause(1300);
    },
  },

  // Partir d'un modèle : « Utiliser » ouvre la création guidée, le modèle est repris à l'étape Style.
  // La vidéo s'arrête avant « Créer le devis » (le devis créé n'est pas enregistré dans la démonstration).
  'modeles-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Partir d’un modèle' }));
      const card = page.getByRole('dialog', { name: 'Partir d’un modèle' }).locator('li').filter({ hasText: 'Mariage, dîner assis 100 couverts' });
      await card.waitFor();
      await act.pause(1200);
      await act.click(card.getByRole('button', { name: 'Utiliser' }));
      await page.waitForURL(/\/devis\/nouveau/);
      await page.getByRole('button', { name: 'Mariage', exact: true }).waitFor({ timeout: 30_000 });
      await act.pause(700);
      await act.click(page.getByRole('button', { name: 'Mariage', exact: true }));
      await put(act, page.getByLabel('Date', { exact: true }), '2027-06-19');
      await act.type(page.getByLabel('Couverts'), '80');
      await act.click(page.getByRole('button', { name: 'Continuer' }));
      await act.pause(500);
      await act.type(page.getByLabel('Rechercher un client'), 'tess');
      await act.click(page.getByRole('button', { name: /Margaux Tessier/ }));
      await act.pause(600);
      await act.click(page.getByRole('button', { name: 'Continuer' }));
      await act.pause(700);
      await act.hover(page.getByLabel('Contenu de départ'));
      await act.pause(1500);
      await pointAt(page, act, page.getByRole('button', { name: 'Créer le devis' }));
      await act.pause(1300);
    },
  },

  // Cocher plusieurs devis : changer leur statut, les ranger dans un dossier, les supprimer (sans confirmer).
  'devis-selection': {
    start: '/devis',
    async run({ page, act }) {
      const boxes = page.getByRole('checkbox', { name: /^Sélectionner / });
      await act.click(boxes.nth(0));
      await act.click(boxes.nth(1));
      await act.pause(600);
      await choose(act, page.getByLabel('Changer le statut des devis sélectionnés'), 'Devis envoyé');
      await act.pause(700);
      await act.click(boxes.nth(2));
      await act.click(boxes.nth(3));
      await act.pause(400);
      await act.click(page.getByRole('toolbar', { name: 'Actions sur la sélection' }).getByRole('button', { name: 'Déplacer' }));
      await act.pause(600);
      await act.click(page.getByRole('button', { name: 'Entreprises', exact: true }));
      await act.pause(900);
      await act.click(boxes.nth(0));
      await act.click(page.getByRole('toolbar', { name: 'Actions sur la sélection' }).getByRole('button', { name: 'Supprimer' }));
      await act.pause(900);
      await pointAt(page, act, page.getByRole('dialog').getByRole('button', { name: /^Supprimer 1 devis/ }));
      await act.pause(1300);
    },
  },

  // Saut de page : après l'introduction, la suite commence sur une nouvelle page.
  'saut-de-page': {
    start: '/devis',
    async run({ page, act }) {
      await openEditor(page, act, 'Soirée de fin de vendanges');
      const intro = page.getByText('Nous vous remercions de votre confiance');
      await act.click(intro);
      await caretAtEnd(intro);
      await act.pause(500);
      await act.click(page.getByTitle('Saut de page : la suite commence sur une nouvelle page'));
      await act.pause(600);
      await act.hover(page.locator('#weboword-sheet .screen-sep', { hasText: 'Saut de page' }).first());
      await act.pause(1500);
      await pointAt(page, act, page.getByTitle('Enregistrer', { exact: true }));
      await act.pause(1200);
    },
  },

  // Les actions du devis dans le menu de gauche de l'éditeur : statut, envoi, copie, événement.
  // Les fenêtres d'envoi et de copie sont ouvertes puis refermées (l'envoi est fermé dans la démonstration).
  'editeur-actions': {
    start: '/devis',
    async run({ page, act }) {
      await openEditor(page, act, 'Journée des associés');
      const status = page.getByLabel('Statut du devis').first();
      await choose(act, status, 'Validé');
      await act.pause(500);
      await pointAt(page, act, page.getByRole('link', { name: 'Préparer l’événement' }).first());
      await act.pause(1000);
      await act.click(page.getByRole('button', { name: 'Envoyer au client' }).first());
      const send = page.getByRole('dialog', { name: 'Envoyer le devis au client' });
      await send.waitFor({ timeout: 30_000 });
      await act.pause(1600);
      await act.click(send.getByRole('button', { name: 'Annuler' }));
      await act.pause(400);
      await act.click(page.getByRole('button', { name: 'Dupliquer' }).first());
      const copy = page.getByRole('dialog', { name: 'Dupliquer le devis' });
      await copy.getByLabel('Couverts').waitFor({ timeout: 30_000 });
      await act.pause(1600);
      await act.click(copy.getByRole('button', { name: 'Annuler' }));
      await act.pause(600);
    },
  },

  // L'éditeur sur téléphone : page entière ou taille réelle, outils repliés, menu du bas.
  'editeur-telephone': {
    start: '/devis',
    mobile: true,
    async run({ page, act }) {
      await openEditor(page, act, 'Soirée de fin de vendanges', { phone: true });
      await act.pause(600);
      await act.click(page.getByRole('button', { name: 'Taille réelle' }));
      await act.pause(1300);
      await act.click(page.getByRole('button', { name: 'Page entière' }));
      await act.pause(900);
      await act.click(page.getByRole('button', { name: 'Plus d’outils' }));
      await act.pause(1500);
      await act.click(page.getByRole('button', { name: 'Moins', exact: true }));
      await act.pause(600);
      await act.click(page.getByRole('navigation', { name: 'Actions du document' }).getByRole('button', { name: 'Menu' }));
      await act.pause(1200);
      await act.hover(page.getByLabel('Statut du devis').last());
      await act.pause(700);
      await act.hover(page.getByRole('button', { name: 'Envoyer au client' }).last());
      await act.pause(700);
      await act.hover(page.getByRole('button', { name: 'Dupliquer' }).last());
      await act.pause(1300);
    },
  },

  // Importer un devis fait ailleurs (la vidéo s'arrête avant « Importer le devis » : l'envoi de fichier est fermé).
  'importer-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Importer' }));
      await act.pause(700);
      await act.type(page.getByPlaceholder('Jean', { exact: true }), 'Paul');
      await act.type(page.getByPlaceholder('Dupont', { exact: true }), 'Garnier');
      await act.type(page.getByPlaceholder('jean@email.com'), 'paul.garnier@exemple.fr');
      const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Importer un devis existant' });
      await choose(act, modal.locator('select'), 'Anniversaire');
      await put(act, modal.locator('input[type="date"]'), '2027-05-22');
      await act.type(modal.getByPlaceholder('120'), '60');
      await act.type(modal.getByPlaceholder('2400.00'), '3150');
      // La zone du fichier est en bas de la fenêtre. Le curseur quitte d'abord le champ du montant :
      // la molette au-dessus d'un champ numérique actif changerait sa valeur au lieu de faire défiler.
      await act.hover(modal.getByText('Adresse de prestation'));
      await act.scroll(320);
      await act.hover(modal.getByText('Cliquer pour sélectionner un fichier'));
      await act.pause(1200);
      await pointAt(page, act, modal.getByRole('button', { name: 'Importer le devis' }));
      await act.pause(1000);
    },
  },

  // Suivre les coûts et la marge : coût de revient d'une prestation, frais en plus, marge recalculée.
  'marge-devis': {
    start: '/devis',
    async run({ page, act }) {
      await act.click(menuOf(page, 'Soirée de fin de vendanges'));
      await act.pause(400);
      await act.click(action(page, 'Marge et coûts'));
      await page.getByText('Détail par prestation').waitFor({ timeout: 20_000 });
      await act.pause(1500);
      // Coût de revient unitaire du serveur : 135 € deviennent 150 €.
      await act.click(page.locator('button[title*="cliquer pour modifier"]').nth(5));
      await page.keyboard.press('Control+A');
      await page.keyboard.type('150', { delay: 120 });
      await act.press('Enter');
      await act.pause(700);
      await act.click(page.getByRole('button', { name: '+ Ajouter' }));
      await act.type(page.getByPlaceholder('Ex: Personnel supplémentaire'), 'Location du camion');
      await act.type(page.getByPlaceholder('0.00'), '180');
      // La synthèse est en bas de la fiche. Le curseur quitte d'abord le champ du montant (voir plus haut).
      await act.hover(page.getByText('Touchez la colonne Coût'));
      await act.scroll(320);
      await act.pause(1500);
    },
  },
};
