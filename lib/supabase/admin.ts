import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client (service role) — bypasses RLS.
 * ONLY use server-side (Server Components, Route Handlers).
 * Never import this in client components.
 */
export const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
