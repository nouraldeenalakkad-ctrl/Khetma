import { supabase } from './supabase'

const sessionKey = (roomId) => 'khatmah-session-' + roomId
const ownerRecoveryKey = (roomId) => 'khatmah-owner-' + roomId
const ownerRecoveryNameKey = (roomId) => 'khatmah-owner-name-' + roomId
let roomSubscriptionId = 0

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
let session
try {
session = JSON.parse(localStorage.getItem(sessionKey(roomId)) || 'null')
} catch {
return null
}

if (session && Object.hasOwn(session, 'room_password')) {
  delete session.room_password
  try {
    localStorage.setItem(sessionKey(roomId), JSON.stringify(session))
  } catch (err) {
    console.warn('تعذّر حذف بيانات قديمة من التخزين المحلي.', err)
  }
}
return session
}

export const clearSession = (roomId) => {
localStorage.removeItem(sessionKey(roomId))
}

const unwrap = ({ data, error }) => {
if (error) {
if (error.code === 'PGRST202') {
throw new Error(
'دالة Supabase غير محدثة. شغّل ملف التحديث المناسب من مجلد supabase ثم أعد تحميل الصفحة.'
)
}

if (error.code === 'PGRST203') {
  throw new Error(
    'يوجد تعريف مكرر لإرسال الرسائل في قاعدة البيانات. شغّل supabase/fix-send-message-overload.sql ثم أعد تحميل الصفحة.'
  )
}

if (error.message?.includes('participant_name_taken')) {
  throw new Error('هذا الاسم مستخدم في هذه الختمة. اختر اسمًا آخر.')
}

if (error.message?.includes('invalid_participant_name')) {
  throw new Error('الاسم يجب أن يتكون من حرفين إلى 80 حرفًا.')
}

if (error.message?.includes('room_already_exists')) {
  throw new Error('هذه الختمة موجودة بالفعل. اختر اسمًا آخر.')
}

if (error.message?.includes('room_not_found')) {
  throw new Error('لم نعثر على الختمة المطلوبة. تحقق من اسمها أو رابطها.')
}

if (error.message?.includes('invalid_room_credentials')) {
  throw new Error('لتفعيل الانضمام دون رمز، شغّل supabase/remove-room-passwords.sql في SQL Editor.')
}

if (error.message?.includes('invalid_session')) {
  throw new Error('انتهت جلستك. أعد الانضمام عبر رابط الختمة.')
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

export async function createRoom(name, participantName) {
const result = unwrap(
await requireSupabase().rpc('create_room', {
room_name: name,
participant_name: participantName,
room_password: null,
})
)

const session = {
...result,
name: participantName,
}

saveSession(result.room_id, session)
return session
}

export async function joinRoom(roomId, participantName) {
const client = requireSupabase()

const trimmedRoomId = roomId.trim()
let room = null

if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedRoomId)) {
 const roomById = unwrap(
   await client
     .from('rooms')
   .select('id,name')
     .eq('id', trimmedRoomId)
     .maybeSingle()
 )
 room = roomById
}

if (!room) {
 const roomResult = await client
   .from('rooms')
   .select('id,name')
   .eq('name', trimmedRoomId)
   .limit(2)

 const rooms = unwrap(roomResult)

 if (!rooms || rooms.length === 0) {
   throw new Error('لم يتم العثور على ختمة بهذا الاسم.')
 }

 if (rooms.length > 1) {
   throw new Error('يوجد أكثر من ختمة بهذا الاسم. اختر اسمًا مختلفًا.')
 }

 room = rooms[0]
}

const result = unwrap(
await client.rpc('join_room', {
target_room_id: room.id,
participant_name: participantName,
room_password: null,
})
)

const session = {
...result,
name: participantName,
}

const savedOwnerToken = localStorage.getItem(ownerRecoveryKey(room.id))
const savedOwnerName = localStorage.getItem(ownerRecoveryNameKey(room.id))
if (
  !session.owner_token &&
  savedOwnerToken &&
  savedOwnerName?.trim().toLocaleLowerCase() === participantName.trim().toLocaleLowerCase()
) {
  session.owner_token = savedOwnerToken
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
    'id,room_id,part_number,status,participant_id,reading_type,child_name,started_at,completed_at'
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
  readingType: part.reading_type,
  childName: part.child_name || null,
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

export async function claimPart(
  roomId,
  partNumber,
  readingType = 'self',
  childName = null
) {
  const session = getSession(roomId)

  if (!session) {
    throw new Error('انتهت جلسة الغرفة.')
  }

  const params = {
    target_room_id: roomId,
    target_participant_id: session.participant_id,
    session_token: session.session_token,
    requested_part: partNumber,
    requested_reading_type: readingType,
  }

  if (childName) {
    params.requested_child_name = childName
  }

  return unwrap(
    await requireSupabase().rpc('claim_part', params)
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
message,
senderName
) {
const client = requireSupabase()
const params = {
target_room_id: roomId,
target_participant_id: participantId,
session_token: sessionToken,
message_text: message,
}

const resultWithSenderName = await client.rpc('send_message', {
  ...params,
  sender_name: senderName,
})

if (resultWithSenderName.error?.code === 'PGRST202') {
  return unwrap(await client.rpc('send_message', params))
}

return unwrap(resultWithSenderName)
}

export async function updateParticipantName(roomId, name) {
  const session = getSession(roomId)

  if (!session) {
    throw new Error('انتهت جلسة الغرفة. أعد الانضمام قبل تغيير الاسم.')
  }

  const result = await requireSupabase().rpc('update_participant_name', {
    target_room_id: roomId,
    target_participant_id: session.participant_id,
    session_token: session.session_token,
    new_name: name,
  })

  if (result.error?.code === 'PGRST202') {
    throw new Error('لتفعيل حفظ الاسم، شغّل supabase/update-participant-name.sql في SQL Editor.')
  }

  unwrap(result)
  saveSession(roomId, { ...session, name })
}

export async function leaveRoom(roomId) {
const session = getSession(roomId)

if (!session) {
return
}

if (session.owner_token) {
  localStorage.setItem(ownerRecoveryKey(roomId), session.owner_token)
  localStorage.setItem(ownerRecoveryNameKey(roomId), session.name)
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
localStorage.removeItem(ownerRecoveryKey(roomId))
localStorage.removeItem(ownerRecoveryNameKey(roomId))
}

export function subscribeToRoom(roomId, onChange) {
const client = requireSupabase()

const channel = client
.channel('room-' + roomId + '-' + ++roomSubscriptionId)

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
