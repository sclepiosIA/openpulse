-- Upload completion is an idempotent transaction tied to exactly one sync event.
alter table drive_file_versions
  add column if not exists completed_at timestamptz;

alter table drive_file_versions
  add column if not exists completion_event_id bigint references drive_sync_events(id);

-- Les versions actives historiques ont été finalisées avant l'introduction du reçu.
update drive_file_versions v
set completed_at = coalesce(v.created_at, now())
from drive_files f
where f.id = v.file_id
  and v.version <= f.current_version
  and f.status in ('active', 'archived')
  and v.completed_at is null;

create unique index if not exists uq_drive_file_versions_completion_event
  on drive_file_versions(completion_event_id)
  where completion_event_id is not null;
