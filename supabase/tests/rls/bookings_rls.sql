-- pgTAP — RLS de `public.bookings`
-- Mix public (création anon via booking-proxy) / privé (lecture staff).
-- Vérifie que l'anonyme ne LIT pas les bookings existants.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES ('99999999-9999-9999-9999-999999999999', 'staff@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Anonyme : aucune lecture (PII candidats / clients)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.bookings) = 0,
  'anonyme ne lit aucun booking (PII)'
);

-- 2. Utilisateur authentifié non host : aucune lecture des bookings d'un autre user
SELECT public._test_set_auth_uid('99999999-9999-9999-9999-999999999999');
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM public.bookings
    WHERE host_user_id IS NOT NULL
      AND host_user_id <> '99999999-9999-9999-9999-999999999999'
  ),
  'utilisateur authentifié ne voit pas les bookings d''un autre host'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
