-- Extras payés au forfait : un forfait brut habituel par mission sur la fiche de l'extra, et un forfait propre à
-- une mission. Quand un forfait s'applique, il remplace le calcul heures × taux. Additive et rejouable.
ALTER TABLE "extras" ADD COLUMN IF NOT EXISTS "flat_fee" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "event_extras" ADD COLUMN IF NOT EXISTS "flat_fee" numeric(8, 2);
