-- Brochures : troisième éditeur, le Studio (pages composées librement), et son document. Additive et rejouable.
ALTER TABLE "brochures" DROP CONSTRAINT IF EXISTS "brochures_editor_mode_check";--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "studio" jsonb;--> statement-breakpoint
ALTER TABLE "brochures" ADD CONSTRAINT "brochures_editor_mode_check" CHECK (editor_mode = ANY (ARRAY['simple'::text, 'advanced'::text, 'studio'::text]));
