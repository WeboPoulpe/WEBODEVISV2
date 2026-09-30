import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Seuls les identifiants du compte de test sont repris de .env.local : le serveur Next
// lancé par Playwright hérite de cet environnement et lit lui-même le reste du fichier.
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^(TEST_[A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

export const AUTH_FILE = path.join(__dirname, 'e2e', '.auth', 'user.json');

const VIEWPORTS = {
  mobile: { width: 360, height: 740 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: true,
  workers: 3,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3001',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    ...Object.entries(VIEWPORTS).map(([name, viewport]) => ({
      name,
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: { viewport, hasTouch: name !== 'desktop', isMobile: name === 'mobile' },
    })),
  ],
});
