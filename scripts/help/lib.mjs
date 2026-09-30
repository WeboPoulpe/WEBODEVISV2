// Outils d'enregistrement des vidéos du centre d'aide.
// Chaque vidéo est un scénario joué dans un vrai navigateur, sur le compte de démonstration
// (données fictives ; ses écritures ne sont jamais enregistrées, on peut donc tout rejouer).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { encode } from 'next-auth/jwt';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = path.join(ROOT, '.help-media');
export const BASE = process.env.HELP_BASE_URL ?? 'http://localhost:3001';
const DEMO_USER_ID = '0d3e0000-0000-4000-8000-000000000001';
const DEMO_EMAIL = 'demo@webodevis.fr';
const SIZE = { width: 1280, height: 800 };
// Scénario « téléphone » : écran d'iPhone (la vidéo du navigateur garde la taille de l'écran), posé au centre d'une image 1280×800,
// pour que la vidéo garde le même cadre que les autres dans le centre d'aide.
const PHONE = { width: 390, height: 844 };
const PHONE_BACKDROP = '0xE6DFD3';

export function envLocal(name) {
  const line = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return (line ?? '').slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

// Curseur dessiné dans la page : la vidéo du navigateur ne montre pas la souris.
const CURSOR = `(() => {
  const install = () => {
    if (document.getElementById('__help_cursor')) return;
    const style = document.createElement('style');
    style.textContent = '[data-demo-banner]{display:none!important}'
      + '#__help_cursor{position:fixed;z-index:2147483647;left:-40px;top:-40px;width:24px;height:24px;pointer-events:none;'
      + 'background:no-repeat url("data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\'><path d=\\'M4 2l15 9-6.5 1.6L9.6 20z\\' fill=\\'%231B1A17\\' stroke=\\'white\\' stroke-width=\\'1.6\\' stroke-linejoin=\\'round\\'/></svg>")}'
      + '#__help_ring{position:fixed;z-index:2147483646;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;pointer-events:none;'
      + 'background:rgba(180,80,45,.28);transform:scale(0);opacity:0}'
      + '#__help_ring.on{transition:transform .35s ease-out,opacity .35s ease-out;transform:scale(1.25);opacity:1}'
      + '#__help_ring.off{transition:opacity .25s;opacity:0}';
    document.head.appendChild(style);
    const cursor = document.createElement('div'); cursor.id = '__help_cursor';
    const ring = document.createElement('div'); ring.id = '__help_ring';
    document.documentElement.append(ring, cursor);
    const last = JSON.parse(sessionStorage.getItem('__help_pos') || 'null');
    if (last) { cursor.style.left = last.x + 'px'; cursor.style.top = last.y + 'px'; }
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px';
      sessionStorage.setItem('__help_pos', JSON.stringify({ x: e.clientX, y: e.clientY }));
    }, true);
    document.addEventListener('mousedown', (e) => {
      ring.className = ''; ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      void ring.offsetWidth; ring.className = 'on';
      setTimeout(() => { ring.className = 'off'; }, 380);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();`;

/** Gestes lents et lisibles : la souris se déplace, marque un temps, clique. */
function actions(page, size = SIZE) {
  let pos = { x: size.width / 2, y: size.height / 2 };
  const pause = (ms) => page.waitForTimeout(ms);
  const loc = (target) => (typeof target === 'string' ? page.locator(target).first() : target);

  const moveTo = async (target) => {
    const el = loc(target);
    await el.waitFor({ state: 'visible', timeout: 20_000 });
    await el.scrollIntoViewIfNeeded();
    await pause(150);
    const box = await el.boundingBox();
    if (!box) throw new Error('élément sans position à l’écran');
    const to = { x: box.x + Math.min(box.width / 2, 160), y: box.y + box.height / 2 };
    const steps = Math.max(12, Math.round(Math.hypot(to.x - pos.x, to.y - pos.y) / 18));
    await page.mouse.move(to.x, to.y, { steps });
    pos = to;
    await pause(260);
    return el;
  };

  return {
    pause,
    /** Ouvre une page et attend que ses données soient affichées. */
    async goto(url) {
      await page.goto(BASE + url);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.locator('.animate-pulse').first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
      await page.mouse.move(pos.x, pos.y);
      await pause(500);
    },
    hover: moveTo,
    async click(target) {
      const el = await moveTo(target);
      await page.mouse.down(); await pause(70); await page.mouse.up();
      await pause(650);
      return el;
    },
    /** Clique dans un champ puis tape le texte à vitesse de lecture. */
    async type(target, text) {
      const el = await moveTo(target);
      await page.mouse.down(); await pause(70); await page.mouse.up();
      await pause(200);
      await el.pressSequentially(text, { delay: 55 });
      await pause(500);
    },
    async press(key) { await page.keyboard.press(key); await pause(500); },
    /** Fait défiler la page (ou le conteneur sous la souris) en douceur. */
    async scroll(dy) {
      const steps = Math.max(1, Math.round(Math.abs(dy) / 60));
      for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await pause(30); }
      await pause(500);
    },
  };
}

function ffmpeg(args) {
  const res = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`ffmpeg : ${res.stderr || res.error?.message}`);
}

/**
 * Joue un scénario et produit <id>.mp4 (H.264, lisible partout) et <id>.jpg (image d'attente).
 * @param scenario { start: '/page', mobile?: true, run: async ({ page, act }) => {} }
 */
export async function record(id, scenario) {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(OUT, `.tmp-${id}`);
  fs.rmSync(tmp, { recursive: true, force: true });

  const mobile = !!scenario.mobile;
  const viewport = mobile ? PHONE : SIZE;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport, locale: 'fr-FR', timezoneId: 'Europe/Paris',
    ...(mobile
      ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: tmp, size: PHONE } }
      : { deviceScaleFactor: 1, recordVideo: { dir: tmp, size: SIZE } }),
  });
  const token = await encode({ token: { sub: DEMO_USER_ID, email: DEMO_EMAIL }, secret: envLocal('NEXTAUTH_SECRET') });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: new URL(BASE).hostname, path: '/', httpOnly: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }]);
  await context.addInitScript(CURSOR);

  const startedAt = Date.now();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  const act = actions(page, viewport);
  let trim = 0;
  let failure = null;
  try {
    await act.goto(scenario.start ?? '/');
    // Tout ce qui précède (chargement) est coupé : la vidéo commence sur la page prête.
    trim = (Date.now() - startedAt) / 1000;
    await act.pause(900);
    await scenario.run({ page, act });
    await act.pause(1400);
  } catch (e) {
    failure = e;
    await page.screenshot({ path: path.join(OUT, `${id}-echec.png`) }).catch(() => {});
  }
  const video = page.video();
  await context.close();
  await browser.close();
  if (failure) { fs.rmSync(tmp, { recursive: true, force: true }); throw failure; }

  const webm = await video.path();
  const mp4 = path.join(OUT, `${id}.mp4`);
  const jpg = path.join(OUT, `${id}.jpg`);
  const frame = mobile
    ? `scale=-2:${SIZE.height - 40}:flags=lanczos,pad=${SIZE.width}:${SIZE.height}:(ow-iw)/2:(oh-ih)/2:color=${PHONE_BACKDROP},`
    : '';
  ffmpeg(['-ss', trim.toFixed(2), '-i', webm, '-an', '-vf', `${frame}fps=25,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', mp4]);
  ffmpeg(['-ss', '0.6', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg]);
  fs.rmSync(tmp, { recursive: true, force: true });

  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' });
  return { mp4, jpg, seconds: Math.round(Number(probe.stdout.trim()) * 10) / 10, bytes: fs.statSync(mp4).size };
}

/** Tous les scénarios, par identifiant de guide. */
export async function loadScenarios() {
  const dir = path.join(ROOT, 'scripts', 'help', 'scenarios');
  const all = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    Object.assign(all, (await import(`file://${path.join(dir, file).replace(/\\/g, '/')}`)).default);
  }
  return all;
}
