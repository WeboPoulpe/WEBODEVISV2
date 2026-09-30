CREATE TABLE "rental_template_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rental_templates" ADD COLUMN "set_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_template_sets" ADD CONSTRAINT "rental_template_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rental_template_sets_user_id" ON "rental_template_sets" USING btree ("user_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "rental_templates" ADD CONSTRAINT "rental_templates_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."rental_template_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rental_templates_set_id" ON "rental_templates" USING btree ("set_id" uuid_ops);--> statement-breakpoint
-- Reprise de l'existant : les articles déjà saisis forment le premier modèle de chaque compte.
INSERT INTO "rental_template_sets" ("user_id", "name")
SELECT DISTINCT "user_id", 'Modèle principal' FROM "rental_templates" WHERE "set_id" IS NULL;--> statement-breakpoint
UPDATE "rental_templates" t SET "set_id" = s."id"
FROM "rental_template_sets" s WHERE s."user_id" = t."user_id" AND t."set_id" IS NULL;
