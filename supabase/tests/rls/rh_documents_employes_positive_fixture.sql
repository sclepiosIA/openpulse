-- pgTAP positive fixture: rh_documents_employes
-- Documents RH (contrats, fiches paie) : self + staff RH/admin uniquement
BEGIN;
SELECT plan(2);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.rh_documents_employes),
  0,
  'anon ne lit aucun document RH'
);

SET LOCAL ROLE authenticated;
SELECT public._test_set_auth_uid('00000000-0000-0000-0000-000000000ddd');
SELECT is(
  (SELECT count(*)::int FROM public.rh_documents_employes WHERE user_id <> '00000000-0000-0000-0000-000000000ddd'::uuid),
  0,
  'user authentifié sans rôle RH/admin ne lit pas les documents d''autrui'
);

SELECT finish();
ROLLBACK;
