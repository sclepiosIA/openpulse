-- pgTAP — fixture positive : `public.bookings`
-- Public booking via slug est autorisé en INSERT anon (proxy edge function),
-- mais SELECT anon doit retourner 0 (anti-énumération).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- 1. Anonyme : aucune lecture des bookings (anti-énumération RDV pros)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.bookings) = 0,
  'anonyme ne lit aucun booking (anti-énumération RDV)'
);

-- 2. Utilisateur authentifié sans booking_page_hosts associé ne lit rien
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
VALUES ('66666666-6666-6666-6666-666666666666', 'host-x@test.local', '', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SELECT public._test_set_auth_uid('66666666-6666-6666-6666-666666666666');
SELECT ok(
  (SELECT count(*) FROM public.bookings WHERE host_user_id = '66666666-6666-6666-6666-666666666666') = 0,
  'user authentifié ne lit que ses propres bookings (RLS host_user_id)'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
