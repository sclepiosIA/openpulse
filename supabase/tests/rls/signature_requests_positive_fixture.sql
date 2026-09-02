-- pgTAP positive fixture: signature_requests
-- Sensible (contrats signés, hash SHA-256) : staff uniquement
BEGIN;
SELECT plan(2);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.signature_requests),
  0,
  'anon ne lit aucune signature_request'
);

SET LOCAL ROLE authenticated;
SELECT public._test_set_auth_uid('00000000-0000-0000-0000-000000000bbb');
SELECT is(
  (SELECT count(*)::int FROM public.signature_requests),
  0,
  'utilisateur sans rôle staff ne lit aucune signature_request'
);

SELECT finish();
ROLLBACK;
