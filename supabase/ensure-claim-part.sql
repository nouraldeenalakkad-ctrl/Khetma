-- Run in the same Supabase project's SQL Editor used by the app.
-- This repairs only claim_part and its required reservation columns.

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

alter table public.parts add column if not exists reading_type text default 'self';
alter table public.parts add column if not exists child_name text;
alter table public.parts drop constraint if exists parts_reading_type_check;
alter table public.parts add constraint parts_reading_type_check
  check (reading_type in ('self', 'child'));

create or replace function public.khatmah_hash(value text)
returns text
language sql
immutable
security definer
set search_path = extensions
as $$
  select encode(extensions.digest(convert_to(value, 'UTF8'), 'sha256'::text), 'hex');
$$;

drop function if exists public.claim_part(uuid, uuid, text, integer);
drop function if exists public.claim_part(uuid, uuid, text, integer, text, text);

create function public.claim_part(
  target_room_id uuid,
  target_participant_id uuid,
  session_token text,
  requested_part integer,
  requested_reading_type text default 'self',
  requested_child_name text default null
)
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
    select 1
    from public.participants
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

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.khatmah_hash(text) to anon, authenticated;
grant execute on function public.claim_part(uuid, uuid, text, integer, text, text) to anon, authenticated;
grant select (reading_type, child_name) on public.parts to anon, authenticated;

notify pgrst, 'reload schema';

select
  p.oid::regprocedure as function_signature,
  pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'claim_part';