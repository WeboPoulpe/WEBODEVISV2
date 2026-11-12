-- Lien de paiement en ligne du traiteur (SumUp, PayPal, sa banque…), affiché sur le devis signé, la facture et les
-- relances. WeboDevis n'encaisse rien. Additive et rejouable.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "company_payment_url" text;
