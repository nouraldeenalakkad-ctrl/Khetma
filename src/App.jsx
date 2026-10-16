import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserRouter, Link, Navigate, Route, Routes,
  useNavigate, useParams,
} from 'react-router-dom'
import { BookOpen, Download } from 'lucide-react'
import {
  claimPart, completePart, createRoom, deleteRoom,
  getRoomState, getSession, joinRoom, leaveRoom,
  sendMessage, subscribeToRoom, updateParticipantName,
} from './lib/roomApi'
import './App.css'

const quranPdfPath = (n) => `/quran/juz${n}.pdf?v=20260925-${n}`
const getReservationName = (part) => part?.childName || part?.reader || ''


/* ═══════════ HomePage ═══════════ */
function HomePage() {
  return (
    <div className="page-shell home-shell">
      <main className="home-card">
        <div className="brand-mark" aria-label="logo">
          <img
            src="/logo-khetma-emerald.png"
            alt="شعار خِتْمَة: مصحف على حامل ضمن محراب أخضر وذهبي"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              if (e.currentTarget.nextElementSibling)
                e.currentTarget.nextElementSibling.style.display = 'block'
            }}
          />
          <BookOpen className="logo-fallback" size={34} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="eyebrow">اجعل لك نصيبًا من القرآن</p>
        <h1>خِتْمَة</h1>
        <p className="verse">
          وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ
        </p>
        <div className="home-actions">
          <Link to="/create" className="primary-button">✨ إنشاء ختمة جديدة</Link>
          <Link to="/join" className="secondary-button">الانضمام للختمة الحالية</Link>
        </div>
        <p className="footer-text">تصميم نور الدين</p>
        <InstallAppButton />
      </main>
    </div>
  )
}

function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true,
  )
  const [message, setMessage] = useState('')

  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const markInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      setMessage('تم تثبيت خِتْمَة على جهازك.')
    }

    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  const install = async () => {
    if (installed) return

      if (!installPrompt) {
        const userAgent = window.navigator.userAgent
        const isAndroid = /android/i.test(userAgent)
        const isEmbeddedBrowser = /;\s*wv\)|\bwv\b|FBAN|FBAV|Instagram|Line\//i.test(userAgent)

        if (isAndroid && isEmbeddedBrowser) {
          const targetUrl = 'https://khetma-web.pages.dev/'
          const fallbackUrl = encodeURIComponent(targetUrl)
          window.location.href = `intent://khetma-web.pages.dev/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallbackUrl};end`
          return
        }

        setMessage('التثبيت غير متاح في هذا المتصفح. افتح الموقع في Chrome ليظهر خيار التثبيت مباشرةً.')
        return
      }

    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    setInstallPrompt(null)
    setMessage(outcome === 'accepted'
      ? 'بدأ تثبيت خِتْمَة على جهازك.'
      : 'يمكنك تثبيت خِتْمَة لاحقًا من قائمة Chrome ⋮.',
    )
  }

  return (
    <div className="install-app-wrap">
      <button
        type="button"
        className="install-app-button"
        onClick={install}
        aria-label={installed ? 'تم تثبيت خِتْمَة' : 'Install | تنزيل خِتْمَة على الجوال'}
        disabled={installed}
      >
        <Download size={18} aria-hidden="true" />
        <span>{installed ? 'Installed | مثبّت' : 'Install | تنزيل'}</span>
      </button>
      {message && <p className="install-app-message" role="status">{message}</p>}
    </div>
  )
}


/* ═══════════ CreateRoomPage ═══════════ */
function CreateRoomPage() {
  const navigate = useNavigate()
  const [roomName, setRoomName] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (roomName.trim().length < 2 || participantName.trim().length < 2) {
      setError('أدخل اسم الختمة واسمك، على أن يتكون كل منهما من حرفين على الأقل.')
      return
    }
    if (participantName.trim().length > 80) {
      setError('الاسم يجب ألا يتجاوز 80 حرفًا.')
      return
    }
    setLoading(true)
    try {
      const result = await createRoom(roomName.trim(), participantName.trim())
      navigate(`/room/${result.room_id}`)
    } catch (err) {
      setError(err?.message || 'تعذّر إنشاء الختمة.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell small-shell">
      <div className="card-box">
        <Link to="/" className="back-link">الرئيسية</Link>
        <h1>إنشاء ختمة ✨</h1>
        <p className="muted-text">أنشئ ختمة جديدة.</p>
        <form onSubmit={onSubmit} className="form-stack">
          <label>
            اسم الختمة
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder=""
              maxLength={120}
              autoFocus
            />
          </label>
          <label>
            اسمك
            <input
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="اكتب اسمك"
              maxLength={80}
              autoComplete="name"
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'جاري الإنشاء...' : 'إنشاء الختمة'}
          </button>
        </form>
      </div>
    </div>
  )
}


/* ═══════════ JoinRoomPage ═══════════ */
function JoinRoomPage({ initialRoomId = '' }) {
  const navigate = useNavigate()
  const [roomId, setRoomId] = useState(initialRoomId)
  const [participantName, setParticipantName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!roomId.trim() || participantName.trim().length < 2) {
      setError('أدخل اسم الختمة واسمك (حرفين على الأقل).')
      return
    }
    if (participantName.trim().length > 80) {
      setError('الاسم يجب ألا يتجاوز 80 حرفًا.')
      return
    }
    setLoading(true)
    try {
      const result = await joinRoom(roomId.trim(), participantName.trim())
      navigate(`/room/${result.room_id}`)
    } catch (err) {
      setError(err?.message || 'تعذّر الانضمام إلى الختمة.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell small-shell">
      <div className="card-box">
        <Link to="/" className="back-link">الرئيسية</Link>
        <h1>الانضمام إلى ختمة قائمة 🔗</h1>
        <p className="muted-text">أدخل اسم الختمة أو معرّفها، ثم اكتب اسمك.</p>
        <form onSubmit={onSubmit} className="form-stack">
          <label>
            اسم الختمة أو معرّفها
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="اسم الختمة أو معرّفها"
              autoFocus
            />
          </label>
          <label>
            اسمك
            <input
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="اكتب اسمك"
              maxLength={80}
              autoComplete="name"
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'جاري الانضمام...' : 'انضمام'}
          </button>
        </form>
      </div>
    </div>
  )
}


/* ═══════════ RoomRoute ═══════════ */
function RoomRoute() {
  const { roomId } = useParams()
  const session = getSession(roomId)
  if (!session) return <JoinRoomPage initialRoomId={roomId} />
  return <RoomPage roomId={roomId} session={session} />
}


/* ═══════════ RoomPage ═══════════ */
function RoomPage({ roomId, session }) {
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)

  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('parts')
  const [chatName, setChatName] = useState(session?.name || '')
  const [confirmedName, setConfirmedName] = useState(session?.name || '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [showDua, setShowDua] = useState(false)
  const [claimPartNumber, setClaimPartNumber] = useState(null)
  const [claimReadingType, setClaimReadingType] = useState('self')
  const [reservationName, setReservationName] = useState('')
  const [claiming, setClaiming] = useState(false)

  const isCreator = Boolean(session?.owner_token)

  const copyInvite = async () => {
    const invite = [
      `${window.location.origin}/room/${roomId}`,
      `الختمة: ${room.name}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(invite)
      setInviteCopied(true)
      setError('')
    } catch {
      setError('تعذّر نسخ الدعوة. يمكنك نسخ رابط الختمة يدويًا.')
    }
  }

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const data = await getRoomState(roomId)
        if (active) { setRoom(data); setLoading(false) }
      } catch (err) {
        if (active) { setError(err?.message || 'تعذّر تحميل الختمة.'); setLoading(false) }
      }
    }
    refresh()
    let unsub
    Promise.resolve()
      .then(() => subscribeToRoom(roomId, refresh))
      .then((unsubscribe) => {
        if (active) {
          unsub = unsubscribe
        } else if (typeof unsubscribe === 'function') {
          unsubscribe()
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || 'تعذّر الاتصال بتحديثات الختمة.')
          setLoading(false)
        }
      })
    return () => {
      active = false
      if (typeof unsub === 'function') unsub()
    }
  }, [roomId])

  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current)
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [room?.messages?.length, activeTab])

  const uniqueParticipants = useMemo(() => {
    if (!room) return []
    return Array.from(new Set([
      ...room.participants.map((p) => p.name),
      ...room.parts.map((p) => getReservationName(p)).filter(Boolean),
    ]))
  }, [room])

  const completion = room
    ? Math.round((room.parts.filter((p) => p.status === 'completed').length / 30) * 100)
    : 0

  const openClaim = (part) => {
    setError('')
    setClaimPartNumber(part.number)
    setClaimReadingType('self')
    setReservationName(session?.name || '')
  }

  const closeClaim = () => {
    if (claiming) return
    setClaimPartNumber(null)
    setReservationName('')
    setError('')
  }

  const confirmClaim = async () => {
    const name = claimReadingType === 'child'
      ? reservationName.trim()
      : session?.name?.trim() || ''
    if (!name || name.length < 2 || name.length > 80) {
      setError('اكتب اسم القارئ (حرفان على الأقل).')
      return
    }
    if (!claimPartNumber) return
    setClaiming(true)
    setError('')
    try {
      await claimPart(
        roomId,
        claimPartNumber,
        claimReadingType,
        claimReadingType === 'child' ? name : null
      )
      setClaimPartNumber(null)
      setReservationName('')
      if (!chatName) setChatName(name)
      navigate(`/room/${roomId}/part/${claimPartNumber}`)
    } catch (err) {
      setError(err?.message || 'تعذّر حجز الجزء.')
    } finally {
      setClaiming(false)
    }
  }

  const onLeave = async () => {
    if (!session) return
    try { await leaveRoom(roomId); navigate('/') }
    catch (err) { setError(err?.message || 'تعذّر مغادرة الختمة.') }
  }

  const onDelete = async () => {
    if (!session?.owner_token) return
    if (!window.confirm('هل تريد حذف الختمة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.')) return
    try { await deleteRoom(roomId); navigate('/') }
    catch (err) { setError(err?.message || 'تعذّر حذف الختمة.') }
  }

  const onSaveName = async () => {
    const name = chatName.trim()
    if (name.length < 2 || name.length > 80) {
      setError('يجب أن يتراوح الاسم بين حرفين و80 حرفًا.')
      return
    }
    setSavingName(true)
    setError('')
    try {
      await updateParticipantName(roomId, name)
      setConfirmedName(name)
      setRoom(await getRoomState(roomId))
    } catch (err) {
      setError(err?.message || 'تعذّر حفظ الاسم.')
    } finally {
      setSavingName(false)
    }
  }

  const onSendMessage = async (e) => {
    e.preventDefault()
    const text = message.trim()
    if (!text || !session) return
    const name = chatName.trim()
    if (name.length < 2 || name.length > 80) {
      setError('اكتب اسمًا من حرفين إلى 80 حرفًا قبل إرسال رسالتك.')
      return
    }
    setSending(true)
    setError('')
    try {
      if (name !== getSession(roomId)?.name) {
        await updateParticipantName(roomId, name)
        setConfirmedName(name)
      }
      await sendMessage(roomId, session.participant_id, session.session_token, text, name)
      setMessage('')
      const updated = await getRoomState(roomId)
      setRoom(updated)
    } catch (err) {
      setError(err?.message || 'تعذّر إرسال الرسالة.')
    } finally {
      setSending(false)
    }
  }


  if (loading) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <div className="loading-state">جاري تحميل الختمة...</div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <h2>تعذر تحميل الختمة</h2>
          {error && <div className="error-box">{error}</div>}
          <Link to="/" className="back-link">العودة للرئيسية</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell room-shell">
      <header className="room-header">
        <div>
          <Link to="/" className="brand-small">خِتْمَة</Link>
          <h1>{room.name}</h1>
        </div>
        <div className="room-actions">
          <button type="button" className="secondary-button" onClick={copyInvite}>
            {inviteCopied ? 'نُسخ رابط الدعوة ✓' : 'مشاركة رابط الختمة'}
          </button>
          {isCreator && (
            <button type="button" className="danger-button" onClick={onDelete}>حذف</button>
          )}
          <button type="button" className="secondary-button" onClick={onLeave}>خروج</button>
        </div>
      </header>

      {error && <div className="error-box" style={{ margin: '0 0 12px' }}>{error}</div>}

      <div className="progress-card">
        <div className="progress-top">
          <strong>تقدم الختمة</strong>
          <span>{completion}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-value" style={{ width: `${completion}%` }} />
        </div>
        {room.status === 'completed' && (
          <div className="success-box">اكتملت الختمة بنجاح 🎉</div>
        )}
      </div>

      <div className="tabs-bar">
        <button
          type="button"
          className={activeTab === 'parts' ? 'tab-btn tab-active' : 'tab-btn'}
          onClick={() => setActiveTab('parts')}
        >
          📖 القراءة
        </button>
        <button
          type="button"
          className={activeTab === 'chat' ? 'tab-btn tab-active' : 'tab-btn'}
          onClick={() => setActiveTab('chat')}
        >
          💬 المحادثة
          {room.messages.length > 0 && (
            <span className="tab-badge">{room.messages.length}</span>
          )}
        </button>
      </div>

      <div className="tab-content">


        {activeTab === 'parts' && (
          <section className="parts-section">
            <div className="section-heading">
              <h2>أجزاء القرآن الكريم</h2>
              <p>اختر جزءًا متاحًا لبدء القراءة.</p>
            </div>
            <div className="parts-grid">
              {room.parts.map((part) => {
                const isReading = part.status === 'reading'
                const isCompleted = part.status === 'completed'
                const partReservationName = getReservationName(part)
                const isMyReservedPart =
                  isReading && part.participantId === session?.participant_id

                return (
                  <div
                    key={part.number}
                    className={
                      'part-card' +
                      (isCompleted ? ' completed' : '') +
                      (isReading ? ' reading' : '') +
                      (!isReading && !isCompleted ? ' available' : '')
                    }
                  >
                    <button
                      type="button"
                      className="part-main-button"
                      disabled={isReading || isCompleted}
                      onClick={() => openClaim(part)}
                    >
                      <span className="part-number">الجزء {part.number}</span>
                      {isCompleted && (
                        <>
                          <span className="part-status part-done">مكتمل</span>
                          <span className="part-reader">قرأه {partReservationName || 'مشارك'}</span>
                        </>
                      )}
                      {isReading && (
                        <span className="part-status part-reading">{partReservationName || 'مشارك'}</span>
                      )}
                      {!isReading && !isCompleted && (
                        <span className="part-status part-available">متاح</span>
                      )}
                    </button>
                    {isMyReservedPart && (
                      <button
                        type="button"
                        className="part-go-button"
                        onClick={() => navigate(`/room/${roomId}/part/${part.number}`)}
                      >
                        📖 الانتقال للجزء
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}


        {activeTab === 'chat' && (
          <aside className="chat-panel chat-panel-full">
            <div className="participants-strip">
              {uniqueParticipants.map((name) => (
                <span key={name} className="participant-chip">{name}</span>
              ))}
            </div>

            {room.status === 'completed' && (
              <div className="dua-banner">
                <span>🎉 اكتملت الختمة بالكامل</span>
                <button
                  type="button"
                  className="primary-button"
                  style={{ marginTop: 8 }}
                  onClick={() => setShowDua(true)}
                >
                  🤲 قراءة دعاء الختمة
                </button>
              </div>
            )}

            <div className="messages-list">
              {room.messages.length === 0 ? (
                <div className="empty-chat">
                  <span style={{ fontSize: 32 }}>💬</span>
                  <p>لا توجد رسائل بعد، كن أول من يكتب!</p>
                </div>
              ) : (
                room.messages.map((item) => {
                  const isMine = item.participant_id === session?.participant_id
                  return (
                    <div key={item.id} className={isMine ? 'message own-message' : 'message'}>
                      <span className="msg-sender">{item.sender_name || 'مشارك'}</span>
                      <p>{item.message}</p>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-composer">
              <div className="chat-name-row">
                <span className="chat-name-label">اسم العرض:</span>
                <input
                  className="chat-name-input"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  placeholder="اكتب اسمك"
                  maxLength={80}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onSaveName}
                  disabled={savingName || chatName.trim().length < 2}
                >
                  {savingName
                    ? 'جاري الحفظ...'
                    : chatName.trim() === confirmedName
                        ? 'تم حفظ الاسم ✓'
                        : 'حفظ الاسم'}
                </button>
              </div>
              <form onSubmit={onSendMessage} className="chat-form">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  maxLength={1000}
                />
                <button
                  type="submit"
                  className={message.trim() ? 'primary-button' : 'send-disabled'}
                  disabled={!message.trim() || sending}
                >
                  إرسال
                </button>
              </form>
            </div>
          </aside>
        )}
      </div>


      {claimPartNumber && (
        <div className="modal-overlay" onClick={closeClaim}>
          <div className="confirm-modal claim-modal" onClick={(e) => e.stopPropagation()}>
            <div className="claim-modal-icon">📖</div>
            <h2>حجز الجزء للقراءة</h2>
            <p className="claim-modal-sub">الجزء {claimPartNumber}</p>
            <label className="claim-modal-label">
              نوع القراءة
              <select
                value={claimReadingType}
                onChange={(e) => {
                  setClaimReadingType(e.target.value)
                  setReservationName('')
                }}
              >
                <option value="self">القراءة لوحدي</option>
                <option value="child">حجز للطفل</option>
              </select>
            </label>
            {claimReadingType === 'child' ? (
              <label className="claim-modal-label">
                اسم الطفل القارئ
                <input
                  value={reservationName}
                  onChange={(e) => setReservationName(e.target.value)}
                  placeholder="اكتب اسم الطفل"
                  maxLength={80}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmClaim()
                    if (e.key === 'Escape') closeClaim()
                  }}
                />
              </label>
            ) : (
              <p className="muted-text">سيُحجز الجزء باسمك: {session?.name}</p>
            )}
            {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="confirm-actions">
              <button type="button" className="primary-button" onClick={confirmClaim} disabled={claiming}>
                {claiming ? 'جاري الحجز...' : 'بدء'}
              </button>
              <button type="button" className="secondary-button" onClick={closeClaim} disabled={claiming}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}


      {showDua && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowDua(false)}>
          <div
            className="dua-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(700px, calc(100vw - 28px))',
              maxHeight: 'min(86vh, 820px)',
              overflow: 'hidden',
              padding: '24px',
              borderRadius: '22px',
              background: '#fff',
              boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
              direction: 'rtl',
              textAlign: 'right',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 style={{ margin: 0, textAlign: 'center' }}>🤲 دعاء ختم القرآن</h2>
            <div style={{ overflowY: 'auto', maxHeight: '62vh', lineHeight: 2.15, fontSize: '1.05rem', color: '#26332d', padding: '4px 8px' }}>
              <p>اللهم ارحمني بالقرآن واجعله لي إماما ونورا وهدى ورحمة</p>
              <p>اللهم ذكرني منه ما نسيت وعلمني منه ما جهلت وارزقني تلاوته آناء الليل وأطراف النهار واجعله لي حجة يا رب العالمين</p>
              <p>اللهم أصلح لي ديني الذي هو عصمة أمري وأصلح لي دنياي التي فيها معاشي وأصلح لي آخرتي التي فيها معادي واجعل الحياة زيادة لي في كل خير واجعل الموت راحة لي من كل شر</p>
              <p>اللهم اجعل خير عمري آخره وخير عملي خواتمه وخير أيامي يوم ألقاك فيه</p>
              <p>اللهم إني أسألك موجبات رحمتك وعزائم مغفرتك والسلامة من كل إثم والغنيمة من كل بر والفوز بالجنة والنجاة من النار</p>
              <p>اللهم لا تدع لنا ذنبا إلا غفرته ولا هما إلا فرجته ولا دينا إلا قضيته ولا حاجة من حوائج الدنيا والآخرة إلا قضيتها يا أرحم الراحمين</p>
              <p>ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار وصلى الله على سيدنا محمد وعلى آله وصحبه وسلم تسليما كثيرا.</p>
            </div>
            <button type="button" className="primary-button" onClick={() => setShowDua(false)} style={{ width: '100%', flexShrink: 0 }}>
              تم 🤲
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


/* ═══════════ PartRoute ═══════════ */
function PartRoute() {
  const { roomId } = useParams()
  const session = getSession(roomId)
  if (!session) return <Navigate to={`/room/${roomId}`} replace />
  return <PartPage session={session} />
}

/* ═══════════ PartPage ═══════════ */
function PartPage({ session }) {
  const { roomId, partNumber } = useParams()
  const navigate = useNavigate()

  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [claimReadingType, setClaimReadingType] = useState('self')
  const [reservationName, setReservationName] = useState('')
  const [claiming, setClaiming] = useState(false)

  const numericPartNumber = Number(partNumber)
  const currentUser = session?.name || ''

  useEffect(() => {
    let cancelled = false
    getRoomState(roomId)
      .then((data) => { if (!cancelled) setRoom(data) })
      .catch((err) => { if (!cancelled)       setError(err?.message || 'تعذّر تحميل الجزء.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [roomId])

  const part = useMemo(
    () => room?.parts.find((p) => p.number === numericPartNumber),
    [room, numericPartNumber]
  )

  const isCompleted = part?.status === 'completed'
  const isReading = part?.status === 'reading'
  const isMyPart = isReading && part?.participantId === session?.participant_id
  const partReservationName = getReservationName(part)

  const openQuran = () => {
    if (!part) return
    window.open(quranPdfPath(part.number), '_blank', 'noopener,noreferrer')
  }

  const openClaim = () => {
    setError('')
    setClaimReadingType('self')
    setReservationName(currentUser)
    setClaimOpen(true)
  }

  const confirmClaim = async () => {
    const name = claimReadingType === 'child'
      ? reservationName.trim()
      : currentUser.trim()
    if (!name || name.length < 2 || name.length > 80) {
      setError('اكتب اسم الشخص الذي سيقرأ الجزء.')
      return
    }
    setClaiming(true)
    setError('')
    try {
      await claimPart(
        roomId,
        numericPartNumber,
        claimReadingType,
        claimReadingType === 'child' ? name : null
      )
      const updated = await getRoomState(roomId)
      setRoom(updated)
      setClaimOpen(false)
      setReservationName('')
    } catch (err) {
      setError(err?.message || 'تعذّر حجز الجزء.')
    } finally {
      setClaiming(false)
    }
  }

  const onFinish = async () => {
    if (!part || !isMyPart) return
    setError('')
    setFinishing(true)
    try {
      await completePart(roomId, part.number)
      const updated = await getRoomState(roomId)
      setRoom(updated)
    } catch (err) {
      setError(err?.message || 'تعذّر تسجيل إكمال الجزء.')
    } finally {
      setFinishing(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <div className="loading-state">جاري تحميل الجزء...</div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <h2>تعذر تحميل الجزء</h2>
          {error && <div className="error-box">{error}</div>}
          <Link to={`/room/${roomId}`} className="back-link">العودة إلى الختمة</Link>
        </div>
      </div>
    )
  }

  if (!part) {
    return (
      <div className="page-shell small-shell">
        <div className="card-box">
          <h2>الجزء غير موجود</h2>
          <p>لم نعثر على الجزء رقم {numericPartNumber}.</p>
          <Link to={`/room/${roomId}`} className="back-link">العودة الى الختمة</Link>
        </div>
      </div>
    )
  }


  return (
    <div className="page-shell reader-shell">
      <header className="reader-header">
        <button type="button" className="back-button" onClick={() => navigate(`/room/${roomId}`)}>
          العودة
        </button>
        <div className="reader-title">
          <span>خِتْمَة</span>
          <h1>الجزء {part.number}</h1>
        </div>
      </header>

      {error && <div className="error-box reader-error">{error}</div>}

      {part.status === 'available' && (
        <section className="reader-start-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div className="reader-icon-circle">📖</div>
          <h2>الجزء {part.number}</h2>
          <p style={{ marginBottom: 24, color: '#66736c' }}>هذا الجزء متاح للقراءة.</p>
          <button
            type="button"
            className="primary-button"
            onClick={openClaim}
            style={{ width: '100%', maxWidth: 420, minHeight: 58, fontSize: '1.08rem', fontWeight: 800 }}
          >
            📖 بدء للقراءة
          </button>
        </section>
      )}

      {isMyPart && (
        <section className="reader-start-card" style={{ padding: '28px 24px' }}>
          <div className="reader-icon-circle">📖</div>
          <h2>الجزء {part.number}</h2>
          <p style={{ marginBottom: 20 }}>
            محجوز لـ <strong>{partReservationName || currentUser}</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, margin: '0 auto' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={openQuran}
              style={{ minHeight: 52, fontSize: '1.02rem' }}
            >
              📖 فتح المصحف للقراءة
            </button>
            <button
              type="button"
              className="success-button"
              onClick={onFinish}
              disabled={finishing}
              style={{ minHeight: 54, fontSize: '1.05rem', fontWeight: 800 }}
            >
              {finishing ? 'جارٍ حفظ التقدّم...' : 'أكملت قراءة الجزء'}
            </button>
          </div>
        </section>
      )}

      {isReading && !isMyPart && (
        <section className="reader-start-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div className="reader-icon-circle">📖</div>
          <h2>الجزء قيد القراءة</h2>
          <p>محجوز لـ <strong>{partReservationName || 'مشارك آخر'}</strong></p>
        </section>
      )}

      {isCompleted && (
        <section className="reader-start-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>
          <h2>تم إكمال الجزء</h2>
          <p>قرأه <strong>{partReservationName || 'مشارك'}</strong></p>
        </section>
      )}

      {claimOpen && (
        <div
          className="modal-overlay"
          onClick={() => { if (!claiming) { setClaimOpen(false); setReservationName('') } }}
        >
          <div className="confirm-modal claim-modal" onClick={(e) => e.stopPropagation()}>
            <div className="claim-modal-icon">📖</div>
            <h2>حجز الجزء للقراءة</h2>
            <p className="claim-modal-sub">الجزء {part.number}</p>
            <label className="claim-modal-label">
              نوع القراءة
              <select
                value={claimReadingType}
                onChange={(e) => {
                  setClaimReadingType(e.target.value)
                  setReservationName('')
                }}
              >
                <option value="self">القراءة لوحدي</option>
                <option value="child">حجز للطفل</option>
              </select>
            </label>
            {claimReadingType === 'child' ? (
              <label className="claim-modal-label">
                اسم الطفل القارئ
                <input
                  value={reservationName}
                  onChange={(e) => setReservationName(e.target.value)}
                  placeholder="اكتب اسم الطفل"
                  maxLength={80}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmClaim()
                    if (e.key === 'Escape') { setClaimOpen(false); setReservationName('') }
                  }}
                />
              </label>
            ) : (
              <p className="muted-text">سيُحجز الجزء باسمك: {currentUser}</p>
            )}
            {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="confirm-actions">
              <button type="button" className="primary-button" onClick={confirmClaim} disabled={claiming}>
                {claiming ? 'جاري الحجز...' : 'بدء'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setClaimOpen(false); setReservationName('') }}
                disabled={claiming}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateRoomPage />} />
        <Route path="/join" element={<JoinRoomPage />} />
        <Route path="/room/:roomId" element={<RoomRoute />} />
        <Route path="/room/:roomId/part/:partNumber" element={<PartRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
