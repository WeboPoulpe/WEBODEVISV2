import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

// La session de test est toujours disponible : compte fourni, ou session signée localement (voir auth.setup.ts).
export const hasTestAccount = true;

/** Capture pleine page rangée par viewport : e2e/screenshots/<mobile|tablet|desktop>/<nom>.png */
export async function shot(page: Page, testInfo: TestInfo, name: string) {
  const file = path.join(__dirname, 'screenshots', testInfo.project.name, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/** Largeur (px) dont la page déborde horizontalement du viewport ; 0 = pas de débordement. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  });
}

/** Éléments visibles qui dépassent du bord droit du viewport (les pires d'abord). */
export async function offscreenElements(page: Page, limit = 5): Promise<string[]> {
  return page.evaluate((max) => {
    const out: { over: number; label: string }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = Math.round(r.right - window.innerWidth);
      if (over <= 1) continue;
      // Ignore ce qui vit dans un conteneur à défilement horizontal voulu.
      let p = el.parentElement;
      let scrollable = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') { scrollable = true; break; }
        p = p.parentElement;
      }
      if (scrollable) continue;
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      out.push({ over, label: `${el.tagName.toLowerCase()}${text ? ` « ${text} »` : ''} (+${over}px)` });
    }
    return out.sort((a, b) => b.over - a.over).slice(0, max).map((o) => o.label);
  }, limit);
}
