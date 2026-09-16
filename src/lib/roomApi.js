import { supabase } from './supabase'

const sessionKey = (roomId) => 'khatmah-session-' + roomId

const requireSupabase = () => {
if (!supabase) {
throw new Error('Supabase غير مهيأ. أضف متغيرات البيئة أولًا.')
}
return supabase
}

const saveSession = (roomId, session) => {
localStorage.setItem(sessionKey(roomId), JSON.stringify(session))
return session
}

export const getSession = (roomId) => {
try {
return JSON.parse(localStorage.getItem(sessionKey(roomId)) || 'null')
} catch {
return null
}
}

export const clearSession = (roomId) => {
localStorage.removeItem(sessionKey(roomId))
}

const unwrap = ({ data, error }) => {
if (error) {
if (error.code === 'PGRST202') {
throw new Error(
'دالة Supabase غير محدثة. شغّل schema.sql كاملًا من SQL Editor ثم أعد تحميل الصفحة.'
)
}

if (error.message?.includes('room_already_exists')) {
  throw new Error('هذه الختمة موجودة بالفعل. اختر اسمًا آخر.')
}

if (error.message?.includes('invalid_room_credentials')) {
  throw new Error('كلمة مرور الختمة غير صحيحة.')
}

if (error.message?.includes('invalid_session')) {
  throw new Error('انتهت جلسة الغرفة. أعد الانضمام باستخدام الرابط وكلمة المرور.')
}

if (error.message?.includes('part_is_not_owned')) {
  throw new Error('لا يمكنك إنهاء هذا الجزء لأنك لم تحجزه بهذه الجلسة.')
}

if (error.message?.includes('empty_message')) {
  throw new Error('اكتب رسالة قبل الإرسال.')
}

if (error.message?.includes('digest(text')) {
  throw new Error(
    'قاعدة Supabase لم تُحدّث بعد. شغّل ملف supabase/fix-claim-part.sql ثم أعد تحميل الصفحة.'
  )
}

throw error

}

return data
}

export async function createRoom(name, participantName, password) {
const result = unwrap(
await requireSupabase().rpc('create_room', {
room_name: name,
participant_name: participantName,
room_password: password,
})
)

const session = {
...result,
name: participantName,
}

saveSession(result.room_id, session)
return session
}

export async function joinRoom(roomId, participantName, password) {
const client = requireSupabase()

const roomResult = await client
.from('rooms')
.select('id,name')
.eq('name', roomId.trim())
.limit(2)

const rooms = unwrap(roomResult)

if (!rooms || rooms.length === 0) {
throw new Error('لم يتم العثور على ختمة بهذا الاسم.')
}

if (rooms.length > 1) {
throw new Error('يوجد أكثر من ختمة بهذا الاسم. اختر اسمًا مختلفًا.')
}

const room = rooms[0]

const result = unwrap(
await client.rpc('join_room', {
target_room_id: room.id,
participant_name: participantName,
room_password: password,
})
)

const session = {
...result,
name: participantName,
}

saveSession(room.id, session)
return session
}

export async function getRoomState(roomId) {
const client = requireSupabase()

const [
roomResult,
participantsResult,
partsResult,
messagesResult,
] = await Promise.all([
client
.from('rooms')
.select('id,name,creator_name,status,created_at')
.eq('id', roomId)
.single(),

client
  .from('participants')
  .select('id,room_id,name,current_part,joined_at')
  .eq('room_id', roomId)
  .order('joined_at'),

client
  .from('parts')
  .select(
    'id,room_id,part_number,status,participant_id,started_at,completed_at'
  )
  .eq('room_id', roomId)
  .order('part_number'),

client
  .from('messages')
  .select('id,room_id,participant_id,message,created_at')
  .eq('room_id', roomId)
  .order('created_at'),

])

const room = unwrap(roomResult)
const participants = unwrap(participantsResult)
const parts = unwrap(partsResult)
const messages = unwrap(messagesResult)

return {
id: room.id,
name: room.name,
creator: room.creator_name,
status: room.status,

members: participants.map(
  (participant) => participant.name
),

participants,

parts: parts.map((part) => ({
  number: part.part_number,
  status: part.status,

  reader:
    participants.find(
      (participant) =>
        participant.id === part.participant_id
    )?.name || null,

  participantId: part.participant_id,
})),

messages: messages.map((message) => ({
  id: message.id,
  participant_id: message.participant_id,

  sender_name:
    participants.find(
      (participant) =>
        participant.id === message.participant_id
    )?.name || 'مشارك',

  message: message.message,
  created_at: message.created_at,
})),

}
}

export async function claimPart(roomId, partNumber) {
const session = getSession(roomId)

if (!session) {
throw new Error('انتهت جلسة الغرفة.')
}

return unwrap(
await requireSupabase().rpc('claim_part', {
target_room_id: roomId,
target_participant_id: session.participant_id,
session_token: session.session_token,
requested_part: partNumber,
})
)
}

export async function completePart(roomId, partNumber) {
const session = getSession(roomId)

if (!session) {
throw new Error('انتهت جلسة الغرفة.')
}

return unwrap(
await requireSupabase().rpc('complete_part', {
target_room_id: roomId,
target_participant_id: session.participant_id,
session_token: session.session_token,
requested_part: partNumber,
})
)
}

export async function sendMessage(
roomId,
participantId,
sessionToken,
message
) {
return unwrap(
await requireSupabase().rpc('send_message', {
target_room_id: roomId,
target_participant_id: participantId,
session_token: sessionToken,
message_text: message,
})
)
}

export async function leaveRoom(roomId) {
const session = getSession(roomId)

if (!session) {
return
}

await unwrap(
await requireSupabase().rpc('leave_room', {
target_room_id: roomId,
target_participant_id: session.participant_id,
session_token: session.session_token,
})
)

clearSession(roomId)
}

export async function deleteRoom(roomId) {
const session = getSession(roomId)

if (!session?.owner_token) {
throw new Error('هذه العملية للمنشئ فقط.')
}

await unwrap(
await requireSupabase().rpc('delete_room', {
target_room_id: roomId,
owner_token: session.owner_token,
})
)

clearSession(roomId)
}

export function subscribeToRoom(roomId, onChange) {
const client = requireSupabase()

const channel = client
.channel('room-' + roomId)

.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'rooms',
    filter: 'id=eq.' + roomId,
  },
  onChange
)

.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'participants',
    filter: 'room_id=eq.' + roomId,
  },
  onChange
)

.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'parts',
    filter: 'room_id=eq.' + roomId,
  },
  onChange
)

.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: 'room_id=eq.' + roomId,
  },
  onChange
)

.subscribe()

return () => client.removeChannel(channel)
}
