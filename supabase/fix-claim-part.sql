-- Run this in the SAME Supabase project used by VITE_SUPABASE_URL.
-- It replaces the old claim_part function that calls digest(text, unknown).

create extension if not exists pgcrypto;

create or replace function public.khatmah_hash(value text)
returns text
language sql
immutable
security definer
set search_path = extensions
as $$
  select encode(extensions.digest(convert_to(value, 'UTF8'), 'sha256'::text), 'hex');
$$;

create or replace function public.claim_part(target_room_id uuid, target_participant_id uuid, session_token text, requested_part integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_part public.parts%rowtype;
begin
  if not exists (
    select 1 from public.participants
    where id = target_participant_id
      and room_id = target_room_id
      and session_token_hash = public.khatmah_hash(session_token)
  ) then
    raise exception 'invalid_session';
  end if;

  if exists (
    select 1 from public.participants
    where id = target_participant_id and current_part is not null
  ) then
    raise exception 'part_is_not_available';
  end if;

  update public.parts
  set status = 'available'
  where room_id = target_room_id
    and part_number = requested_part
    and status = 'locked'
    and not exists (
      select 1 from public.parts
      where room_id = target_room_id
        and part_number < requested_part
        and status = 'locked'
    );

  select * into selected_part
  from public.parts
  where room_id = target_room_id
    and part_number = requested_part
  for update;

  if not found or selected_part.status <> 'available' then
    raise exception 'part_is_not_available';
  end if;

  update public.parts
  set status = 'reading', participant_id = target_participant_id, started_at = now()
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

grant execute on function public.khatmah_hash(text) to anon, authenticated;
grant execute on function public.claim_part(uuid, uuid, text, integer) to anon, authenticated;

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
  set current_part = null
  where id = target_participant_id;

  update public.parts
  set status = 'available'
  where room_id = target_room_id
    and part_number = requested_part + 1
    and status = 'locked';

  update public.rooms
  set status = 'completed'
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

-- Keep sessions permanently and prevent duplicate names, including completed sessions.
-- Existing duplicate names can prevent a unique index from being created.
-- create_room below uses a transaction lock and remains safe for new sessions.

create or replace function public.create_room(room_name text, participant_name text, room_password text)
returns json language plpgsql security definer set search_path = public as $$
declare
  new_room_id uuid := gen_random_uuid();
  new_participant_id uuid := gen_random_uuid();
  owner_token text := encode(
    extensions.digest(
      convert_to(trim(room_password) || ':' || new_room_id::text || ':' || lower(trim(participant_name)), 'UTF8'),
      'sha256'::text
    ),
    'hex'
  );
begin
  if char_length(trim(room_name)) = 0 or char_length(trim(participant_name)) = 0 or char_length(room_password) < 4 then
    raise exception 'invalid_room_data';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(room_name)), 0));
  if exists (select 1 from rooms where lower(trim(name)) = lower(trim(room_name))) then
    raise exception 'room_already_exists';
  end if;
  insert into rooms (id, name, password_hash, owner_token_hash, creator_name)
  values (new_room_id, trim(room_name), encode(extensions.digest(room_password, 'sha256'), 'hex'), encode(extensions.digest(owner_token, 'sha256'), 'hex'), trim(participant_name));
  insert into participants (id, room_id, name, session_token_hash)
  values (new_participant_id, new_room_id, trim(participant_name), encode(extensions.digest(owner_token, 'sha256'), 'hex'));
  insert into parts (room_id, part_number, status)
  select new_room_id, number, case when number = 1 then 'available' else 'locked' end
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
  owner_token text;
begin
  select * into room_record from rooms where id = target_room_id;
  if not found or room_record.password_hash <> encode(extensions.digest(room_password, 'sha256'), 'hex') then
    raise exception 'invalid_room_credentials';
  end if;
  if lower(trim(participant_name)) = lower(trim(room_record.creator_name)) then
    owner_token := encode(
      extensions.digest(
        convert_to(trim(room_password) || ':' || target_room_id::text || ':' || lower(trim(participant_name)), 'UTF8'),
        'sha256'::text
      ),
      'hex'
    );
  end if;
  insert into participants (id, room_id, name, session_token_hash)
  values (new_participant_id, target_room_id, trim(participant_name), encode(extensions.digest(session_token, 'sha256'), 'hex'))
  on conflict (room_id, name) do update set session_token_hash = excluded.session_token_hash
  returning id into new_participant_id;
  return json_build_object('room_id', target_room_id, 'participant_id', new_participant_id, 'session_token', session_token, 'owner_token', owner_token);
end;
$$;

grant execute on function public.create_room(text, text, text) to anon, authenticated;
grant execute on function public.join_room(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
