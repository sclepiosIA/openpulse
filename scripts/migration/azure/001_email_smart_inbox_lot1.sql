-- ============================================================================
-- Migration Azure PostgreSQL — Emails Smart Inbox — Lot 1 (2026-07-07)
-- ============================================================================
-- Cible : base Azure PostgreSQL miroir de Gestion (PAS Supabase).
-- Ce fichier est volontairement séparé de supabase/migrations/ : il prépare
-- les tables complémentaires `email_*_azure` du plan Smart Inbox (§6) sans
-- toucher aux tables existantes (email_threads, email_messages,
-- email_attachments, email_sync_logs déjà miroirées).
--
-- Idempotent : IF NOT EXISTS partout, rejouable sans danger.
-- Sécurité : aucun secret stocké — `secret_ref` référence Azure Key Vault.
--
-- Application (exemple) :
--   psql "$AZURE_PG_CONNECTION_STRING" -f scripts/migration/azure/001_email_smart_inbox_lot1.sql
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Comptes email gérés côté Azure (config sync, référence Key Vault)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_accounts_azure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  email_address text NOT NULL,
  display_name text,
  provider text NOT NULL CHECK (provider IN ('imap_smtp','microsoft_graph','gmail_api','shared_mailbox')),
  is_shared boolean NOT NULL DEFAULT false,
  sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  -- Référence Key Vault (ex: kv://openpulse-gestion/email-accounts/<id>) — jamais le secret.
  secret_ref text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_accounts_azure_profile_address
  ON email_accounts_azure (profile_id, lower(email_address));

CREATE INDEX IF NOT EXISTS idx_email_accounts_azure_sync_enabled
  ON email_accounts_azure (sync_enabled) WHERE sync_enabled;

-- ----------------------------------------------------------------------------
-- 2. Curseurs de synchronisation (reprise incrémentale robuste)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_sync_cursors (
  account_id uuid PRIMARY KEY REFERENCES email_accounts_azure(id),
  provider text NOT NULL,
  cursor jsonb NOT NULL DEFAULT '{}',
  last_seen_uid bigint,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  error_count int DEFAULT 0,
  last_error text,
  updated_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Insights IA (classification, résumés, risques, brouillons, liens CRM)
--    thread_id/message_id référencent les tables miroir existantes ; pas de FK
--    dure au lot 1 pour tolérer l'ordre d'ingestion du worker.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  message_id uuid NULL,
  insight_type text NOT NULL CHECK (insight_type IN ('summary','classification','action','risk','draft','calendar','crm_link')),
  model text,
  confidence numeric,
  payload jsonb NOT NULL,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_ai_insights_thread
  ON email_ai_insights (thread_id, insight_type);

CREATE INDEX IF NOT EXISTS idx_email_ai_insights_created_at
  ON email_ai_insights (created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Actions CRM suggérées/exécutées depuis les emails
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('create_task','create_ticket','create_event','link_contact','link_etablissement','draft_reply','archive','assign_owner')),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','rejected','done','failed')),
  assignee_profile_id uuid NULL,
  payload jsonb NOT NULL,
  created_by_ai boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_email_actions_thread
  ON email_actions (thread_id);

CREATE INDEX IF NOT EXISTS idx_email_actions_status
  ON email_actions (status) WHERE status = 'suggested';

-- ----------------------------------------------------------------------------
-- 5. Trigger updated_at (comptes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_email_azure_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_accounts_azure_updated_at ON email_accounts_azure;
CREATE TRIGGER trg_email_accounts_azure_updated_at
  BEFORE UPDATE ON email_accounts_azure
  FOR EACH ROW EXECUTE FUNCTION set_email_azure_updated_at();

DROP TRIGGER IF EXISTS trg_email_sync_cursors_updated_at ON email_sync_cursors;
CREATE TRIGGER trg_email_sync_cursors_updated_at
  BEFORE UPDATE ON email_sync_cursors
  FOR EACH ROW EXECUTE FUNCTION set_email_azure_updated_at();

COMMIT;

-- Rollback manuel (ne PAS exécuter en routine) :
--   DROP TABLE IF EXISTS email_actions, email_ai_insights, email_sync_cursors, email_accounts_azure;
--   DROP FUNCTION IF EXISTS set_email_azure_updated_at();
