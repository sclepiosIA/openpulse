-- Sessions de renouvellement Desktop Drive, opaques et révocables.
-- Aucun bearer/refresh du fournisseur d'identité n'est persisté ici.
create table if not exists drive_desktop_refresh_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash) = 64),
  family_id uuid not null,
  user_id text not null,
  email text not null,
  app_role text,
  display_name text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  replaced_by_hash text
);

create index if not exists idx_drive_desktop_refresh_family
  on drive_desktop_refresh_sessions (family_id);

create unique index if not exists uq_drive_desktop_refresh_active_user
  on drive_desktop_refresh_sessions (user_id)
  where rotated_at is null and revoked_at is null;

create index if not exists idx_drive_desktop_refresh_active
  on drive_desktop_refresh_sessions (expires_at)
  where rotated_at is null and revoked_at is null;
