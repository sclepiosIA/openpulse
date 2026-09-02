-- Helpers d'authentification pour les tests pgTAP.
-- Reproduit le comportement de `auth.uid()` en injectant un JWT factice
-- dans `request.jwt.claims` (lecture par les SECURITY DEFINER de Supabase).

CREATE OR REPLACE FUNCTION public._test_set_auth_uid(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION public._test_set_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM set_config('role', 'anon', true);
END;
$$;

CREATE OR REPLACE FUNCTION public._test_reset_auth()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
  RESET ROLE;
END;
$$;
