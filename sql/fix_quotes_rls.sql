-- ═══════════════════════════════════════════════════════════════════════════
-- Restaure les policies RLS standard sur quotes (chaque user voit ses devis)
-- À lancer si la table quotes ne contient plus que la policy admin
-- ═══════════════════════════════════════════════════════════════════════════

-- Vérifie l'état actuel
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'quotes';

DROP POLICY IF EXISTS "Users can read own quotes" ON quotes;
CREATE POLICY "Users can read own quotes" ON quotes
  FOR SELECT USING (
    user_id = auth.uid() OR owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
CREATE POLICY "Users can insert own quotes" ON quotes
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
CREATE POLICY "Users can update own quotes" ON quotes
  FOR UPDATE USING (
    user_id = auth.uid() OR owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;
CREATE POLICY "Users can delete own quotes" ON quotes
  FOR DELETE USING (
    user_id = auth.uid() OR owner_user_id = auth.uid()
  );
