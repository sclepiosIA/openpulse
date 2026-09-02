-- Gestion Drive API compatibility: allow temporary upload placeholders.
-- Non-destructive: only updates the CHECK constraint to include 'uploading'.

begin;

alter table public.drive_files drop constraint if exists drive_files_status_check;
alter table public.drive_files add constraint drive_files_status_check
  check (status in ('active','deleted','archived','quarantine','uploading'));

commit;
