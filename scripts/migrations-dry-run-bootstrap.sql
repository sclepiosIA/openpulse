-- ---------------------------------------------------------------------------
-- migrations-dry-run-bootstrap.sql
-- Bootstrap a vanilla postgres:15 to look enough like a Supabase project so
-- that the 800+ migrations under supabase/migrations/*.sql can be applied
-- in lexical order for syntax / dependency / GRANT validation.
--
-- Used by .github/workflows/migrations-dry-run.yml (CICD-02 Phase 3).
-- NOT used at runtime by Supabase managed Postgres.
-- ---------------------------------------------------------------------------

-- Extensions usually pre-installed by Supabase.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;
-- pgjwt / pgsodium / vector / http / pg_net : not in stock postgres:15.
-- Stubbed below where migrations reference them.

-- Supabase roles.
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE supabase_admin NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO postgres;

-- Supabase schemas.
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS realtime AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS supabase_functions AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS vault AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS net AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS graphql AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS graphql_public AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS pgsodium AUTHORIZATION postgres;

-- auth.users — minimal shape used by FKs.
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  encrypted_password text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  phone text,
  deleted_at timestamptz
);

-- storage.buckets / objects — minimal shape.
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata jsonb,
  path_tokens text[],
  version text,
  owner_id text
);

-- auth.* helper functions stubbed.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'anon'::text $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;

-- Authorization helpers/tables needed by strict-admin migrations. Production
-- provides the real objects; this disposable DB only validates migration SQL.
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY,
  actif boolean NOT NULL DEFAULT true
);
CREATE OR REPLACE FUNCTION public.has_admin_role(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

-- pg_net stub (HTTP from triggers — common in Supabase).
CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 1000
) RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;
CREATE OR REPLACE FUNCTION net.http_get(
  url text,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 1000
) RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;

-- pgsodium stubs (used by some migrations for encryption).
CREATE OR REPLACE FUNCTION pgsodium.crypto_aead_det_encrypt(message bytea, additional bytea, key_id uuid, nonce bytea DEFAULT NULL)
  RETURNS bytea LANGUAGE sql AS $$ SELECT message $$;
CREATE OR REPLACE FUNCTION pgsodium.crypto_aead_det_decrypt(ciphertext bytea, additional bytea, key_id uuid, nonce bytea DEFAULT NULL)
  RETURNS bytea LANGUAGE sql AS $$ SELECT ciphertext $$;

-- vault.secrets stub.
CREATE TABLE IF NOT EXISTS vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  secret text,
  key_id uuid,
  nonce bytea,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Default grants close to Supabase defaults (PostgREST does NOT add defaults
-- on public, but our migrations grant explicitly anyway).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Make sure public is the default search_path for migrations that omit it.
ALTER ROLE postgres SET search_path = public, extensions;
