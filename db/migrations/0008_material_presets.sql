CREATE TABLE "material_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"default_qty" numeric DEFAULT '1' NOT NULL,
	"qty_per_guest" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "material_presets" ADD CONSTRAINT "material_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_material_presets_user_id" ON "material_presets" USING btree ("user_id" uuid_ops);