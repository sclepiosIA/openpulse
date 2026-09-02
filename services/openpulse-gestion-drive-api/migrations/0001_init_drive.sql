-- ============================================================================
-- Migration 0001 — Socle Gestion Drive (tables drive_*)
-- Non destructif : uniquement CREATE TABLE IF NOT EXISTS + index.
-- Cible : Azure PostgreSQL (base Gestion). Nécessite pgcrypto ou pg13+
-- pour gen_random_uuid().
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- 1. Espaces --------------------------------------------------------------
create table if not exists drive_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null check (type in ('gsi','etablissement','project','dpo','template','personal')),
  etablissement_id uuid null,
  project_key text null,
  sensitivity text not null default 'standard' check (sensitivity in ('standard','sensitive','hds','dpo_restricted')),
  sync_policy text not null default 'allowed' check (sync_policy in ('allowed','web_only','approval_required')),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Dossiers -------------------------------------------------------------
create table if not exists drive_folders (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references drive_spaces(id),
  parent_id uuid null references drive_folders(id),
  name text not null,
  path text not null,
  status text not null default 'active' check (status in ('active','deleted','archived')),
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- Unicité de path par espace, hors éléments supprimés (le soft delete libère le chemin).
create unique index if not exists uq_drive_folders_space_path
  on drive_folders(space_id, path) where status <> 'deleted';

create index if not exists idx_drive_folders_space on drive_folders(space_id) where status = 'active';
create index if not exists idx_drive_folders_parent on drive_folders(parent_id);

-- 3. Fichiers ---------------------------------------------------------------
-- Statut 'uploading' ajouté vs plan initial : fichier créé par upload-intent
-- mais dont le blob n'est pas encore confirmé par upload-complete.
create table if not exists drive_files (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references drive_spaces(id),
  folder_id uuid null references drive_folders(id),
  name text not null,
  path text not null,
  blob_container text not null,
  blob_name text not null,
  content_type text null,
  size_bytes bigint not null default 0,
  sha256 text null,
  etag text null,
  current_version int not null default 1,
  status text not null default 'active' check (status in ('active','deleted','archived','quarantine','uploading')),
  document_type text null,
  reference_framework text null check (reference_framework in ('rgpd','hds','iso27001','ai_act') or reference_framework is null),
  evidence_status text null check (evidence_status in ('current','to_review','archive') or evidence_status is null),
  valid_from date null,
  valid_until date null,
  locked_by uuid null,
  locked_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- Unicité de path par espace, hors fichiers supprimés (le soft delete libère le chemin).
create unique index if not exists uq_drive_files_space_path
  on drive_files(space_id, path) where status <> 'deleted';

create index if not exists idx_drive_files_space on drive_files(space_id) where status = 'active';
create index if not exists idx_drive_files_folder on drive_files(folder_id);
create index if not exists idx_drive_files_sha256 on drive_files(sha256);

-- 4. Versions ---------------------------------------------------------------
create table if not exists drive_file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references drive_files(id),
  version int not null,
  blob_container text not null,
  blob_name text not null,
  sha256 text null,
  size_bytes bigint not null,
  etag text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  change_summary text null,
  unique(file_id, version)
);

-- 5. Permissions --------------------------------------------------------------
create table if not exists drive_permissions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references drive_spaces(id),
  folder_id uuid null references drive_folders(id),
  file_id uuid null references drive_files(id),
  subject_type text not null check (subject_type in ('user','team','role','establishment')),
  subject_id text not null,
  permission text not null check (permission in ('owner','admin','editor','viewer','uploader','no_sync_local')),
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_drive_permissions_space on drive_permissions(space_id);
create index if not exists idx_drive_permissions_subject on drive_permissions(subject_type, subject_id);

-- 6. Devices sync ------------------------------------------------------------
create table if not exists drive_sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_name text not null,
  platform text not null check (platform in ('macos','windows')),
  machine_id text not null,
  client_version text not null,
  sync_root text null,
  status text not null default 'active' check (status in ('active','revoked','lost')),
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  unique(user_id, machine_id)
);

-- 7. Feed d'événements sync ----------------------------------------------------
create table if not exists drive_sync_events (
  id bigserial primary key,
  space_id uuid not null references drive_spaces(id),
  file_id uuid null references drive_files(id),
  folder_id uuid null references drive_folders(id),
  event_type text not null check (event_type in (
    'file_created','file_updated','file_deleted','file_restored','file_moved',
    'folder_created','folder_deleted','folder_moved','permission_changed','lock_changed',
    'file_conflict_created'
  )),
  payload jsonb not null default '{}',
  actor_user_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_drive_sync_events_space_id on drive_sync_events(space_id, id);

-- 8. Audit ---------------------------------------------------------------------
create table if not exists drive_audit_logs (
  id bigserial primary key,
  user_id uuid null,
  device_id uuid null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  ip inet null,
  user_agent text null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_drive_audit_logs_entity on drive_audit_logs(entity_type, entity_id);
create index if not exists idx_drive_audit_logs_user on drive_audit_logs(user_id, created_at);

commit;
