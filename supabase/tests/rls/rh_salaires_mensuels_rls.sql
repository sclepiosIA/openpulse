-- pgTAP — RLS de `public.rh_salaires_mensuels`
-- Données salariales ultra-sensibles : accès limité aux rôles admin/rh
-- via `can_manage_rh_data()`. Tout user authentifié non RH = 0 ligne.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES ('88888888-8888-8888-8888-888888888888', 'employee@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Anonyme : strictement aucune fuite
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.rh_salaires_mensuels) = 0,
  'anonyme ne lit aucun salaire'
);

-- 2. Utilisateur authentifié sans rôle RH/admin : aucune ligne
SELECT public._test_set_auth_uid('88888888-8888-8888-8888-888888888888');
SELECT ok(
  (SELECT count(*) FROM public.rh_salaires_mensuels) = 0,
  'utilisateur non RH/admin ne voit aucun salaire'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
