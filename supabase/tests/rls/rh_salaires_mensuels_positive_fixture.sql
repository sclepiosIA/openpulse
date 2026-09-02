-- pgTAP — fixture positive : `public.rh_salaires_mensuels`
-- Un employé authentifié doit pouvoir lire SON propre salaire mais PAS celui d'un autre.
-- (politique RBAC : self OR admin/rh).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- Setup
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'salarie-a@test.local', '', now(), now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'salarie-b@test.local', '', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'salarie-a@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'salarie-b@test.local')
ON CONFLICT (id) DO NOTHING;

-- Employé A authentifié regarde sa table
SELECT public._test_set_auth_uid('33333333-3333-3333-3333-333333333333');

-- 1. Lecture autorisée pour soi-même n'expose pas la fiche d'un autre
SELECT ok(
  (SELECT count(*) FROM public.rh_salaires_mensuels WHERE profile_id = '44444444-4444-4444-4444-444444444444') = 0,
  'employé A ne lit pas le salaire de B (RLS self-only)'
);

-- 2. INSERT salaire d'un autre interdit
SELECT throws_ok(
  $$ INSERT INTO public.rh_salaires_mensuels (profile_id, mois, annee, salaire_brut)
     VALUES ('44444444-4444-4444-4444-444444444444', 6, 2026, 5000) $$,
  NULL,
  NULL,
  'INSERT salaire pour autre user bloqué (RLS RBAC RH/admin)'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
