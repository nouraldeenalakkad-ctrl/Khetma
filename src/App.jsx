import { useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { BookOpen } from 'lucide-react'

import {
  claimPart,
  completePart,
  createRoom,
  deleteRoom,
  getRoomState,
  getSession,
  joinRoom,
  leaveRoom,
  sendMessage,
  subscribeToRoom,
} from './lib/roomApi'

import './App.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

const quranPdfPath = (partNumber) =>
  `/quran/juz-${String(partNumber).padStart(2, '0')}.pdf`

const getNextAvailablePart = (parts) => {
  const nextAvailable = parts.find(
    (part) => part.status === 'available',
  )

  if (nextAvailable) return nextAvailable.number

  const firstClaimableLocked = parts.find(
    (part, index) =>
      part.status === 'locked' &&
      parts
        .slice(0, index)
        .every((previousPart) => previousPart.status !== 'locked'),
  )

  return firstClaimableLocked?.number || null
}

function HomePage() {
  return (
    <div className="page-shell">
      <main className="home-card">
        <div className="brand-mark" aria-label="شعار خَتْمَة">
          <img
            src="/logo.png"
            alt="شعار خَتْمَة"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
              event.currentTarget.nextElementSibling.style.display = 'block'
            }}
          />
          <BookOpen className="logo-fallback" size={34} strokeWidth={1.8} aria-hidden="true" />
        </div>

        <p className="eyebrow">اجعل لك في القرآن نصيبًا</p>

        <h1>خَتْمَة</h1>

        <p className="verse">
          ﴿وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ
          فَهَلْ مِن مُّدَّكِرٍ﴾
        </p>

        <div className="home-actions">
          <Link
            to="/create"
            className="primary-button"
          >
            إنشاء ختمة
          </Link>

          <Link
            to="/join"
            className="secondary-button"
          >
            الانضمام للختمة الحالية
          </Link>
        </div>

        <p className="footer-text">
          صُنع من نور الدين
        </p>
      </main>
    </div>
  )
}

function CreateRoomPage() {
  const navigate = useNavigate()

  const [roomName, setRoomName] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (roomName.trim().length < 2) {
      setError('اسم الختمة يجب أن يكون حرفين على الأقل.')
      return
    }

    if (participantName.trim().length < 2) {
      setError('اسمك يجب أن يكون حرفين على الأقل.')
      return
    }

    if (password.length < 4) {
      setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل.')
      return
    }

    setLoading(true)

    try {
      const result = await createRoom(
        roomName.trim(),
        participantName.trim(),
        password,
      )

      navigate(`/room/${result.room_id}`)
    } catch (reason) {
      setError(
        reason?.message ||
          'تعذر إنشاء الختمة.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell small-shell">
      <div className="card-box">
        <Link to="/" className="back-link">
          ← الرئيسية
        </Link>

        <h1>إنشاء ختمة</h1>

        <p className="muted-text">
          أنشئ غرفة وشارك الرابط مع من تريد أن يشاركك الختمة.
        </p>

        <form onSubmit={onSubmit} className="form-stack">
          <label>
            اسم الختمة
            <input
              value={roomName}
              onChange={(event) =>
                setRoomName(event.target.value)
              }
              placeholder="مثلاً: ختمة العائلة"
            />
          </label>

          <label>
            اسمك
            <input
              value={participantName}
              onChange={(event) =>
                setParticipantName(event.target.value)
              }
              placeholder="اكتب اسمك"
            />
          </label>

          <label>
            كلمة مرور الختمة
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="4 أحرف على الأقل"
            />
          </label>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? 'جاري الإنشاء...'
              : 'إنشاء الختمة'}
          </button>
        </form>
      </div>
    </div>
  )
}

function JoinRoomPage({
  initialRoomId = '',
}) {
  const navigate = useNavigate()

  const [roomId, setRoomId] = useState(initialRoomId)
  const [participantName, setParticipantName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!roomId.trim()) {
      setError('أدخل رابط أو معرف الختمة.')
      return
    }

    if (participantName.trim().length < 2) {
      setError('اسمك يجب أن يكون حرفين على الأقل.')
      return
    }

    if (!password) {
      setError('اكتب كلمة المرور.')
      return
    }

    setLoading(true)

    try {
      const result = await joinRoom(
        roomId.trim(),
        participantName.trim(),
        password,
      )

      navigate(`/room/${result.room_id}`)
    } catch (reason) {
      setError(reason?.message || 'تعذر الانضمام إلى الختمة.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell small-shell">
      <div className="card-box">
        <Link to="/" className="back-link">
          ← الرئيسية
        </Link>

        <h1>الانضمام للختمة الحالية</h1>

        <p className="muted-text">
          أدخل رابط الختمة أو معرفها، ثم اسمك وكلمة المرور.
        </p>

        <form onSubmit={onSubmit} className="form-stack">
          <label>
            رابط أو معرف الختمة
            <input
              value={roomId}
              onChange={(event) =>
                setRoomId(event.target.value)
              }
              placeholder="معرف الختمة"
            />
          </label>

          <label>
            اسمك
            <input
              value={participantName}
              onChange={(event) =>
                setParticipantName(event.target.value)
              }
              placeholder="اكتب اسمك"
            />
          </label>

          <label>
            كلمة المرور
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="كلمة المرور"
            />
          </label>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? 'جاري الانضمام...'
              : 'الانضمام'}
          </button>
        </form>
      </div>
    </div>
  )
}

function RoomRoute() {
  const { roomId } = useParams()
  const session = getSession(roomId)

  if (!session) {
    return (
      <JoinRoomPage
        initialRoomId={roomId}
      />
    )
  }

  return (
    <RoomPage
      roomId={roomId}
      currentUser={session.name}
    />
  )
}

function RoomPage({
  roomId,
  currentUser,
}) {
  const navigate = useNavigate()

  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const session = getSession(roomId)
  const isCreator = Boolean(
    session?.owner_token,
  )

  useEffect(() => {
    let active = true
    const refreshRoom = async () => {
      try {
        const data = await getRoomState(roomId)
        if (active) setRoom(data)
      } catch (reason) {
        if (active) setError(reason?.message || 'تعذر تحميل الختمة.')
      } finally {
        if (active) setLoading(false)
      }
    }

    refreshRoom()

    const unsubscribe =
      subscribeToRoom(roomId, () => {
        refreshRoom()
      })

    return () => {
      active = false
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [roomId])

  const completion = room
    ? Math.round(
        (
          room.parts.filter(
            (part) =>
              part.status === 'completed',
          ).length / 30
        ) * 100,
      )
    : 0

  const nextAvailable = room
    ? getNextAvailablePart(room.parts)
    : 1

  const copyRoomLink = async () => {
    const roomLink = `${window.location.origin}/room/${roomId}`

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(roomLink)
      } else {
        const helper = document.createElement('textarea')
        helper.value = roomLink
        helper.setAttribute('readonly', '')
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.appendChild(helper)
        helper.select()
        document.execCommand('copy')
        helper.remove()
      }
      setLinkCopied(true)
      setError('')
      window.setTimeout(() => setLinkCopied(false), 3500)
    } catch (reason) {
      setError(reason?.message || 'تعذر نسخ الرابط. انسخه يدويًا من شريط العنوان.')
    }
  }

  const onLeave = async () => {
    if (!session) return

    try {
      await leaveRoom(
        roomId,
        session.participant_id,
        session.session_token,
      )

      navigate('/')
    } catch (reason) {
      setError(
        reason?.message ||
          'تعذر مغادرة الختمة.',
      )
    }
  }

  const onDelete = async () => {
    if (!session?.owner_token) return

    const confirmed = window.confirm(
      'هل تريد حذف الختمة نهائيًا؟',
    )

    if (!confirmed) return

    try {
      await deleteRoom(
        roomId,
        session.owner_token,
      )

      navigate('/')
    } catch (reason) {
      setError(
        reason?.message ||
          'تعذر حذف الختمة.',
      )
    }
  }

  const onSendMessage = async (event) => {
    event.preventDefault()

    const text = message.trim()

    if (!text || !session) return

    setSending(true)
    setError('')

    try {
      await sendMessage(
        roomId,
        session.participant_id,
        session.session_token,
        text,
      )

      setMessage('')
      const updatedRoom = await getRoomState(roomId)
      setRoom(updatedRoom)
    } catch (reason) {
      setError(
        reason?.message ||
          'تعذر إرسال الرسالة.',
      )
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <div className="loading-state">
            جاري تحميل الختمة...
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <h2>تعذر تحميل الختمة</h2>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <Link
            to="/"
            className="back-link"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell room-shell">
      <header className="room-header">
        <div>
          <Link
            to="/"
            className="brand-small"
          >
            خَتْمَة
          </Link>

          <h1>{room.name}</h1>

          <p>
            أهلاً {currentUser}
          </p>
        </div>

        <div className="room-actions">
          <button
            type="button"
            className={linkCopied ? 'copied-button' : 'secondary-button'}
            onClick={copyRoomLink}
          >
            {linkCopied ? 'تم نسخ الرابط شاركه!' : 'مشاركة'}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setChatOpen(
                (value) => !value,
              )
            }
          >
            {chatOpen
              ? 'إخفاء الدردشة'
              : 'إظهار الدردشة'}
          </button>

          {isCreator && (
            <button
              type="button"
              className="danger-button"
              onClick={onDelete}
            >
              حذف الختمة
            </button>
          )}

          <button
            type="button"
            className="secondary-button"
            onClick={onLeave}
          >
            خروج
          </button>
        </div>
      </header>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      <div className="progress-card">
        <div className="progress-top">
          <strong>
            تقدم الختمة
          </strong>

          <span>{completion}%</span>
        </div>

        <div className="progress-track">
          <div
            className="progress-value"
            style={{
              width: `${completion}%`,
            }}
          />
        </div>

        {room.status === 'completed' && (
          <div className="success-box">
            تمت الختمة بنجاح 🎉
          </div>
        )}
      </div>

      <main
        className={
          chatOpen
            ? 'room-layout with-chat'
            : 'room-layout'
        }
      >
        <section className="parts-section">
          <div className="section-heading">
            <div>
              <h2>أجزاء القرآن</h2>
              <p>
                ابدأ من الجزء المتاح، ويصبح الجزء التالي
                متاحًا فور حجزه.
              </p>
            </div>

            {nextAvailable && (
              <span className="next-part">
                الجزء التالي: {nextAvailable}
              </span>
            )}
          </div>

          <div className="parts-grid">
            {room.parts.map((part) => {
              const isAvailable =
                part.number === nextAvailable &&
                (part.status === 'available' ||
                  part.status === 'locked')

              const isReading =
                part.status === 'reading'

              const isCompleted =
                part.status === 'completed'

              const isLocked =
                part.status === 'locked'

              const stateClass =
                isCompleted
                  ? 'done'
                  : isReading
                    ? 'taken'
                    : isAvailable
                      ? 'available'
                      : 'locked'

              const disabled =
                (part.status === 'locked' &&
                  part.number !== nextAvailable) ||
                (part.status === 'available' &&
                  part.number !== nextAvailable)

              return (
                <button
                  key={part.number}
                  type="button"
                  className={`part-card ${stateClass}`}
                  disabled={disabled}
                  onClick={() =>
                    navigate(
                      `/room/${roomId}/part/${part.number}`,
                    )
                  }
                >
                  <span className="part-number">
                    {part.number}
                  </span>

                  <span className="part-title">
                    الجزء {part.number}
                  </span>

                  {isCompleted && (
                    <>
                      <span className="part-status">
                        ✓ مكتمل
                      </span>
                      <span className="part-status">
                        قرأه: {part.reader || 'مشارك'}
                      </span>
                    </>
                  )}

                  {isReading && (
                    <span className="part-status">
                      يقرأه{' '}
                      {part.reader ||
                        'مشارك'}
                    </span>
                  )}

                  {isAvailable && (
                    <span className="part-status">
                      متاح للقراءة
                    </span>
                  )}

                  {isLocked && (
                    <span className="part-status">
                      مقفل
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {chatOpen && (
          <aside className="chat-panel">
            <div className="chat-header">
              <h2>الدردشة</h2>
              <span>
                {room.participants.length}{' '}
                مشارك
              </span>
            </div>

            <div className="participants-list">
              {room.participants.map(
                (participant) => (
                  <span
                    key={participant.id}
                    className="participant-chip"
                  >
                    {participant.name}
                  </span>
                ),
              )}
            </div>

            <div className="messages-list">
              {room.messages.length === 0 ? (
                <div className="empty-chat">
                  لا توجد رسائل بعد.
                </div>
              ) : (
                room.messages.map(
                  (item) => (
                    <div
                      key={item.id}
                      className={
                        item.participant_id ===
                        session?.participant_id
                          ? 'message own-message'
                          : 'message'
                      }
                    >
                      <strong>
                        {item.sender_name ||
                          'مشارك'}
                      </strong>

                      <p>
                        {item.message}
                      </p>
                    </div>
                  ),
                )
              )}
            </div>

            <form
              onSubmit={onSendMessage}
              className="chat-form"
            >
              <input
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value,
                  )
                }
                placeholder="اكتب رسالة..."
                maxLength={1000}
              />

              <button
                type="submit"
                className={
                  message.trim()
                    ? 'primary-button'
                    : 'send-disabled'
                }
                disabled={
                  !message.trim() ||
                  sending
                }
              >
                إرسال
              </button>
            </form>
          </aside>
        )}
      </main>
    </div>
  )
}

function PartRoute() {
  const { roomId } = useParams()
  const session = getSession(roomId)

  if (!session) {
    return (
      <Navigate
        to={`/room/${roomId}`}
        replace
      />
    )
  }

  return (
    <PartPage
      currentUser={session.name}
    />
  )
}

function PartPage({
  currentUser,
}) {
  const { roomId, partNumber } =
    useParams()

  const navigate = useNavigate()

  const [seconds, setSeconds] =
    useState(0)

  const [isRunning, setIsRunning] =
    useState(false)

  const [showDua, setShowDua] =
    useState(false)

  const [pdfPages, setPdfPages] =
    useState(0)

  const [pdfPage, setPdfPage] =
    useState(1)

  const [pdfScale, setPdfScale] =
    useState(0.8)

  const [room, setRoom] =
    useState(null)

  const [error, setError] =
    useState('')

  const [finishing, setFinishing] =
    useState(false)

  const numericPartNumber =
    Number(partNumber)

  useEffect(() => {
    let cancelled = false

    getRoomState(roomId)
      .then(async (data) => {
        if (cancelled) return

        const targetPart = data.parts.find(
          (item) => item.number === numericPartNumber,
        )
        const nextPart = getNextAvailablePart(data.parts)

        if (targetPart?.status === 'reading' && targetPart.reader === currentUser) {
          setRoom(data)
          setIsRunning(true)
          return
        }

        if (
          (targetPart?.status === 'available' ||
            targetPart?.status === 'locked') &&
          targetPart.number === nextPart
        ) {
          try {
            await claimPart(roomId, numericPartNumber)
            const claimedRoom = await getRoomState(roomId)
            if (!cancelled) {
              setRoom(claimedRoom)
              setIsRunning(true)
            }
            return
          } catch (reason) {
            if (!cancelled) {
              setError(reason?.message || 'تعذر بدء قراءة الجزء. أعد المحاولة.')
            }
          }
        }

        if (!cancelled) setRoom(data)
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason?.message ||
              'تعذر تحميل الجزء.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [roomId, numericPartNumber, currentUser])

  useEffect(() => {
    if (!isRunning) {
      return undefined
    }

    const timer =
      window.setInterval(() => {
        setSeconds(
          (value) => value + 1,
        )
      }, 1000)

    return () =>
      window.clearInterval(timer)
  }, [isRunning])

  const part = useMemo(
    () =>
      room?.parts.find(
        (item) =>
          item.number ===
          numericPartNumber,
      ),
    [room, numericPartNumber],
  )

  const isCompleted =
    part?.status === 'completed'

  const isReading =
    part?.status === 'reading'

  const isMyPart =
    isReading &&
    part?.reader === currentUser

  const formatTime = (
    totalSeconds,
  ) => {
    const hours =
      Math.floor(
        totalSeconds / 3600,
      )

    const minutes =
      Math.floor(
        (totalSeconds % 3600) /
          60,
      )

    const secs =
      totalSeconds % 60

    return [
      hours > 0
        ? String(hours).padStart(
            2,
            '0',
          )
        : null,

      String(minutes).padStart(
        2,
        '0',
      ),

      String(secs).padStart(
        2,
        '0',
      ),
    ]
      .filter(Boolean)
      .join(':')
  }

  const onFinish = async () => {
    if (!part || !isMyPart) {
      return
    }

    setError('')
    setIsRunning(false)
    setFinishing(true)

    try {
      await completePart(
        roomId,
        part.number,
      )

      // The room page reloads the completed state from Supabase.
      navigate(`/room/${roomId}`, { replace: true })
    } catch (reason) {
      setError(
        reason?.message ||
          'تعذر إنهاء الجزء.',
      )
    } finally {
      setFinishing(false)
    }
  }

  const resetTimer = () => {
    setIsRunning(false)
    setSeconds(0)
  }

  const onDocumentLoadSuccess =
    ({ numPages }) => {
      setPdfPages(numPages)
      setPdfPage(1)
    }

  const previousPage = () => {
    setPdfPage(
      (page) =>
        Math.max(1, page - 1),
    )
  }

  const nextPage = () => {
    setPdfPage(
      (page) =>
        Math.min(
          pdfPages || page,
          page + 1,
        ),
    )
  }

  const canFinish = Boolean(
    isMyPart && pdfPages > 0 && pdfPage >= pdfPages,
  )

  /*
   * مهم:
   * لا نرجع للرئيسية أثناء تحميل الغرفة.
   */
  if (!room) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <div className="loading-state">
            جاري تحميل الجزء...
          </div>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!part) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <h2>
            الجزء غير موجود
          </h2>

          <p>
            تعذر العثور على الجزء رقم{' '}
            {numericPartNumber}.
          </p>

          <Link
            to={`/room/${roomId}`}
            className="back-link"
          >
            العودة إلى الغرفة
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell reader-shell">
      <header className="reader-header">
        <button
          type="button"
          className="back-button"
          onClick={() =>
            navigate(
              `/room/${roomId}`,
            )
          }
        >
          ← العودة
        </button>

        <div className="reader-title">
          <span>خَتْمَة</span>

          <h1>
            الجزء {part.number}
          </h1>
        </div>

        <div className="reader-timer">
          {formatTime(seconds)}
        </div>
      </header>

      {error && (
        <div className="error-box reader-error">
          {error}
        </div>
      )}

      <main className="reader-content">
        <section className="reader-pdf-card">
          <div className="reader-toolbar">
            <button
              type="button"
              onClick={
                previousPage
              }
              disabled={
                pdfPage <= 1
              }
            >
              الصفحة السابقة
            </button>

            <span>
              صفحة {pdfPage}
              {pdfPages
                ? ` من ${pdfPages}`
                : ''}
            </span>

            <button
              type="button"
              onClick={nextPage}
              disabled={
                !pdfPages ||
                pdfPage >= pdfPages
              }
            >
              الصفحة التالية
            </button>

            <button
              type="button"
              onClick={() =>
                setPdfScale(
                  (value) =>
                    Math.min(
                      1.5,
                      value + 0.1,
                    ),
                )
              }
            >
              +
            </button>

            <button
              type="button"
              onClick={() =>
                setPdfScale(
                  (value) =>
                    Math.max(
                      0.5,
                      value - 0.1,
                    ),
                )
              }
            >
              −
            </button>

            <button
              type="button"
              onClick={() =>
                setPdfScale(0.8)
              }
            >
              ملاءمة
            </button>
          </div>

          <div className="pdf-viewer">
            <Document
              file={quranPdfPath(
                part.number,
              )}
              onLoadSuccess={
                onDocumentLoadSuccess
              }
              loading={
                <div className="loading-state">
                  جاري تحميل القرآن...
                </div>
              }
              error={
                <div className="error-box">
                  تعذر تحميل ملف القرآن.
                </div>
              }
            >
              <Page
                pageNumber={pdfPage}
                scale={pdfScale}
                renderTextLayer
                renderAnnotationLayer
              />
            </Document>
          </div>
        </section>

        <aside className="reader-side-panel">
          <div className="card-box">
            <h2>
              الجزء {part.number}
            </h2>

            {isCompleted && (
              <div className="success-box">
                ✓ تم إكمال هذا الجزء
                {part.reader
                  ? ` بواسطة ${part.reader}`
                  : ''}
              </div>
            )}

            {isReading &&
              !isMyPart && (
                <div className="warning-box">
                  هذا الجزء يقرأه حاليًا:
                  <strong>
                    {part.reader ||
                      'مشارك آخر'}
                  </strong>
                </div>
              )}

            {!isCompleted &&
              !isReading && (
                <div className="info-box">
                  جاري فتح الجزء وبدء المؤقت...
                </div>
              )}

            {isMyPart && (
              <div className="reading-box">
                أنت تقرأ هذا الجزء الآن.
              </div>
            )}

            <div className="timer-box">
              <div className="timer-value">
                {formatTime(seconds)}
              </div>

              <div className="timer-actions">
                {isMyPart && (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        setIsRunning(
                          (value) =>
                            !value,
                        )
                      }
                    >
                      {isRunning
                        ? 'إيقاف المؤقت'
                        : 'متابعة'}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={
                        resetTimer
                      }
                    >
                      إعادة ضبط المؤقت
                    </button>

                  </>
                )}

                {!isCompleted && (
                  <button
                    type="button"
                    className={canFinish ? 'success-button finish-button-ready' : 'success-button finish-button'}
                    onClick={onFinish}
                    disabled={!canFinish || finishing}
                  >
                    {finishing ? 'جاري إنهاء الجزء...' : 'تم إنهاء الجزء'}
                  </button>
                )}
              </div>
            </div>

            <div className="reader-note">
              <strong>
                تنبيه:
              </strong>

              <p>
                لن يتم إنهاء الجزء
                تلقائيًا عند الوصول
                إلى آخر صفحة. اضغط
                «تم قراءة الجزء» بعد
                الانتهاء فعليًا.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {showDua && (
        <div className="modal-overlay">
          <div className="dua-modal">
            <h2>
              تمت الختمة بنجاح 🎉
            </h2>

            <p>
              الحمد لله الذي بنعمته
              تتم الصالحات.
            </p>

            <p>
              اللهم اجعل القرآن ربيع
              قلوبنا، ونور صدورنا،
              وجلاء أحزاننا، وذهاب
              همومنا.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setShowDua(false)
              }
            >
              تم
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/create"
          element={<CreateRoomPage />}
        />

        <Route
          path="/join"
          element={<JoinRoomPage />}
        />

        <Route
          path="/room/:roomId"
          element={<RoomRoute />}
        />

        <Route
          path="/room/:roomId/part/:partNumber"
          element={<PartRoute />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App