-- Add is_option column to prestations table
-- This marks a prestation as an "option" by default when added to a quote
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS is_option BOOLEAN DEFAULT FALSE;
