-- pgTAP — RLS de `public.taches`
-- CRITIQUE : tâches CRM/RH liées aux établissements + assignations multi-rôles.
-- Anonyme ne doit rien voir ni insérer.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- 1. Anonyme : aucune lecture (les taches contiennent libellés, deadlines, owners)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.taches) = 0,
  'anonyme ne lit aucune tache (anti-fuite CRM/RH)'
);

-- 2. Anonyme : aucun INSERT possible
SELECT throws_ok(
  $$ INSERT INTO public.taches (titre, statut)
     VALUES ('Test anonyme', 'a_faire') $$,
  NULL,
  NULL,
  'INSERT taches bloqué pour anonyme'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
