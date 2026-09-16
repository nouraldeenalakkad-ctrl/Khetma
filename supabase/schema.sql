create extension if not exists pgcrypto;

-- Compatibility for functions created by the earlier schema version.
create or replace function public.digest(value text, algorithm text)
returns bytea
language sql
immutable
security definer
set search_path = extensions
as $$ select extensions.digest(value, algorithm); $$;

create or replace function public.khatmah_hash(value text)
returns text
language sql
immutable
security definer
set search_path = extensions
as $$
  select encode(extensions.digest(convert_to(value, 'UTF8'), 'sha256'::text), 'hex');
$$;

-- Remove the old zero-argument RPC if an earlier schema was applied.
drop function if exists public.create_room();
drop function if exists public.join_room();

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  password_hash text not null,
  owner_token_hash text not null,
  creator_name text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  session_token_hash text not null,
  current_part integer check (current_part between 1 and 30),
  joined_at timestamptz not null default now(),
  unique (room_id, name)
);

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  part_number integer not null check (part_number between 1 and 30),
  status text not null default 'locked' check (status in ('available', 'reading', 'completed', 'locked')),
  participant_id uuid references public.participants(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  unique (room_id, part_number)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Keep an already-created parts table compatible with the current state names.
alter table public.parts drop constraint if exists parts_status_check;
alter table public.parts add constraint parts_status_check check (status in ('available', 'reading', 'completed', 'locked'));

create unique index if not exists rooms_active_name_unique
  on public.rooms (lower(trim(name)))
  where status = 'active';

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.parts enable row level security;
alter table public.messages enable row level security;

drop policy if exists "public room state is readable" on public.rooms;
drop policy if exists "public participant state is readable" on public.participants;
drop policy if exists "public part state is readable" on public.parts;
drop policy if exists "public messages are readable" on public.messages;
create policy "public room state is readable" on public.rooms for select using (true);
create policy "public participant state is readable" on public.participants for select using (true);
create policy "public part state is readable" on public.parts for select using (true);
create policy "public messages are readable" on public.messages for select using (true);

create or replace function public.create_room(room_name text, participant_name text, room_password text)
returns json language plpgsql security definer set search_path = public as $$
declare
  new_room_id uuid := gen_random_uuid();
  new_participant_id uuid := gen_random_uuid();
  owner_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if char_length(trim(room_name)) = 0 or char_length(trim(participant_name)) = 0 or char_length(room_password) < 4 then
    raise exception 'invalid_room_data';
  end if;
  if exists (select 1 from rooms where lower(trim(name)) = lower(trim(room_name)) and status = 'active') then
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
begin
  select * into room_record from rooms where id = target_room_id and status = 'active';
  if not found or room_record.password_hash <> encode(extensions.digest(room_password, 'sha256'), 'hex') then raise exception 'invalid_room_credentials'; end if;
  insert into participants (id, room_id, name, session_token_hash)
  values (new_participant_id, target_room_id, trim(participant_name), encode(extensions.digest(session_token, 'sha256'), 'hex'))
  on conflict (room_id, name) do update set session_token_hash = excluded.session_token_hash
  returning id into new_participant_id;
  return json_build_object('room_id', target_room_id, 'participant_id', new_participant_id, 'session_token', session_token, 'owner_token', null);
end;
$$;

create or replace function public.claim_part(target_room_id uuid, target_participant_id uuid, session_token text, requested_part integer)
returns json language plpgsql security definer set search_path = public as $$
declare selected_part parts%rowtype;
begin
  if not exists (select 1 from participants where id = target_participant_id and room_id = target_room_id and session_token_hash = public.khatmah_hash(session_token)) then raise exception 'invalid_session'; end if;
  select * into selected_part from parts where room_id = target_room_id and part_number = requested_part for update;
  if selected_part.status <> 'available' then raise exception 'part_is_not_available'; end if;
  update parts set status = 'reading', participant_id = target_participant_id, started_at = now() where id = selected_part.id;
  update participants set current_part = requested_part where id = target_participant_id;
  update parts set status = 'available' where room_id = target_room_id and part_number = requested_part + 1 and status = 'locked';
  return json_build_object('ok', true);
end;
$$;

create or replace function public.complete_part(target_room_id uuid, target_participant_id uuid, session_token text, requested_part integer)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from participants where id = target_participant_id and room_id = target_room_id and session_token_hash = public.khatmah_hash(session_token)) then raise exception 'invalid_session'; end if;
  update parts set status = 'completed', completed_at = now() where room_id = target_room_id and part_number = requested_part and status = 'reading' and participant_id = target_participant_id;
  if not found then raise exception 'part_is_not_owned'; end if;
  update participants set current_part = null where id = target_participant_id;
  update parts set status = 'available' where room_id = target_room_id and part_number = requested_part + 1 and status = 'locked';
  update rooms set status = 'completed' where id = target_room_id and not exists (select 1 from parts where room_id = target_room_id and status <> 'completed');
  return json_build_object('ok', true);
end;
$$;

create or replace function public.delete_room(target_room_id uuid, owner_token text)
returns json language plpgsql security definer set search_path = public as $$
begin
  delete from rooms where id = target_room_id and owner_token_hash = encode(extensions.digest(owner_token, 'sha256'), 'hex');
  if not found then raise exception 'not_room_owner'; end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.send_message(target_room_id uuid, target_participant_id uuid, session_token text, message_text text)
returns json language plpgsql security definer set search_path = public as $$
declare new_message_id uuid;
begin
  if not exists (select 1 from participants where id = target_participant_id and room_id = target_room_id and session_token_hash = public.khatmah_hash(session_token)) then raise exception 'invalid_session'; end if;
  if char_length(trim(message_text)) = 0 then raise exception 'empty_message'; end if;
  insert into messages (room_id, participant_id, message) values (target_room_id, target_participant_id, trim(message_text)) returning id into new_message_id;
  return json_build_object('id', new_message_id);
end;
$$;

create or replace function public.leave_room(target_room_id uuid, target_participant_id uuid, session_token text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from participants where id = target_participant_id and room_id = target_room_id and session_token_hash = encode(extensions.digest(session_token, 'sha256'), 'hex')) then raise exception 'invalid_session'; end if;
  delete from participants where id = target_participant_id;
  return json_build_object('ok', true);
end;
$$;

revoke all on public.rooms, public.participants, public.parts, public.messages from anon, authenticated;
grant execute on function public.create_room(text, text, text) to anon, authenticated;
grant execute on function public.join_room(uuid, text, text) to anon, authenticated;
grant execute on function public.claim_part(uuid, uuid, text, integer) to anon, authenticated;
grant execute on function public.complete_part(uuid, uuid, text, integer) to anon, authenticated;
grant execute on function public.delete_room(uuid, text) to anon, authenticated;
grant execute on function public.send_message(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.leave_room(uuid, uuid, text) to anon, authenticated;

grant select (id, name, creator_name, status, created_at) on public.rooms to anon, authenticated;
grant select (id, room_id, name, current_part, joined_at) on public.participants to anon, authenticated;
grant select (id, room_id, part_number, status, participant_id, started_at, completed_at) on public.parts to anon, authenticated;
grant select (id, room_id, participant_id, message, created_at) on public.messages to anon, authenticated;

alter publication supabase_realtime add table public.rooms, public.participants, public.parts, public.messages;

notify pgrst, 'reload schema';
