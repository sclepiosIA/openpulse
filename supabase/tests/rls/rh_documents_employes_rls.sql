-- pgTAP — RLS de `public.rh_documents_employes`
-- CRITIQUE : documents RH (bulletins paie, contrats travail). PII sensible.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- 1. Anonyme : aucune lecture (bulletins paie, scans CNI, RIB…)
SELECT public._test_set_anon();
SELECT ok(
  (SELECT count(*) FROM public.rh_documents_employes) = 0,
  'anonyme ne lit aucun rh_documents_employes (PII RH)'
);

-- 2. Anonyme : aucun INSERT possible (upload doit passer par auth + storage RLS)
SELECT throws_ok(
  $$ INSERT INTO public.rh_documents_employes (profile_id, nom_document, type_document)
     VALUES ('00000000-0000-0000-0000-000000000000', 'fake', 'bulletin') $$,
  NULL,
  NULL,
  'INSERT rh_documents_employes bloqué pour anonyme'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
