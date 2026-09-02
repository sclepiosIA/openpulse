-- pgTAP — fixture positive : `public.email_threads`
-- Un utilisateur authentifié ne voit que les threads de SON compte email
-- (politique : EXISTS user_email_accounts WHERE user_id = auth.uid()).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(1);

RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
VALUES ('55555555-5555-5555-5555-555555555555', 'mail-a@test.local', '', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Utilisateur A authentifié
SELECT public._test_set_auth_uid('55555555-5555-5555-5555-555555555555');

-- Sans compte email associé, ne doit voir aucun thread
SELECT ok(
  (SELECT count(*) FROM public.email_threads) = 0,
  'user authentifié sans user_email_accounts ne lit aucun email_thread'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
