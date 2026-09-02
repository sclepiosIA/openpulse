-- pgTAP — RLS de `public.signature_requests`
-- CRITIQUE : pipeline DocuSeal (contrats signés). Lecture restreinte propriétaire,
-- mutation = service_role only (via webhooks HMAC).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- 1. Anonyme : aucune lecture (les signature requests contiennent emails + IDs contrats)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.signature_requests) = 0,
  'anonyme ne lit aucune signature_request (anti-fuite contrats)'
);

-- 2. Anonyme : aucun INSERT possible (mutation = webhook DocuSeal HMAC only)
SELECT throws_ok(
  $$ INSERT INTO public.signature_requests (contrat_id, status)
     VALUES ('00000000-0000-0000-0000-000000000000', 'pending') $$,
  NULL,
  NULL,
  'INSERT signature_requests bloqué pour anonyme (mutation = webhook only)'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
