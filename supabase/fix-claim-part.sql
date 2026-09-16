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

  select * into selected_part
  from public.parts
  where room_id = target_room_id
    and part_number = requested_part
  for update;

  if not found
     or selected_part.status <> 'available'
     or exists (
       select 1 from public.parts
       where room_id = target_room_id
         and part_number < requested_part
         and status <> 'completed'
     ) then
    raise exception 'part_is_not_available';
  end if;

  update public.parts
  set status = 'reading', participant_id = target_participant_id, started_at = now()
  where id = selected_part.id;

  update public.participants
  set current_part = requested_part
  where id = target_participant_id;

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

notify pgrst, 'reload schema';
