-- Challenges d'appairage Desktop à usage unique.
-- Seuls les hashes du challenge et du nonce sont persistés ; aucun bearer
-- fournisseur, code MFA ou secret Desktop n'est stocké.
create table if not exists drive_desktop_handoff_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_hash text not null unique check (length(challenge_hash) = 64),
  user_id text not null,
  nonce_hash text not null check (length(nonce_hash) = 64),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  check (expires_at > created_at)
);

create index if not exists idx_drive_desktop_handoff_active_user
  on drive_desktop_handoff_challenges (user_id, expires_at)
  where consumed_at is null;
