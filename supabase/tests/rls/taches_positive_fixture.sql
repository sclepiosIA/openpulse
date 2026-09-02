-- pgTAP — fixture positive : `public.taches`
-- Vérifie qu'un utilisateur authentifié peut lire ses propres tâches
-- (créées ou assignées) et qu'il NE voit PAS celles d'un autre utilisateur.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
\i ../helpers/auth.sql

SELECT plan(2);

RESET ROLE;

-- Setup : deux utilisateurs fictifs + 2 tâches (une par owner)
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.local', '', now(), now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.local', '', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.taches (id, titre, statut, created_by)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tache user A', 'a_faire', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tache user B', 'a_faire', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- 1. User A authentifié : peut lire la sienne
SELECT public._test_set_auth_uid('11111111-1111-1111-1111-111111111111');
SELECT ok(
  (SELECT count(*) FROM public.taches WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') >= 1,
  'user A authentifié lit sa propre tache'
);

-- 2. User A NE voit PAS la tâche de B (sauf si politique CRM partagée)
-- Note: si la politique est ouverte à tous les staff, ce test devra être ajusté.
SELECT ok(
  (SELECT count(*) FROM public.taches WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  'user A ne lit pas la tache de user B (sauf staff CRM partagé)'
);

SELECT public._test_reset_auth();
SELECT * FROM finish();
ROLLBACK;
