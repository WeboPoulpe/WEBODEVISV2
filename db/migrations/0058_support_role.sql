-- Rôle « support » : une personne de l'équipe WeboDevis qui remplit les comptes des traiteurs (profil, prestations,
-- devis). Dans l'administration, elle ne voit que la liste des comptes et peut entrer dans celui d'un client ;
-- les autres réglages restent réservés au rôle admin (voir server/session.ts, requireStaff). Rejouable.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'support';
