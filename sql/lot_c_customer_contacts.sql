-- ═══════════════════════════════════════════════════════════════════════════
-- Lot C — Contacts multiples par client + snapshot destinataire/SIRET sur devis
-- À lancer dans le SQL Editor de Supabase (idempotent).
-- Pré-requis : fonction public.is_admin() (cf. fix_admin_rls_recursion.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Table des contacts
CREATE TABLE IF NOT EXISTS customer_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name          text NOT NULL,
  role          text,
  email         text,
  phone         text,
  notes         text,
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);

-- 2) RLS
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own customer_contacts" ON customer_contacts;
CREATE POLICY "Owner manages own customer_contacts" ON customer_contacts
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage customer_contacts" ON customer_contacts;
CREATE POLICY "Admins manage customer_contacts" ON customer_contacts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Snapshot destinataire + SIRET sur les devis
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_siret            text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_phone text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_role  text;

-- 4) Migration idempotente des contacts primaires existants
INSERT INTO customer_contacts (customer_id, owner_user_id, name, email, phone, is_primary)
SELECT c.id, c.owner_user_id, c.contact_person_name, c.contact_person_email, c.contact_person_phone, true
FROM customers c
WHERE c.customer_type = 'entreprise'
  AND c.contact_person_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customer_contacts cc WHERE cc.customer_id = c.id);
