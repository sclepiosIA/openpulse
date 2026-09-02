-- pgTAP — RLS de `public.contacts`
-- Vérifie que :
--   1. Un utilisateur authentifié ne voit que les contacts liés à un
--      établissement dont il a la visibilité.
--   2. Un utilisateur anonyme ne voit rien.
--   3. service_role bypasse RLS (sanity check).
--
-- Pré-requis : `supabase test db` charge pgtap automatiquement.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(4);

-- Fixtures : on insère en tant que service_role (bypass RLS).
RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'other@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.etablissements (id, nom, created_by)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Hop A', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contacts (id, etablissement_id, nom, email)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Doe', 'doe@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Owner sees its contact
SELECT public._test_set_auth_uid('11111111-1111-1111-1111-111111111111');

SELECT ok(
  EXISTS(SELECT 1 FROM public.contacts WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'owner authentifié voit son propre contact'
);

-- 2. Foreign user denied
SELECT public._test_set_auth_uid('22222222-2222-2222-2222-222222222222');

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.contacts WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'utilisateur étranger ne voit pas le contact'
);

-- 3. Anon denied
SELECT public._test_set_anon();

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.contacts WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'anonyme ne voit aucun contact'
);

-- 4. service_role bypasses RLS
SELECT public._test_reset_auth();
SET ROLE service_role;

SELECT ok(
  EXISTS(SELECT 1 FROM public.contacts WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'service_role bypasse RLS (sanity check)'
);

SELECT public._test_reset_auth();

SELECT * FROM finish();
ROLLBACK;
