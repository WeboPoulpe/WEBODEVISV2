-- ═══════════════════════════════════════════════════════════════════════════
-- Lot E — Dossiers de devis (imbriqués, avec couleur + icône)
-- À lancer dans le SQL Editor de Supabase (idempotent).
-- Pré-requis : fonction public.is_admin() (cf. fix_admin_rls_recursion.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Table des dossiers (arborescence : parent_id NULL = racine)
CREATE TABLE IF NOT EXISTS quote_folders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  parent_id     uuid REFERENCES quote_folders(id) ON DELETE CASCADE,
  name          text NOT NULL,
  color         text NOT NULL DEFAULT 'purple',
  icon          text NOT NULL DEFAULT 'folder',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_folders_owner  ON quote_folders(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_quote_folders_parent ON quote_folders(parent_id);

-- Rattrapage si la table existait déjà sans couleur/icône
ALTER TABLE quote_folders ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'purple';
ALTER TABLE quote_folders ADD COLUMN IF NOT EXISTS icon  text NOT NULL DEFAULT 'folder';

-- 2) Rattachement des devis à un dossier (NULL = racine)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS folder_id uuid;

-- FK ajoutée à part pour rester idempotent (pas de IF NOT EXISTS sur ADD CONSTRAINT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_folder_id_fkey') THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES quote_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_folder ON quotes(folder_id);

-- 3) RLS — chacun ne voit et ne gère que ses propres dossiers
ALTER TABLE quote_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own quote_folders" ON quote_folders;
CREATE POLICY "Owner manages own quote_folders" ON quote_folders
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage quote_folders" ON quote_folders;
CREATE POLICY "Admins manage quote_folders" ON quote_folders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ Vérification rapide (optionnel) :
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'quotes' AND column_name = 'folder_id';
-- SELECT * FROM quote_folders LIMIT 1;
-- ═══════════════════════════════════════════════════════════════════════════
