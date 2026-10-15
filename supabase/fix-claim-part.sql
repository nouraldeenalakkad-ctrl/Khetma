-- Run this in the SAME Supabase project used by VITE_SUPABASE_URL.
-- It replaces the old claim_part function that calls digest(text, unknown).
-- This script also clears stale signatures so the database can be recreated cleanly.

create extension if not exists pgcrypto;

drop function if exists public.khatmah_hash(text);
drop function if exists public.claim_part(uuid, uuid, text, integer);
drop function if exists public.claim_part(uuid, uuid, text, integer, text, text);
drop function if exists public.complete_part(uuid, uuid, text, integer);
drop function if exists public.send_message(uuid, uuid, text, text, text);
drop function if exists public.send_message(uuid, uuid, text, text);
drop function if exists public.create_room(text, text, text);
drop function if exists public.join_room(uuid, text, text);
drop function if exists public.delete_room(uuid, text);
drop function if exists public.leave_room(uuid, uuid, text);

create or replace function public.khatmah_hash(value text)
returns text
language sql
immutable
security definer
set search_path = extensions
as $$
  select encode(extensions.digest(convert_to(value, 'UTF8'), 'sha256'::text), 'hex');
$$;

alter table public.parts add column if not exists reading_type text default 'self';
alter table public.parts add column if not exists child_name text;
alter table public.parts drop constraint if exists parts_reading_type_check;
alter table public.parts add constraint parts_reading_type_check check (reading_type in ('self', 'child'));
update public.parts set status = 'available' where status = 'locked';

create or replace function public.claim_part(target_room_id uuid, target_participant_id uuid, session_token text, requested_part integer, requested_reading_type text default 'self', requested_child_name text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_part public.parts%rowtype;
  normalized_reading_type text;
  normalized_child_name text;
begin
  if not exists (
    select 1 from public.participants
    where id = target_participant_id
      and room_id = target_room_id
      and session_token_hash = public.khatmah_hash(session_token)
  ) then
    raise exception 'invalid_session';
  end if;

  normalized_reading_type := lower(coalesce(trim(requested_reading_type), 'self'));
  if normalized_reading_type not in ('self', 'child') then
    raise exception 'invalid_reading_type';
  end if;

  if normalized_reading_type = 'child' then
    normalized_child_name := trim(coalesce(requested_child_name, ''));
    if char_length(normalized_child_name) < 2 then
      raise exception 'child_name_required';
    end if;
  else
    normalized_child_name := null;
  end if;

  select * into selected_part
  from public.parts
  where room_id = target_room_id
    and part_number = requested_part
  for update;

  if not found or selected_part.status <> 'available' then
    raise exception 'part_is_not_available';
  end if;

  update public.parts
  set status = 'reading',
      participant_id = target_participant_id,
      reading_type = normalized_reading_type,
      child_name = normalized_child_name,
      started_at = now()
  where id = selected_part.id;

  update public.participants
  set current_part = requested_part
  where id = target_participant_id;

  update public.parts
  set status = 'available'
  where room_id = target_room_id
    and part_number = requested_part + 1
    and status = 'locked';

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.claim_part(uuid, uuid, text, integer, text, text) to anon, authenticated;
grant select (reading_type, child_name) on public.parts to anon, authenticated;

grant execute on function public.khatmah_hash(text) to anon, authenticated;

create or replace function public.complete_part(target_room_id uuid, target_participant_id uuid, session_token text, requested_part integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.participants
    where id = target_participant_id
      and room_id = target_room_id
      and session_token_hash = public.khatmah_hash(session_token)
  ) then
    raise exception 'invalid_session';
  end if;

  update public.parts
  set status = 'completed', completed_at = now()
  where room_id = target_room_id
    and part_number = requested_part
    and status = 'reading'
    and participant_id = target_participant_id;

  if not found then raise exception 'part_is_not_owned'; end if;

  update public.participants
  set current_part = (
    select min(part_number)
    from public.parts
    where room_id = target_room_id
      and participant_id = target_participant_id
      and status = 'reading'
  )
  where id = target_participant_id;

  update public.rooms
  set status = 'completed', completed_at = coalesce(completed_at, now())
  where id = target_room_id
    and not exists (
      select 1 from public.parts
      where room_id = target_room_id and status <> 'completed'
    );

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.complete_part(uuid, uuid, text, integer) to anon, authenticated;

create or replace function public.send_message(target_room_id uuid, target_participant_id uuid, session_token text, message_text text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message_id uuid;
begin
  if not exists (
    select 1 from public.participants
    where id = target_participant_id
      and room_id = target_room_id
      and session_token_hash = public.khatmah_hash(session_token)
  ) then
    raise exception 'invalid_session';
  end if;

  if char_length(trim(message_text)) = 0 then
    raise exception 'empty_message';
  end if;

  insert into public.messages (room_id, participant_id, message)
  values (target_room_id, target_participant_id, trim(message_text))
  returning id into new_message_id;

  return json_build_object('ok', true, 'id', new_message_id);
end;
$$;

grant execute on function public.send_message(uuid, uuid, text, text) to anon, authenticated;

create or replace function public.delete_room(target_room_id uuid, owner_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rooms
  where id = target_room_id
    and owner_token_hash = encode(extensions.digest(owner_token, 'sha256'), 'hex');

  if not found then
    raise exception 'not_room_owner';
  end if;

  return json_build_object('ok', true);
end;
$$;

create or replace function public.leave_room(target_room_id uuid, target_participant_id uuid, session_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.participants
    where id = target_participant_id
      and room_id = target_room_id
      and session_token_hash = public.khatmah_hash(session_token)
  ) then
    raise exception 'invalid_session';
  end if;

  delete from public.participants
  where id = target_participant_id
    and room_id = target_room_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.delete_room(uuid, text) to anon, authenticated;
grant execute on function public.leave_room(uuid, uuid, text) to anon, authenticated;

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

grant execute on function public.delete_expired_completed_rooms() to anon, authenticated;

create extension if not exists pg_cron;

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
-- Keep sessions permanently and prevent duplicate names, including completed sessions.
-- Existing duplicate names can prevent a unique index from being created.
-- create_room below uses a transaction lock and remains safe for new sessions.

create or replace function public.create_room(room_name text, participant_name text, room_password text)
returns json language plpgsql security definer set search_path = public as $$
declare
  new_room_id uuid := gen_random_uuid();
  new_participant_id uuid := gen_random_uuid();
  safe_participant_name text := coalesce(nullif(trim(participant_name), ''), 'مشارك');
  owner_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if char_length(trim(room_name)) = 0 or char_length(safe_participant_name) not between 2 and 80 then
    raise exception 'invalid_room_data';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(room_name)), 0));
  if exists (select 1 from rooms where lower(trim(name)) = lower(trim(room_name))) then
    raise exception 'room_already_exists';
  end if;
  insert into rooms (id, name, password_hash, owner_token_hash, creator_name)
  values (new_room_id, trim(room_name), encode(extensions.digest(owner_token, 'sha256'), 'hex'), encode(extensions.digest(owner_token, 'sha256'), 'hex'), safe_participant_name);
  insert into participants (id, room_id, name, session_token_hash)
  values (new_participant_id, new_room_id, safe_participant_name, encode(extensions.digest(owner_token, 'sha256'), 'hex'));
  insert into parts (room_id, part_number, status)
  select new_room_id, number, 'available'
  from generate_series(1, 30) as number;
  return json_build_object('room_id', new_room_id, 'participant_id', new_participant_id, 'session_token', owner_token, 'owner_token', owner_token);
end;
$$;

create or replace function public.join_room(target_room_id uuid, participant_name text, room_password text)
returns json language plpgsql security definer set search_path = public as $$
declare
  room_record rooms%rowtype;
  new_participant_id uuid := gen_random_uuid();
  session_token text := encode(extensions.gen_random_bytes(32), 'hex');
  safe_participant_name text := coalesce(nullif(trim(participant_name), ''), 'مشارك');
begin
  select * into room_record from rooms where id = target_room_id;
  if not found then
    raise exception 'room_not_found';
  end if;
  if char_length(safe_participant_name) not between 2 and 80 then
    raise exception 'invalid_participant_name';
  end if;
  insert into participants (id, room_id, name, session_token_hash)
  values (new_participant_id, target_room_id, safe_participant_name, encode(extensions.digest(session_token, 'sha256'), 'hex'))
  on conflict (room_id, name) do update set session_token_hash = excluded.session_token_hash
  returning id into new_participant_id;
  return json_build_object('room_id', target_room_id, 'participant_id', new_participant_id, 'session_token', session_token, 'owner_token', null);
end;
$$;

grant execute on function public.create_room(text, text, text) to anon, authenticated;
grant execute on function public.join_room(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
