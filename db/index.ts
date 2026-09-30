import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Une seule réserve de connexions par processus (le rechargement à chaud de Next recrée les modules).
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({
    // URL poolée en priorité : adaptée aux fonctions serverless de Vercel.
    connectionString: process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
