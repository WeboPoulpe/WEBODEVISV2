import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Les tests de rendu (.test.tsx) : tsconfig laisse le JSX tel quel pour Next (« preserve »), ici on le compile.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['lib/**/*.test.ts', 'server/**/*.test.ts', 'components/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
});
