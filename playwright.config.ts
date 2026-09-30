import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Session commune des tests qui lisent : compte de démonstration (voir e2e/auth.setup.ts).
// Aucun test ne se connecte à un compte réel ; ceux qui écrivent créent leur propre compte d'essai.
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
  globalTeardown: './e2e/global-teardown.ts',
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
