-- =====================================================================
-- Amorçage d'une base OpenPulse vierge.
--
-- Principe : n'installer QUE ce que la plateforme hébergée fournit et que le
-- corpus de migrations ne peut pas créer lui-même — schémas de service, rôles,
-- extensions, et la surface d'API attendue (auth.*, storage.*, realtime.*).
--
-- Règle absolue : AUCUNE table du schéma public. Le bootstrap historique en
-- créait une (profiles) avec une forme divergente ; comme les migrations la
-- créent elles-mêmes, la première migration échouait sur « already exists » et
-- entraînait par domino l'échec de centaines d'autres.
-- =====================================================================

-- --- schéma des extensions, à créer AVANT les extensions ---------------
-- Le schéma extensions doit préexister : le schéma consolidé référence
-- extensions.gen_random_bytes() dans des valeurs par défaut de colonnes, comme
-- le fait la plateforme hébergée. Installer pgcrypto dans public ferait échouer
-- l'application du schéma.
CREATE SCHEMA IF NOT EXISTS extensions;

-- --- extensions libres -----------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Les fonctions des extensions doivent être résolubles sans qualification.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO public, extensions', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'search_path de la base non modifiable, à configurer côté serveur';
END $$;
SET search_path TO public, extensions;

-- --- rôles ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user') THEN
    CREATE ROLE dashboard_user NOLOGIN NOINHERIT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgsodium_keyholder') THEN
    CREATE ROLE pgsodium_keyholder NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Role de connexion de l'API REST. Il n'a aucun privilege propre : il emprunte
-- anon ou authenticated selon le jeton presente, ce qui fait appliquer la
-- securite au niveau ligne. Son mot de passe est defini a l'installation, il
-- est propre a chaque instance et n'a donc pas sa place ici.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
END $$;

-- L'emprunt de role doit etre possible dans les deux sens utiles.
DO $$ BEGIN
  GRANT anon, authenticated, service_role TO authenticator;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'attribution des roles a authenticator a faire par un superutilisateur';
END $$;

-- --- schémas de service -----------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
-- Le service temps reel applique SES migrations dans « _realtime », un schema
-- distinct de « realtime ». Il se connecte avec search_path force dessus : si
-- le schema n'existe pas, il echoue au demarrage sur « no schema has been
-- selected to create in » — un message qui ne nomme pas le schema attendu, et
-- le conteneur redemarre en boucle.
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS supabase_functions;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS pgsodium;

-- --- authentification -------------------------------------------------
-- Les tables du schema auth ne sont PAS creees ici.
--
-- C'est le service d'authentification qui les cree, avec ses propres
-- migrations, et lui seul en connait la forme exacte. Les stuber ici
-- reproduirait a l'identique le defaut qui rendait le corpus injouable : une
-- table preexistante de forme divergente, un CREATE TABLE IF NOT EXISTS qui ne
-- fait rien, et la migration suivante qui echoue sur une colonne absente.
--
-- Consequence sur l'ordre d'installation : le service d'authentification doit
-- avoir demarre et migre AVANT que le schema applicatif soit applique, puisque
-- celui-ci porte des cles etrangeres vers auth.users. C'est ce que fait
-- scripts/installer.sh.

-- Surface d'API attendue par le code : 2280 emplacements du corpus l'utilisent.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(coalesce(current_setting('request.jwt.claim.sub', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(coalesce(current_setting('request.jwt.claim.role', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')), '') $$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(coalesce(current_setting('request.jwt.claim.email', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')), '') $$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

-- Le service d'authentification recree certaines de ces fonctions au demarrage.
-- Sans transfert de propriete, son CREATE OR REPLACE echoue sur « must be owner
-- of function » et le service redemarre en boucle. C'est la troisieme variante
-- du meme piege : ne jamais posseder ce qu'un autre composant doit pouvoir
-- remplacer.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth'
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO supabase_auth_admin', f.signature);
  END LOOP;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'transfert de propriete des fonctions auth a faire par un superutilisateur';
END $$;

-- --- stockage d'objets ------------------------------------------------
-- Meme raisonnement : le service de stockage cree ses propres tables. Seules
-- ses fonctions utilitaires sont fournies ici, car le schema applicatif les
-- appelle dans ses policies et le service ne les cree pas toutes.

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql AS
$$ DECLARE _parts text[]; BEGIN SELECT string_to_array(name, '/') INTO _parts; RETURN _parts[1:array_length(_parts,1)-1]; END $$;

CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text LANGUAGE plpgsql AS
$$ DECLARE _parts text[]; BEGIN SELECT string_to_array(name, '/') INTO _parts; RETURN _parts[array_length(_parts,1)]; END $$;

CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text LANGUAGE plpgsql AS
$$ DECLARE _parts text[]; _filename text; BEGIN SELECT string_to_array(name, '/') INTO _parts;
   SELECT _parts[array_length(_parts,1)] INTO _filename;
   RETURN reverse(split_part(reverse(_filename), '.', 1)); END $$;

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'storage'
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO supabase_storage_admin', f.signature);
  END LOOP;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'transfert de propriete des fonctions storage a faire par un superutilisateur';
END $$;

-- --- temps réel -------------------------------------------------------
--
-- ON NE PRÉ-CRÉE RIEN DANS LE SCHÉMA `realtime`, ET C'EST LE POINT.
--
-- Le service temps réel porte ses propres migrations — soixante pour la version
-- 2.34.47 — et les rejoue à chaque connexion de locataire. Il crée lui-même sa
-- table `subscription`, ses types (`realtime.user_defined_filter`), ses
-- fonctions (`list_changes`, `apply_rls`, `is_visible_through_filters`…) et sa
-- table `messages`.
--
-- L'amorçage créait ici des versions APPROCHANTES de ces objets, avec les
-- meilleures intentions. Elles bloquaient les migrations du service :
--
--   * `subscription` était créée avec `filters` en `jsonb`, là où le service
--     attend un tableau de son propre type composite. La migration n°13 posait
--     ensuite un index dont le nom existait déjà, et échouait ;
--   * `realtime.topic()` appartenait à `postgres` : la migration n°42 fait
--     `create or replace function realtime.topic()` et se voyait refuser
--     « must be owner of function » ;
--   * `messages`, pré-créée, survivait en silence à `create_if_not_exists`, et
--     les migrations 47 à 49 divergeaient à partir de là.
--
-- Le compteur `realtime.schema_migrations` restait donc bloqué à 12 sur 60. Ce
-- n'était pas un état stable mais un état bloqué : le service rejouait, échouait
-- au même endroit, arrêtait le locataire, et recommençait. Mesuré sur une
-- instance : 35 tentatives, 68 échecs, 38 arrêts de locataire.
--
-- Le symptôme, lui, ne désignait rien de tout cela : la connexion websocket
-- s'établissait, le canal passait à SUBSCRIBED — c'est le serveur de canaux qui
-- répond, pas la base — et aucun événement n'arrivait jamais.
--
-- Ce que l'amorçage doit faire ici se réduit donc à deux choses que le service
-- ne peut PAS faire lui-même : créer le schéma, et préparer le rôle.

-- Le schéma lui-même est créé plus haut, avec les autres schémas de la
-- plateforme : le service migre dedans mais ne le crée pas.

-- La migration n°40 (CreateRealtimeAdminAndMoveOwnership) exécute
-- `CREATE ROLE supabase_realtime_admin`. Or le service se connecte avec
-- `supabase_admin`, qui n'est ni superutilisateur ni `CREATEROLE` : la création
-- échouerait, et le message de PostgreSQL ne nomme pas le privilège manquant.
-- On crée donc le rôle en amont, avec les mêmes attributs que la migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin WITH NOINHERIT NOLOGIN NOREPLICATION;
  END IF;

  -- WITH ADMIN OPTION, et ce n'est pas un détail : la migration n°40 accorde
  -- ensuite ce rôle à `postgres`. Sans l'option d'administration, elle échoue
  -- sur « must have admin option on role "supabase_realtime_admin" ».
  EXECUTE 'GRANT supabase_realtime_admin TO postgres WITH ADMIN OPTION';
  EXECUTE 'GRANT supabase_realtime_admin TO supabase_admin WITH ADMIN OPTION';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'role supabase_realtime_admin : privileges insuffisants, a creer a la main';
END $$;

-- Être MEMBRE d'un rôle ne suffit pas à en exercer les droits : il faut aussi
-- en hériter. `supabase_admin` est créé NOINHERIT plus haut, si bien que la
-- migration n°40 — qui transfère la propriété de `realtime.channels`,
-- `broadcasts` et `presences` à supabase_realtime_admin puis les modifie —
-- échouait sur « must be owner of table channels ». Elle ne fait pas de
-- SET ROLE explicite : elle compte sur l'héritage.
ALTER ROLE supabase_admin INHERIT;

-- La migration n°43 (CreateListChangesFunction) crée `realtime.list_changes`
-- avec `SET log_min_messages TO 'fatal'`. Ce paramètre est réservé au
-- superutilisateur, et `supabase_admin` n'en est pas un : la migration échouait
-- sur « permission denied to set parameter "log_min_messages" », et les 21
-- migrations suivantes avec elle.
--
-- PostgreSQL 15 permet de déléguer précisément ce droit, sans rien accorder
-- d'autre. C'est le minimum nécessaire, et il est nommé.
DO $$
BEGIN
  EXECUTE 'GRANT SET ON PARAMETER log_min_messages TO supabase_admin';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'GRANT SET ON PARAMETER : privileges insuffisants';
  WHEN syntax_error THEN
    -- Antérieur à PostgreSQL 15 : la délégation par paramètre n'existe pas.
    RAISE NOTICE 'GRANT SET ON PARAMETER indisponible : PostgreSQL 15 ou superieur requis';
END $$;

-- La publication est exigée par plusieurs migrations. Sans elle, elles échouent
-- sur « publication does not exist ». Elle est créée VIDE : les tables à publier
-- sont choisies par schema-10-temps-reel.sql, une fois le schéma applicatif en
-- place.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- --- substituts des extensions non libres ------------------------------
-- Ces substituts ne servent QUE sur un Postgres nu. Sur une image qui fournit
-- deja pg_net et pg_cron, les objets reels existent et leurs schemas
-- appartiennent a un role d'administration : on ne touche a rien.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000)
      RETURNS bigint LANGUAGE sql AS 'SELECT 0::bigint';
    CREATE OR REPLACE FUNCTION net.http_get(url text, params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000)
      RETURNS bigint LANGUAGE sql AS 'SELECT 0::bigint';
    RAISE NOTICE 'pg_net absent : substitut inerte installe, les appels sortants doivent passer par une fonction de bord';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'schema net gere par la plateforme, aucun substitut installe';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE TABLE IF NOT EXISTS cron.job (
      jobid bigserial PRIMARY KEY, schedule text, command text,
      nodename text DEFAULT 'localhost', nodeport integer DEFAULT 5432,
      database text DEFAULT current_database(), username text DEFAULT current_user,
      active boolean DEFAULT true, jobname text
    );
    CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE sql AS
      'INSERT INTO cron.job (schedule, command, jobname) VALUES ($2, $3, $1) RETURNING jobid';
    CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text) RETURNS bigint LANGUAGE sql AS
      'INSERT INTO cron.job (schedule, command) VALUES ($1, $2) RETURNING jobid';
    CREATE OR REPLACE FUNCTION cron.unschedule(job_name text) RETURNS boolean LANGUAGE sql AS
      'WITH d AS (DELETE FROM cron.job WHERE jobname = $1 RETURNING 1) SELECT true';
    CREATE OR REPLACE FUNCTION cron.unschedule(job_id bigint) RETURNS boolean LANGUAGE sql AS
      'WITH d AS (DELETE FROM cron.job WHERE jobid = $1 RETURNING 1) SELECT true';
    RAISE NOTICE 'pg_cron absent : substitut inerte installe, un ordonnanceur externe est requis';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'schema cron gere par la plateforme, aucun substitut installe';
END $$;

DO $$
BEGIN
  -- Meme regle que pour pg_net et pg_cron : on ne pose un substitut QUE si
  -- l'extension reelle est absente. Sans ce test, le CREATE OR REPLACE VIEW
  -- ci-dessous ecraserait la vue de dechiffrement de supabase_vault par une
  -- vue qui ne dechiffre rien -- panne silencieuse, et fuite de secrets.
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    CREATE TABLE IF NOT EXISTS vault.secrets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE, description text DEFAULT '', secret text NOT NULL,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION vault.create_secret(new_secret text, new_name text DEFAULT NULL, new_description text DEFAULT '')
      RETURNS uuid LANGUAGE sql AS
      'INSERT INTO vault.secrets (name, description, secret) VALUES ($2, $3, $1)
       ON CONFLICT (name) DO UPDATE SET secret = excluded.secret, updated_at = now() RETURNING id';

    -- Le schema consolide LIT vault.decrypted_secrets, jamais vault.secrets.
    -- Sans cette vue, quatre fonctions echouent a l'execution sur un Postgres
    -- nu alors que l'installation, elle, reussit : la panne n'apparait qu'a
    -- l'usage, longtemps apres, et sans rapport apparent avec l'installation.
    CREATE OR REPLACE VIEW vault.decrypted_secrets AS
      SELECT id, name, description, secret, secret AS decrypted_secret,
             created_at, updated_at
      FROM vault.secrets;

    -- Le substitut ne chiffre rien : il ne doit etre lisible que par le
    -- proprietaire. Un droit ici exposerait les secrets via l'API REST.
    REVOKE ALL ON vault.secrets FROM PUBLIC, anon, authenticated, service_role;
    REVOKE ALL ON vault.decrypted_secrets FROM PUBLIC, anon, authenticated, service_role;
    RAISE NOTICE 'supabase_vault absent : substitut EN CLAIR installe, reserve au proprietaire';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'schema vault gere par la plateforme, aucun substitut installe';
END $$;

-- --- privilèges -------------------------------------------------------
GRANT USAGE ON SCHEMA public, extensions, auth, storage, realtime, vault, net, cron TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth, storage TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
