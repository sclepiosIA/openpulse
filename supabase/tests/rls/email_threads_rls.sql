-- pgTAP — RLS de `public.email_threads`
-- CRITIQUE : threads email contiennent expéditeurs, sujets, classifications IA, liens entités.
-- Anonyme ne doit rien voir ni insérer.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- 1. Anonyme : aucune lecture (anti-fuite messagerie pro)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.email_threads) = 0,
  'anonyme ne lit aucun email_thread (anti-fuite messagerie)'
);

-- 2. Anonyme : aucun INSERT possible (mutation = sync-emails edge function service_role)
SELECT throws_ok(
  $$ INSERT INTO public.email_threads (subject, account_id)
     VALUES ('Test anonyme', '00000000-0000-0000-0000-000000000000') $$,
  NULL,
  NULL,
  'INSERT email_threads bloqué pour anonyme (mutation = sync service_role only)'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
