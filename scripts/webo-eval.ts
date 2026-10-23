// Évaluation de l'aiguilleur de Webo : 20 demandes types et le spécialiste attendu. Appels réels à Claude (payants,
// quelques centimes) : à lancer à la main après un changement de consignes, jamais en intégration continue.
//
//   npx tsx --conditions=react-server --env-file=.env.local scripts/webo-eval.ts
//
// Ajouter ici les questions des réponses notées « à revoir » (admin > Webo) pour qu'elles ne régressent plus.

import { routeMessage } from '../server/webo/agents';
import { modelCostUsd } from '../lib/webo/models';
import type { AgentName } from '../server/webo/tools';

const CASES: [string, AgentName][] = [
  ['Prépare un devis pour le mariage Dupont, 120 personnes le 14 juin, menu Tentation', 'devis'],
  ['Passe le devis Lenoir à 100 couverts', 'devis'],
  ['Envoie le devis Martin à son client', 'devis'],
  ['Relance les devis sans réponse', 'devis'],
  ['Fais comme pour le mariage Martin de l’an dernier, mais pour 80 personnes', 'devis'],
  ['Bonjour, nous nous marions le 12 juillet à Troyes, 90 invités, auriez-vous une formule cocktail et dîner ? Claire', 'devis'],
  ['Fais l’acompte de 30 % du devis Dupont', 'factures'],
  ['Prépare la facture de solde du gala Renault', 'factures'],
  ['Crée une prestation brunch du dimanche à 38 € par personne', 'catalogue'],
  ['Passe le menu Tentation à 79 €', 'catalogue'],
  ['Écris une description appétissante pour le plateau de fromages', 'catalogue'],
  ['Réponds à la dernière demande de prospect', 'prospects'],
  ['Il y a des nouvelles demandes de prospects ?', 'prospects'],
  ['Qu’est-ce que j’ai à faire aujourd’hui ?', 'journee'],
  ['Résume ma semaine', 'journee'],
  ['Quels événements arrivent ce week-end ?', 'journee'],
  ['Comment je fais une variante de devis ?', 'aide'],
  ['Où je change mon logo ?', 'aide'],
  ['Comment marche la traduction en anglais ?', 'aide'],
  ['Merci Webo !', 'aide'],
];

async function main() {
  let ok = 0;
  let cost = 0;
  for (const [text, expected] of CASES) {
    const { agent, usage } = await routeMessage(text, '');
    cost += usage.reduce((s, u) => s + modelCostUsd(u.model, u), 0);
    const good = agent === expected;
    if (good) ok++;
    console.log(`${good ? '✓' : '✗'} ${expected.padEnd(10)} ${good ? '' : `→ ${agent.padEnd(10)}`} ${text}`);
  }
  console.log(`\n${ok}/${CASES.length} bien aiguillés · coût ${cost.toFixed(4)} $`);
  process.exitCode = ok === CASES.length ? 0 : 1;
}

void main();
