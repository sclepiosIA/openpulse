-- pgTAP positive fixture: profiles_secrets (TOTP, 2FA)
-- Ultra sensible : seul le propriétaire (et service_role) lit ses secrets
BEGIN;
SELECT plan(2);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.profiles_secrets),
  0,
  'anon ne lit aucun profiles_secrets'
);

SET LOCAL ROLE authenticated;
SELECT public._test_set_auth_uid('00000000-0000-0000-0000-000000000ccc');
SELECT is(
  (SELECT count(*)::int FROM public.profiles_secrets WHERE user_id <> '00000000-0000-0000-0000-000000000ccc'::uuid),
  0,
  'user authentifié ne lit jamais les secrets d''autres utilisateurs'
);

SELECT finish();
ROLLBACK;
