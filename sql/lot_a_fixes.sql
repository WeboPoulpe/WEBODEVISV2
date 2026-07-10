-- ═══════════════════════════════════════════════════════════════════════════
-- Correctifs Lot A — à lancer dans le SQL Editor de Supabase (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Frais additionnels de la gestion financière ──────────────────────────
-- Les « frais » (personnel, transport, frais fixes…) n'étaient pas persistés.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS extra_costs JSONB DEFAULT '[]'::jsonb;


-- ── 2) Statut prospect qui ne se met pas à jour (403 Forbidden) ─────────────
-- La table prospect_requests n'avait pas de policy UPDATE pour le propriétaire
-- (le traiteur), d'où le 403 au changement de statut. On ajoute lecture/màj/suppr
-- pour le propriétaire (owner_user_id = utilisateur connecté), sans toucher à
-- l'insertion publique (formulaire de prospection via l'API).
ALTER TABLE prospect_requests ENABLE ROW LEVEL SECURITY;

-- Propriétaire = owner_user_id direct OU prospect lié à un token du traiteur
-- (certaines demandes du formulaire public n'ont que user_token, sans owner_user_id).
DROP POLICY IF EXISTS "Owner can read prospect_requests" ON prospect_requests;
CREATE POLICY "Owner can read prospect_requests" ON prospect_requests
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner can update prospect_requests" ON prospect_requests;
CREATE POLICY "Owner can update prospect_requests" ON prospect_requests
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner can delete prospect_requests" ON prospect_requests;
CREATE POLICY "Owner can delete prospect_requests" ON prospect_requests
  FOR DELETE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  );

-- Optionnel : accès admin (si la fonction is_admin() existe — cf. fix_admin_rls_recursion.sql)
DROP POLICY IF EXISTS "Admins manage prospect_requests" ON prospect_requests;
CREATE POLICY "Admins manage prospect_requests" ON prospect_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
