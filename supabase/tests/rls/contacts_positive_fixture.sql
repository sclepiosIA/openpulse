-- pgTAP — fixture positive : `public.contacts`
-- Anonyme : aucune lecture des contacts CRM (PII).
-- User authentifié non-staff : ne voit que les contacts d'un établissement où il a un rôle.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- 1. Anonyme = 0
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.contacts) = 0,
  'anonyme ne lit aucun contact (anti-fuite PII CRM)'
);

-- 2. User authentifié sans etablissement_users associé ne voit rien
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
VALUES ('77777777-7777-7777-7777-777777777777', 'newbie@test.local', '', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SELECT public._test_set_auth_uid('77777777-7777-7777-7777-777777777777');
SELECT ok(
  (SELECT count(*) FROM public.contacts) = 0
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '77777777-7777-7777-7777-777777777777'),
  'user sans rôle ni etablissement_users ne lit aucun contact'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
