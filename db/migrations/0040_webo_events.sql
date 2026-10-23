-- Webo : propositions sur les événements (check-list, matériel, déroulé, extras) et recalcul des courses.
-- La contrainte est retirée puis remise : rejouable sans erreur.
ALTER TABLE "webo_proposals" DROP CONSTRAINT IF EXISTS "webo_proposals_kind_check";--> statement-breakpoint
ALTER TABLE "webo_proposals" ADD CONSTRAINT "webo_proposals_kind_check" CHECK (kind = ANY (ARRAY['quote'::text, 'invoice'::text, 'prestation'::text, 'prestation_update'::text, 'prospect_reply'::text, 'memory'::text, 'quote_update'::text, 'quote_send'::text, 'event_update'::text, 'courses_recalc'::text]));