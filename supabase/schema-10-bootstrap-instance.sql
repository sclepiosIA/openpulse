-- Bootstrap atomique du premier administrateur OpenPulse.
-- L'état persiste en base et n'est manipulable que par le rôle service_role.

CREATE TABLE IF NOT EXISTS public.instance_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'claimed', 'completed')),
  claimed_at timestamptz,
  completed_at timestamptz,
  admin_user_id uuid,
  CHECK ((state = 'completed') = (admin_user_id IS NOT NULL))
);

ALTER TABLE public.instance_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instance_bootstrap FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.instance_bootstrap TO service_role;

INSERT INTO public.instance_bootstrap (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_initial_installation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claimed boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  UPDATE public.instance_bootstrap
  SET state = 'claimed', claimed_at = now()
  WHERE singleton = true
    AND state = 'open'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  RETURNING true INTO claimed;

  RETURN COALESCE(claimed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_initial_installation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  UPDATE public.instance_bootstrap
  SET state = 'open', claimed_at = NULL
  WHERE singleton = true
    AND state = 'claimed'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_initial_installation(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  UPDATE public.instance_bootstrap
  SET state = 'completed', completed_at = now(), admin_user_id = _user_id
  WHERE singleton = true AND state = 'claimed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'installation not claimed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_initial_installation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_initial_installation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_initial_installation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_initial_installation() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_initial_installation() TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_initial_installation(uuid) TO service_role;
