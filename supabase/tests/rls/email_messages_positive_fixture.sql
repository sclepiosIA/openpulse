-- pgTAP positive fixture: email_messages
-- Contenu emails très sensible : owner du user_email_account uniquement
BEGIN;
SELECT plan(2);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.email_messages),
  0,
  'anon ne lit aucun email_message'
);

SET LOCAL ROLE authenticated;
SELECT public._test_set_auth_uid('00000000-0000-0000-0000-0000000aaaaa');
SELECT is(
  (SELECT count(*)::int FROM public.email_messages),
  0,
  'user authentifié sans user_email_accounts ne lit aucun email_message'
);

SELECT finish();
ROLLBACK;
