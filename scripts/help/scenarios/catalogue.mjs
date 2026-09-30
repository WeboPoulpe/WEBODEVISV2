// Scénarios des vidéos de la rubrique « Catalogue ». Un scénario par guide, même identifiant.
// Rappel : le compte de démonstration n'enregistre rien. Quand la page relit ses données après l'écriture
// (catégories) ou part vers une autre page (nouvelle prestation), la vidéo s'arrête
// sur le bouton de validation, sans cliquer dessus.
// Pas de vidéo pour « modeles-presentation » (page Modèles de devis) : la création d'un modèle y échoue
// et le modèle choisi n'est pas repris par le nouveau devis. Le guide est écrit, avec ce qui marche.

// ── Outils locaux ─────────────────────────────────────────────────────────────
/** Liste déroulante : la liste du navigateur n'apparaît pas à l'image, on montre le champ puis la valeur choisie. */
const choose = async (act, select, text) => {
  await act.hover(select);
  const label = (await select.locator('option', { hasText: text }).first().textContent()) ?? text;
  await select.selectOption({ label });
  await act.pause(700);
};

/** Champ déjà rempli : remplace sa valeur au lieu d'écrire à la suite. */
const retype = async (act, page, field, text) => {
  await act.click(field);
  await page.keyboard.press('Control+A');
  await field.pressSequentially(text, { delay: 70 });
  await act.pause(500);
};

/** Champ d'heure : la valeur est posée d'un coup, comme avec le sélecteur du navigateur. */
const setValue = async (act, field, value) => {
  await act.hover(field);
  await field.fill(value);
  await act.pause(700);
};

/** Fenêtre ouverte par-dessus la page, reconnue à son titre (ces fenêtres n'ont pas de rôle « dialog »). */
const windowOf = (page, title) => page.locator('div.fixed.inset-0').filter({ hasText: title }).last();

export default {
  'prestation-creer': {
    start: '/prestations',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Nouvelle prestation' }));
      const win = windowOf(page, 'Nouvelle prestation');
      await act.type(win.getByPlaceholder('Plateau cocktail dînatoire'), 'Velouté de potimarron aux châtaignes');
      await act.type(win.getByPlaceholder('85.00'), '9.5');
      await act.type(win.getByPlaceholder('50.00'), '2.8');
      await choose(act, win.locator('select').nth(0), 'Dîner');
      await choose(act, win.locator('select').nth(1), 'Entrée');
      await act.type(win.locator('[contenteditable="true"]'), 'Velouté servi chaud, crème de châtaigne et huile de noisette.');
      await act.hover(win.getByText('Aperçu dans un devis'));
      await act.pause(1200);
      await act.hover(win.getByRole('button', { name: 'Ajouter', exact: true }));
      await act.pause(900);
    },
  },

  'prestation-ingredients': {
    start: '/prestations',
    async run({ page, act }) {
      await act.click(page.getByRole('tab', { name: 'Dîner' }));
      await act.pause(500);
      await act.click(page.getByRole('button', { name: /^Risotto aux champignons/ }));
      const win = windowOf(page, 'Modifier la prestation');
      await win.getByText('Ingrédients (par personne)').waitFor();
      await act.pause(700);
      await act.scroll(420);
      await act.hover(win.getByText('Ingrédients (par personne)'));
      await act.pause(900);
      await act.click(win.getByRole('button', { name: 'Ajouter', exact: true }));
      await act.type(win.getByPlaceholder('Rechercher un ingrédient…'), 'crème');
      await act.pause(500);
      await act.click(win.getByRole('button', { name: /Crème fraîche épaisse/ }));
      await retype(act, page, win.locator('input[type="number"][step="0.1"]'), '0.03');
      await act.click(win.getByRole('button', { name: 'Lier' }));
      await act.hover(win.getByText('Crème fraîche épaisse', { exact: true }));
      await act.pause(1200);
    },
  },

  categories: {
    start: '/parametres/categories',
    async run({ page, act }) {
      await act.hover(page.getByText('Vin d\'honneur', { exact: true }));
      await act.pause(700);
      await act.scroll(360);
      await act.pause(500);
      await act.scroll(-360);
      await act.click(page.getByRole('button', { name: 'Catégorie', exact: true }));
      const field = page.getByPlaceholder('Nom de la catégorie…');
      await act.type(field, 'Brunch');
      // Le bouton de validation (une coche) est juste à droite du champ.
      await act.hover(field.locator('xpath=following-sibling::button[1]'));
      await act.pause(1000);
    },
  },

  extras: {
    start: '/extras',
    async run({ page, act }) {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await act.click(page.getByRole('button', { name: 'Ajouter un extra' }));
      const form = windowOf(page, 'Nouvel extra');
      await act.type(form.getByPlaceholder('Jean Dupont'), 'Léa Marchand');
      await act.type(form.getByPlaceholder('06 00 00 00 00'), '06 39 98 41 27');
      await choose(act, form.locator('select'), 'Serveur');
      await act.click(form.getByRole('button', { name: 'Ajouter', exact: true }));
      await act.hover(page.getByText('Léa Marchand', { exact: true }));
      await act.pause(900);
      // L'extra ajouté n'existe pas en base dans la démonstration : l'affectation se fait sur un extra déjà enregistré.
      const card = page.locator('main div.rounded-2xl').filter({ hasText: 'Oscar Thévenin' }).last();
      await act.click(card.getByRole('button', { name: 'Assigner', exact: true }));
      const assign = windowOf(page, 'Assigner à un événement');
      await choose(act, assign.locator('select'), 'Gautherot');
      await act.click(assign.getByRole('button', { name: 'Confirmé' }));
      await setValue(act, assign.locator('input[type="time"]'), '18:00');
      await act.click(assign.getByRole('button', { name: 'Assigner', exact: true }));
      await act.hover(card.getByRole('button', { name: /Anniversaire/ }));
      await act.pause(700);
      await act.click(card.getByTitle('Copier le lien'));
      await act.pause(700);
      await act.click(page.getByRole('button', { name: 'Agenda' }));
      await act.pause(1000);
    },
  },

  'modeles-location': {
    start: '/location-templates',
    async run({ page, act }) {
      // L'article est ajouté à un modèle existant : un modèle créé dans la démonstration n'existe pas en base,
      // il ne pourrait donc pas recevoir d'article. La création d'un modèle vient ensuite.
      await act.click(page.getByRole('tab', { name: /^Cocktail/ }));
      await act.pause(700);
      await act.click(page.getByRole('button', { name: 'Ajouter un article' }));
      const item = page.getByRole('dialog', { name: 'Nouvel article' });
      await act.type(item.getByLabel('Article'), 'Tasse à café');
      await retype(act, page, item.getByLabel('Quantité par couvert'), '0.5');
      await act.type(item.getByLabel('Unité'), 'pièce');
      await retype(act, page, item.getByLabel('Prix unitaire HT'), '0.2');
      await choose(act, item.getByLabel('Fournisseur habituel'), 'Loca-Réception');
      await act.click(item.getByRole('button', { name: 'Enregistrer' }));
      await act.hover(page.getByText('Tasse à café', { exact: true }));
      await act.pause(900);
      await act.click(page.getByRole('button', { name: 'Nouveau modèle' }));
      const model = page.getByRole('dialog', { name: 'Nouveau modèle de location' });
      await act.type(model.getByLabel('Nom du modèle'), 'Séminaire');
      await act.click(model.getByRole('button', { name: 'Créer le modèle' }));
      await act.hover(page.getByRole('heading', { name: 'Séminaire' }));
      await act.pause(900);
    },
  },
};
