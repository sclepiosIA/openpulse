-- pgTAP — RLS de `public.profiles_secrets`
-- CRITIQUE : 2FA secrets, doivent rester invisibles à l'anonyme et aux autres users.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(3);

RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner-secrets@test.local'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'foreign-secrets@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Anonyme : aucune lecture (secrets 2FA = top secret)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.profiles_secrets) = 0,
  'anonyme ne lit aucun profiles_secrets (TOTP secret leak)'
);

-- 2. Utilisateur authentifié : ne voit jamais les secrets d'un autre user
SELECT public._test_set_auth_uid('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM public.profiles_secrets
    WHERE user_id = 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  'utilisateur ne voit pas les secrets 2FA d''un autre user'
);

-- 3. INSERT d'un secret pour un autre user doit échouer (anti-impersonation)
SELECT throws_ok(
  $$ INSERT INTO public.profiles_secrets (user_id, totp_secret)
     VALUES ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'FAKE_SECRET') $$,
  NULL,
  NULL,
  'INSERT profiles_secrets pour autrui bloqué par RLS (anti-2FA-takeover)'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
