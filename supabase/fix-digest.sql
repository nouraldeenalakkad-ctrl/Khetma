-- Run this once in Supabase SQL Editor if the deployed app still reports:
-- function digest(text, unknown) does not exist
-- or function gen_random_bytes(integer) does not exist

create extension if not exists pgcrypto;

-- Drop older function signatures that can block a clean recreate.
drop function if exists public.digest(text, text);
drop function if exists public.khatmah_hash(text);
drop function if exists public.claim_part(uuid, uuid, text, integer, text, text);
drop function if exists public.claim_part(uuid, uuid, text, integer);

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

notify pgrst, 'reload schema';
