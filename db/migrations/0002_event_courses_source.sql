ALTER TABLE "event_ingredients" ADD COLUMN "source" text DEFAULT 'manuelle' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "event_material_checks" jsonb DEFAULT '[]'::jsonb;