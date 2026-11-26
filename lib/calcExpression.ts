// Petite calculatrice des frais annexes : « CAM 200 + 50 + COM 250 » → 500.
// Les mots sont ignorés ; seuls les nombres et les opérations + − × ÷ et les parenthèses comptent.
// Pas d'eval : un analyseur à descente récursive, qui rend null dès que l'expression n'est pas claire.

type Token = number | '+' | '-' | '*' | '/' | '(' | ')';

function tokenize(input: string): Token[] | null {
  const text = input
    .replace(/[−–—]/g, '-')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    // « 3 x 15 » : le x entre deux nombres multiplie.
    .replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1*')
    // Les mots et symboles (€, %) sont des libellés : on les retire.
    .replace(/[^\d.,+\-*/()\s]/g, ' ');
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+(?:[.,]\d+)?)|([+\-*/()]))/y;
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(text);
    if (!m) return null;
    if (m[1] !== undefined) {
      // Deux nombres à la suite sans opération : on ne devine pas.
      if (typeof tokens[tokens.length - 1] === 'number') return null;
      tokens.push(Number(m[1].replace(',', '.')));
    } else tokens.push(m[2] as Token);
    i = re.lastIndex;
  }
  return tokens;
}

/** Valeur de l'expression au centime, ou null si elle est vide, ambiguë ou incalculable. */
export function evalAmount(input: string): number | null {
  const tokens = tokenize(input);
  if (!tokens || !tokens.some((t) => typeof t === 'number')) return null;
  // Opérateurs traînants (« 200 + ») : retirés, pour calculer pendant la saisie.
  while (tokens.length && typeof tokens[tokens.length - 1] === 'string' && tokens[tokens.length - 1] !== ')') tokens.pop();
  let pos = 0;
  const peek = () => tokens[pos];

  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') v = tokens[pos++] === '+' ? v + term() : v - term();
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = tokens[pos++];
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const factor = (): number => {
    const t = tokens[pos++];
    if (typeof t === 'number') return t;
    if (t === '-') return -factor();
    if (t === '+') return factor();
    if (t === '(') {
      const v = expr();
      if (tokens[pos++] !== ')') throw new Error('parenthèse');
      return v;
    }
    throw new Error('jeton');
  };

  try {
    const v = expr();
    if (pos !== tokens.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch {
    return null;
  }
}
