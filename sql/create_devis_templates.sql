-- Table pour stocker les modèles de devis réutilisables
CREATE TABLE IF NOT EXISTS devis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  services JSONB DEFAULT '[]',
  content_html TEXT,
  template TEXT DEFAULT 'standard',
  selected_font TEXT,
  selected_font_size INTEGER DEFAULT 12,
  remarks TEXT,
  vat_rate NUMERIC DEFAULT 20,
  hide_price BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE devis_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own devis templates" ON devis_templates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
