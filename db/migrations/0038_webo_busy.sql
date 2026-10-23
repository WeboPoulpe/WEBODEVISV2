-- Assistant Webo : une conversation occupée (Webo répond) n'accepte pas un second message en même temps.
ALTER TABLE "webo_conversations" ADD COLUMN IF NOT EXISTS "busy_until" timestamp with time zone;
