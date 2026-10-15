-- Repairs the room creation/join RPCs used by the app's entry screens.
-- Run in the SQL Editor of the Supabase project configured in the app.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $pgcrypto_schema$
declare
  installed_schema text;
begin
  select namespace.nspname into installed_schema
  from pg_extension extension_record
  join pg_namespace namespace on namespace.oid = extension_record.extnamespace
  where extension_record.extname = 'pgcrypto';

  if installed_schema is distinct from 'extensions' then
    execute 'alter extension pgcrypto set schema extensions';
  end if;
end
$pgcrypto_schema$;

drop function if exists public.create_room(text, text, text);
drop function if exists public.join_room(uuid, text, text);

create function public.create_room(
  room_name text,
  participant_name text,
  room_password text
)
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

  if exists (
    select 1 from public.rooms
    where lower(trim(name)) = lower(trim(room_name))
  ) then
    raise exception 'room_already_exists';
  end if;

  insert into public.rooms (id, name, password_hash, owner_token_hash, creator_name)
  values (
    new_room_id,
    trim(room_name),
    encode(extensions.digest(owner_token, 'sha256'::text), 'hex'),
    encode(extensions.digest(owner_token, 'sha256'::text), 'hex'),
    safe_participant_name
  );

  insert into public.participants (id, room_id, name, session_token_hash)
  values (
    new_participant_id,
    new_room_id,
    safe_participant_name,
    encode(extensions.digest(owner_token, 'sha256'::text), 'hex')
  );

  insert into public.parts (room_id, part_number, status)
  select new_room_id, part_number, 'available'
  from generate_series(1, 30) as part_number;

  return json_build_object(
    'room_id', new_room_id,
    'participant_id', new_participant_id,
    'session_token', owner_token,
    'owner_token', owner_token
  );
end;
$$;

create function public.join_room(
  target_room_id uuid,
  participant_name text,
  room_password text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  room_record public.rooms%rowtype;
  new_participant_id uuid := gen_random_uuid();
  session_token text := encode(extensions.gen_random_bytes(32), 'hex');
  safe_participant_name text := coalesce(nullif(trim(participant_name), ''), 'مشارك');
begin
  select * into room_record
  from public.rooms
  where id = target_room_id;

  if not found then
    raise exception 'room_not_found';
  end if;

  if char_length(safe_participant_name) not between 2 and 80 then
    raise exception 'invalid_participant_name';
  end if;

  insert into public.participants (id, room_id, name, session_token_hash)
  values (
    new_participant_id,
    target_room_id,
    safe_participant_name,
    encode(extensions.digest(session_token, 'sha256'::text), 'hex')
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

grant execute on function public.create_room(text, text, text) to anon, authenticated;
grant execute on function public.join_room(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select p.proname, p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_room', 'join_room')
order by p.proname;