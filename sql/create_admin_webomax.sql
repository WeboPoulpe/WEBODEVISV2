-- ═══════════════════════════════════════════════════════════════════════════
-- Crée le compte admin maxence@webomax.fr avec mot de passe + le promeut admin
-- ═══════════════════════════════════════════════════════════════════════════
-- Mot de passe initial : Webomax@Admin2026
-- À changer après la première connexion via "Mot de passe oublié"
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Créer l'utilisateur dans auth.users avec mot de passe bcrypt
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Si le compte existe déjà, on ne le recrée pas
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'maxence@webomax.fr') THEN
    RAISE NOTICE 'Compte maxence@webomax.fr existe déjà — passe à l''étape 2.';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'maxence@webomax.fr',
    crypt('Webomax@Admin2026', gen_salt('bf')),
    now(),
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '', '', '', ''
  );

  -- Identité email (requis par certains setups Supabase récents)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'maxence@webomax.fr'),
    'email', 'maxence@webomax.fr',
    now(), now(), now()
  );

  RAISE NOTICE 'Compte maxence@webomax.fr créé avec id %', new_user_id;
END $$;

-- 2. S'assurer qu'une ligne existe dans profiles (au cas où le trigger n'a pas créé)
INSERT INTO profiles (id, email, role, is_active, created_at)
SELECT u.id, u.email, 'admin', true, now()
FROM auth.users u
WHERE u.email = 'maxence@webomax.fr'
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;

-- 3. Vérification finale
SELECT u.id, u.email, p.role, p.is_active
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'maxence@webomax.fr';
