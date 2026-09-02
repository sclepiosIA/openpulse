-- pgTAP — RLS de `public.rgpd_consentements`
-- Données ultra sensibles : un user ne voit que ses propres consentements.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES
  ('44444444-4444-4444-4444-444444444444', 'a@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'b@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Anonyme : aucun accès
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.rgpd_consentements) = 0,
  'anonyme ne lit aucun consentement RGPD'
);

-- 2. Utilisateur authentifié : voit uniquement ses propres consentements
SELECT public._test_set_auth_uid('44444444-4444-4444-4444-444444444444');
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM public.rgpd_consentements
    WHERE user_id = '55555555-5555-5555-5555-555555555555'
  ),
  'utilisateur ne voit pas les consentements d''un autre user'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
