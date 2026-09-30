// tables.ts et relations.ts sont générés par `drizzle-kit pull` à partir de la base.
export * from './tables';
export * from './relations';

import type { profiles } from './tables';

export type ProfileRow = typeof profiles.$inferSelect;
