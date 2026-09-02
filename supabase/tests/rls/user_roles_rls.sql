-- pgTAP — RLS de `public.user_roles`
-- CRITIQUE : empêcher privilege escalation. Anonyme = jamais, user = ses propres rôles
-- en lecture seule, mutation = service_role only via fonctions admin.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(3);

RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES
  ('66666666-6666-6666-6666-666666666666', 'victim@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'attacker@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Anonyme : aucune lecture (sinon enum app_role fuite)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.user_roles) = 0,
  'anonyme ne lit aucun user_role (anti-énumération rôles)'
);

-- 2. Utilisateur authentifié : ne voit pas les rôles des AUTRES
SELECT public._test_set_auth_uid('77777777-7777-7777-7777-777777777777');
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = '66666666-6666-6666-6666-666666666666'
  ),
  'utilisateur ne voit pas les rôles d''un autre user'
);

-- 3. Tentative d'INSERT par utilisateur authentifié = doit échouer (privilege escalation)
SELECT throws_ok(
  $$ INSERT INTO public.user_roles (user_id, role)
     VALUES ('77777777-7777-7777-7777-777777777777', 'admin') $$,
  NULL,
  NULL,
  'INSERT user_roles bloqué côté RLS pour user authentifié (anti-escalation)'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
