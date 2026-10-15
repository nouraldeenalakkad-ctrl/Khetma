-- Repairs the send_message RPC without deleting rooms, participants, or messages.
begin;

drop function if exists public.send_message(uuid, uuid, text, text, text);

create or replace function public.send_message(
  target_room_id uuid,
  target_participant_id uuid,
  session_token text,
  message_text text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message_id uuid;
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

  if char_length(trim(message_text)) = 0 then
    raise exception 'empty_message';
  end if;

  insert into public.messages (room_id, participant_id, message)
  values (target_room_id, target_participant_id, trim(message_text))
  returning id into new_message_id;

  return json_build_object('ok', true, 'id', new_message_id);
end;
$$;

revoke all on function public.send_message(uuid, uuid, text, text) from public;
grant execute on function public.send_message(uuid, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

select
  p.oid::regprocedure as signature,
  pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'send_message'
order by p.oid::regprocedure::text;
