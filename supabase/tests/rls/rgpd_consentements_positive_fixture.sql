-- pgTAP positive fixture: rgpd_consentements
-- RGPD : self uniquement, aucune fuite vers anon
BEGIN;
SELECT plan(2);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.rgpd_consentements),
  0,
  'anon ne lit aucun consentement RGPD'
);

SET LOCAL ROLE authenticated;
SELECT public._test_set_auth_uid('00000000-0000-0000-0000-000000000fff');
SELECT is(
  (SELECT count(*)::int FROM public.rgpd_consentements WHERE user_id <> '00000000-0000-0000-0000-000000000fff'::uuid),
  0,
  'user authentifié ne lit pas les consentements d''autrui'
);

SELECT finish();
ROLLBACK;
