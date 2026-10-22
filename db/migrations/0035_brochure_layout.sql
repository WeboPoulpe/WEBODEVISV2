-- Brochures : éditeur choisi (simple ou avancé) et mise en page à blocs de l'éditeur avancé.
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "editor_mode" text DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "layout" jsonb;--> statement-breakpoint
ALTER TABLE "brochures" ADD CONSTRAINT "brochures_editor_mode_check" CHECK (editor_mode = ANY (ARRAY['simple'::text, 'advanced'::text]));
