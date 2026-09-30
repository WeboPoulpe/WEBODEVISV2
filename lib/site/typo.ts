// Typographie française : une espace insécable avant « ? ! : ; » et à l'intérieur des guillemets,
// pour qu'un signe ne se retrouve jamais seul en début de ligne.
const NBSP = '\u00a0';

export const fr = (text: string): string =>
  text.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
