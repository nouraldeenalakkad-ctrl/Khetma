create or replace function public.update_participant_name(target_room_id uuid, target_participant_id uuid, session_token text, new_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  normalized_name text := trim(coalesce(new_name, ''));
begin
  if char_length(normalized_name) not between 2 and 80 then
    raise exception 'invalid_participant_name';
  end if;

  if not exists (
    select 1 from participants
    where id = target_participant_id
      and room_id = target_room_id
      and session_token_hash = public.khatmah_hash(session_token)
  ) then
    raise exception 'invalid_session';
  end if;

  begin
    update participants
    set name = normalized_name
    where id = target_participant_id and room_id = target_room_id;
  exception when unique_violation then
    raise exception 'participant_name_taken';
  end;

  return json_build_object('ok', true, 'name', normalized_name);
end;
$$;

revoke all on function public.update_participant_name(uuid, uuid, text, text) from public;
grant execute on function public.update_participant_name(uuid, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
