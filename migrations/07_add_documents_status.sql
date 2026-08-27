-- Add a status column to documents so the admin UI can show per-document status.
-- Values: 'processing' (during upload pipeline), 'ready' (after chunks stored), 'failed' (on error).
-- Existing rows default to 'ready' so the migration is backwards-compatible.

alter table documents
  add column if not exists status text default 'ready';

alter table documents
  drop constraint if exists documents_status_check;

alter table documents
  add constraint documents_status_check
  check (status in ('processing', 'ready', 'failed'));
