-- =====================================================================
-- Dossiers de rangement par défaut, et déclencheur rendu robuste.
--
-- POURQUOI CE FICHIER EXISTE
-- Un déclencheur `BEFORE INSERT` sur `public.documents` affecte un dossier à
-- tout document qui n'en précise pas, en routant vers DEUX IDENTIFIANTS ÉCRITS
-- EN DUR dans son corps. Ces dossiers avaient été créés à la main sur
-- l'installation d'origine ; aucune migration ne les crée.
--
-- Conséquence sur une instance fraîchement installée, mesurée :
--
--   INSERT INTO public.documents (name, …) VALUES ('essai.pdf', …);
--   ERROR: insert or update on table "documents" violates foreign key
--          constraint "documents_folder_id_fkey"
--   DETAIL: Key (folder_id)=(72008f57-…) is not present in table
--           "document_folders".
--
-- Autrement dit : AUCUN document ne peut être déposé. Le module documentaire —
-- 169 composants, neuf tables — est entièrement inopérant, et le message
-- d'erreur ne nomme ni le déclencheur, ni la raison.
--
-- Ce fichier remplace le déclencheur par une version qui RÉSOUT le dossier au
-- lieu de le supposer : il vérifie que sa cible existe, retombe sinon sur un
-- dossier partagé quelconque, et laisse `folder_id` à NULL s'il n'y en a aucun.
-- Un document rangé ailleurs, ou non rangé, vaut mieux qu'un document refusé.
--
-- Les deux dossiers eux-mêmes ne sont PAS créés ici : `document_folders.owner_id`
-- est NOT NULL, et aucun compte n'existe encore au moment où le schéma
-- s'applique. Ils sont créés par `scripts/creer-admin.sh`, qui a un
-- propriétaire sous la main.
--
-- QUAND L'APPLIQUER
-- Après le schéma applicatif, qui crée `document_folders` et le déclencheur.
-- L'installateur s'en charge.
--
-- Idempotent : rejouable sans dommage.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_folders'
  ) THEN
    RAISE EXCEPTION
      'public.document_folders est absente : appliquez le schéma applicatif avant ce fichier.';
  END IF;
END $$;

-- --- déclencheur : résoudre plutôt que supposer -----------------------

CREATE OR REPLACE FUNCTION public.ensure_document_has_folder() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $fonction$
DECLARE
  id_etudes uuid := 'e3763f37-9f4d-49d0-8edc-66296122b280';
  id_autres uuid := '72008f57-d6e8-42e7-a950-6894525343ee';
  cible uuid;
BEGIN
  -- Un dossier explicite l'emporte toujours.
  IF NEW.folder_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.name ILIKE 'Etude %' OR NEW.name ILIKE 'Étude %' THEN
    cible := id_etudes;
  ELSE
    cible := id_autres;
  END IF;

  -- La version d'origine affectait la cible sans vérifier qu'elle existe : la
  -- clé étrangère refusait alors l'insertion, et le message ne nommait pas la
  -- cause. On vérifie, et à défaut on retombe sur n'importe quel dossier
  -- partagé — mieux vaut un document rangé ailleurs qu'un document refusé.
  IF NOT EXISTS (SELECT 1 FROM public.document_folders WHERE id = cible) THEN
    SELECT id INTO cible
    FROM public.document_folders
    WHERE folder_type = 'shared' AND is_restricted = false
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Aucun dossier du tout : on laisse NULL plutôt que d'échouer. Le document
  -- existe, il est visible, et l'utilisateur peut le ranger ensuite.
  NEW.folder_id := cible;
  RETURN NEW;
END;
$fonction$;

-- --- vérification ----------------------------------------------------

-- Le contrôle porte sur le déclencheur, pas sur les dossiers : ceux-ci
-- n'existent pas encore à ce stade, et c'est justement ce que la nouvelle
-- version doit savoir encaisser.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ensure_document_has_folder'
      AND pg_get_functiondef(p.oid) LIKE '%NOT EXISTS (SELECT 1 FROM public.document_folders%'
  ) THEN
    RAISE EXCEPTION 'le declencheur ensure_document_has_folder n''a pas ete remplace';
  END IF;
  RAISE NOTICE 'declencheur de rangement tolerant a l''absence de dossier';
END $$;
