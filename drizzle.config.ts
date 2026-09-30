import { defineConfig } from 'drizzle-kit';
import { loadEnvLocal } from './lib/env';

loadEnvLocal(__dirname);

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  out: './db/migrations',
  // Connexion directe (non poolée) pour les migrations.
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Le schéma neon_auth (Neon Auth, non utilisé) est laissé de côté.
  schemaFilter: ['public'],
  // Les colonnes gardent leur nom SQL (snake_case) dans le code, comme partout dans l'app.
  introspect: { casing: 'preserve' },
});
