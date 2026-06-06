-- ═══════════════════════════════════════════════════════════════════════════
-- Lien prospect ↔ devis + unification des statuts
-- ═══════════════════════════════════════════════════════════════════════════
-- À lancer dans Supabase SQL Editor.
-- Idempotent : peut être relancé plusieurs fois sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Ajouter la colonne prospect_id sur quotes ───────────────────────────
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prospect_id TEXT;

-- ── 2) Supprimer l'ancienne contrainte CHECK sur status ────────────────────
--    (elle n'autorisait que draft/pending/sent/accepted/rejected)
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

-- ── 3) Migrer les anciens statuts devis vers les statuts prospection ───────
--    On désactive les triggers utilisateur le temps de la migration
--    (le trigger d'historique exige auth.uid() qui est NULL dans l'éditeur SQL)
ALTER TABLE quotes DISABLE TRIGGER USER;
UPDATE quotes SET status = 'devis_a_faire'  WHERE status IN ('draft', 'pending');
UPDATE quotes SET status = 'devis_envoye'   WHERE status = 'sent';
UPDATE quotes SET status = 'valide'         WHERE status = 'accepted';
UPDATE quotes SET status = 'refus_client'   WHERE status IN ('rejected', 'refuse', 'refuse_client');
UPDATE quotes SET status = 'refus_traiteur' WHERE status = 'refuse_traiteur';
-- Catch-all : tout statut NULL ou non reconnu retombe sur "Devis à faire"
UPDATE quotes SET status = 'devis_a_faire'
WHERE status IS NULL OR status NOT IN (
  'nouveau', 'broch_envoyee', 'devis_a_faire', 'devis_envoye',
  'rdv_deg_a_venir', 'rdv_deg_fait', 'devis_final', 'valide',
  'acompte', 'paye', 'refus_client', 'refus_traiteur'
);
ALTER TABLE quotes ENABLE TRIGGER USER;

-- ── 4) Recréer la contrainte avec les statuts de prospection ───────────────
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK (status IN (
  'nouveau', 'broch_envoyee', 'devis_a_faire', 'devis_envoye',
  'rdv_deg_a_venir', 'rdv_deg_fait', 'devis_final', 'valide',
  'acompte', 'paye', 'refus_client', 'refus_traiteur'
));

-- ── 5) Vérification ────────────────────────────────────────────────────────
SELECT status, count(*) FROM quotes GROUP BY status ORDER BY count(*) DESC;
