// Scénarios des vidéos de la rubrique « Stock et achats ». Un scénario par guide, même identifiant.
// Rappel : le compte de démonstration n'enregistre rien, et ces pages relisent leurs données après chaque écriture.
// Un mouvement de stock, une commande ou un fournisseur validé disparaîtrait donc aussitôt de l'écran :
// ces vidéos montrent le geste jusqu'au bouton de validation, sans cliquer dessus.

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

/** Fenêtre ouverte par-dessus la page, reconnue à son titre (ces fenêtres n'ont pas de rôle « dialog »). */
const windowOf = (page, title) => page.locator('div.fixed.inset-0').filter({ hasText: title }).last();

export default {
  ingredients: {
    start: '/ingredients',
    async run({ page, act }) {
      // Les suggestions de produits d'Open Food Facts (site extérieur) changent d'un jour à l'autre
      // et montrent des marques : elles sont coupées pour la vidéo.
      await page.route(/openfoodfacts\.org/, (route) => route.abort());
      await act.click(page.getByRole('button', { name: 'Fruits & Légumes', exact: true }));
      await act.pause(500);
      await act.click(page.getByRole('button', { name: 'Ajouter', exact: true }));
      const win = windowOf(page, 'Ajouter un ingrédient');
      await act.type(win.getByPlaceholder('Ex. : Crème fraîche épaisse…'), 'Échalotes');
      await choose(act, win.locator('select').nth(0), 'Fruits & Légumes');
      await choose(act, win.locator('select').nth(1), 'kg');
      await choose(act, win.locator('select').nth(2), 'Primeurs');
      await act.type(win.getByPlaceholder('10', { exact: true }), '2');
      await act.type(win.getByPlaceholder('2.50'), '3.4');
      await act.click(win.getByRole('button', { name: 'Ajouter', exact: true }));
      await act.hover(page.getByText('Échalotes', { exact: true }));
      await act.pause(1000);
    },
  },

  stock: {
    start: '/stock',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: /Stock bas/ }));
      await act.pause(900);
      const card = page.locator('main div.rounded-xl').filter({ hasText: 'Farine T55' }).last();
      await act.click(card.getByTitle('Historique'));
      await act.pause(1500);
      await act.click(windowOf(page, 'Historique').getByRole('button').first());
      await act.click(card.getByRole('button', { name: 'Entrée' }));
      const win = windowOf(page, 'Entrée stock');
      await act.type(win.getByPlaceholder('10', { exact: true }), '25');
      await act.type(win.getByPlaceholder('Livraison fournisseur X'), 'Livraison Comptoir Darcy');
      await act.hover(win.getByRole('button', { name: 'Valider' }));
      await act.pause(900);
    },
  },

  'commande-fournisseur': {
    start: '/commandes',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Nouvelle commande' }));
      const win = windowOf(page, 'Nouvelle commande fournisseur');
      await choose(act, win.locator('select'), 'Primeurs');
      const search = win.getByPlaceholder('Rechercher un ingrédient…');
      await act.type(search, 'tomat');
      await act.click(win.getByRole('button', { name: /Tomates cerises/ }));
      await retype(act, page, win.locator('input[type="number"]').nth(0), '6');
      await act.type(search, 'courg');
      await act.click(win.getByRole('button', { name: /Courgettes/ }));
      await retype(act, page, win.locator('input[type="number"]').nth(2), '8');
      await act.hover(win.getByText(/^Total HT/));
      await act.pause(600);
      await act.type(win.getByPlaceholder('Pour le mariage Dupont du 14 juin…'), 'Pour le cocktail de samedi');
      await act.hover(win.getByRole('button', { name: 'Créer la commande' }));
      await act.pause(900);
    },
  },

  'commande-suivi': {
    start: '/commandes',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: /^Envoyées/ }));
      await act.pause(900);
      await act.click(page.getByRole('button', { name: 'Détails' }).first());
      await act.pause(1500);
      await act.click(page.getByRole('button', { name: 'Fermer' }));
      await act.hover(page.getByRole('button', { name: /Marquer reçue/ }).first());
      await act.pause(1200);
      await act.hover(page.getByTitle('Imprimer').first());
      await act.pause(600);
      await act.click(page.getByRole('button', { name: /^Brouillons/ }));
      await act.pause(600);
      await act.hover(page.getByRole('button', { name: 'Marquer envoyée' }).first());
      await act.pause(900);
    },
  },

  fournisseurs: {
    start: '/fournisseurs',
    async run({ page, act }) {
      await act.hover(page.getByText('Loca-Réception Côte-d’Or'));
      await act.pause(600);
      await act.click(page.getByRole('button', { name: 'Ajouter', exact: true }));
      await act.type(page.getByPlaceholder('Ex : METRO, Huguier Location…'), 'Fromagerie des Halles');
      await act.type(page.getByPlaceholder('01 23 45 67 89'), '01 99 00 41 12');
      await act.type(page.getByPlaceholder('contact@fournisseur.fr'), 'commandes@fromagerie.exemple.fr');
      await act.type(page.getByPlaceholder('Infos complémentaires…'), 'Livraison le mardi et le vendredi');
      await act.hover(page.getByRole('button', { name: 'Enregistrer' }));
      await act.pause(900);
    },
  },
};
