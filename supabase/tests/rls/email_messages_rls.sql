-- pgTAP — RLS de `public.email_messages`
-- Vérifie l'isolation par compte propriétaire (`user_email_accounts.user_id`).
--
-- Pré-requis : `supabase test db`.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(3);

RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'mail-owner@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'mail-foreign@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_email_accounts (id, user_id, email_address, provider)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333',
   'owner@inbox.test.local', 'imap')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.email_threads (id, account_id, subject)
VALUES
  ('11111111-2222-3333-4444-555555555555',
   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Sujet test RLS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.email_messages (id, thread_id, account_id, from_address, subject)
VALUES
  ('99999999-8888-7777-6666-555555555555',
   '11111111-2222-3333-4444-555555555555',
   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   'sender@example.com', 'Sujet test RLS')
ON CONFLICT (id) DO NOTHING;

-- 1. Owner reads its email
SELECT public._test_set_auth_uid('33333333-3333-3333-3333-333333333333');

SELECT ok(
  EXISTS(SELECT 1 FROM public.email_messages WHERE id = '99999999-8888-7777-6666-555555555555'),
  'propriétaire du compte voit son email'
);

-- 2. Foreign user denied
SELECT public._test_set_auth_uid('44444444-4444-4444-4444-444444444444');

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.email_messages WHERE id = '99999999-8888-7777-6666-555555555555'),
  'utilisateur étranger ne voit pas l''email'
);

-- 3. Anon denied
SELECT public._test_set_anon();

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.email_messages WHERE id = '99999999-8888-7777-6666-555555555555'),
  'anonyme ne voit aucun email'
);

SELECT public._test_reset_auth();

SELECT * FROM finish();
ROLLBACK;
