create or replace function public.create_room(room_name text, participant_name text, room_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_room_id uuid := gen_random_uuid();
  new_participant_id uuid := gen_random_uuid();
  safe_participant_name text := coalesce(nullif(trim(participant_name), ''), 'مشارك');
  owner_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if coalesce(char_length(trim(room_name)), 0) not between 1 and 120
    or char_length(safe_participant_name) not between 2 and 80 then
    raise exception 'invalid_room_data';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(trim(room_name)), 0));
  if exists (select 1 from rooms where lower(trim(name)) = lower(trim(room_name))) then
    raise exception 'room_already_exists';
  end if;

  insert into rooms (id, name, password_hash, owner_token_hash, creator_name)
  values (
    new_room_id,
    trim(room_name),
    encode(extensions.digest(owner_token, 'sha256'), 'hex'),
    encode(extensions.digest(owner_token, 'sha256'), 'hex'),
    safe_participant_name
  );

  insert into participants (id, room_id, name, session_token_hash)
  values (
    new_participant_id,
    new_room_id,
    safe_participant_name,
    encode(extensions.digest(owner_token, 'sha256'), 'hex')
  );

  insert into parts (room_id, part_number, status)
  select new_room_id, number, 'available'
  from generate_series(1, 30) as number;

  return json_build_object(
    'room_id', new_room_id,
    'participant_id', new_participant_id,
    'session_token', owner_token,
    'owner_token', owner_token
  );
end;
$$;

create or replace function public.join_room(target_room_id uuid, participant_name text, room_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
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
  values (
    new_participant_id,
    target_room_id,
    safe_participant_name,
    encode(extensions.digest(session_token, 'sha256'), 'hex')
  )
  on conflict (room_id, name)
  do update set session_token_hash = excluded.session_token_hash
  returning id into new_participant_id;

  return json_build_object(
    'room_id', target_room_id,
    'participant_id', new_participant_id,
    'session_token', session_token,
    'owner_token', null
  );
end;
$$;

create or replace function public.update_participant_name(target_room_id uuid, target_participant_id uuid, session_token text, new_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(coalesce(new_name, ''));
begin
  if char_length(normalized_name) not between 2 and 80 then
    raise exception 'invalid_participant_name';
  end if;

  if not exists (
    select 1
    from participants
    where id = target_participant_id
      and room_id = target_room_id
      and session_token_hash = public.khatmah_hash(session_token)
  ) then
    raise exception 'invalid_session';
  end if;

  begin
    update participants
    set name = normalized_name
    where id = target_participant_id
      and room_id = target_room_id;
  exception when unique_violation then
    raise exception 'participant_name_taken';
  end;

  return json_build_object('ok', true, 'name', normalized_name);
end;
$$;

revoke all on function public.create_room(text, text, text) from public;
revoke all on function public.join_room(uuid, text, text) from public;
revoke all on function public.update_participant_name(uuid, uuid, text, text) from public;
grant execute on function public.create_room(text, text, text) to anon, authenticated;
grant execute on function public.join_room(uuid, text, text) to anon, authenticated;
grant execute on function public.update_participant_name(uuid, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
