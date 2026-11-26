-- Kits de matériel (docs/superpowers/specs/2026-11-26-kits-materiel-design.md) : un modèle de matériel inclus dans
-- un autre (« Kit café » dans « Brunch » et « Mariage »). Lien vivant, mis à plat à l'application. Rejouable.
CREATE TABLE IF NOT EXISTS "public"."material_template_set_children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"parent_id" uuid NOT NULL REFERENCES "public"."material_template_sets"("id") ON DELETE cascade,
	"child_id" uuid NOT NULL REFERENCES "public"."material_template_sets"("id") ON DELETE cascade,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_template_set_children_not_self" CHECK ("parent_id" <> "child_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "material_template_set_children_pair_key" ON "public"."material_template_set_children" USING btree ("parent_id", "child_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_material_template_set_children_child_id" ON "public"."material_template_set_children" USING btree ("child_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_material_template_set_children_user_id" ON "public"."material_template_set_children" USING btree ("user_id");
