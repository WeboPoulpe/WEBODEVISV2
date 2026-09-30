// Trouve une photo pour les ingrédients qui n'en ont pas, à partir de Wikipédia (images sous licence libre
// de Wikimedia Commons), la copie sur Vercel Blob et enregistre son auteur et sa licence.
//
// Usage :
//   node scripts/ingredient-photos.mjs --dry-run     cherche seulement, écrit .help-media/ingredient-photos.json
//   node scripts/ingredient-photos.mjs               reprend ce fichier s'il existe, copie les images, met à jour la base
// Rejouable : seuls les ingrédients sans photo sont traités. À relancer après un ré-import des données.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { put } from '@vercel/blob';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim())).filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);
const dryRun = process.argv.includes('--dry-run');
if (!env.DATABASE_URL || !/\.neon\.tech\//.test(env.DATABASE_URL)) throw new Error('DATABASE_URL doit pointer vers Neon.');
if (!dryRun && !env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN est absent de .env.local.');

const PLAN = path.join(ROOT, '.help-media', 'ingredient-photos.json');
const UA = 'WeboDevis/0.1 (https://webodevis.fr; maxence@webomax.fr) ingredient-photos';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Article de Wikipédia à utiliser quand le nom de l'ingrédient ne suffit pas à le trouver (marque, conditionnement,
// terme de métier). `null` : aucune photo pertinente, l'ingrédient garde son pictogramme.
const ARTICLES = {
  'Cola 1.5L': 'Cola', 'Eau Gazeuse 1L': 'Eau gazeuse', 'Eau Minérale 1.5L': 'Eau minérale', 'Café Grains 1kg': 'Grain de café', 'Café en grains': 'Grain de café',
  'Thé Earl Grey (Boîte x50)': 'Earl Grey', 'Vin Blanc Sec (Sauvignon)': 'Vin blanc', 'Vin Rosé (Provence)': 'Vin rosé', 'Vin Rouge (Merlot)': 'Vin rouge',
  'Champagne Brut': 'Vin de Champagne', 'Jus de Pomme Artisanal': 'Jus de pomme', 'Jus de pomme artisanal': 'Jus de pomme', 'Pinot noir': 'Pinot noir',
  'Mini Croissant': 'Croissant (viennoiserie)', 'Mini Pain au Chocolat': 'Pain au chocolat', 'Mini Pains Assortis (Catering)': 'Petit pain', 'Mini-pains navettes': 'Navette (pain)',
  'Pain de Mie Grande Taille': 'Pain de mie', 'Jambon Blanc Supérieur': 'Jambon blanc', 'Jambon Cru de Pays': 'Jambon cru', 'Mousse de Canard au Porto': 'Mousse de foie',
  'Bacon fumé': 'Bacon', 'Lardons fumés': 'Lardon',
  'Beaufort Chalet d\'Alpage': 'Beaufort (fromage)', 'Beurre Demi-Sel (Plaquette)': 'Beurre', 'Beurre Doux 82% (Plaquette)': 'Beurre', 'Beurre Gastronomique (Motte 5kg)': 'Beurre',
  'Beurre de Tourage (Feuilletage)': 'Beurre', 'Beurre doux': 'Beurre', 'Blancs d\'Oeufs (Bidon)': 'Blanc d\'œuf', 'Jaunes d\'Oeufs (Bidon)': 'Jaune d\'œuf',
  'Burrata 125g': 'Burrata', 'Cheddar Orange': 'Cheddar', 'Chèvre Bûche': 'Bûche de chèvre', 'Chèvre Frais (Petit Moulin)': 'Fromage de chèvre', 'Comté 12 mois': 'Comté (fromage)',
  'Comté 18 mois': 'Comté (fromage)', 'Crème fraîche épaisse': 'Crème fraîche', 'Emmental Râpé': 'Emmental', 'Fromage frais': 'Fromage frais', 'Gorgonzola Cremoso': 'Gorgonzola',
  'Lait Demi-Écrémé UHT': 'Lait', 'Lait Entier': 'Lait', 'Lait entier': 'Lait', 'Lait de Coco': 'Lait de coco', 'Lait de Coco (Conserve)': 'Lait de coco', 'Lait de Soja': 'Lait de soja',
  'Mascarpone Galbani 500g': 'Mascarpone', 'Mimolette Vieille': 'Mimolette', 'Mimolette Étuvée': 'Mimolette', 'Morbier AOP': 'Morbier (fromage)',
  'Mozzarella di Bufala (Boule)': 'Mozzarella', 'Oeufs Plein Air (Alvéole x30)': 'Œuf (aliment)', 'Œufs frais': 'Œuf (aliment)', 'Parmesan Reggiano AOP': 'Parmigiano Reggiano',
  'Philadelphia Professional': 'Fromage à la crème', 'Saint-Moret / Philadelphia': 'Fromage à la crème', 'Tofu Ferme': 'Tofu', 'Valençay AOP': 'Valençay (fromage)',
  'Yaourt Grec': 'Yaourt grec', 'Yaourt Nature': 'Yaourt', 'Époisses': 'Époisses (fromage)', 'Tomme de Savoie': 'Tomme de Savoie', 'Roquefort': 'Roquefort (fromage)',
  'Maroilles': 'Maroilles (fromage)', 'Pont-l\'Évêque': 'Pont-l\'évêque (fromage)', 'Appenzeller': 'Appenzeller (fromage)', 'Ricotta': 'Ricotta',
  'Caissettes Papier (Muffin)': 'Caissette', 'Film Étirable Cuisine (45cm)': 'Film étirable', 'Gants Nitrile (Boîte x100)': 'Gant médical', 'Papier Aluminium': 'Papier d\'aluminium',
  'Papier Cuisson (Sulfurisé)': 'Papier sulfurisé', 'Papier Essuie-tout': 'Essuie-tout', 'Pastilles Lave-Vaisselle': null, 'Plateau Traiteur Carton': null,
  'Poches à Douille Jetables': 'Poche à douille', 'Produit Plonge Main': 'Liquide vaisselle', 'Verrines Plastique 6cl': 'Verrine',
  'Ail Blanc': 'Ail cultivé', 'Ananas Victoria': 'Ananas', 'Avocat Ready-to-eat': 'Avocat (fruit)', 'Carotte Fanage': 'Carotte', 'Carotte Lavée': 'Carotte', 'Carottes fanes': 'Carotte',
  'Champignon de Paris Blanc': 'Champignon de Paris', 'Champignons de Paris': 'Champignon de Paris', 'Citron Vert (Lime)': 'Lime (fruit)', 'Citrons jaunes': 'Citron',
  'Courgette Verte': 'Courgette', 'Courgettes': 'Courgette', 'Cèpes Surgelés': 'Cèpe', 'Céleri Rave': 'Céleri-rave', 'Fraise Gariguette': 'Fraise', 'Framboise Fraîche': 'Framboise',
  'Framboises': 'Framboise', 'Haricot Vert Extra Fin': 'Haricot vert', 'Laitue Coeur de Laitue': 'Laitue', 'Mesclun': 'Mesclun', 'Salade Mesclun': 'Mesclun', 'Morilles Séchées': 'Morille',
  'Myrtille': 'Myrtille', 'Mâche': 'Mâche', 'Oignon Jaune': 'Oignon', 'Oignons jaunes': 'Oignon', 'Oignon Rouge': 'Oignon rouge', 'Orange à Jus': 'Orange (fruit)',
  'Poire Conférence': 'Conférence (poire)', 'Poires': 'Poire', 'Poivron Vert': 'Poivron', 'Pomme Granny Smith': 'Granny Smith', 'Pomme de terre Grenaille': 'Pomme de terre',
  'Pommes de terre grenaille': 'Pomme de terre', 'Raisin Blanc sans pépins': 'Raisin', 'Tomate Cerise': 'Tomate cerise', 'Tomates cerises': 'Tomate cerise',
  'Tomate Coeur de Boeuf': 'Cœur de bœuf (tomate)', 'Tomate Grappe': 'Tomate', 'Tomate Roma (Concasse)': 'Roma (tomate)', 'Échalote Grise': 'Échalote', 'Épinard Frais': 'Épinard',
  'Aubergine': 'Aubergine',
  'Basilic': 'Basilic (plante)', 'Cannelle Poudre': 'Cannelle', 'Ciboulette': 'Ciboulette (botanique)', 'Coriandre': 'Coriandre', 'Estragon': 'Estragon', 'Laurier Sauce': 'Laurus nobilis',
  'Menthe': 'Menthe', 'Noix de Muscade': 'Noix de muscade', 'Paprika Fumé': 'Paprika', 'Romarin Frais': 'Romarin', 'Safran en filaments': 'Safran (épice)', 'Thym frais': 'Thym', 'Thym Frais': 'Thym',
  'Bar Elevage (Filet)': 'Bar commun', 'Bulots Cuits': 'Bulot', 'Cabillaud (Dos)': 'Morue de l\'Atlantique', 'Dos de cabillaud': 'Morue de l\'Atlantique', 'Chair de Crabe': 'Crabe',
  'Couteaux': 'Couteau (mollusque)', 'Crevettes Roses 40/60': 'Crevette', 'Daurade Royale (Filet)': 'Dorade royale', 'Espadon (Tranche)': 'Espadon', 'Gambas': 'Gamba',
  'Gambas Surgelées': 'Gamba', 'Homard Bleu Vivant': 'Homard européen', 'Huîtres N°3': 'Huître', 'Lieu Noir (Filet)': 'Lieu noir', 'Maquereau': 'Maquereau',
  'Moulle de Bouchot': 'Moule de bouchot', 'Mélange de Fruits de Mer': 'Fruits de mer', 'Oeufs de Truite': 'Œufs de poisson', 'Palourdes': 'Palourde', 'Queue de Langouste': 'Langouste',
  'Rascasse Rouge': 'Rascasse', 'Rillettes de Crabe': 'Rillettes', 'Salade de Poulpe': 'Poulpe', 'Tentacules de Poulpe Cuites': 'Poulpe', 'Saumon Frais (Filet)': 'Saumon (aliment)',
  'Saumon Fumé Atlantique': 'Saumon fumé', 'Saumon fumé': 'Saumon fumé', 'Sole Portion': 'Sole commune', 'Terrine aux Deux Saumons': 'Terrine (plat)', 'Thon Rouge (Longe)': 'Thon rouge',
  'Tourteau Cuit': 'Tourteau', 'Truite Portion': 'Truite', 'Turbot Entier': 'Turbot', 'Écrevisses Entières': 'Écrevisse',
  'Cacao en Poudre (Van Houten)': 'Cacao en poudre', 'Chocolat Blanc 30% (Pistoles)': 'Chocolat blanc', 'Chocolat Noir 65% (Pistoles)': 'Chocolat noir', 'Chocolat noir 64 %': 'Chocolat noir',
  'Coulis de Mangue': 'Mangue', 'Extrait de Vanille Liquide': 'Extrait de vanille', 'Gousses de Vanille Bourbon': 'Vanille', 'Purée de Passion': 'Fruit de la passion',
  'Ailerons de Poulet (Wings)': 'Aile de poulet', 'Blanc de Poulet Export': 'Blanc de poulet', 'Bresaola': 'Bresaola', 'Caille Entière': 'Caille des blés', 'Carré d\'Agneau': 'Carré d\'agneau',
  'Chorizo à Cuire': 'Chorizo', 'Cuisse de Poulet': 'Cuisse de poulet', 'Cuisses de Canard Confites': 'Confit de canard', 'Entrecôte': 'Entrecôte', 'Faux-filet de Boeuf': 'Faux-filet',
  'Filet de Boeuf paré': 'Filet de bœuf', 'Filet de Canette': 'Magret', 'Filet de Sanglier': 'Sanglier', 'Foie de Veau Tranché': 'Foie (aliment)', 'Gigot d\'Agneau avec os': 'Gigot d\'agneau',
  'Gigue de Chevreuil': 'Chevreuil', 'Grenadin de Veau': 'Viande de veau', 'Jambon Serrano 18 mois': 'Jambon Serrano', 'Joue de Boeuf': 'Viande bovine', 'Langue de Boeuf': 'Langue de bœuf',
  'Paleron de Boeuf': 'Paleron', 'Paleron de bœuf': 'Paleron', 'Pancetta Italienne': 'Pancetta', 'Pastrami': 'Pastrami', 'Pavé de Cerf': 'Viande de cerf', 'Poitrine de Porc Fumée': 'Poitrine de porc',
  'Poulet Entier PAC': 'Poulet', 'Ris d\'Agneau': 'Ris (abat)', 'Rognon de Veau': 'Rognon', 'Rôti de Porc Échine': 'Rôti de porc', 'Salami Milano': 'Salami', 'Saucisse de Toulouse': 'Saucisse de Toulouse',
  'Souris d\'Agneau': 'Souris d\'agneau', 'Suprême de volaille fermière': 'Blanc de poulet',
  'Bouillon de Volaille': 'Bouillon (cuisine)', 'Concentré de Tomate': 'Concentré de tomate', 'Cornichons Extra Fins': 'Cornichon', 'Couscous Grain Moyen': 'Couscous', 'Câpres au vinaigre': 'Câpre',
  'Farine T55': 'Farine', 'Fleur de Sel de Guérande': 'Fleur de sel', 'Fond de Veau Déshydraté': 'Fond (cuisine)', 'Fumet de Poisson déshydraté': 'Fumet', 'Fécule de Maïs (Maïzena)': 'Amidon de maïs',
  'Gros Sel de Mer': 'Sel de mer', 'Gélatine Feuilles (Or)': 'Gélatine', 'Huile d\'Olive Vierge Extra': 'Huile d\'olive', 'Huile d’olive': 'Huile d\'olive', 'Huile de Colza': 'Huile de colza',
  'Huile de Noisette': 'Huile de noisette', 'Huile de Sésame': 'Huile de sésame', 'Huile de Tournesol': 'Huile de tournesol', 'Ketchup': 'Ketchup', 'Levure Chimique': 'Levure chimique',
  'Miel de Fleurs': 'Miel', 'Moutarde de Dijon': 'Moutarde de Dijon', 'Noix de Grenoble Décortiquées': 'Noix', 'Olives Noires Dénoyautées': 'Olive', 'Pain d’épices': 'Pain d\'épices',
  'Pistaches Émondées': 'Pistache', 'Pois Chiches (Conserve)': 'Pois chiche', 'Poivre Noir Grains': 'Poivre noir', 'Poudre d\'Amande': 'Amande', 'Pâtes Lasagnes': 'Lasagnes',
  'Pâtes Penne Rigate': 'Penne', 'Pâtes Spaghetti': 'Spaghetti', 'Quinoa Blond': 'Quinoa', 'Raisins Secs Sultamines': 'Raisin sec', 'Riz Arborio (Risotto)': 'Riz arborio', 'Riz Basmati': 'Riz basmati',
  'Riz carnaroli': 'Carnaroli', 'Sel Fin de Cuisine': 'Sel alimentaire', 'Sirop de Glucose': 'Sirop de glucose', 'Sucre semoule': 'Sucre', 'Vinaigre de Vin Rouge': 'Vinaigre',
  'Bourgogne aligoté': 'Bourgogne aligoté', 'Crème de cassis': 'Crème de cassis', 'Crémant de Bourgogne': 'Crémant de Bourgogne', 'Crémant de Loire': 'Crémant de Loire',
  'Limonade': 'Limonade', 'Sirop de Menthe': 'Sirop de menthe', 'Jambon persillé': 'Jambon persillé', 'Pâté en Croûte': 'Pâté en croûte', 'Rosette de Lyon': 'Rosette de Lyon',
  'Saucisson Sec': 'Saucisson', 'Pain de campagne': 'Pain de campagne', 'Crottin de Chavignol': 'Crottin de Chavignol', 'Fromage Blanc': 'Fromage blanc', 'Gorgonzola': 'Gorgonzola',
  'Mascarpone': 'Mascarpone', 'Sainte-Maure de Touraine': 'Sainte-maure-de-touraine',
};

// Résultats écartés après relecture des images : dessin botanique, animal vivant, tableau, homonyme ou schéma.
// Ces ingrédients gardent leur pictogramme plutôt qu'une photo qui ne leur ressemble pas.
const REJECTED = new Set(["Ail Blanc", "Beurre Demi-Sel (Plaquette)", "Beurre Doux 82% (Plaquette)", "Beurre Gastronomique (Motte 5kg)", "Beurre de Tourage (Feuilletage)", "Beurre doux", "Cabillaud (Dos)", "Cacao en Poudre (Van Houten)", "Café Grains 1kg", "Café en grains", "Caille Entière", "Caissettes Papier (Muffin)", "Chair de Crabe", "Cheddar Orange", "Coriandre", "Cornichons Extra Fins", "Crevettes Roses 40/60", "Crémant de Loire", "Dos de cabillaud", "Filet de Sanglier", "Film Étirable Cuisine (45cm)", "Fécule de Maïs (Maïzena)", "Gambas", "Gambas Surgelées", "Gigue de Chevreuil", "Laitue Coeur de Laitue", "Laurier Sauce", "Levure Chimique", "Lieu Noir (Filet)", "Limonade", "Mâche", "Oeufs de Truite", "Oignon Jaune", "Oignon Rouge", "Oignons jaunes", "Olives Noires Dénoyautées", "Pois Chiches (Conserve)", "Poivre Noir Grains", "Pomme de terre Grenaille", "Pommes de terre grenaille", "Poulet Entier PAC", "Quinoa Blond", "Rascasse Rouge", "Romarin Frais", "Salade de Poulpe", "Sucre semoule", "Tentacules de Poulpe Cuites", "Tomate Grappe", "Vin Rosé (Provence)", "Épinard Frais"]);

async function api(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`Wikipédia ne répond pas (${host})`);
}

const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Image principale de l'article, avec son auteur et sa licence. */
async function findPhoto(name) {
  if (REJECTED.has(name)) return null;
  const article = name in ARTICLES ? ARTICLES[name] : name.replace(/\([^)]*\)/g, '').replace(/\b\d+[.,]?\d*\s?(kg|g|l|cl|ml|%)\b/gi, '').replace(/\bAOP\b/g, '').trim();
  if (!article) return null;
  const page = (await api('fr.wikipedia.org', { action: 'query', titles: article, redirects: '1', prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '500' })).query?.pages?.[0];
  if (!page || page.missing || !page.thumbnail || !page.pageimage) return null;
  if (/\.(svg|gif)$/i.test(page.pageimage)) return null; // schémas, cartes, pictogrammes
  const info = (await api('commons.wikimedia.org', { action: 'query', titles: `File:${page.pageimage}`, prop: 'imageinfo', iiprop: 'extmetadata|url' })).query?.pages?.[0]?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = strip(meta.LicenseShortName?.value);
  if (!license) return null; // licence inconnue : on ne prend pas
  const author = strip(meta.Artist?.value).slice(0, 80) || 'Auteur inconnu';
  return {
    article: page.title,
    thumb: page.thumbnail.source,
    credit: `${author}, ${license}, Wikimedia Commons`,
    source: info.descriptionurl,
  };
}

const db = new pg.Client({ connectionString: env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full') });
await db.connect();
const names = (await db.query(
  `select name from public.ingredients group by name having count(*) filter (where image_url is not null and image_url <> '') = 0 order by name`,
)).rows.map((r) => r.name);
console.log(`${names.length} noms d'ingrédients sans photo.`);

// 1. Recherche (ou reprise d'une recherche déjà faite et relue)
let plan = fs.existsSync(PLAN) && !dryRun ? JSON.parse(fs.readFileSync(PLAN, 'utf8')) : null;
if (!plan) {
  plan = {};
  for (const name of names) {
    try { plan[name] = await findPhoto(name); } catch (e) { plan[name] = null; console.log(`  erreur pour ${name} : ${e.message}`); }
    await sleep(120);
  }
  fs.mkdirSync(path.dirname(PLAN), { recursive: true });
  fs.writeFileSync(PLAN, JSON.stringify(plan, null, 1));
}
const found = names.filter((n) => plan[n] && !REJECTED.has(n));
console.log(`${found.length} photos trouvées, ${names.length - found.length} sans résultat.`);
console.log('Sans résultat :', names.filter((n) => !plan[n]).join(' | ') || 'aucun');
if (dryRun) { await db.end(); process.exit(0); }

// 2. Copie sur Blob et mise à jour : une même image sert à tous les ingrédients du même nom.
const uploaded = new Map();
let updated = 0;
for (const name of found) {
  const photo = plan[name];
  let url = uploaded.get(photo.thumb);
  if (!url) {
    const res = await fetch(photo.thumb, { headers: { 'User-Agent': UA } });
    if (!res.ok) { console.log(`  image indisponible pour ${name} (${res.status})`); continue; }
    const body = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12);
    url = (await put(`ingredients/${hash}.${ext}`, body, { access: 'public', contentType: type, token: env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31536000 })).url;
    uploaded.set(photo.thumb, url);
    await sleep(150);
  }
  const res = await db.query(
    `update public.ingredients set image_url = $1, image_credit = $2 where name = $3 and (image_url is null or image_url = '')`,
    [url, photo.credit, name],
  );
  updated += res.rowCount;
}
console.log(`${uploaded.size} images copiées, ${updated} ingrédients mis à jour.`);
await db.end();
