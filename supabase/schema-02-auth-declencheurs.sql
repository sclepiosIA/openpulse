-- =====================================================================
-- Déclencheurs posés sur le schéma d'authentification.
--
-- POURQUOI CE FICHIER EXISTE
-- Le corpus de migrations définit bien la fonction `public.handle_new_user()`,
-- mais il ne contient AUCUN `CREATE TRIGGER ... ON auth.users`. Sur la
-- plateforme hébergée, ce déclencheur avait été posé hors migration. Il manque
-- donc à toute instance auto-hébergée, et son absence est silencieuse : la
-- création d'un compte réussit, mais aucune ligne de profil n'est créée.
--
-- Constaté sur une instance fraîchement installée : 1 compte dans auth.users,
-- 0 ligne dans public.profiles. L'application est alors inutilisable, puisque
-- 63 fichiers de l'interface interrogent les profils par identifiant
-- d'utilisateur.
--
-- QUAND L'APPLIQUER
-- Après le démarrage du service d'authentification, qui crée et fait évoluer
-- auth.users, et après le schéma applicatif, qui apporte handle_new_user().
-- L'installateur s'en charge dans cet ordre.
--
-- Ce fichier est idempotent : il peut être rejoué sans dommage, notamment après
-- une mise à jour du service d'authentification qui recréerait ses tables.
-- =====================================================================

-- Le schéma applicatif doit être en place : sans la fonction, poser le
-- déclencheur produirait une erreur difficile à relier à sa cause.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    RAISE EXCEPTION
      'public.handle_new_user() est absente : appliquez le schéma applicatif avant ce fichier.';
  END IF;
END $$;

-- Création du profil à l'inscription.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Vérification immédiate : un déclencheur qu'on croit posé et qui ne l'est pas
-- coûte plus cher qu'une erreur franche à l'installation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relname = 'users'
      AND t.tgname = 'on_auth_user_created' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'le déclencheur on_auth_user_created n''a pas été posé';
  END IF;
  RAISE NOTICE 'déclencheur on_auth_user_created en place sur auth.users';
END $$;
