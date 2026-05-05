-- Devis importés depuis un autre logiciel (passation)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported BOOLEAN DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported_file_url TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported_file_name TEXT;

-- Séparation adultes/enfants
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS guest_count_adults INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS guest_count_children INTEGER DEFAULT 0;

-- Mettre à jour la contrainte CHECK des statuts prospects (si elle existe)
ALTER TABLE prospect_requests DROP CONSTRAINT IF EXISTS prospect_requests_status_check;
ALTER TABLE prospect_requests ADD CONSTRAINT prospect_requests_status_check
  CHECK (status IN (
    'nouveau',
    'broch_envoyee',
    'devis_a_faire',
    'devis_envoye',
    'rdv_deg_a_venir',
    'rdv_deg_fait',
    'devis_final',
    'valide',
    'acompte',
    'paye',
    'refus_client',
    'refus_traiteur',
    -- legacy
    'devis', 'flyer', 'rdv_degust', 'attente_reponse', 'relance', 'refuse'
  ));
