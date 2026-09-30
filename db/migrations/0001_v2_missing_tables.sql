CREATE TABLE "rental_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"material_name" text NOT NULL,
	"qty_per_guest" numeric DEFAULT '1' NOT NULL,
	"unit" text,
	"default_supplier_id" uuid,
	"default_price_per_unit" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_ingredients" DROP CONSTRAINT "service_ingredients_service_id_fkey";
--> statement-breakpoint
ALTER TABLE "rental_items" ADD COLUMN "confirmed_individually" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "rental_items" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_templates" ADD CONSTRAINT "rental_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_templates" ADD CONSTRAINT "rental_templates_default_supplier_id_fkey" FOREIGN KEY ("default_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ingredients" ADD CONSTRAINT "service_ingredients_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."prestations"("id") ON DELETE cascade ON UPDATE no action;