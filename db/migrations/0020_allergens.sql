ALTER TABLE "ingredients" ADD COLUMN "allergens" text[];--> statement-breakpoint
ALTER TABLE "prestations" ADD COLUMN "allergens_extra" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "prestations" ADD COLUMN "allergens_checked" boolean DEFAULT false NOT NULL;