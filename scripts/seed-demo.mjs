// Crée le compte de démonstration : « Maison Verdier », un traiteur fictif à Dijon, avec un jeu de données complet.
// Usage : node scripts/seed-demo.mjs
//
// Rejouable : dans une seule transaction, le script supprime tout ce qui appartient au compte de démonstration,
// puis le recrée. Chaque suppression est filtrée par l'identifiant de ce compte, directement ou par une ligne
// qui lui appartient : aucune ligne d'un autre compte n'est lue pour être copiée, modifiée ou supprimée.
// Les lignes `users` et `profiles` du compte sont mises à jour sur place, jamais supprimées : aucune
// suppression en cascade ne peut donc partir de là.
// Les dates sont relatives au jour d'exécution : relancer le script garde la démonstration « vivante ».
// Toutes les données sont inventées (noms, adresses, téléphones 01 99 00 / 06 39 98, emails en @exemple.fr).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);
if (!env.DATABASE_URL || !/\.neon\.tech\//.test(env.DATABASE_URL)) throw new Error('DATABASE_URL doit pointer vers Neon.');

// Identité imposée par lib/demo.ts
const DEMO = '0d3e0000-0000-4000-8000-000000000001';
const DEMO_EMAIL = 'demo@webodevis.fr';

// ── Outils ───────────────────────────────────────────────────────────────────
// Identifiants stables d'une exécution à l'autre : les adresses des fiches restent valables après un rejeu.
const KINDS = ['supplier', 'ingredient', 'prestation', 'recipe', 'customer', 'contact', 'folder', 'token', 'prospect', 'quote',
  'line', 'task', 'material', 'cost', 'rental', 'rentalTpl', 'course', 'extra', 'mission', 'order', 'orderItem', 'movement',
  'devisTpl', 'quoteTpl', 'notification'];
const seq = {};
const uid = (kind) => {
  const k = KINDS.indexOf(kind);
  if (k < 0) throw new Error(`Type d'identifiant inconnu : ${kind}`);
  seq[kind] = (seq[kind] ?? 0) + 1;
  return `0d3e${String(k + 1).padStart(4, '0')}-0000-4000-8000-${String(seq[kind]).padStart(12, '0')}`;
};

const NOW = new Date();
const pad = (n) => String(n).padStart(2, '0');
const atDay = (offset) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + offset);
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Date (AAAA-MM-JJ) à J+offset ; avec `dow` (0 = dimanche … 6 = samedi), avancée jusqu'à ce jour de la semaine. */
const day = (offset, dow) => {
  const d = atDay(offset);
  if (dow !== undefined) while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  return ymd(d);
};
/** Horodatage à J+offset, à l'heure donnée ; jamais dans le futur. */
const ts = (offset, hour = 10, minute = 0) => {
  const d = atDay(offset);
  d.setHours(hour, minute, 0, 0);
  return new Date(Math.min(d.getTime(), NOW.getTime() - 5 * 60_000)).toISOString();
};
const dateFr = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const round2 = (n) => Math.round(n * 100) / 100;
const two = (n) => `${pad(Math.floor(n / 100) % 100)} ${pad(n % 100)}`;
const mobile = (n) => `06 39 98 ${two(1000 + n * 137)}`;
const fixe = (n) => `01 99 00 ${two(2000 + n * 211)}`;
const mail = (local) => `${local}@exemple.fr`;
/** Même règle que lib/events/needs.ts : sans accents, sans casse, espaces réduits. */
/** « 18 bouteilles », « 4 kg » : l'unité en toutes lettres prend la marque du pluriel. */
const qtyLabel = (qty, unit) => `${qty} ${['kg', 'L', 'g', 'cl'].includes(unit) ? unit : unit.toLowerCase() + (qty > 1 ? 's' : '')}`;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

// ── Entreprise ───────────────────────────────────────────────────────────────
const CGV = [
  '<p><strong>Devis et réservation.</strong> Le devis est valable 30 jours. La date est réservée à réception du devis signé et d’un acompte de 30 %.</p>',
  '<p><strong>Nombre de convives.</strong> Le nombre définitif est confirmé 10 jours avant la réception ; il sert de base à la facturation.</p>',
  '<p><strong>Règlement.</strong> Le solde est dû à réception de la facture, au plus tard 8 jours après la réception.</p>',
  '<p><strong>Annulation.</strong> Toute annulation à moins de 30 jours de la réception entraîne la conservation de l’acompte.</p>',
  '<p><strong>Allergènes.</strong> La liste des allergènes de chaque plat est communiquée sur simple demande.</p>',
].join('');

const profile = {
  id: DEMO,
  email: DEMO_EMAIL,
  first_name: 'Élise',
  last_name: 'Verdier',
  role: 'user',
  is_active: true,
  subscription_type: 'premium',
  company_name: 'Maison Verdier',
  company_siret: '000 000 000 00000',
  siret: '000 000 000 00000',
  company_address: '12 rue des Exemples, 21000 Dijon',
  company_phone: '01 99 00 21 00',
  company_email: mail('bonjour.maisonverdier'),
  company_website: 'www.maisonverdier.exemple.fr',
  company_logo_url: null,
  logo_url: null,
  company_cgv: CGV,
  cgv: CGV,
  custom_vat_rate: 10,
  default_vat_rate: 10,
  quotes_count: 0,
  parent_user_id: null,
  has_completed_onboarding: true,
  completed_tutorial_pages: [],
  updated_at: NOW.toISOString(),
};

// ── Fournisseurs ─────────────────────────────────────────────────────────────
const SUPPLIERS = [
  { key: 'primeurs', name: 'Primeurs Collin, carreau des Halles', contact: 'Gérald Collin', local: 'commandes.primeurs', address: '3 allée des Maraîchers, 21000 Dijon', notes: 'Livraison du mardi au samedi avant 7 h. Commande la veille avant 14 h.' },
  { key: 'boucherie', name: 'Boucherie Morvandelle Aubert', contact: 'Stéphane Aubert', local: 'boucherie.aubert', address: '27 rue du Charolais, 21000 Dijon', notes: 'Volailles fermières sur commande, 5 jours à l’avance.' },
  { key: 'maree', name: 'Marée de l’Ouche', contact: 'Nadège Ferrand', local: 'maree.ouche', address: '8 quai des Arrivages, 21000 Dijon', notes: 'Arrivages mardi et vendredi. Poisson fileté sur demande.' },
  { key: 'cremerie', name: 'Crèmerie du Val Suzon', contact: 'Bertrand Maillot', local: 'cremerie.valsuzon', address: '14 route des Alpages, 21121 Fontaine-lès-Dijon', notes: 'Fromages affinés, beurre et crème. Tournée le jeudi.' },
  { key: 'comptoir', name: 'Comptoir Darcy, épicerie et cave', contact: 'Isabelle Rochat', local: 'comptoir.darcy', address: '41 avenue des Négociants, 21000 Dijon', notes: 'Épicerie sèche, vins de Bourgogne et boissons. Franco à partir de 250 € HT.' },
  { key: 'location', name: 'Loca-Réception Côte-d’Or', contact: 'Yann Bressand', local: 'loca.reception', address: '5 rue de l’Entrepôt, 21300 Chenôve', notes: 'Vaisselle, mobilier et nappage. Livraison la veille, reprise le lendemain.' },
].map((s, i) => ({ ...s, id: uid('supplier'), phone: fixe(i + 1) }));
const supplier = (key) => SUPPLIERS.find((s) => s.key === key) ?? (() => { throw new Error(`Fournisseur inconnu : ${key}`); })();

// ── Ingrédients : nom, catégorie, unité, prix d'achat HT, fournisseur, stock visé, seuil d'alerte ──
const INGREDIENTS = [
  ['Tomates cerises', 'Fruits & Légumes', 'kg', 6.8, 'primeurs', 3, 0],
  ['Courgettes', 'Fruits & Légumes', 'kg', 2.9, 'primeurs', 4, 0],
  ['Pommes de terre grenaille', 'Fruits & Légumes', 'kg', 2.4, 'primeurs', 25, 10],
  ['Carottes fanes', 'Fruits & Légumes', 'Botte', 2.2, 'primeurs', 6, 0],
  ['Champignons de Paris', 'Fruits & Légumes', 'kg', 5.5, 'primeurs', 2, 0],
  ['Citrons jaunes', 'Fruits & Légumes', 'kg', 3.2, 'primeurs', 5, 2],
  ['Framboises', 'Fruits & Légumes', 'Barquette', 3.9, 'primeurs', 0, 0],
  ['Poires', 'Fruits & Légumes', 'kg', 3.4, 'primeurs', 8, 0],
  ['Oignons jaunes', 'Fruits & Légumes', 'kg', 1.6, 'primeurs', 12, 5],
  ['Mesclun', 'Fruits & Légumes', 'kg', 12, 'primeurs', 1, 0],
  ['Ciboulette', 'Herbes & Épices', 'Botte', 1.3, 'primeurs', 4, 0],
  ['Thym frais', 'Herbes & Épices', 'Botte', 1.2, 'primeurs', 3, 0],
  ['Suprême de volaille fermière', 'Viandes', 'kg', 14.5, 'boucherie', 0, 0],
  ['Paleron de bœuf', 'Viandes', 'kg', 13.9, 'boucherie', 6, 0],
  ['Jambon persillé', 'Charcuterie', 'kg', 19, 'boucherie', 2.5, 0],
  ['Lardons fumés', 'Charcuterie', 'kg', 9.8, 'boucherie', 3, 1],
  ['Saumon fumé', 'Poissons', 'kg', 38, 'maree', 1.5, 0],
  ['Dos de cabillaud', 'Poissons', 'kg', 24, 'maree', 0, 0],
  ['Gambas', 'Poissons', 'kg', 22, 'maree', 2, 0],
  ['Crème fraîche épaisse', 'Crèmerie', 'L', 4.6, 'cremerie', 6, 4],
  ['Beurre doux', 'Crèmerie', 'kg', 9.2, 'cremerie', 9, 5],
  ['Œufs frais', 'Crèmerie', 'Douzaine', 3.6, 'cremerie', 15, 8],
  ['Comté 18 mois', 'Crèmerie', 'kg', 26, 'cremerie', 4.5, 2],
  ['Époisses', 'Crèmerie', 'Unité', 8.5, 'cremerie', 6, 0],
  ['Fromage frais', 'Crèmerie', 'kg', 7.8, 'cremerie', 3, 0],
  ['Lait entier', 'Crèmerie', 'L', 1.1, 'cremerie', 12, 6],
  ['Farine T55', 'Épicerie', 'kg', 1.1, 'comptoir', 4, 10],
  ['Sucre semoule', 'Épicerie', 'kg', 1.4, 'comptoir', 18, 8],
  ['Chocolat noir 64 %', 'Épicerie', 'kg', 17.5, 'comptoir', 7, 3],
  ['Moutarde de Dijon', 'Épicerie', 'Pot', 3.2, 'comptoir', 9, 4],
  ['Huile d’olive', 'Épicerie', 'L', 9.5, 'comptoir', 11, 5],
  ['Riz carnaroli', 'Épicerie', 'kg', 4.2, 'comptoir', 14, 5],
  ['Pain d’épices', 'Épicerie', 'kg', 14, 'comptoir', 3, 0],
  ['Café en grains', 'Épicerie', 'kg', 19, 'comptoir', 5, 2],
  ['Pain de campagne', 'Boulangerie', 'Unité', 3.8, 'comptoir', 0, 0],
  ['Mini-pains navettes', 'Boulangerie', 'Unité', 0.45, 'comptoir', 0, 0],
  ['Crémant de Bourgogne', 'Boissons', 'Bouteille', 9.8, 'comptoir', 18, 24],
  ['Bourgogne aligoté', 'Boissons', 'Bouteille', 8.2, 'comptoir', 42, 24],
  ['Pinot noir', 'Boissons', 'Bouteille', 11.5, 'comptoir', 54, 24],
  ['Crème de cassis', 'Boissons', 'Bouteille', 12, 'comptoir', 7, 3],
  ['Jus de pomme artisanal', 'Boissons', 'Bouteille', 3.2, 'comptoir', 36, 18],
  ['Eau minérale', 'Boissons', 'Bouteille', 0.55, 'comptoir', 144, 60],
].map(([name, category, unit, price, sup, stock, alert]) => ({ id: uid('ingredient'), name, category, unit, price, supplier_id: supplier(sup).id, stock, alert }));
const ingredient = (name) => INGREDIENTS.find((i) => i.name === name) ?? (() => { throw new Error(`Ingrédient inconnu : ${name}`); })();

// ── Prestations : catégorie, sous-catégorie, nom, prix de vente HT, coût de revient, description, recette par convive ──
const PRESTATIONS = [
  ['cocktail', 'Bouchées salées', 'Cocktail dînatoire 12 pièces', 24, 8.4,
    'Douze pièces par convive, salées et sucrées : navettes garnies, verrines de saison, brochettes de gambas, gougères tièdes et mignardises.',
    { 'Saumon fumé': 0.03, 'Fromage frais': 0.025, 'Tomates cerises': 0.04, 'Mini-pains navettes': 3, 'Jambon persillé': 0.03, 'Gambas': 0.04, 'Comté 18 mois': 0.02, 'Œufs frais': 0.08, 'Farine T55': 0.02, 'Beurre doux': 0.015, 'Ciboulette': 0.05, 'Courgettes': 0.04 }],
  ['cocktail', 'Vin d\'honneur', 'Vin d’honneur 6 pièces', 12.5, 4.3,
    'Six pièces salées servies au plateau pendant le vin d’honneur : navettes, jambon persillé, comté, tomates confites.',
    { 'Tomates cerises': 0.025, 'Comté 18 mois': 0.02, 'Jambon persillé': 0.02, 'Mini-pains navettes': 2, 'Fromage frais': 0.015, 'Farine T55': 0.015, 'Beurre doux': 0.01 }],
  ['cocktail', 'Apéritif', 'Gougères au comté (3 pièces)', 3.6, 0.95,
    'Trois gougères au comté 18 mois, cuites le jour même et servies tièdes.',
    { 'Farine T55': 0.02, 'Beurre doux': 0.012, 'Œufs frais': 0.06, 'Comté 18 mois': 0.025, 'Lait entier': 0.03 }],
  ['cocktail', 'Bouchées sucrées', 'Plateau de mignardises (3 pièces)', 5.5, 1.7,
    'Trois mignardises par convive : tartelette framboise, carré chocolat, chou à la crème.',
    { 'Chocolat noir 64 %': 0.015, 'Framboises': 0.15, 'Farine T55': 0.015, 'Beurre doux': 0.012, 'Sucre semoule': 0.015, 'Œufs frais': 0.04, 'Crème fraîche épaisse': 0.02 }],
  ['cocktail', 'Buffet', 'Atelier saumon fumé et blinis', 7.5, 3.1,
    'Animation devant les convives : saumon fumé tranché à la demande, blinis maison, crème citronnée à la ciboulette.',
    { 'Saumon fumé': 0.05, 'Crème fraîche épaisse': 0.02, 'Farine T55': 0.02, 'Œufs frais': 0.04, 'Citrons jaunes': 0.02, 'Ciboulette': 0.04 }],
  ['dîner', 'Entrée', 'Œuf en meurette', 11, 3.4,
    'Œuf poché, sauce au pinot noir, lardons, champignons et croûton de pain de campagne.',
    { 'Œufs frais': 0.09, 'Lardons fumés': 0.03, 'Champignons de Paris': 0.04, 'Pinot noir': 0.08, 'Pain de campagne': 0.1, 'Oignons jaunes': 0.03 }],
  ['dîner', 'Entrée', 'Tartare de saumon fumé aux herbes', 12.5, 4.6,
    'Saumon fumé coupé au couteau, fromage frais, citron et ciboulette, quelques feuilles de mesclun.',
    { 'Saumon fumé': 0.07, 'Fromage frais': 0.03, 'Citrons jaunes': 0.03, 'Ciboulette': 0.06, 'Mesclun': 0.02 }],
  ['dîner', 'Plat principal', 'Suprême de volaille, sauce à l’époisses', 21, 6.9,
    'Suprême de volaille fermière rôti, sauce crémée à l’époisses, grenailles et carottes fanes.',
    { 'Suprême de volaille fermière': 0.18, 'Époisses': 0.08, 'Crème fraîche épaisse': 0.06, 'Pommes de terre grenaille': 0.15, 'Carottes fanes': 0.2, 'Beurre doux': 0.01 }],
  ['dîner', 'Plat principal', 'Bœuf bourguignon, grenailles rôties', 22.5, 7.4,
    'Paleron mijoté au pinot noir pendant six heures, lardons, champignons, carottes et grenailles rôties.',
    { 'Paleron de bœuf': 0.2, 'Pinot noir': 0.15, 'Lardons fumés': 0.03, 'Champignons de Paris': 0.05, 'Carottes fanes': 0.2, 'Oignons jaunes': 0.04, 'Pommes de terre grenaille': 0.18 }],
  ['dîner', 'Plat principal', 'Dos de cabillaud, beurre citronné', 23, 8.6,
    'Dos de cabillaud rôti sur peau, beurre citronné, courgettes et riz crémeux.',
    { 'Dos de cabillaud': 0.16, 'Beurre doux': 0.025, 'Citrons jaunes': 0.04, 'Courgettes': 0.12, 'Riz carnaroli': 0.06 }],
  ['dîner', 'Plat principal', 'Risotto aux champignons', 17.5, 4.8,
    'Plat végétarien : riz carnaroli, champignons poêlés, comté et vin blanc.',
    { 'Riz carnaroli': 0.09, 'Champignons de Paris': 0.12, 'Comté 18 mois': 0.03, 'Beurre doux': 0.02, 'Bourgogne aligoté': 0.04, 'Oignons jaunes': 0.03 }],
  ['dîner', 'Fromage', 'Assiette de fromages affinés', 7.5, 2.9,
    'Comté 18 mois et époisses, mesclun et pain de campagne.',
    { 'Comté 18 mois': 0.04, 'Époisses': 0.1, 'Pain de campagne': 0.1, 'Mesclun': 0.015 }],
  ['dîner', 'Dessert', 'Poire pochée au cassis, pain d’épices', 8.5, 2.3,
    'Poire pochée au sirop de cassis, crumble de pain d’épices.',
    { 'Poires': 0.18, 'Crème de cassis': 0.02, 'Sucre semoule': 0.03, 'Pain d’épices': 0.03 }],
  ['dîner', 'Dessert', 'Fondant au chocolat noir', 8, 2.2,
    'Fondant au chocolat noir 64 %, cœur coulant, crème légère.',
    { 'Chocolat noir 64 %': 0.045, 'Beurre doux': 0.03, 'Œufs frais': 0.08, 'Sucre semoule': 0.025, 'Farine T55': 0.01, 'Crème fraîche épaisse': 0.03 }],
  ['dîner', 'Menu complet', 'Menu enfant', 14, 4.5,
    'Volaille et grenailles, fondant au chocolat, jus de pomme. Jusqu’à 10 ans.',
    { 'Suprême de volaille fermière': 0.1, 'Pommes de terre grenaille': 0.12, 'Chocolat noir 64 %': 0.02, 'Jus de pomme artisanal': 0.25 }],
  ['boissons', 'Vins', 'Forfait vins de Bourgogne', 14, 6.2,
    'Bourgogne aligoté et pinot noir, une bouteille pour deux convives.',
    { 'Bourgogne aligoté': 0.25, 'Pinot noir': 0.25 }],
  ['boissons', 'Alcoolisées', 'Kir au crémant', 4.5, 1.6,
    'Crémant de Bourgogne et crème de cassis, un verre et demi par convive.',
    { 'Crémant de Bourgogne': 0.2, 'Crème de cassis': 0.015 }],
  ['boissons', 'Sans alcool', 'Forfait boissons sans alcool', 3.5, 1.1,
    'Jus de pomme artisanal, eaux plates et gazeuses à discrétion.',
    { 'Jus de pomme artisanal': 0.2, 'Eau minérale': 1 }],
  ['boissons', 'Café & thé', 'Café et thé', 2, 0.45,
    'Café en grains moulu sur place, sélection de thés, sucre.',
    { 'Café en grains': 0.012, 'Sucre semoule': 0.005 }],
  ['matériel', 'Vaisselle', 'Vaisselle et verrerie complète', 4.8, 2.6,
    'Assiettes, couverts et verres pour tout le repas, par couvert. Reprise non lavée.', null],
  ['matériel', 'Nappage', 'Nappage et serviettes en tissu', 2.5, 1.2,
    'Nappes et serviettes en coton blanc, par couvert.', null],
  ['matériel', 'Mobilier', 'Table ronde 8 personnes et chaises', 38, 19,
    'Une table ronde de 150 cm et ses huit chaises, livrées et installées.', null],
  ['personnel', 'Maître d\'hôtel', 'Maître d’hôtel', 280, 190,
    'Coordination du service en salle, de la mise en place au départ des convives.', null],
  ['personnel', 'Serveur', 'Serveur', 190, 135,
    'Service en salle, vacation de sept heures, tenue noire.', null],
  ['personnel', 'Chef à domicile', 'Chef en cuisine sur place', 320, 220,
    'Cuissons et dressage sur le lieu de réception.', null],
  ['logistique', 'Livraison', 'Livraison et installation', 120, 55,
    'Livraison dans un rayon de 40 km autour de Dijon, installation du buffet ou de l’office.', null],
  ['logistique', 'Transport', 'Camion frigorifique', 160, 95,
    'Transport en température dirigée pour les réceptions de plus de 90 couverts.', null],
].map(([category, sub_category, name, price, cost, text, recipe]) => ({
  id: uid('prestation'), category, sub_category, name, price, cost, description: `<p>${text}</p>`,
  recipe: Object.entries(recipe ?? {}).map(([ing, qty]) => ({ ingredient: ingredient(ing), qty })),
}));
const prestation = (name) => PRESTATIONS.find((p) => p.name === name) ?? (() => { throw new Error(`Prestation inconnue : ${name}`); })();

// ── Clients ──────────────────────────────────────────────────────────────────
const CUSTOMERS = [
  { key: 'berthier', first: 'Camille', last: 'Berthier', address: '18 rue des Lilas, 21000 Dijon', notes: 'Mariage avec Hugo Lemaire. Préfère être jointe le soir.' },
  { key: 'marchetti', first: 'Julien', last: 'Marchetti', address: '4 impasse du Verger, 21240 Talant', notes: 'Très satisfait du mariage. A recommandé la maison à deux amis.' },
  { key: 'delaunay', first: 'Sophie', last: 'Delaunay', address: '62 avenue des Tilleuls, 21200 Beaune', notes: null },
  { key: 'rousselot', first: 'Antoine', last: 'Rousselot', address: '9 chemin des Vignes, 21160 Marsannay-la-Côte', notes: 'Dégustation faite à l’atelier, hésite encore sur le plat.' },
  { key: 'tessier', first: 'Margaux', last: 'Tessier', address: '31 rue du Moulin, 21121 Fontaine-lès-Dijon', notes: null },
  { key: 'gautherot', first: 'Hélène', last: 'Gautherot', address: '7 place de l’Église, 21800 Quetigny', notes: 'Anniversaire surprise : ne pas appeler le fixe.' },
  { key: 'perrinvidal', first: 'Thomas', last: 'Perrin-Vidal', address: '25 rue des Acacias, 21300 Chenôve', notes: null },
  { key: 'benali', first: 'Nadia', last: 'Benali', address: '3 allée des Peupliers, 21000 Dijon', notes: 'Deux convives végétariens.' },
  { key: 'lacombe', first: 'Bastien', last: 'Lacombe', address: '14 route de la Combe, 21370 Plombières-lès-Dijon', notes: null },
  { key: 'lumen', company: 'Atelier Lumen', contact: 'Claire Fontanel', role: 'Office manager', address: '5 cours des Architectes, 21000 Dijon', notes: 'Agence d’architecture, deux à trois réceptions par an.' },
  { key: 'sorelia', company: 'Groupe Sorélia', contact: 'Marc Dumoulin', role: 'Directeur des ressources humaines', address: '120 boulevard de l’Industrie, 21000 Dijon', notes: 'Bon de commande obligatoire avant facturation.' },
  { key: 'hautefeuille', company: 'Cabinet Hautefeuille Avocats', contact: 'Anne Hautefeuille', role: 'Associée', address: '2 place du Palais, 21000 Dijon', notes: null },
  { key: 'tilleuls', company: 'Domaine des Hauts Tilleuls', contact: 'Pierre Vasseur', role: 'Régisseur', address: 'Lieu-dit Les Hauts Tilleuls, 21220 Gevrey-Chambertin', notes: 'Lieu de réception partenaire : office équipé, accès camion par l’arrière.' },
  { key: 'patrimoine', company: 'Association Les Amis du Patrimoine de l’Ouche', contact: 'Monique Jacquot', role: 'Présidente', address: '11 rue de la Mairie, 21410 Fleurey-sur-Ouche', notes: 'Gala annuel en septembre, dîner des adhérents au printemps.' },
  { key: 'orvane', company: 'Orvane Conseil', contact: 'Karim Haddad', role: 'Associé', address: '48 rue des Entrepreneurs, 21000 Dijon', notes: null },
].map((c, i) => {
  const isCompany = !!c.company;
  const slug = norm(isCompany ? c.contact : `${c.first} ${c.last}`).replace(/[^a-z]+/g, '.');
  return {
    ...c, id: uid('customer'), isCompany,
    name: isCompany ? c.company : `${c.first} ${c.last}`,
    email: mail(isCompany ? `${slug}.${c.key}` : slug),
    phone: isCompany ? fixe(20 + i) : mobile(i + 1),
    contactPhone: isCompany ? mobile(40 + i) : null,
    created: ts(-210 + i * 13, 9 + (i % 8), (i * 17) % 60),
  };
});
const customer = (key) => CUSTOMERS.find((c) => c.key === key) ?? (() => { throw new Error(`Client inconnu : ${key}`); })();

const CONTACTS = [
  ['lumen', 'Claire Fontanel', 'Office manager', true], ['lumen', 'Romain Vidal', 'Gérant', false],
  ['sorelia', 'Marc Dumoulin', 'Directeur des ressources humaines', true], ['sorelia', 'Élodie Baron', 'Assistante de direction', false],
  ['patrimoine', 'Monique Jacquot', 'Présidente', true], ['patrimoine', 'Alain Royer', 'Trésorier', false],
].map(([key, name, role, primary], i) => ({
  id: uid('contact'), customer_id: customer(key).id, name, role, is_primary: primary,
  email: primary ? customer(key).email : mail(`${norm(name).replace(/[^a-z]+/g, '.')}.${key}`),
  phone: primary ? customer(key).contactPhone : mobile(60 + i),
}));

// ── Dossiers de devis ────────────────────────────────────────────────────────
const FOLDERS = {
  mariages: { id: uid('folder'), name: 'Mariages de la saison prochaine', color: 'rose', icon: 'heart' },
  entreprises: { id: uid('folder'), name: 'Entreprises', color: 'teal', icon: 'briefcase' },
};

// ── Demandes reçues par le formulaire en ligne ───────────────────────────────
const PROSPECT_TOKEN = crypto.randomBytes(16).toString('hex');
const PROSPECTS = [
  { key: 'chevalier', first: 'Laure', last: 'Chevalier', type: 'Mariage', date: day(300, 6), guests: 120, children: 10, status: 'nouveau', created: new Date(NOW.getTime() - 3 * 3600_000).toISOString(), place: 'Domaine à définir, autour de Beaune', message: 'Bonjour, nous nous marions l’été prochain et cherchons un traiteur pour un vin d’honneur puis un dîner assis. Proposez-vous une dégustation ?' },
  { key: 'roussel', first: 'Emmanuel', last: 'Roussel', type: 'Séminaire', date: day(40, 2), guests: 35, status: 'nouveau', created: ts(-1, 16, 40), place: 'Nos locaux, zone d’activité de Longvic', message: 'Journée de séminaire : accueil café, déjeuner assis et pause de l’après-midi. Trois régimes sans gluten.' },
  { key: 'pichon', first: 'Anaïs', last: 'Pichon', type: 'Anniversaire', date: day(65, 6), guests: 50, status: 'nouveau', created: ts(-3, 11, 15), place: 'Salle des fêtes de Couchey', message: 'Les 40 ans de mon mari, plutôt un cocktail dînatoire avec un atelier. Budget autour de 45 € par personne.' },
  { key: 'langlois', first: 'Victor', last: 'Langlois', type: 'Mariage', date: day(330, 6), guests: 90, children: 6, status: 'broch_envoyee', created: ts(-8, 9, 30), place: 'Château à confirmer', message: 'Nous comparons plusieurs traiteurs. Pouvez-vous nous envoyer votre brochure et vos tarifs ?' },
  { key: 'marchal', first: 'Céline', last: 'Marchal', type: 'Baptême', date: day(120, 0), guests: 45, children: 12, status: 'devis_a_faire', created: ts(-6, 14, 5), place: 'À domicile, Saint-Apollinaire', message: 'Déjeuner de baptême dans le jardin, service à table si possible. Beaucoup d’enfants.' },
  { key: 'delaunay', first: 'Sophie', last: 'Delaunay', type: 'Mariage', date: day(270, 6), guests: 140, children: 8, status: 'devis_envoye', created: ts(-11, 18, 20), place: 'Orangerie du parc, Beaune', message: 'Mariage en fin de printemps. Nous aimerions un menu autour des produits de Bourgogne.' },
  { key: 'gautherot', first: 'Hélène', last: 'Gautherot', type: 'Anniversaire', date: day(31, 6), guests: 60, status: 'acompte', created: ts(-42, 10, 45), place: 'Salle du Clos, Quetigny', message: 'Anniversaire surprise pour les 50 ans de mon mari. Cocktail dînatoire, pas de repas assis.' },
  { key: 'colas', first: 'Damien', last: 'Colas', type: 'Cocktail', date: day(20, 4), guests: 60, status: 'refus_client', created: ts(-30, 15, 10), place: 'Showroom, Dijon', message: 'Soirée clients pour l’ouverture de notre showroom. Nous avons finalement choisi une autre formule.' },
].map((p, i) => ({ ...p, id: uid('prospect'), email: mail(`${norm(p.first)}.${norm(p.last)}`), phone: mobile(80 + i) }));
const prospect = (key) => PROSPECTS.find((p) => p.key === key);

// ── Devis ────────────────────────────────────────────────────────────────────
/** Ligne de devis, telle que l'éditeur l'enregistre quand on ajoute une prestation du catalogue. */
const line = (name, quantity, flags = {}) => {
  const p = prestation(name);
  return {
    id: uid('line'), name: p.name, description: p.description, quantity, unitPrice: p.price, childUnitPrice: null,
    category: p.category, gastroCardHtml: null, gastroCardHtmlEn: null, isOption: false, isFree: false, removed: false, ...flags,
  };
};
/** Lignes à partir d'un menu : les prestations au couvert prennent le nombre de convives. */
const menu = (guests, perGuest, fixed = [], extra = []) => [
  ...perGuest.map((name) => line(name, guests)),
  ...fixed.map(([name, qty]) => line(name, qty)),
  ...extra,
];

const QUOTES = [
  // ── Confirmés, à venir : ce sont les événements à préparer ────────────────
  { key: 'mariageBerthier', customer: 'berthier', type: 'Mariage', date: day(17, 6), guests: 110, status: 'acompte', created: -95, template: 'mariage',
    internal: 'Mariage Camille et Hugo', location: 'Château de Varennes-le-Bas, 21490 Varois-et-Chaignot', arrival: '13:00', folder: 'mariages',
    remarks: 'Vin d’honneur dans le parc à 17 h, dîner servi à 20 h sous la verrière.',
    notes: 'Acompte de 30 % reçu. Trois menus végétariens, un sans gluten (table des mariés).',
    lines: menu(110, ['Vin d’honneur 6 pièces', 'Kir au crémant', 'Tartare de saumon fumé aux herbes', 'Suprême de volaille, sauce à l’époisses', 'Assiette de fromages affinés', 'Fondant au chocolat noir', 'Forfait vins de Bourgogne', 'Café et thé', 'Vaisselle et verrerie complète', 'Nappage et serviettes en tissu'],
      [['Table ronde 8 personnes et chaises', 14], ['Maître d’hôtel', 1], ['Serveur', 6], ['Chef en cuisine sur place', 1], ['Livraison et installation', 1]]) },
  { key: 'seminaireSorelia', customer: 'sorelia', type: 'Séminaire', date: day(9, 4), guests: 45, status: 'valide', created: -20, template: 'business',
    internal: 'Séminaire de rentrée Sorélia', location: 'Les Ateliers du Canal, 21000 Dijon', arrival: '10:30', folder: 'entreprises',
    remarks: 'Déjeuner assis à 12 h 30, service en une heure et quart.',
    notes: 'Bon de commande reçu. Quatre convives sans poisson : prévoir le risotto.',
    lines: menu(45, ['Œuf en meurette', 'Dos de cabillaud, beurre citronné', 'Poire pochée au cassis, pain d’épices', 'Forfait boissons sans alcool', 'Café et thé', 'Vaisselle et verrerie complète'],
      [['Serveur', 2], ['Livraison et installation', 1]]) },
  { key: 'anniversaireGautherot', customer: 'gautherot', type: 'Anniversaire', date: day(31, 6), guests: 60, status: 'acompte', created: -40, template: 'standard',
    internal: 'Les 50 ans de Bruno (surprise)', location: 'Salle du Clos, 21800 Quetigny', arrival: '17:30', prospect: 'gautherot',
    remarks: 'Cocktail dînatoire à partir de 19 h 30. Les convives arrivent avant l’invité d’honneur.',
    notes: 'Surprise : tout passe par Hélène, sur son portable uniquement.',
    lines: menu(60, ['Cocktail dînatoire 12 pièces', 'Gougères au comté (3 pièces)', 'Plateau de mignardises (3 pièces)', 'Kir au crémant', 'Forfait boissons sans alcool', 'Vaisselle et verrerie complète'],
      [['Serveur', 3], ['Livraison et installation', 1]]) },
  { key: 'inaugurationLumen', customer: 'lumen', type: 'Cocktail', date: day(52, 4), guests: 80, status: 'valide', created: -6, template: 'business',
    internal: 'Inauguration des nouveaux bureaux', location: 'Atelier Lumen, 5 cours des Architectes, 21000 Dijon', arrival: '16:30', folder: 'entreprises',
    remarks: 'Cocktail de 18 h 30 à 21 h 30, discours à 19 h.',
    notes: 'Pas d’office sur place : tout arrive dressé. Ascenseur de service à réserver.',
    lines: menu(80, ['Cocktail dînatoire 12 pièces', 'Atelier saumon fumé et blinis', 'Plateau de mignardises (3 pièces)', 'Forfait vins de Bourgogne', 'Forfait boissons sans alcool', 'Vaisselle et verrerie complète'],
      [['Serveur', 4], ['Maître d’hôtel', 1], ['Livraison et installation', 1]]) },
  // ── Confirmés, passés ────────────────────────────────────────────────────
  { key: 'mariageMarchetti', customer: 'marchetti', type: 'Mariage', date: day(-30, 6), guests: 95, status: 'paye', created: -150, template: 'mariage',
    internal: 'Mariage Julien et Inès', location: 'Domaine des Hauts Tilleuls, 21220 Gevrey-Chambertin', arrival: '13:30',
    remarks: 'Vin d’honneur à 17 h 30, dîner à 20 h 30.', notes: 'Soldé. Très bon retour des mariés.',
    lines: menu(95, ['Vin d’honneur 6 pièces', 'Kir au crémant', 'Œuf en meurette', 'Bœuf bourguignon, grenailles rôties', 'Assiette de fromages affinés', 'Poire pochée au cassis, pain d’épices', 'Forfait vins de Bourgogne', 'Café et thé', 'Vaisselle et verrerie complète', 'Nappage et serviettes en tissu'],
      [['Table ronde 8 personnes et chaises', 12], ['Maître d’hôtel', 1], ['Serveur', 5], ['Chef en cuisine sur place', 1], ['Livraison et installation', 1], ['Camion frigorifique', 1]]) },
  { key: 'seminaireOrvane', customer: 'orvane', type: 'Séminaire', date: day(-50, 2), guests: 30, status: 'paye', created: -75, template: 'business',
    internal: null, location: 'Orvane Conseil, 48 rue des Entrepreneurs, 21000 Dijon', arrival: '11:00',
    remarks: 'Déjeuner de travail servi en salle de réunion.', notes: 'Facture réglée à 30 jours.',
    lines: menu(30, ['Tartare de saumon fumé aux herbes', 'Risotto aux champignons', 'Fondant au chocolat noir', 'Forfait boissons sans alcool', 'Café et thé', 'Vaisselle et verrerie complète'],
      [['Serveur', 1], ['Livraison et installation', 1]]) },
  { key: 'baptemeTessier', customer: 'tessier', type: 'Baptême', date: day(-72, 0), guests: 40, status: 'paye', created: -110, template: 'standard',
    internal: 'Baptême de Léon', location: 'À domicile, 21121 Fontaine-lès-Dijon', arrival: '10:00',
    remarks: 'Déjeuner au jardin, repli sous barnum en cas de pluie.', notes: null,
    lines: menu(40, ['Gougères au comté (3 pièces)', 'Kir au crémant', 'Suprême de volaille, sauce à l’époisses', 'Fondant au chocolat noir', 'Forfait vins de Bourgogne', 'Forfait boissons sans alcool', 'Café et thé', 'Vaisselle et verrerie complète', 'Nappage et serviettes en tissu'],
      [['Serveur', 2], ['Livraison et installation', 1]]) },
  { key: 'galaPatrimoine', customer: 'patrimoine', type: 'Gala', date: day(-14, 5), guests: 120, status: 'acompte', created: -60, template: 'standard',
    internal: 'Gala annuel des Amis du Patrimoine', location: 'Halle aux Grains, 21410 Fleurey-sur-Ouche', arrival: '15:00',
    remarks: 'Apéritif à 19 h, dîner à 20 h, remise des prix pendant le fromage.', notes: 'Solde attendu : relancer le trésorier en fin de mois.',
    lines: menu(120, ['Kir au crémant', 'Tartare de saumon fumé aux herbes', 'Bœuf bourguignon, grenailles rôties', 'Assiette de fromages affinés', 'Poire pochée au cassis, pain d’épices', 'Forfait vins de Bourgogne', 'Café et thé', 'Vaisselle et verrerie complète', 'Nappage et serviettes en tissu'],
      [['Table ronde 8 personnes et chaises', 15], ['Maître d’hôtel', 1], ['Serveur', 6], ['Chef en cuisine sur place', 1], ['Camion frigorifique', 1]]) },
  // ── En cours ─────────────────────────────────────────────────────────────
  { key: 'afterworkOrvane', customer: 'orvane', type: 'Cocktail', date: day(45, 4), guests: 40, status: 'nouveau', created: -2, template: 'business',
    internal: 'Afterwork clients Orvane', location: 'Orvane Conseil, 48 rue des Entrepreneurs, 21000 Dijon', folder: 'entreprises',
    remarks: null, notes: 'Demande reçue par téléphone, à chiffrer.',
    lines: menu(40, ['Vin d’honneur 6 pièces', 'Forfait vins de Bourgogne', 'Forfait boissons sans alcool'], [['Serveur', 1]]) },
  { key: 'anniversaireBenali', customer: 'benali', type: 'Anniversaire', date: day(75, 6), guests: 35, status: 'broch_envoyee', created: -5, template: 'standard',
    internal: null, location: 'À domicile, 21000 Dijon', remarks: null, notes: 'Brochure envoyée, rappeler en fin de semaine.',
    lines: menu(35, ['Cocktail dînatoire 12 pièces', 'Kir au crémant', 'Forfait boissons sans alcool'], [['Serveur', 1], ['Livraison et installation', 1]]) },
  { key: 'seminaireHautefeuille', customer: 'hautefeuille', type: 'Séminaire', date: day(38, 3), guests: 25, status: 'devis_a_faire', created: -3, template: 'business',
    internal: 'Journée des associés', location: 'Cabinet Hautefeuille, 2 place du Palais, 21000 Dijon', folder: 'entreprises',
    remarks: null, notes: 'Attendent un devis avant vendredi.',
    lines: menu(25, ['Tartare de saumon fumé aux herbes', 'Dos de cabillaud, beurre citronné', 'Fondant au chocolat noir', 'Forfait boissons sans alcool', 'Café et thé', 'Vaisselle et verrerie complète'], [['Serveur', 1], ['Livraison et installation', 1]]) },
  { key: 'communionPerrinVidal', customer: 'perrinvidal', type: 'Communion', date: day(200, 0), guests: 28, status: 'devis_a_faire', created: -1, template: 'standard',
    internal: null, location: 'À domicile, 21300 Chenôve', remarks: null, notes: null,
    lines: menu(28, ['Gougères au comté (3 pièces)', 'Suprême de volaille, sauce à l’époisses', 'Fondant au chocolat noir', 'Forfait boissons sans alcool'], [['Menu enfant', 6], ['Livraison et installation', 1]]) },
  { key: 'mariageDelaunay', customer: 'delaunay', type: 'Mariage', date: day(270, 6), guests: 140, status: 'devis_envoye', created: -9, sent: -8, template: 'mariage',
    internal: 'Mariage Sophie et Arnaud', location: 'Orangerie du parc, 21200 Beaune', folder: 'mariages', prospect: 'delaunay',
    remarks: 'Proposition autour des produits de Bourgogne, à ajuster après la dégustation.', notes: 'Devis envoyé, dégustation à proposer.',
    lines: menu(140, ['Vin d’honneur 6 pièces', 'Kir au crémant', 'Œuf en meurette', 'Suprême de volaille, sauce à l’époisses', 'Assiette de fromages affinés', 'Poire pochée au cassis, pain d’épices', 'Forfait vins de Bourgogne', 'Café et thé', 'Vaisselle et verrerie complète', 'Nappage et serviettes en tissu'],
      [['Table ronde 8 personnes et chaises', 18], ['Maître d’hôtel', 1], ['Serveur', 8], ['Chef en cuisine sur place', 2], ['Camion frigorifique', 1]],
      [line('Atelier saumon fumé et blinis', 140, { isOption: true })]) },
  { key: 'vendangesTilleuls', customer: 'tilleuls', type: 'Cocktail', date: day(24, 5), guests: 70, status: 'devis_envoye', created: -12, sent: -10, template: 'standard',
    internal: 'Soirée de fin de vendanges', location: 'Domaine des Hauts Tilleuls, 21220 Gevrey-Chambertin',
    remarks: 'Les vins sont fournis par le domaine.', notes: 'Relancer Pierre Vasseur en début de semaine.',
    lines: menu(70, ['Cocktail dînatoire 12 pièces', 'Gougères au comté (3 pièces)', 'Plateau de mignardises (3 pièces)', 'Forfait boissons sans alcool', 'Vaisselle et verrerie complète'], [['Serveur', 3], ['Livraison et installation', 1]]) },
  { key: 'galaSorelia', customer: 'sorelia', type: 'Gala', date: day(80, 5), guests: 150, status: 'rdv_deg_a_venir', created: -15, template: 'business',
    internal: 'Soirée de fin d’année Sorélia', location: 'Grande Halle du Port du Canal, 21000 Dijon', folder: 'entreprises',
    remarks: 'Dîner assis suivi d’une soirée dansante.', notes: `Dégustation prévue le ${dateFr(day(6, 2))} à l’atelier, quatre personnes.`,
    lines: menu(150, ['Kir au crémant', 'Tartare de saumon fumé aux herbes', 'Suprême de volaille, sauce à l’époisses', 'Fondant au chocolat noir', 'Forfait vins de Bourgogne', 'Café et thé', 'Vaisselle et verrerie complète', 'Nappage et serviettes en tissu'],
      [['Table ronde 8 personnes et chaises', 19], ['Maître d’hôtel', 2], ['Serveur', 8], ['Chef en cuisine sur place', 2], ['Camion frigorifique', 1]]) },
  { key: 'mariageRousselot', customer: 'rousselot', type: 'Mariage', date: day(240, 6), guests: 130, status: 'rdv_deg_fait', created: -30, template: 'mariage',
    internal: 'Mariage Antoine et Lucie', location: 'Ferme du Val Fleuri, 21160 Marsannay-la-Côte', folder: 'mariages',
    remarks: 'Douze enfants à une table dédiée.', notes: 'Dégustation faite : hésitent entre la volaille et le bœuf. Réponse attendue sous quinze jours.',
    lines: menu(118, ['Vin d’honneur 6 pièces', 'Kir au crémant', 'Tartare de saumon fumé aux herbes', 'Bœuf bourguignon, grenailles rôties', 'Assiette de fromages affinés', 'Fondant au chocolat noir', 'Forfait vins de Bourgogne'],
      [['Menu enfant', 12], ['Vaisselle et verrerie complète', 130], ['Nappage et serviettes en tissu', 130], ['Table ronde 8 personnes et chaises', 17], ['Maître d’hôtel', 1], ['Serveur', 7], ['Chef en cuisine sur place', 1], ['Camion frigorifique', 1]],
      [line('Café et thé', 130, { isFree: true })]) },
  { key: 'dinerPatrimoine', customer: 'patrimoine', type: 'Autre', date: day(60, 6), guests: 85, status: 'devis_final', created: -18, template: 'standard',
    internal: 'Dîner des adhérents', location: 'Salle des Tanneurs, 21410 Fleurey-sur-Ouche',
    remarks: 'Menu unique, service à l’assiette.', notes: 'Version finale envoyée, signature attendue au prochain bureau.',
    lines: menu(85, ['Kir au crémant', 'Œuf en meurette', 'Suprême de volaille, sauce à l’époisses', 'Poire pochée au cassis, pain d’épices', 'Forfait vins de Bourgogne', 'Café et thé', 'Vaisselle et verrerie complète'],
      [['Serveur', 4], ['Maître d’hôtel', 1], ['Livraison et installation', 1]]) },
  // ── Refusés ──────────────────────────────────────────────────────────────
  { key: 'seminaireLumen', customer: 'lumen', type: 'Séminaire', date: day(-30, 3), guests: 20, status: 'refus_client', created: -70, template: 'business',
    internal: null, location: 'Atelier Lumen, 5 cours des Architectes, 21000 Dijon', remarks: null, notes: 'Ont finalement réservé un restaurant.',
    lines: menu(20, ['Risotto aux champignons', 'Fondant au chocolat noir', 'Forfait boissons sans alcool', 'Café et thé'], [['Livraison et installation', 1]]) },
  { key: 'cocktailHautefeuille', customer: 'hautefeuille', type: 'Cocktail', date: day(-55, 4), guests: 50, status: 'refus_client', created: -90, template: 'business',
    internal: 'Vœux du cabinet', location: 'Cabinet Hautefeuille, 2 place du Palais, 21000 Dijon', remarks: null, notes: 'Budget revu à la baisse, événement annulé.',
    lines: menu(50, ['Cocktail dînatoire 12 pièces', 'Forfait vins de Bourgogne', 'Forfait boissons sans alcool'], [['Serveur', 2], ['Livraison et installation', 1]]) },
  { key: 'mariageLacombe', customer: 'lacombe', type: 'Mariage', date: day(17, 6), guests: 200, status: 'refus_traiteur', created: -25, template: 'mariage',
    internal: null, location: 'Château de la Combe Noire, 21370 Plombières-lès-Dijon', remarks: null, notes: 'Date déjà prise par le mariage Berthier : demande déclinée.',
    lines: menu(200, ['Vin d’honneur 6 pièces', 'Suprême de volaille, sauce à l’époisses', 'Fondant au chocolat noir', 'Forfait vins de Bourgogne'], [['Serveur', 10]]) },
].map((q, i) => {
  const c = customer(q.customer);
  const ht = q.lines.reduce((s, l) => s + (l.isOption || l.isFree || l.removed ? 0 : l.quantity * l.unitPrice), 0);
  const cost = q.lines.reduce((s, l) => s + (l.isOption || l.removed ? 0 : l.quantity * prestation(l.name).cost), 0);
  return { ...q, id: uid('quote'), c, number: `MV-${NOW.getFullYear()}-${String(i + 1).padStart(3, '0')}`, ht: round2(ht), ttc: round2(ht * 1.1), cost: round2(cost) };
});
const quote = (key) => QUOTES.find((q) => q.key === key) ?? (() => { throw new Error(`Devis inconnu : ${key}`); })();
const CONFIRMED = ['valide', 'acompte', 'paye'];
const TODAY = day(0);
const events = QUOTES.filter((q) => CONFIRMED.includes(q.status));
const upcoming = events.filter((q) => q.date >= TODAY);
const past = events.filter((q) => q.date < TODAY);

// ── Préparation des événements ───────────────────────────────────────────────
const TASKS = [
  'Confirmer le nombre définitif de convives', 'Valider le menu et les régimes particuliers', 'Commander les produits frais',
  'Réserver la vaisselle et le nappage', 'Confirmer l’équipe de service', 'Repérer l’accès livraison et l’office',
  'Imprimer les menus et les étiquettes allergènes', 'Charger le camion la veille', 'Envoyer la facture de solde',
];
const MATERIALS = [['Caisses isothermes', 8, 'pièces'], ['Étuve de maintien au chaud', 2, 'pièces'], ['Plaques à induction', 4, 'pièces'],
  ['Percolateur 100 tasses', 1, 'pièce'], ['Nappes de buffet', 6, 'pièces'], ['Planches et couteaux de découpe', 1, 'lot'], ['Trousse de secours', 1, 'pièce']];
const prep = {
  seminaireSorelia: { tasksDone: 5, tasks: 8, materials: 5, materialsDone: 3, lineChecks: 1, costs: [['Essence et stationnement', 28]] },
  mariageBerthier: { tasksDone: 3, tasks: 8, materials: 7, materialsDone: 2, lineChecks: 2, costs: [['Essence et péage', 46], ['Fleurs de buffet', 120]] },
  anniversaireGautherot: { tasksDone: 2, tasks: 7, materials: 4, materialsDone: 0, lineChecks: 0, costs: [] },
  inaugurationLumen: { tasksDone: 1, tasks: 6, materials: 4, materialsDone: 0, lineChecks: 0, costs: [['Location d’un monte-charge', 90]] },
};
for (const q of past) prep[q.key] = { tasksDone: 9, tasks: 9, materials: 5, materialsDone: 5, lineChecks: 99, costs: [['Essence et péage', 38]] };
for (const q of events) {
  const p = prep[q.key];
  q.checklist = TASKS.slice(0, p.tasks).map((text, i) => ({ id: uid('task'), text, done: i < p.tasksDone }));
  q.materials = MATERIALS.slice(0, p.materials).map(([name, qty, unit], i) => ({ id: uid('material'), name, qty, unit, checked: i < p.materialsDone }));
  q.materialChecks = q.lines.filter((l) => ['matériel', 'personnel'].includes(l.category)).slice(0, p.lineChecks).map((l) => l.id);
  q.extraCosts = p.costs.map(([label, amount]) => ({ id: uid('cost'), label, amount }));
}

// Modèles de location (quantité par convive) et location de chaque événement.
const RENTAL_TEMPLATES = [
  ['Assiette plate 27 cm', 1.1, 'pièce', 0.32], ['Assiette à dessert 21 cm', 1.1, 'pièce', 0.28], ['Couverts (jeu de 4 pièces)', 1.1, 'jeu', 0.48],
  ['Verre à vin 35 cl', 2.2, 'pièce', 0.25], ['Flûte 17 cl', 1.1, 'pièce', 0.25], ['Serviette en tissu', 1.1, 'pièce', 0.6], ['Nappe ronde 240 cm', 0.13, 'pièce', 9.5],
].map(([material_name, qty_per_guest, unit, price], i) => ({ id: uid('rentalTpl'), material_name, qty_per_guest, unit, price, sort_order: i }));
const MANUAL_RENTALS = {
  mariageBerthier: [['Étuve chauffante', 2, 'pièce', 45, 'Livraison la veille, avec la vaisselle'], ['Mange-debout nappé', 10, 'pièce', 14, 'Pour le vin d’honneur dans le parc']],
  seminaireSorelia: [['Percolateur 50 tasses', 1, 'pièce', 22, null]],
  inaugurationLumen: [['Mange-debout nappé', 12, 'pièce', 14, null], ['Vasque à glace', 3, 'pièce', 9, null]],
  mariageMarchetti: [['Étuve chauffante', 2, 'pièce', 45, null]],
};
const rentals = [];
for (const q of events) {
  const isPast = q.date < TODAY;
  const created = ts(isPast ? q.created + 20 : Math.min(q.created + 4, -1), 15);
  // Même calcul que le bouton « Générer depuis mes modèles ». Pas de modèles pour les petits cocktails à domicile.
  if (q.key !== 'anniversaireGautherot' && q.key !== 'baptemeTessier') {
    for (const t of RENTAL_TEMPLATES) {
      rentals.push({ id: uid('rental'), quote_id: q.id, material_name: t.material_name, qty: Math.ceil(t.qty_per_guest * q.guests), unit: t.unit, supplier_id: supplier('location').id,
        price_per_unit: t.price, notes: null, source: 'template', ordered: isPast || q.key === 'seminaireSorelia', created_at: created });
    }
  }
  for (const [material_name, qty, unit, price, notes] of MANUAL_RENTALS[q.key] ?? []) {
    rentals.push({ id: uid('rental'), quote_id: q.id, material_name, qty, unit, supplier_id: supplier('location').id, price_per_unit: price, notes, source: 'manual', ordered: isPast, created_at: created });
  }
}

/** Besoins d'un événement : même règle que lib/events/needs.ts (quantité par personne × convives, une fois par prestation). */
function needsOf(q) {
  const byName = new Map(PRESTATIONS.map((p) => [norm(p.name), p]));
  const seen = new Set();
  const needs = new Map();
  for (const l of q.lines) {
    if (l.removed || !l.name.trim()) continue;
    const p = byName.get(norm(l.name));
    if (!p || seen.has(p.id) || p.recipe.length === 0) continue;
    seen.add(p.id);
    for (const r of p.recipe) needs.set(r.ingredient.id, { ingredient: r.ingredient, quantity: (needs.get(r.ingredient.id)?.quantity ?? 0) + r.qty * q.guests });
  }
  return [...needs.values()].map((n) => ({ ...n, quantity: round2(n.quantity) }));
}
// Lignes ajoutées à la main sur les listes de courses.
const MANUAL_COURSES = {
  seminaireSorelia: [['Huile d’olive', 2, 'Pour la cuisson des courgettes'], ['Thym frais', 3, null]],
  mariageBerthier: [['Moutarde de Dijon', 4, 'Condiment des plateaux de fromages'], ['Huile d’olive', 3, null], ['Pain de campagne', 8, 'Repas de l’équipe']],
  anniversaireGautherot: [['Thym frais', 2, null]],
  inaugurationLumen: [['Citrons jaunes', 3, 'Pour les carafes d’eau']],
};
const checkedShare = { seminaireSorelia: 0.45, mariageBerthier: 0.15, anniversaireGautherot: 0, inaugurationLumen: 0 };
const courses = [];
for (const q of events) {
  const isPast = q.date < TODAY;
  const created = ts(isPast ? q.created + 25 : Math.min(q.created + 5, -1), 9, 30);
  q.needs = needsOf(q);
  q.needs.forEach((n, i) => courses.push({ id: uid('course'), quote_id: q.id, ingredient_id: n.ingredient.id, quantity: n.quantity, unit: n.ingredient.unit,
    supplier_id: n.ingredient.supplier_id, notes: null, checked: isPast || i < Math.round(q.needs.length * checkedShare[q.key]), source: 'auto', created_at: created }));
  for (const [name, qty, notes] of MANUAL_COURSES[q.key] ?? []) {
    const ing = ingredient(name);
    courses.push({ id: uid('course'), quote_id: q.id, ingredient_id: ing.id, quantity: qty, unit: ing.unit, supplier_id: ing.supplier_id, notes, checked: false, source: 'manuelle', created_at: created });
  }
}

// ── Extras et missions ───────────────────────────────────────────────────────
const EXTRAS = [
  ['ines', 'Inès Carpentier', 'Serveur'], ['mathis', 'Mathis Renaudin', 'Serveur'], ['clemence', 'Clémence Aubry', 'Serveur'],
  ['yanis', 'Yanis Boucher', 'Barman'], ['pauline', 'Pauline Girardot', 'Sous-chef'], ['oscar', 'Oscar Thévenin', 'Cuisinier'],
].map(([key, name, role], i) => ({ key, id: uid('extra'), name, role, phone: mobile(100 + i), email: mail(norm(name).replace(/[^a-z]+/g, '.')), created: ts(-300 + i * 21, 11) }));
const extra = (key) => EXTRAS.find((e) => e.key === key);
const MISSIONS = [
  ['seminaireSorelia', 'ines', 'confirme', '10:30', 'Tenue noire. Mise en place de la salle puis service à l’assiette.', false],
  ['seminaireSorelia', 'mathis', 'a_solliciter', '10:30', null, false],
  ['mariageBerthier', 'pauline', 'confirme', '13:00', 'Réception des marchandises et mise en place de l’office. Chargée des courses du matin.', true],
  ['mariageBerthier', 'oscar', 'confirme', '13:00', 'Cuisson des volailles et dressage du plat.', false],
  ['mariageBerthier', 'ines', 'confirme', '15:30', 'Responsable du rang côté verrière.', false],
  ['mariageBerthier', 'mathis', 'confirme', '15:30', null, false],
  ['mariageBerthier', 'clemence', 'a_solliciter', '15:30', null, false],
  ['mariageBerthier', 'yanis', 'a_solliciter', '16:00', 'Bar du vin d’honneur, puis service des vins à table.', false],
  ['anniversaireGautherot', 'yanis', 'confirme', '18:00', 'Bar à kir et boissons sans alcool.', false],
  ['anniversaireGautherot', 'clemence', 'a_solliciter', '18:00', null, false],
  ['inaugurationLumen', 'ines', 'a_solliciter', '17:00', null, false],
  ['mariageMarchetti', 'ines', 'present', '15:30', null, false], ['mariageMarchetti', 'mathis', 'present', '15:30', null, false],
  ['mariageMarchetti', 'yanis', 'present', '16:00', null, false], ['mariageMarchetti', 'oscar', 'present', '13:30', 'Bœuf bourguignon remis en température sur place.', true],
  ['galaPatrimoine', 'pauline', 'present', '15:00', null, true], ['galaPatrimoine', 'clemence', 'present', '17:00', null, false], ['galaPatrimoine', 'mathis', 'present', '17:00', null, false],
  ['seminaireOrvane', 'clemence', 'present', '11:00', null, false],
].map(([q, e, status, arrival_time, mission_notes, assign_courses]) => ({ id: uid('mission'), quote_id: quote(q).id, extra_id: extra(e).id, status, arrival_time, mission_notes, assign_courses,
  created_at: ts(Math.min(quote(q).created + 6, -1), 17) }));

// ── Commandes fournisseurs : tirées des besoins d'un événement, comme « Créer les commandes » ──
const orderFromEvent = (qKey, supKey, status, createdOffset, extra = {}) => {
  const q = quote(qKey);
  const items = q.needs.filter((n) => n.ingredient.supplier_id === supplier(supKey).id)
    .map((n) => ({ id: uid('orderItem'), ingredient: n.ingredient, quantity: n.quantity, unit_price: n.ingredient.price }));
  return { id: uid('order'), supplier: supplier(supKey), event: q, status, items, created: createdOffset, ...extra };
};
const ORDERS = [
  orderFromEvent('mariageMarchetti', 'boucherie', 'received', -34, { ordered: -34, received: -31, notes: 'Paleron paré et coupé en morceaux de 60 g.' }),
  orderFromEvent('galaPatrimoine', 'primeurs', 'received', -18, { ordered: -18, received: -15, notes: null }),
  orderFromEvent('galaPatrimoine', 'boucherie', 'received', -19, { ordered: -19, received: -15, notes: null }),
  orderFromEvent('seminaireSorelia', 'maree', 'sent', -2, { ordered: -2, notes: 'Livraison souhaitée la veille avant 9 h, cabillaud en pavés de 160 g.' }),
  orderFromEvent('seminaireSorelia', 'primeurs', 'sent', -2, { ordered: -1, notes: null }),
  orderFromEvent('mariageBerthier', 'comptoir', 'sent', -4, { ordered: -3, notes: 'Vins à livrer directement au château, le vendredi avant 16 h.' }),
  orderFromEvent('mariageBerthier', 'boucherie', 'draft', -1, { notes: 'Commande générée depuis la liste de courses (110 couverts)' }),
  orderFromEvent('mariageBerthier', 'cremerie', 'draft', -1, { notes: 'Commande générée depuis la liste de courses (110 couverts)' }),
  { id: uid('order'), supplier: supplier('comptoir'), event: null, status: 'draft', created: -1, notes: 'Réassort de la cave et de l’épicerie avant la saison des fêtes.',
    items: [['Crémant de Bourgogne', 48], ['Farine T55', 25], ['Pinot noir', 24], ['Café en grains', 6]].map(([name, quantity]) => ({ id: uid('orderItem'), ingredient: ingredient(name), quantity, unit_price: ingredient(name).price })) },
];
for (const o of ORDERS) o.total = round2(o.items.reduce((s, i) => s + i.quantity * i.unit_price, 0));

// ── Mouvements de stock : les triggers en déduisent le stock de chaque ingrédient ──
const movements = [];
const move = (ing, type, quantity, reason, at, refs = {}) => movements.push({ ingredient: ing, type, quantity, reason, at, event_id: refs.event_id ?? null, order_id: refs.order_id ?? null });
for (const o of ORDERS.filter((x) => x.status === 'received')) {
  for (const item of o.items) {
    // Reçu pour l'événement, puis sorti le jour J : le stock revient à son niveau.
    move(item.ingredient, 'in', item.quantity, `Commande ${o.supplier.name} reçue`, ts(o.received, 8, 15), { order_id: o.id });
    move(item.ingredient, 'out', item.quantity, `Sortie pour ${o.event.internal ?? o.event.c.name}`, `${o.event.date}T07:30:00.000Z`, { event_id: o.event.id });
  }
}
// Sorties de la cave et de l'épicerie pour les derniers événements.
const OUTS = [
  ['Crémant de Bourgogne', 19, 'mariageMarchetti'], ['Crémant de Bourgogne', 24, 'galaPatrimoine'], ['Bourgogne aligoté', 30, 'galaPatrimoine'], ['Pinot noir', 48, 'galaPatrimoine'],
  ['Farine T55', 9, 'mariageMarchetti'], ['Farine T55', 12, 'galaPatrimoine'], ['Café en grains', 1.5, 'galaPatrimoine'], ['Sucre semoule', 4, 'galaPatrimoine'],
  ['Eau minérale', 120, 'galaPatrimoine'], ['Jus de pomme artisanal', 24, 'mariageMarchetti'],
];
for (const [name, qty, qKey] of OUTS) move(ingredient(name), 'out', qty, `Sortie pour ${quote(qKey).internal ?? quote(qKey).c.name}`, `${quote(qKey).date}T07:45:00.000Z`, { event_id: quote(qKey).id });
for (const ing of INGREDIENTS) {
  const net = movements.filter((m) => m.ingredient === ing).reduce((s, m) => s + (m.type === 'in' ? m.quantity : -m.quantity), 0);
  const opening = round2(ing.stock - net);
  if (opening > 0) move(ing, 'in', opening, 'Inventaire de début de saison', ts(-90, 8));
}
movements.sort((a, b) => a.at.localeCompare(b.at));

// ── Modèles ──────────────────────────────────────────────────────────────────
const DEVIS_TEMPLATES = [
  { name: 'Mariage, dîner assis 100 couverts', template: 'mariage', remarks: 'Base à ajuster après la dégustation : entrée, plat, fromage, dessert, vins compris.', created: -120,
    lines: menu(100, ['Vin d’honneur 6 pièces', 'Kir au crémant', 'Tartare de saumon fumé aux herbes', 'Suprême de volaille, sauce à l’époisses', 'Assiette de fromages affinés', 'Fondant au chocolat noir', 'Forfait vins de Bourgogne', 'Café et thé', 'Vaisselle et verrerie complète', 'Nappage et serviettes en tissu'],
      [['Table ronde 8 personnes et chaises', 13], ['Maître d’hôtel', 1], ['Serveur', 5], ['Chef en cuisine sur place', 1]]) },
  { name: 'Cocktail d’entreprise 50 personnes', template: 'business', remarks: 'Cocktail dînatoire de deux heures, service au plateau.', created: -85,
    lines: menu(50, ['Cocktail dînatoire 12 pièces', 'Forfait vins de Bourgogne', 'Forfait boissons sans alcool', 'Vaisselle et verrerie complète'], [['Serveur', 2], ['Livraison et installation', 1]]) },
  { name: 'Déjeuner de séminaire', template: 'business', remarks: 'Entrée, plat, dessert, boissons sans alcool et café.', created: -50,
    lines: menu(30, ['Œuf en meurette', 'Dos de cabillaud, beurre citronné', 'Poire pochée au cassis, pain d’épices', 'Forfait boissons sans alcool', 'Café et thé'], [['Serveur', 1], ['Livraison et installation', 1]]) },
].map((t) => ({ ...t, id: uid('devisTpl') }));
const QUOTE_TEMPLATES = [
  { name: 'Maison Verdier, vert sapin', base: 'standard', accent: '#2e7d32', header: 'Maison Verdier, traiteur à Dijon depuis 2014', footer: 'Devis valable 30 jours. Acompte de 30 % à la réservation.', isDefault: true, created: -200 },
  { name: 'Mariages, ton champagne', base: 'mariage', accent: '#c8956c', header: 'Votre réception, imaginée avec vous', footer: 'Dégustation offerte pour toute réservation confirmée.', isDefault: false, created: -160 },
].map((t) => ({ ...t, id: uid('quoteTpl') }));

// ── Notifications ────────────────────────────────────────────────────────────
const lowStock = INGREDIENTS.filter((i) => i.alert > 0 && i.stock <= i.alert);
const nextEvent = upcoming.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
const NOTIFICATIONS = [
  ...PROSPECTS.filter((p) => p.status === 'nouveau').map((p, i) => ({
    type: 'prospect_request', priority: 'high', is_read: i === 2, created_at: p.created, action_url: '/prospects', data: { prospect_id: p.id },
    title: 'Nouvelle demande de devis', message: `${p.first} ${p.last} vous a écrit pour un événement de ${p.guests} couverts (${p.type.toLowerCase()}).`,
  })),
  { type: 'upcoming_event', priority: 'high', is_read: false, created_at: ts(-1, 7), action_url: `/evenements/${nextEvent.id}`, data: { quote_id: nextEvent.id },
    title: 'Un événement approche', message: `${nextEvent.internal ?? nextEvent.c.name} a lieu ${dateFr(nextEvent.date)}. Vérifiez la checklist et les commandes.` },
  ...lowStock.map((ing, i) => ({
    type: 'stock_alert', priority: 'medium', is_read: i > 0, created_at: ts(-2 - i * 9, 8, 30), action_url: `/stock?ing=${ing.id}`, data: null,
    title: `Stock bas : ${ing.name}`, message: `Il reste ${qtyLabel(ing.stock, ing.unit)} pour un seuil d’alerte fixé à ${ing.alert}.`,
  })),
  { type: 'task_reminder', priority: 'low', is_read: true, created_at: ts(-4, 9), action_url: '/devis', data: null,
    title: 'Devis sans réponse', message: `Le devis envoyé à ${quote('mariageDelaunay').c.name} attend une réponse depuis plus d’une semaine.` },
].map((n) => ({ ...n, id: uid('notification') }));

// ── Écriture ─────────────────────────────────────────────────────────────────
const db = new pg.Client({ connectionString: env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full') });
await db.connect();

/** Insère des lignes ; les objets et tableaux partent en JSON. */
async function insert(table, rows) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const params = [];
  const tuples = rows.map((row) => `(${cols.map((c) => {
    const v = row[c];
    params.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
    return `$${params.length}`;
  }).join(', ')})`);
  await db.query(`insert into public.${table} (${cols.join(', ')}) values ${tuples.join(', ')}`, params);
}

const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

await db.query('begin');
try {
  // Lu par les triggers d'historique (statuts de devis) : l'auteur des écritures est le compte de démonstration.
  await db.query(`select set_config('app.user_id', $1, true)`, [DEMO]);

  const clash = await db.query('select id from public.users where email = $1 and id <> $2', [DEMO_EMAIL, DEMO]);
  if (clash.rowCount) throw new Error(`L'adresse ${DEMO_EMAIL} appartient déjà à un autre compte.`);

  // 1. Suppression de tout ce qui appartient au compte de démonstration. Chaque requête est filtrée par son identifiant.
  const mine = '(select id from public.quotes where owner_user_id = $1)';
  for (const sql of [
    'delete from public.notifications where user_id = $1',
    `delete from public.event_extras where quote_id in ${mine} or extra_id in (select id from public.extras where user_id = $1)`,
    `delete from public.event_ingredients where quote_id in ${mine}`,
    `delete from public.rental_items where quote_id in ${mine}`,
    'delete from public.supplier_order_items where order_id in (select id from public.supplier_orders where user_id = $1)',
    'delete from public.stock_movements where user_id = $1',
    'delete from public.supplier_orders where user_id = $1',
    'delete from public.service_ingredients where user_id = $1',
    'delete from public.service_materials where user_id = $1',
    'delete from public.rental_templates where user_id = $1',
    `delete from public.quote_status_history where quote_id in ${mine}`,
    // Les autres tables liées à un devis (pièces jointes, tâches, factures…) le suivent par leur clé étrangère.
    'delete from public.quotes where owner_user_id = $1',
    'delete from public.quote_folders where owner_user_id = $1',
    'delete from public.customer_contacts where owner_user_id = $1',
    'delete from public.customers where owner_user_id = $1',
    'delete from public.prospect_requests where owner_user_id = $1 or user_token in (select token from public.user_prospect_tokens where user_id = $1)',
    'delete from public.user_prospect_tokens where user_id = $1',
    'delete from public.prestations where user_id = $1',
    'delete from public.prestation_subcategories where user_id = $1',
    'delete from public.prestation_categories where user_id = $1',
    'delete from public.ingredients where user_id = $1',
    'delete from public.suppliers where owner_user_id = $1',
    'delete from public.extras where user_id = $1',
    'delete from public.devis_templates where user_id = $1',
    'delete from public.quote_templates where owner_user_id = $1',
  ]) await db.query(sql, [DEMO]);

  // 2. Compte et profil : créés, ou remis à neuf sur place.
  await db.query(
    `insert into public.users (id, email, password_hash) values ($1, $2, $3)
     on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash`,
    [DEMO, DEMO_EMAIL, passwordHash],
  );
  const pCols = Object.keys(profile);
  await db.query(
    `insert into public.profiles (${pCols.join(', ')}) values (${pCols.map((_, i) => `$${i + 1}`).join(', ')})
     on conflict (id) do update set ${pCols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`,
    pCols.map((c) => (Array.isArray(profile[c]) ? JSON.stringify(profile[c]) : profile[c])),
  );

  // 3. Catalogue
  await insert('suppliers', SUPPLIERS.map((s, i) => ({
    id: s.id, owner_user_id: DEMO, user_id: DEMO, name: s.name, contact_person: s.contact, email: mail(s.local), phone: s.phone,
    address: s.address, notes: s.notes, is_active: true, created_at: ts(-320 + i * 9, 10), updated_at: ts(-320 + i * 9, 10),
  })));
  await insert('ingredients', INGREDIENTS.map((g, i) => ({
    id: g.id, owner_user_id: DEMO, user_id: DEMO, name: g.name, category: g.category, unit: g.unit, volume_unit_price: g.price,
    preferred_supplier_id: g.supplier_id, stock_quantity: 0, min_stock_alert: g.alert, created_at: ts(-310 + i, 10, i),
  })));
  await insert('prestations', PRESTATIONS.map((p, i) => ({
    id: p.id, user_id: DEMO, name: p.name, unit_price: p.price, cost_price: p.cost, category: p.category, sub_category: p.sub_category,
    description: p.description, is_option: false, created_at: ts(-300 + i, 14, i),
  })));
  await insert('service_ingredients', PRESTATIONS.flatMap((p) => p.recipe.map((r) => ({
    id: uid('recipe'), user_id: DEMO, service_id: p.id, ingredient_id: r.ingredient.id, qty_per_person: r.qty, quantity_per_guest: r.qty, unit: r.ingredient.unit,
  }))));
  await insert('rental_templates', RENTAL_TEMPLATES.map((t) => ({
    id: t.id, user_id: DEMO, material_name: t.material_name, qty_per_guest: t.qty_per_guest, unit: t.unit,
    default_supplier_id: supplier('location').id, default_price_per_unit: t.price, sort_order: t.sort_order,
  })));

  // 4. Clients et demandes
  await insert('customers', CUSTOMERS.map((c) => ({
    id: c.id, owner_user_id: DEMO, user_id: DEMO, customer_type: c.isCompany ? 'entreprise' : 'particulier', email: c.email, phone: c.phone,
    address: c.address, service_address: null, notes: c.notes, first_name: c.first ?? null, last_name: c.last ?? null, company_name: c.company ?? null,
    contact_person_name: c.contact ?? null, contact_person_email: c.isCompany ? c.email : null, contact_person_phone: c.contactPhone,
    created_at: c.created, updated_at: c.created,
  })));
  await insert('customer_contacts', CONTACTS.map((c) => ({ ...c, owner_user_id: DEMO, notes: null })));
  await insert('quote_folders', Object.values(FOLDERS).map((f, i) => ({ ...f, owner_user_id: DEMO, parent_id: null, created_at: ts(-140 + i * 30, 9) })));
  await insert('user_prospect_tokens', [{ id: uid('token'), user_id: DEMO, token: PROSPECT_TOKEN, is_active: true, brochure_url: null }]);
  await insert('prospect_requests', PROSPECTS.map((p) => ({
    id: p.id, owner_user_id: DEMO, user_token: PROSPECT_TOKEN, first_name: p.first, last_name: p.last, email: p.email, phone: p.phone,
    address: null, service_address: p.place, guest_count: p.guests, guest_count_children: p.children ?? null, event_type: p.type, event_date: p.date,
    message: p.message, status: p.status, created_at: p.created, updated_at: p.created,
  })));

  // 5. Devis (les événements sont les devis confirmés)
  await insert('quotes', QUOTES.map((q) => {
    const c = q.c;
    const [contactFirst, ...contactLast] = (c.contact ?? '').split(' ');
    return {
      id: q.id, owner_user_id: DEMO, user_id: DEMO, customer_id: c.id, folder_id: q.folder ? FOLDERS[q.folder].id : null,
      prospect_id: q.prospect ? prospect(q.prospect).id : null, quote_number: q.number, internal_name: q.internal ?? null, name: q.internal ?? null,
      client_name: c.name, client_type: c.isCompany ? 'entreprise' : 'particulier',
      client_first_name: c.isCompany ? contactFirst : c.first, client_last_name: c.isCompany ? contactLast.join(' ') : c.last,
      client_email: c.email, client_phone: c.phone, client_address: c.address, company_name: c.company ?? null, contact_person_name: c.contact ?? null,
      recipient_contact_role: c.role ?? null, recipient_contact_email: c.isCompany ? c.email : null, recipient_contact_phone: c.contactPhone,
      event_type: q.type, event_date: q.date, event_location: q.location, guest_count: q.guests, team_arrival_time: q.arrival ?? null,
      remarks: q.remarks, internal_notes: q.notes, status: q.status, template: q.template, language: 'fr', vat_rate: 10, hide_price: false,
      total_amount: q.ttc, total_cost_price: q.cost, services: q.lines, checklist: q.checklist ?? [], event_materials: q.materials ?? [],
      event_material_checks: q.materialChecks ?? [], extra_costs: q.extraCosts ?? [], images: [],
      sent_at: q.sent !== undefined ? ts(q.sent, 17, 20) : null,
      created_at: ts(q.created, 9 + (q.guests % 8), q.guests % 60), updated_at: ts(Math.min(q.created + 3, 0), 16),
    };
  }));
  await insert('rental_items', rentals);
  await insert('event_ingredients', courses);

  // 6. Extras
  await insert('extras', EXTRAS.map((e) => ({ id: e.id, user_id: DEMO, name: e.name, role: e.role, phone: e.phone, email: e.email, created_at: e.created })));
  await insert('event_extras', MISSIONS);

  // 7. Commandes et stock
  await insert('supplier_orders', ORDERS.map((o) => ({
    id: o.id, user_id: DEMO, supplier_id: o.supplier.id, event_id: o.event?.id ?? null, status: o.status, total_amount: o.total, notes: o.notes ?? null,
    ordered_at: o.ordered !== undefined ? ts(o.ordered, 11) : null, received_at: o.received !== undefined ? ts(o.received, 8, 15) : null,
    created_at: ts(o.created, 10, 30), updated_at: ts(o.received ?? o.ordered ?? o.created, 11),
  })));
  await insert('supplier_order_items', ORDERS.flatMap((o) => o.items.map((i) => ({
    id: i.id, order_id: o.id, ingredient_id: i.ingredient.id, quantity: i.quantity, unit_price: i.unit_price,
    received_quantity: o.status === 'received' ? i.quantity : 0, created_at: ts(o.created, 10, 30),
  }))));
  // Un par un, dans l'ordre du temps : le trigger met le stock à jour à chaque mouvement.
  for (const m of movements) {
    await insert('stock_movements', [{ id: uid('movement'), user_id: DEMO, ingredient_id: m.ingredient.id, movement_type: m.type, quantity: m.quantity,
      reason: m.reason, event_id: m.event_id, order_id: m.order_id, created_at: m.at }]);
  }

  // 8. Modèles
  await insert('devis_templates', DEVIS_TEMPLATES.map((t) => ({
    id: t.id, user_id: DEMO, name: t.name, services: t.lines, content_html: null, template: t.template, remarks: t.remarks, vat_rate: 10, hide_price: false,
    created_at: ts(t.created, 15), updated_at: ts(t.created, 15),
  })));
  await insert('quote_templates', QUOTE_TEMPLATES.map((t) => ({
    id: t.id, owner_user_id: DEMO, user_id: DEMO, name: t.name, event_type: 'Tous', guest_count: 1, base_template: t.base, accent_color: t.accent,
    primary_color: t.accent, header_note: t.header, footer_note: t.footer, is_default: t.isDefault, created_at: ts(t.created, 11), updated_at: ts(t.created, 11),
  })));

  // 9. Notifications : celles que les triggers viennent de créer pour ce compte (demandes, stock bas) sont remplacées par un jeu daté.
  await db.query('delete from public.notifications where user_id = $1', [DEMO]);
  await insert('notifications', NOTIFICATIONS.map((n) => ({ ...n, user_id: DEMO, read_at: n.is_read ? NOW.toISOString() : null })));

  // Contrôle : le stock calculé par les triggers est bien celui visé.
  const stock = await db.query('select id, stock_quantity::float8 as s from public.ingredients where user_id = $1', [DEMO]);
  const wrong = stock.rows.filter((r) => Math.abs(r.s - INGREDIENTS.find((i) => i.id === r.id).stock) > 0.005);
  if (wrong.length) throw new Error(`Stock inattendu pour ${wrong.length} ingrédient(s).`);

  await db.query('commit');
} catch (e) {
  await db.query('rollback');
  await db.end();
  console.error(`Rien n'a été modifié : ${e.message}`);
  process.exit(1);
}
await db.end();

console.log(`Compte de démonstration prêt : ${profile.company_name} (${DEMO_EMAIL}).`);
console.log(`  ${PRESTATIONS.length} prestations, ${INGREDIENTS.length} ingrédients, ${SUPPLIERS.length} fournisseurs, ${CUSTOMERS.length} clients, ${EXTRAS.length} extras`);
console.log(`  ${QUOTES.length} devis, dont ${events.length} événements (${upcoming.length} à venir, ${past.length} passés) ; ${PROSPECTS.length} demandes`);
console.log(`  ${courses.length} lignes de courses, ${rentals.length} articles de location, ${ORDERS.length} commandes, ${movements.length} mouvements de stock, ${NOTIFICATIONS.length} notifications`);
