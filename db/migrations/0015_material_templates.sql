CREATE TABLE "material_template_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"default_qty" numeric DEFAULT '1' NOT NULL,
	"qty_per_guest" numeric,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "material_template_sets" ADD CONSTRAINT "material_template_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_templates" ADD CONSTRAINT "material_templates_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."material_template_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_templates" ADD CONSTRAINT "material_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_material_template_sets_user_id" ON "material_template_sets" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_material_templates_set_id" ON "material_templates" USING btree ("set_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_material_templates_user_id" ON "material_templates" USING btree ("user_id" uuid_ops);