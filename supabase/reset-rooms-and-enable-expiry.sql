-- Run this file once in the same Supabase project used by VITE_SUPABASE_URL.
-- It deletes all current sessions now and enables automatic cleanup after completion.

create extension if not exists pg_cron;

alter table public.rooms add column if not exists completed_at timestamptz;

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
    and completed_at <= now() - interval '30 minutes';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.delete_expired_completed_rooms() to anon, authenticated;

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

-- One-time clean start. Cascades to participants, parts, and messages.
delete from public.rooms;

notify pgrst, 'reload schema';
