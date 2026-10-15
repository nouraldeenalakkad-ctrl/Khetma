-- Retains completed rooms for three days before automatic cleanup.
-- This migration does not delete any rooms immediately.
begin;

create extension if not exists pg_cron;

alter table public.rooms add column if not exists completed_at timestamptz;

update public.rooms
set completed_at = now()
where status = 'completed'
  and completed_at is null;

create or replace function public.delete_expired_completed_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.rooms
  where status = 'completed'
    and completed_at is not null
    and completed_at <= now() - interval '3 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_completed_rooms() from public, anon, authenticated;

do $job$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'khetma-delete-completed-rooms';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'khetma-delete-completed-rooms',
    '*/5 * * * *',
    $command$select public.delete_expired_completed_rooms();$command$
  );
end
$job$;

commit;

select jobname, schedule, command
from cron.job
where jobname = 'khetma-delete-completed-rooms';
