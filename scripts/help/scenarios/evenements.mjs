// Scénarios des vidéos de la rubrique « Événements ». Un scénario par guide, même identifiant.
// Rappel : le compte de démonstration n'enregistre rien. Chaque vidéo tient dans une seule page après sa première écriture.

// ── Outils locaux ─────────────────────────────────────────────────────────────
/** Attend la fin d'un chargement (roue ou lignes grises) après un changement de page ou d'onglet. */
const settled = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('.animate-pulse, .animate-spin').first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
};

/** Liste déroulante : la liste du navigateur n'apparaît pas à l'image, on montre le champ puis la valeur choisie. */
const choose = async (act, select, option) => {
  await act.hover(select);
  // Un texte désigne l'option qui le contient ; sinon c'est un choix Playwright ({ index }, { label }).
  const target = typeof option === 'string' ? { label: (await select.locator('option', { hasText: option }).first().textContent()) ?? option } : option;
  await select.selectOption(target);
  await act.pause(700);
};

/** Champ déjà rempli : remplace sa valeur au lieu d'écrire à la suite. */
const retype = async (act, page, field, text) => {
  await act.click(field);
  await page.keyboard.press('Control+A');
  await field.pressSequentially(text, { delay: 70 });
  await act.pause(500);
};

/** Champ de date ou d'heure : la valeur est posée d'un coup, comme avec le sélecteur du navigateur. */
const setValue = async (act, field, value) => {
  await act.hover(field);
  await field.fill(value);
  await act.pause(700);
};

/** Ouvre la fiche d'un événement à venir depuis la liste (rang 0 = le plus proche) : son adresse change à chaque régénération. */
const openEvent = async (page, act, rank = 0) => {
  await act.click(page.locator('main a[href^="/evenements/"]').nth(rank));
  await page.getByRole('tablist', { name: 'Préparation de l\'événement' }).waitFor({ timeout: 20_000 });
  await settled(page);
  await act.pause(900);
};

const openTab = async (page, act, name) => {
  await act.click(page.getByRole('tab', { name, exact: true }));
  await settled(page);
  await act.pause(500);
};

/** Date du jour décalée, au format des champs de date (AAAA-MM-JJ). */
const dayFromNow = (offset) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('sv-SE');

const panel = (page) => page.getByRole('tabpanel');

export default {
  'evenements-liste': {
    start: '/evenements',
    async run({ page, act }) {
      await act.hover(page.locator('main a[href^="/evenements/"]').first());
      await act.pause(600);
      await act.click(page.getByRole('tab', { name: /^Passés/ }));
      await act.pause(1100);
      await act.click(page.getByRole('tab', { name: /^À venir/ }));
      await act.pause(500);
      await openEvent(page, act, 0);
      await act.hover(page.getByRole('heading', { level: 1 }));
      await act.pause(900);
      await act.hover(page.getByRole('tab', { name: 'Checklist', exact: true }));
      await act.hover(page.getByRole('tab', { name: 'Extras', exact: true }));
      await act.pause(600);
    },
  },

  'evenement-modifier': {
    start: '/evenements',
    async run({ page, act }) {
      await openEvent(page, act, 0);
      await act.click(page.getByRole('button', { name: 'Modifier', exact: true }));
      await retype(act, page, page.getByLabel('Couverts'), '52');
      await retype(act, page, page.getByLabel('Lieu'), 'Les Ateliers du Canal, salle haute');
      await act.hover(page.getByLabel('Statut'));
      await act.pause(700);
      await act.click(page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }));
      await act.hover(page.getByText('52 couverts'));
      await act.pause(900);
    },
  },

  'evenement-checklist': {
    start: '/evenements',
    async run({ page, act }) {
      await openEvent(page, act, 0);
      await act.scroll(330);
      await act.click(panel(page).getByRole('checkbox', { checked: false }).first());
      await act.pause(500);
      await act.type(page.getByLabel('Nouvelle tâche'), 'Prévenir le gardien pour l’accès camion');
      await act.click(panel(page).getByRole('button', { name: 'Ajouter' }));
      await act.scroll(420);
      const task = panel(page).getByRole('listitem').filter({ hasText: 'Prévenir le gardien' });
      await act.click(task.getByRole('button', { name: 'Monter' }));
      await act.click(task.getByRole('button', { name: 'Monter' }));
      await act.click(task.getByRole('checkbox'));
      await act.pause(600);
    },
  },

  'evenement-materiel': {
    start: '/evenements',
    async run({ page, act }) {
      await openEvent(page, act, 0);
      await openTab(page, act, 'Matériel');
      await act.scroll(330);
      await act.type(page.getByLabel('Nom du matériel'), 'Rampe de chargement');
      await retype(act, page, page.getByLabel('Quantité'), '2');
      await act.type(page.getByLabel('Unité'), 'pièces');
      await act.click(panel(page).getByRole('button', { name: 'Ajouter', exact: true }));
      await act.pause(500);
      await act.click(page.getByRole('checkbox', { name: 'Rampe de chargement' }));
      await act.pause(500);
      // Les lignes « du devis » : matériel et personnel vendus au client.
      const fromQuote = panel(page).getByRole('listitem').filter({ hasText: 'du devis' });
      await act.hover(fromQuote.first().getByText('du devis'));
      await act.pause(600);
      await act.click(fromQuote.getByRole('checkbox', { checked: false }).first());
      await act.pause(600);
    },
  },

  'evenement-location': {
    start: '/evenements',
    async run({ page, act }) {
      await openEvent(page, act, 1);
      await openTab(page, act, 'Matériel');
      await act.hover(page.getByRole('heading', { name: 'Location', exact: true }));
      await act.scroll(260);
      await act.hover(page.getByRole('button', { name: 'Générer depuis mes modèles' }));
      await act.pause(900);
      await act.click(panel(page).getByRole('checkbox', { name: /commandé$/ }).first());
      await act.pause(500);
      await act.click(page.getByRole('button', { name: 'Ajouter un article' }));
      await act.type(page.getByLabel('Article', { exact: true }), 'Vasque à champagne');
      await retype(act, page, page.getByRole('dialog').getByLabel('Quantité'), '4');
      await act.type(page.getByRole('dialog').getByLabel('Unité'), 'pièce');
      await retype(act, page, page.getByLabel('Prix unitaire HT'), '9');
      await choose(act, page.getByLabel('Fournisseur'), 'Loca-Réception');
      await act.click(page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }));
      await act.hover(page.getByText('Vasque à champagne', { exact: true }));
      await act.pause(600);
      await act.hover(page.getByText('Total de la location'));
      await act.pause(600);
    },
  },

  'evenement-courses': {
    start: '/evenements',
    async run({ page, act }) {
      await openEvent(page, act, 0);
      await openTab(page, act, 'Courses');
      await act.scroll(330);
      // Fermé dans la démonstration : on montre le bouton sans cliquer, les lignes calculées sont déjà là.
      await act.hover(page.getByRole('button', { name: 'Calculer depuis le devis' }));
      await act.pause(1200);
      await act.click(panel(page).getByRole('checkbox', { checked: false }).first());
      await act.pause(500);
      await act.click(page.getByRole('button', { name: 'Ajouter un ingrédient' }));
      await act.type(page.getByLabel('Rechercher un ingrédient'), 'cibou');
      await act.pause(500);
      await act.click(page.getByRole('dialog').getByRole('button', { name: /Ciboulette/ }));
      await retype(act, page, page.getByLabel('Quantité'), '2');
      await choose(act, page.getByLabel('Fournisseur'), 'Primeurs');
      await act.type(page.getByLabel('Note'), 'Pour le dressage des assiettes');
      await act.click(page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }));
      await act.hover(page.getByText('Ajout manuel').last());
      await act.pause(900);
    },
  },

  'evenement-mode-courses': {
    start: '/evenements',
    async run({ page, act }) {
      await openEvent(page, act, 0);
      await openTab(page, act, 'Courses');
      await act.click(page.getByRole('link', { name: 'Mode courses' }));
      await page.getByRole('heading', { name: 'Courses', exact: true }).waitFor({ timeout: 20_000 });
      await settled(page);
      await act.pause(900);
      const todo = page.locator('main button[aria-pressed="false"]');
      await act.click(todo.first());
      await act.click(todo.first());
      await act.pause(400);
      await act.click(page.getByRole('button', { name: 'Fruits & Légumes', exact: true }));
      await act.pause(700);
      await act.click(todo.first());
      await act.click(page.getByRole('button', { name: 'Tout', exact: true }));
      await act.pause(600);
    },
  },

  'evenement-extras': {
    start: '/evenements',
    async run({ page, act }) {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await openEvent(page, act, 0);
      await openTab(page, act, 'Extras');
      await act.scroll(330);
      await act.click(page.getByRole('button', { name: 'Affecter un extra' }));
      await choose(act, page.getByLabel('Extra', { exact: true }), { index: 1 });
      await setValue(act, page.getByLabel('Heure d’arrivée'), '10:30');
      await act.type(page.getByLabel('Consignes'), 'Tenue noire, service à l’assiette');
      await act.click(page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }));
      await act.scroll(260);
      const card = panel(page).getByRole('listitem').last();
      await act.click(card.getByRole('tab', { name: 'Confirmé' }));
      await act.click(card.getByRole('button', { name: 'Copier le lien de sa fiche mission' }));
      await act.pause(900);
    },
  },

  calendrier: {
    start: '/calendrier',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Mois suivant' }));
      await act.pause(700);
      // Un jour qui porte au moins un événement.
      await act.click(page.locator('main button[aria-pressed]:not([aria-label$=", 0 événement"])').first());
      await act.pause(900);
      await act.hover(page.locator('main a[href^="/evenements/"], main a[href^="/devis/"]').first());
      await act.pause(700);
      await act.click(page.getByRole('button', { name: 'Voir tout le mois' }));
      await act.click(page.getByRole('tab', { name: 'Confirmés' }));
      await act.pause(900);
      await act.hover(page.getByRole('button', { name: 'Aujourd’hui' }));
      await act.pause(500);
    },
  },

  'courses-globales': {
    start: '/courses-globales',
    async run({ page, act }) {
      const dates = page.locator('main input[type="date"]');
      await setValue(act, dates.nth(0), dayFromNow(0));
      await setValue(act, dates.nth(1), dayFromNow(60));
      await act.click(page.getByRole('button', { name: 'Calculer les besoins' }));
      await settled(page);
      await act.pause(900);
      await act.scroll(320);
      await act.pause(600);
      await act.scroll(320);
      await act.pause(500);
    },
  },

  'location-globale': {
    start: '/location-globale',
    async run({ page, act }) {
      const dates = page.locator('main input[type="date"]');
      await setValue(act, dates.nth(0), dayFromNow(0));
      await setValue(act, dates.nth(1), dayFromNow(60));
      await act.click(page.getByRole('button', { name: 'Calculer les besoins' }));
      await settled(page);
      await act.pause(900);
      await act.scroll(300);
      await act.hover(page.getByRole('button', { name: 'Bon fournisseur' }).first());
      await act.pause(700);
      await act.hover(page.getByRole('button', { name: 'Bon général PDF' }));
      await act.pause(600);
    },
  },
};
