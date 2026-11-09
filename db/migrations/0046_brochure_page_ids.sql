-- Lecture page par page des brochures du Studio : chaque page est repérée par son identifiant (elle se suit même
-- déplacée), plus par son rang. Les lectures notées par rang ne se rattachent à aucune page : elles sont effacées
-- (fonction tout juste sortie). Rejouable sans erreur.
DELETE FROM "brochure_page_stats";--> statement-breakpoint
ALTER TABLE "brochure_page_stats" DROP CONSTRAINT IF EXISTS "brochure_page_stats_pkey";--> statement-breakpoint
ALTER TABLE "brochure_page_stats" DROP COLUMN IF EXISTS "page";--> statement-breakpoint
ALTER TABLE "brochure_page_stats" ADD COLUMN IF NOT EXISTS "page_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "brochure_page_stats" ADD CONSTRAINT "brochure_page_stats_pkey" PRIMARY KEY("brochure_id","page_id");
