// Brochure « Convivial Event — Catering 2026-2027 au Château de Vallery », version française puis anglaise,
// sous forme de mise en page à blocs (éditeur avancé, lib/brochureLayout.ts). Aucune prestation du catalogue :
// tout est en blocs Texte, mis en forme en ligne (styles inline), donc modifiable ensuite dans l'éditeur.
// Utilisé par scripts/seed-convivial-brochure.mjs.

export const T = {
  fr: {
    lang: 'fr',
    coverKicker: 'Catering',
    coverYears: 'Saison 2026 – 2027',
    coverVenue: 'au Château de Vallery',
    coverMin: 'À partir de 50 adultes facturés',
    tagline: ['Spécialiste du repas champêtre avec tournebroche', 'Organisation de brunchs et soirées conviviales', 'Mariages écoresponsables et repas végétariens ou végans'],
    ecolabel: 'Éco-responsable',
    sectionEvening: 'Les soirées',
    sectionEveningSub: 'Le dîner de la veille ou du grand jour',
    intro: [
      'Toutes nos formules et recettes sont déclinables en version végétarienne.',
      'Variantes thématiques possibles : italienne, méditerranéenne, indienne, orientale, allemande, ch’ti, belge, hollandaise…',
    ],
    styles: [
      ['Conviviale', 'autour d’un BBQ ou d’un grand poêlon, à table'],
      ['Guinguette', 'autour d’un plat mijoté traditionnel, servi à table en cocotte en fonte'],
      ['Dînatoire', 'autour d’ardoises gourmandes et d’un show-cooking'],
    ],
    included: 'Inclus',
    or: 'ou',
    perPers: '/ pers.',
    sectionExtras: 'Le petit plus de votre soirée',
    sectionBrunch: 'Le lendemain',
    sectionOptions: 'Les options possibles',
    contact: 'Contact & réservation',
    page: 'Page',
    note: 'Prix par personne. Vins et alcools fournis par le client, sauf options proposées par le traiteur.',
  },
  en: {
    lang: 'en',
    coverKicker: 'Catering',
    coverYears: '2026 – 2027 Season',
    coverVenue: 'at Château de Vallery',
    coverMin: 'Minimum 50 adults invoiced',
    tagline: ['Specialists in country-style spit-roast meals', 'Brunches and convivial evenings', 'Eco-friendly weddings, vegetarian and vegan menus'],
    ecolabel: 'Eco-friendly',
    sectionEvening: 'The evenings',
    sectionEveningSub: 'Dinner the day before or on the big day',
    intro: [
      'All our menus and recipes are available in a vegetarian version.',
      'Possible themed variations: Italian, Mediterranean, Indian, Oriental, German, Northern French, Belgian, Dutch…',
    ],
    styles: [
      ['Convivial', 'around a BBQ or a large skillet, served at the table'],
      ['Guinguette', 'around a traditional slow-cooked dish, served at the table in a cast-iron pot'],
      ['Walking dinner', 'around gourmet sharing boards and live show-cooking'],
    ],
    included: 'Included',
    or: 'or',
    perPers: '/ person',
    sectionExtras: 'The finishing touch',
    sectionBrunch: 'The day after',
    sectionOptions: 'Optional extras',
    contact: 'Contact & booking',
    page: 'Page',
    note: 'Prices per person. Wines and spirits supplied by the client, unless ordered from the caterer as an option.',
  },
};

export const F = {
  fr: {
    bbq: {
      kicker: 'Soirée conviviale', title: 'BBQ ou Tournebroche', price: '42 €',
      included: ['Déplacement, stand et buffet nappé', 'Tout le matériel de cuisson du concept', 'Notre rôtisseur et 1 serveur pour 40 invités pour la gestion du repas', 'Location de vaisselle vintage et nappage en tissu', 'Pain de campagne'],
      choices: [
        { name: 'Le BBQ Brasero', desc: '300 g/pers. de viandes : poulet mariné, onglet de bœuf, saumon frais, magret, saucisserie — pommes grenailles sautées au thym' },
        { name: 'Le Tournebroche de porcelet rôti', desc: 'et ses cuissots (500 g/pers.), sauce au miel — pommes grenailles sautées au thym', extra: '+2 €' },
        { name: 'Le Tournebroche d’agneau rôti', desc: 'et ses culottes d’agneau — pommes grenailles sautées au thym', extra: '+3 €' },
      ],
      notes: ['Autres viandes possibles sur demande, ou brasero végétarien'],
      addons: [['Brasero de légumes provençaux', '+3 €']],
    },
    guinguette: {
      kicker: 'Soirée guinguette', title: '« Cocotte en fonte »', price: '42 €',
      included: ['Déplacement, stand et buffet nappé', 'Tout le matériel de cuisson du concept', 'Notre cuisinier et 1 serveur pour 40 invités pour la gestion du repas', 'Location de vaisselle vintage et nappage en tissu', 'Pain de campagne'],
      lead: 'Vos invités passent à table — servi en cocotte en fonte, pain de campagne tranché',
      choices: [
        { name: 'Bœuf bourguignon', desc: 'et ses pommes de terre fondantes au jus', opt: ['Option purée maison', '+1 €'] },
        { name: 'Blanquette de veau à l’ancienne', desc: 'petits légumes locavores et son riz pilaf' },
        { name: 'Filet mignon de porc lardé, sauce Pinot Noir', desc: 'pommes grenailles sautées forestières' },
        { name: 'Suprême de pintadeau en crémée de morilles', desc: 'gratin dauphinois' },
      ],
      addons: [['Option étuvée de légumes', '+2 €']],
    },
    poelon: {
      kicker: 'Soirée conviviale', title: 'Autour du Grand Poêlon', price: '42 €',
      included: ['Déplacement, stand et buffet nappé', 'Tout le matériel de cuisson du concept', 'Notre cuisinier et 1 serveur pour 40 invités pour la gestion du repas', 'Location de vaisselle vintage et nappage en tissu', 'Pain de campagne'],
      lead: 'Le Grand Poêlon, cuisiné devant vous',
      choices: [
        { name: 'Tajine de poulet à l’orientale' },
        { name: 'Risotto parmesan', desc: 'et ses filets de caille rôtis sur plancha' },
        { name: 'Paella conviviale' },
        { name: 'Colombo de mignon de porc' },
      ],
    },
    dinatoire: {
      kicker: 'Soirée dînatoire', title: '« À la française »', price: '47 €',
      included: ['Déplacement, stand et buffet nappé', 'Tout le matériel de cuisson du concept', 'Notre cuisinier et 1 serveur pour 40 invités pour la gestion du repas', 'Location de verrerie et vaisselle dînatoire', 'Pain tranché'],
      courses: [
        { name: 'Les 6 tapas apéritifs Terroir', sub: '(ou pièces cocktail)', desc: 'Bruschetta champignon · Ciabatta italienne · Bruschetta tomate-mozza · Croûtonnée tapenade et chips · Samoussa · Gougère champignon' },
        { name: 'Ardoises de charcuteries et fromages de la région', sub: '(200 g)', desc: 'Pain tranché' },
        { name: 'Le stand « poêlon et cocotte grand-mère » devant vous', sub: 'servis en petites cassolettes dînatoires', desc: 'Bœuf bourguignon et ses pommes de terre fondantes au jus, servi en cocotte en fonte + Risotto parmesan et son émincé de volaille fondante', note: 'Autres recettes possibles' },
        { name: 'Petit buffet de desserts bourguignons', sub: '(version mignardises possible)', desc: 'Clafoutis cerise · Poire au cassis · Tarte crumble · Flambée de prunes au marc de Bourgogne' },
      ],
      addons: [['Nappage en tissu des tables rondes', '+2 €']],
    },
    bar: {
      kicker: 'Apéritif', title: 'Bar apéritif d’accueil', price: '11 €',
      included: ['Notre barman pour toute la prestation', 'Le bar convivial et son mobilier, la verrerie, les glaçons', 'Les eaux minérales et le bar à softs'],
      lead: 'Les 6 bouchées apéritives, au choix',
      choices: [
        { name: '6 Tapas Terroir', desc: 'Gougère emmental et champignon · Bruschetta forestière et italienne · Ciabatta · Croûtonnée tapenade et chips · Samoussa' },
        { name: '6 Pièces cocktail', desc: 'Nordique saumon · Brochette tomate-mozza · Navette magret · Burger végé · Brochette toscane ou autre' },
        { name: 'Bistrot', desc: 'Piqué de charcuteries et fromages bourguignons · Panier de gougères et torsades · Croûtonnée tapenades et chips de légumes' },
      ],
      notes: ['Vins et alcools fournis par le client'],
      optTitle: 'Ou en option, fournis par le traiteur',
      opts: [
        ['2 cocktails / pers. réalisés devant vous', '+3,50 €', 'Spritz, Mojito, Margarita, Moscow Mule, Espresso Martini, Gin Fizz…'],
        ['Crémant de Bourgogne', '12 € la bouteille'],
        ['Petit Chablis', '6 € la bouteille'],
        ['Bourgogne Pinot Noir', '12 € la bouteille'],
      ],
    },
    brunch: {
      kicker: 'Le lendemain', title: 'Le Convivial Brunch', price: '36 €',
      included: ['Buffet décoré', 'Tasses recyclables prestige · Vaisselle tradition simple', 'Belles nappes blanches et serviettes', '1 cuisinier et 1 serveur pour 40 invités pour la gestion de votre brunch'],
      breakfastTitle: 'Le Breakfast',
      breakfast: ['Café, thé, jus d’orange pressé frais, lait frais', 'Céréales, yaourts', 'Eaux plates et gazeuses · Bonbonne de thé glacé ou citronnade', 'Pain frais, brioche · Beurre demi-sel, confiture artisanale, miel'],
      breakfastOpt: ['Les 2 mini-viennoiseries', '+2,50 €'],
      lunchTitle: 'Le lunch du midi', lunchSub: 'au choix',
      lunch: [
        { name: 'L’atelier galette de sarrasin', desc: 'jambon, gruyère, champignons — ou galette de sarrasin façon chakchouka (tomate, cumin, œuf)' },
        { name: 'L’animation œufs brouillés au saumon fumé devant vous', desc: 'coupelles d’avocat et concombre' },
        { name: 'Le risotto et wok de volaille', desc: 'ou tajine' },
        { name: 'Le buffet froid', desc: 'salades, charcuteries, viandes, fromages', extra: '+3 €' },
      ],
      dessertTitle: 'Et pour finir',
      dessert: [
        { name: 'Assortiment de tartes maison', desc: 'abricot, crumble pomme et fruits rouges, salade de fruits à la menthe' },
        { name: 'Animation crêpes party', desc: 'sucre, pâte à tartiner, confiture, sirop d’érable' },
      ],
    },
    options: [
      ['Personnel supplémentaire pour un vrai service', '250 €', ''],
      ['Bar à softs et eaux minérales en bouteille verre, en open-bar', '+2 € / pers.', 'Compris dans l’option « Bar apéritif d’accueil »'],
      ['Ardoises de charcuteries bourguignonnes', '2,50 € / pers.', 'Jambon persillé de Bourgogne, saucisson fumé, rosette'],
      ['Ardoises de fromages régionaux', '2,50 € / pers.', 'Époisses, Chaource, Prestige de Bourgogne, Comté, chèvre, pain de campagne'],
      ['Petit buffet de desserts régionaux', '4 € / pers.', 'Clafoutis de cerise de l’Yonne, salade de poire dijonnaise au cassis, tarte crumble fruits rouges et pommes, pain d’épices de Dijon…'],
      ['Café en open-bar', '0,75 € / pers.', ''],
    ],
  },
  en: {
    bbq: {
      kicker: 'Convivial evening', title: 'BBQ or Spit-Roast', price: '€42',
      included: ['Travel, stand and dressed buffet table', 'All the cooking equipment for the concept', 'Our roast chef and 1 waiter per 40 guests to manage the meal', 'Vintage crockery and cloth tablecloth hire', 'Country bread'],
      choices: [
        { name: 'The BBQ Brazier', desc: '300 g/person of meats: marinated chicken, hanger steak, fresh salmon, duck breast, sausages — sautéed baby potatoes with thyme' },
        { name: 'Spit-roasted suckling pig', desc: 'and its legs (500 g/person), honey sauce — sautéed baby potatoes with thyme', extra: '+€2' },
        { name: 'Spit-roasted lamb', desc: 'and lamb rumps — sautéed baby potatoes with thyme', extra: '+€3' },
      ],
      notes: ['Other meats available on request, or a vegetarian brazier'],
      addons: [['Provençal vegetable brazier', '+€3']],
    },
    guinguette: {
      kicker: 'Guinguette evening', title: '“Cast-Iron Pot”', price: '€42',
      included: ['Travel, stand and dressed buffet table', 'All the cooking equipment for the concept', 'Our cook and 1 waiter per 40 guests to manage the meal', 'Vintage crockery and cloth tablecloth hire', 'Country bread'],
      lead: 'Your guests sit down at the table — served in a cast-iron pot, sliced country bread',
      choices: [
        { name: 'Beef bourguignon', desc: 'with melting potatoes in their juices', opt: ['Homemade mashed potatoes', '+€1'] },
        { name: 'Old-fashioned veal blanquette', desc: 'small locally-grown vegetables and rice pilaf' },
        { name: 'Bacon-wrapped pork tenderloin, Pinot Noir sauce', desc: 'baby potatoes sautéed with wild mushrooms' },
        { name: 'Guinea fowl supreme in morel cream', desc: 'gratin dauphinois' },
      ],
      addons: [['Braised vegetables option', '+€2']],
    },
    poelon: {
      kicker: 'Convivial evening', title: 'Around the Great Skillet', price: '€42',
      included: ['Travel, stand and dressed buffet table', 'All the cooking equipment for the concept', 'Our cook and 1 waiter per 40 guests to manage the meal', 'Vintage crockery and cloth tablecloth hire', 'Country bread'],
      lead: 'The Great Skillet, cooked in front of you',
      choices: [
        { name: 'Oriental chicken tagine' },
        { name: 'Parmesan risotto', desc: 'with quail fillets roasted on the plancha' },
        { name: 'Convivial paella' },
        { name: 'Pork tenderloin Colombo' },
      ],
    },
    dinatoire: {
      kicker: 'Walking dinner', title: '“French-Style”', price: '€47',
      included: ['Travel, stand and dressed buffet table', 'All the cooking equipment for the concept', 'Our cook and 1 waiter per 40 guests to manage the meal', 'Glassware and finger-food tableware hire', 'Sliced bread'],
      courses: [
        { name: '6 local appetiser tapas', sub: '(or cocktail bites)', desc: 'Mushroom bruschetta · Italian ciabatta · Tomato-mozzarella bruschetta · Tapenade toasts and crisps · Samosa · Mushroom gougère' },
        { name: 'Boards of regional charcuterie and cheeses', sub: '(200 g)', desc: 'Sliced bread' },
        { name: 'The “grandma’s skillet & casserole” station in front of you', sub: 'served in small individual cassolettes', desc: 'Beef bourguignon with melting potatoes in their juices, served in a cast-iron pot + Parmesan risotto with tender sliced chicken', note: 'Other recipes available' },
        { name: 'Small buffet of Burgundy desserts', sub: '(petits fours version available)', desc: 'Cherry clafoutis · Pear with blackcurrant · Crumble tart · Plums flambéed with Marc de Bourgogne' },
      ],
      addons: [['Cloth tablecloths for round tables', '+€2']],
    },
    bar: {
      kicker: 'Aperitif', title: 'Welcome Aperitif Bar', price: '€11',
      included: ['Our bartender for the whole service', 'The convivial bar and its furniture, glassware and ice', 'Mineral water and soft-drinks bar'],
      lead: '6 appetiser bites, your choice of',
      choices: [
        { name: '6 Local Tapas', desc: 'Emmental and mushroom gougère · Wild mushroom and Italian bruschetta · Ciabatta · Tapenade toasts and crisps · Samosa' },
        { name: '6 Cocktail Bites', desc: 'Nordic salmon · Tomato-mozzarella skewer · Duck breast navette · Veggie burger · Tuscan skewer or other' },
        { name: 'Bistro', desc: 'Burgundy charcuterie and cheese picks · Basket of gougères and puff-pastry twists · Tapenade toasts and vegetable crisps' },
      ],
      notes: ['Wines and spirits supplied by the client'],
      optTitle: 'Or as an option, supplied by the caterer',
      opts: [
        ['2 cocktails / person made in front of you', '+€3.50', 'Spritz, Mojito, Margarita, Moscow Mule, Espresso Martini, Gin Fizz…'],
        ['Crémant de Bourgogne', '€12 per bottle'],
        ['Petit Chablis', '€6 per bottle'],
        ['Bourgogne Pinot Noir', '€12 per bottle'],
      ],
    },
    brunch: {
      kicker: 'The day after', title: 'The Convivial Brunch', price: '€36',
      included: ['Decorated buffet', 'Premium recyclable cups · Simple traditional crockery', 'Fine white tablecloths and napkins', '1 cook and 1 waiter per 40 guests to manage your brunch'],
      breakfastTitle: 'Breakfast',
      breakfast: ['Coffee, tea, freshly squeezed orange juice, fresh milk', 'Cereals, yoghurts', 'Still and sparkling water · Iced tea or lemonade dispenser', 'Fresh bread, brioche · Salted butter, artisan jam, honey'],
      breakfastOpt: ['2 mini pastries', '+€2.50'],
      lunchTitle: 'Midday lunch', lunchSub: 'your choice',
      lunch: [
        { name: 'Buckwheat galette station', desc: 'ham, Gruyère, mushrooms — or shakshuka-style buckwheat galette (tomato, cumin, egg)' },
        { name: 'Scrambled eggs with smoked salmon, cooked in front of you', desc: 'avocado and cucumber cups' },
        { name: 'Chicken risotto and wok', desc: 'or tagine' },
        { name: 'Cold buffet', desc: 'salads, charcuterie, meats, cheeses', extra: '+€3' },
      ],
      dessertTitle: 'To finish',
      dessert: [
        { name: 'Assortment of homemade tarts', desc: 'apricot, apple and red-fruit crumble, fruit salad with mint' },
        { name: 'Crêpe party', desc: 'sugar, chocolate spread, jam, maple syrup' },
      ],
    },
    options: [
      ['Additional staff for full table service', '€250', ''],
      ['Open bar of soft drinks and mineral water in glass bottles', '+€2 / person', 'Included in the “Welcome Aperitif Bar” option'],
      ['Burgundy charcuterie boards', '€2.50 / person', 'Burgundy parsleyed ham, smoked sausage, rosette'],
      ['Regional cheese boards', '€2.50 / person', 'Époisses, Chaource, Prestige de Bourgogne, Comté, goat’s cheese, country bread'],
      ['Small buffet of regional desserts', '€4 / person', 'Yonne cherry clafoutis, Dijon-style pear salad with blackcurrant, red-fruit and apple crumble tart, Dijon gingerbread…'],
      ['Open-bar coffee', '€0.75 / person', ''],
    ],
  },
};


// ── Mise en forme ────────────────────────────────────────────────────────────
// Un bloc Texte est affiché à 3,3 % de la largeur de page : les tailles ci-dessous sont en em de cette base.
const C = { plum: '#5b2638', plumSoft: '#8a4a5e', gold: '#a8844f', goldLight: '#d6ba8c', sage: '#5f6e52', ink: '#2b2326', muted: '#6f6468', line: '#e4d9c8', cream: '#fbf7f0' };
const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";

const css = (o) => Object.entries(o).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`).join(';');
const tag = (name, style, inner) => `<${name}${Object.keys(style).length ? ` style="${css(style)}"` : ''}>${inner}</${name}>`;
const div = (style, inner) => tag('div', style, inner);
const p = (style, inner) => tag('p', { margin: '0', ...style }, inner);
const span = (style, inner) => tag('span', style, inner);

const extra = (s) => span({ fontFamily: SANS, fontSize: '0.75em', fontWeight: '600', color: '#fff', background: C.gold, borderRadius: '3px', padding: '0 0.35em', marginLeft: '0.3em', fontStyle: 'normal', whiteSpace: 'nowrap' }, s);
const ornament = (color = C.gold) => p({ textAlign: 'center', color, fontSize: '0.6em', letterSpacing: '0.6em', margin: '0.4em 0' }, '— ✦ —');
const orSep = (t) => p({ textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.5em', color: C.gold, margin: '0.25em 0' }, `— ${t.or} —`);

const cardHead = (f, t) => `
${p({ fontFamily: SANS, fontSize: '0.42em', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.sage, fontWeight: '600' }, f.kicker)}
${div({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6em', marginTop: '0.15em' }, `
  ${p({ fontFamily: SERIF, fontSize: '1.15em', fontWeight: '600', color: C.plum, lineHeight: '1.1', textAlign: 'left' }, f.title)}
  ${div({ background: C.plum, color: '#fff', borderRadius: '6px', padding: '0.25em 0.55em', textAlign: 'center', flexShrink: '0' }, `
    ${p({ fontFamily: SERIF, fontSize: '1em', fontWeight: '600', lineHeight: '1' }, f.price)}
    ${p({ fontFamily: SANS, fontSize: '0.36em', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: '0.85' }, t.perPers)}`)}`)}
${p({ fontFamily: SANS, fontSize: '0.46em', lineHeight: '1.55', color: C.muted, borderTop: `1px dashed ${C.line}`, borderBottom: `1px dashed ${C.line}`, padding: '0.5em 0', margin: '0.6em 0 0.5em', textAlign: 'left' },
  `${span({ color: C.gold, fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', marginRight: '0.5em' }, t.included)}${f.included.join(span({ color: C.gold, margin: '0 0.4em' }, '·'))}`)}`;

const lead = (s) => p({ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.62em', color: C.plumSoft, textAlign: 'center', margin: '0.3em 0 0.4em' }, s);
const name = (s, ex) => p({ fontFamily: SERIF, fontSize: '0.72em', fontWeight: '600', color: C.ink, lineHeight: '1.25', textAlign: 'center' }, `${s}${ex ? extra(ex) : ''}`);
const desc = (s) => p({ fontFamily: SANS, fontSize: '0.47em', color: C.muted, lineHeight: '1.45', textAlign: 'center' }, s);
const opt = (s, ex) => p({ fontFamily: SANS, fontSize: '0.46em', color: C.plumSoft, fontStyle: 'italic', textAlign: 'center', marginTop: '0.15em' }, `${s}${ex ? extra(ex) : ''}`);

const choices = (items, t) => items.map((c, i) => `${i ? orSep(t) : ''}${name(c.name, c.extra)}${c.desc ? desc(c.desc) : ''}${c.opt ? opt(c.opt[0], c.opt[1]) : ''}`).join('');
const notes = (f) => (f.notes ?? []).map((n) => p({ fontFamily: SANS, fontSize: '0.46em', fontStyle: 'italic', color: C.sage, textAlign: 'center', marginTop: '0.5em' }, n)).join('');
const addons = (f) => (f.addons ?? []).map((a) => p({ textAlign: 'center', marginTop: '0.6em' },
  span({ fontFamily: SANS, fontSize: '0.46em', background: C.cream, border: `1px solid ${C.line}`, borderRadius: '99px', padding: '0.25em 0.9em', color: C.ink }, `+ ${a[0]} <strong style="color:${C.plum}">${a[1]}</strong>`))).join('');

const card = (inner, scale = 1.25) => div({ fontSize: `${scale}em`, background: '#fff', border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.plum}`, borderRadius: '8px', padding: '0.8em 0.9em', textAlign: 'center' }, inner);

const priceRow = (o, big) => div({ padding: big ? '0.3em 0' : '0.2em 0', borderBottom: big ? `1px solid #f1eadf` : 'none', textAlign: 'left' }, `
  ${div({ display: 'flex', alignItems: 'baseline', gap: '0.4em' }, `
    ${span({ fontFamily: big ? SERIF : SANS, fontSize: big ? '0.62em' : '0.5em', fontWeight: big ? '600' : '500', color: C.ink }, o[0])}
    ${span({ flex: '1', borderBottom: '1px dotted #c8b9a2', minWidth: '1em' }, '')}
    ${span({ fontFamily: SANS, fontSize: '0.5em', fontWeight: '600', color: C.plum, whiteSpace: 'nowrap' }, o[1])}`)}
  ${o[2] ? p({ fontFamily: SANS, fontSize: '0.42em', fontStyle: 'italic', color: C.muted }, o[2]) : ''}`);

function formulaHtml(f, t) {
  return card(`${cardHead(f, t)}${f.lead ? lead(f.lead) : ''}${f.choices ? choices(f.choices, t) : ''}${notes(f)}${addons(f)}`, 1.3);
}

function dinatoireHtml(f, t) {
  const courses = f.courses.map((c, i) => div({ display: 'flex', gap: '0.5em', alignItems: 'flex-start', textAlign: 'left', marginTop: '0.45em' }, `
    ${span({ fontFamily: SERIF, fontSize: '0.55em', fontWeight: '600', color: C.gold, border: `1px solid ${C.gold}`, borderRadius: '50%', width: '1.9em', height: '1.9em', lineHeight: '1.85em', textAlign: 'center', flexShrink: '0' }, ['I', 'II', 'III', 'IV'][i])}
    ${div({}, `
      ${p({ fontFamily: SERIF, fontSize: '0.66em', fontWeight: '600', color: C.ink, lineHeight: '1.25' }, `${c.name} ${span({ fontFamily: SANS, fontSize: '0.65em', fontWeight: '400', fontStyle: 'italic', color: C.muted }, c.sub || '')}`)}
      ${p({ fontFamily: SANS, fontSize: '0.46em', color: C.muted, lineHeight: '1.45' }, c.desc)}
      ${c.note ? p({ fontFamily: SANS, fontSize: '0.44em', color: C.plumSoft, fontStyle: 'italic' }, c.note) : ''}`)}`)).join('');
  return card(`${cardHead(f, t)}${courses}${addons(f)}`);
}

function barHtml(f, t) {
  return card(`${cardHead(f, t)}${lead(f.lead)}${choices(f.choices, t)}${notes(f)}
    ${div({ background: C.cream, borderRadius: '6px', padding: '0.6em 0.8em', marginTop: '0.7em', textAlign: 'left' }, `
      ${p({ fontFamily: SANS, fontSize: '0.42em', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.plum, fontWeight: '600', marginBottom: '0.3em' }, f.optTitle)}
      ${f.opts.map((o) => priceRow(o, false)).join('')}`)}`, 1.2);
}

function brunchHtml(f, t) {
  const h = (s, sub) => p({ fontFamily: SERIF, fontSize: '0.8em', fontWeight: '600', color: C.plum, borderBottom: `1px solid ${C.line}`, paddingBottom: '0.15em', margin: '0.7em 0 0.35em', textAlign: 'center' },
    `${s}${sub ? span({ fontFamily: SANS, fontSize: '0.55em', fontWeight: '400', fontStyle: 'italic', color: C.muted }, ` — ${sub}`) : ''}`);
  const bullets = f.breakfast.map((b) => p({ fontFamily: SANS, fontSize: '0.5em', color: C.ink, textAlign: 'center', margin: '0.2em 0' }, b)).join('');
  return card(`${cardHead(f, t)}
    ${h(f.breakfastTitle)}${bullets}${opt(`+ ${f.breakfastOpt[0]}`, f.breakfastOpt[1])}
    ${h(f.lunchTitle, f.lunchSub)}${choices(f.lunch, t)}
    ${div({ background: C.cream, borderRadius: '6px', padding: '0.2em 0.8em 0.7em', marginTop: '0.7em' }, `${h(f.dessertTitle)}${choices(f.dessert, t)}`)}`, 1.04);
}

const sectionTitle = (title, sub) => div({ textAlign: 'center' }, `
  ${p({ fontFamily: SERIF, fontSize: '1.45em', fontWeight: '600', color: C.plum, lineHeight: '1.1' }, title)}
  ${sub ? p({ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.7em', color: C.muted }, sub) : ''}
  ${ornament()}`);

function introHtml(t) {
  const styles = t.styles.map((s) => div({ borderLeft: `2px solid ${C.gold}`, paddingLeft: '0.5em', textAlign: 'left', flex: '1', minWidth: '0' }, `
    ${p({ fontFamily: SERIF, fontSize: '0.72em', fontWeight: '600', color: C.plum }, s[0])}
    ${p({ fontFamily: SANS, fontSize: '0.42em', color: C.muted, lineHeight: '1.4' }, s[1])}`)).join('');
  return div({ background: C.cream, borderRadius: '8px', padding: '0.7em 0.8em' }, `
    ${div({ display: 'flex', gap: '0.6em' }, styles)}
    ${p({ fontFamily: SANS, fontSize: '0.48em', fontWeight: '500', color: C.sage, textAlign: 'center', marginTop: '0.7em' }, t.intro[0])}
    ${p({ fontFamily: SANS, fontSize: '0.43em', fontStyle: 'italic', color: C.muted, textAlign: 'center' }, t.intro[1])}`);
}

function coverHtml(t, isEn) {
  return div({ background: C.plum, color: '#f6eee4', borderRadius: '4px', padding: '0.5em', textAlign: 'center' },
    div({ border: `1px solid ${C.goldLight}`, borderRadius: '2px', padding: '2.2em 1em 1.6em', minHeight: '36.5em', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }, `
      ${div({}, `
        ${p({ fontFamily: SERIF, fontSize: '1.2em', fontWeight: '600', color: C.goldLight, border: `1px solid ${C.goldLight}`, borderRadius: '50%', width: '2.6em', height: '2.6em', lineHeight: '2.55em', margin: '0 auto' }, 'CE')}
        ${p({ fontFamily: SERIF, fontSize: '1.5em', fontWeight: '600', marginTop: '0.4em' }, `Convivial ${span({ fontStyle: 'italic', fontWeight: '500', color: C.goldLight }, 'Event')}`)}
        ${p({ fontFamily: SANS, fontSize: '0.38em', letterSpacing: '0.5em', textTransform: 'uppercase', opacity: '0.75' }, 'Traiteur')}`)}
      ${div({}, `
        ${isEn ? p({ display: 'inline-block', fontFamily: SANS, fontSize: '0.38em', letterSpacing: '0.3em', textTransform: 'uppercase', background: C.goldLight, color: C.plum, fontWeight: '600', padding: '0.3em 0.9em', marginBottom: '1.2em' }, 'English version') : ''}
        ${p({ fontFamily: SANS, fontSize: '0.42em', letterSpacing: '0.6em', textTransform: 'uppercase', color: C.goldLight }, t.coverKicker)}
        ${p({ fontFamily: SERIF, fontSize: '1.9em', fontWeight: '500', lineHeight: '1.1', margin: '0.15em 0' }, t.coverYears)}
        ${ornament(C.goldLight)}
        ${p({ fontFamily: SERIF, fontStyle: 'italic', fontSize: '1.05em' }, t.coverVenue)}
        ${p({ display: 'inline-block', fontFamily: SANS, fontSize: '0.4em', letterSpacing: '0.2em', textTransform: 'uppercase', border: `1px solid ${C.goldLight}`, padding: '0.4em 1em', marginTop: '0.9em' }, t.coverMin)}`)}
      ${div({}, `
        ${t.tagline.map((l) => p({ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.62em', lineHeight: '1.5' }, l)).join('')}
        ${p({ display: 'inline-block', fontFamily: SANS, fontSize: '0.34em', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#cbd6b9', border: '1px solid #9fb08a', borderRadius: '99px', padding: '0.25em 0.9em', margin: '0.8em 0 0.5em' }, t.ecolabel)}
        ${p({ fontFamily: SANS, fontSize: '0.45em', letterSpacing: '0.08em' }, '06 75 33 08 23 &nbsp;·&nbsp; convivialevent@yahoo.fr')}`)}`));
}

function optionsHtml(list) {
  return div({ fontSize: '1.25em', background: '#fff', border: `1px solid ${C.line}`, borderRadius: '8px', padding: '0.5em 0.9em' }, list.map((o) => priceRow(o, true)).join(''));
}

// ── Mise en page ─────────────────────────────────────────────────────────────
// Identifiants stables : relancer le script donne la même mise en page.
let n = 0;
const id = (prefix) => `${prefix}cve${String(++n).padStart(4, '0')}`;
// Police chargée pour la brochure (lib/brochureLayout.layoutFonts lit les polices des blocs) : la page est en
// Montserrat, les titres en Playfair Display.
const text = (html, font = 'Montserrat') => ({ id: id('b'), type: 'text', html: html.replace(/\n\s*/g, ''), style: { font } });
const page = (blocks) => ({ id: id('p'), kind: 'blocks', background: '#FBF7F0', font: 'Montserrat', blocks });

function edition(lang) {
  const t = T[lang]; const f = F[lang];
  return [
    page([text(coverHtml(t, lang === 'en'), 'Playfair Display')]),
    // Une formule par page : aucune carte coupée d'une page à l'autre.
    page([text(sectionTitle(t.sectionEvening, t.sectionEveningSub)), text(introHtml(t)), text(formulaHtml(f.bbq, t))]),
    page([text(formulaHtml(f.poelon, t))]),
    page([text(formulaHtml(f.guinguette, t))]),
    page([text(dinatoireHtml(f.dinatoire, t))]),
    page([text(sectionTitle(t.sectionExtras)), text(barHtml(f.bar, t))]),
    page([text(sectionTitle(t.sectionOptions)), text(optionsHtml(f.options)),
      text(p({ fontSize: '0.5em', fontStyle: 'italic', color: C.muted, textAlign: 'center' }, t.note))]),
    page([text(brunchHtml(f.brunch, t))]),
  ];
}

export function buildBrochure() {
  n = 0;
  return {
    name: 'Convivial Event — Catering 2026-2027 (FR + EN)',
    cover: { title: 'Convivial Event — Catering 2026-2027', subtitle: 'Au Château de Vallery · À partir de 50 adultes facturés' },
    layout: {
      pages: [
        ...edition('fr'),
        ...edition('en'),
        { id: id('p'), kind: 'contact', background: null, font: null, blocks: [] },
        { id: id('p'), kind: 'form', background: null, font: null, blocks: [] },
      ],
    },
  };
}
