-- Destructive reset: removes every room and all related data.
-- Run only when you intend to permanently clear the current sessions.

begin;

delete from public.messages;
delete from public.parts;
delete from public.participants;
delete from public.rooms;

commit;

select
  (select count(*) from public.rooms) as rooms_remaining,
  (select count(*) from public.participants) as participants_remaining,
  (select count(*) from public.parts) as parts_remaining,
  (select count(*) from public.messages) as messages_remaining;