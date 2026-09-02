-- pgTAP positive fixture: user_roles
-- Source de vérité RBAC : aucune fuite vers anon, lecture cross-user interdite
BEGIN;
SELECT plan(2);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.user_roles),
  0,
  'anon ne lit aucun user_roles (anti-énumération RBAC)'
);

SET LOCAL ROLE authenticated;
SELECT public._test_set_auth_uid('00000000-0000-0000-0000-000000000eee');
SELECT is(
  (SELECT count(*)::int FROM public.user_roles WHERE user_id <> '00000000-0000-0000-0000-000000000eee'::uuid),
  0,
  'user authentifié ne lit pas les rôles des autres utilisateurs'
);

SELECT finish();
ROLLBACK;
