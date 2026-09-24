import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
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

const quranPdfPath = (partNumber) => {
  const fileNumber = partNumber >= 10 && partNumber < 30
    ? partNumber + 1
    : partNumber
  const filename = partNumber === 9
    ? 'juzz9.pdf'
    : `juz-${String(fileNumber).padStart(2, '0')}.pdf`

  return `/quran/${filename}?v=20260924-${partNumber}`
}

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
          تصميم نور الدين
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
          أنشئ جلسة وشارك الرابط مع من تريد أن يشاركك الختمة.
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
              : 'ابدأ الختمة'}
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
              placeholder="اسم الجلسة أو رابطها"
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

  const [isReaderOpen, setIsReaderOpen] =
    useState(false)

  const [confirmPartOpen, setConfirmPartOpen] =
    useState(false)

  const [isPdfOpen, setIsPdfOpen] =
    useState(false)

  const pdfOpenRef = useRef(false)

  const [showDua, setShowDua] =
    useState(false)

  const [pdfPages, setPdfPages] =
    useState(false)

  const [room, setRoom] =
    useState(null)

  const [error, setError] =
    useState('')

  const [finishing, setFinishing] =
    useState(false)

  const numericPartNumber =
    Number(partNumber)

  useEffect(() => {
    pdfOpenRef.current = isPdfOpen
  }, [isPdfOpen])

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
          setIsReaderOpen(true)
          return
        }

        if (
          (targetPart?.status === 'available' ||
            targetPart?.status === 'locked') &&
          targetPart.number === nextPart
        ) {
          setRoom(data)
          setConfirmPartOpen(true)
          return
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
    if (!isReaderOpen) return undefined

    window.history.pushState(
      { readerModal: true, pdfOpen: false },
      '',
      window.location.href,
    )

    const handleBack = () => {
      if (pdfOpenRef.current) {
        setIsPdfOpen(false)
        return
      }

      setIsReaderOpen(false)
    }

    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [isReaderOpen])

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

  const confirmReadPart = async () => {
    setConfirmPartOpen(false)
    setError('')

    try {
      await claimPart(roomId, numericPartNumber)
      const claimedRoom = await getRoomState(roomId)
      setRoom(claimedRoom)
      setIsReaderOpen(true)
    } catch (reason) {
      setError(reason?.message || 'تعذر بدء قراءة الجزء. أعد المحاولة.')
    }
  }

  const resetTimer = () => {
    setIsRunning(false)
    setSeconds(0)
  }

  const onPdfLoad = () => setPdfPages(true)

  const canFinish = Boolean(
    isMyPart && pdfPages,
  )

  /*
   * مهم:
  * لا نرجع للرئيسية أثناء تحميل الجلسة.
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
            العودة إلى الجلسة
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

      </header>

      {error && (
        <div className="error-box reader-error">
          {error}
        </div>
      )}

      {isMyPart && !isReaderOpen && (
        <section className="reader-start-card">
          <h2>الجزء {part.number} جاهز للقراءة</h2>
          <p>اضغط بدء القراءة لفتح المصحف وتشغيل المؤقت.</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setIsReaderOpen(true)
              setIsRunning(true)
            }}
          >
            بدء القراءة
          </button>
        </section>
      )}

      {!isMyPart && !isReaderOpen && (
        <section className="reader-start-card">
          {isCompleted ? (
            <>
              <h2>تم إكمال الجزء</h2>
              <p>
                قرأه {part.reader || 'مشارك'}
              </p>
            </>
          ) : (
            <>
              <h2>الجزء قيد القراءة</h2>
              <p>
                يقرأه حاليًا {part.reader || 'مشارك آخر'}
              </p>
            </>
          )}
        </section>
      )}

      {confirmPartOpen && part && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h2>هل تريد قراءة الجزء {part.number}؟</h2>
            <p>سيتم حجز هذا الجزء باسمك ويمكنك قراءته الآن.</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="primary-button"
                onClick={confirmReadPart}
              >
                نعم
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate(`/room/${roomId}`)}
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

      {isReaderOpen && (
        <div className="modal-overlay reader-modal-overlay">
          <div className="reader-modal">
            <div className="reader-modal-top">
              <div className="reader-timer">
                {formatTime(seconds)}
              </div>

              {isMyPart && !isPdfOpen && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setIsPdfOpen(true)
                    setIsRunning(true)
                  }}
                >
                  بدء القراءة
                </button>
              )}

              {isPdfOpen && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsPdfOpen(false)}
                >
                  العودة
                </button>
              )}
            </div>

            <main className="reader-content">
        {isPdfOpen && (
          <section className="reader-pdf-card reader-file-card">
            <div className="pdf-viewer">
              <iframe
                title={`الجزء ${part.number}`}
                src={quranPdfPath(part.number)}
                loading="lazy"
                onLoad={onPdfLoad}
              />
            </div>
          </section>
        )}

        {!isPdfOpen && (
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
                      onClick={() => {
                        setIsPdfOpen(true)
                        setIsRunning(true)
                      }}
                    >
                      بدء القراءة
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
                    {finishing ? 'جاري إنهاء الجزء...' : 'تم قراءة الجزء'}
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
        )}
            </main>

            <button
              type="button"
              className="secondary-button reader-modal-close"
              onClick={() => setIsReaderOpen(false)}
            >
              إغلاق نافذة القراءة
            </button>
          </div>
        </div>
      )}

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