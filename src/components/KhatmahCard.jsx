import { ArrowLeft, CalendarDays, Users } from 'lucide-react'

export default function KhatmahCard({ khatmah, compact = false }) {
  const progressWidth = `${khatmah.progress}%`

  return (
    <article className={`khatmah-card ${compact ? 'compact' : ''}`}>
      <div className="card-top-row">
        <div className="khatmah-title-wrap">
          <span className="mini-badge" style={{ background: `${khatmah.color}1A`, color: khatmah.color }}>
            {khatmah.badge}
          </span>
          <h3>{khatmah.title}</h3>
        </div>
        <div className="khatmah-progress-value">{khatmah.progress}%</div>
      </div>

      <p>{khatmah.description}</p>

      <div className="progress-bar" aria-label={`تقدم ${khatmah.title}`}>
        <span style={{ width: progressWidth, background: khatmah.color }} />
      </div>

      <div className="metric-row">
        <span>
          <CalendarDays size={15} />
          {khatmah.lastRead}
        </span>
        <span>
          <Users size={15} />
          {khatmah.members} أعضاء
        </span>
      </div>

      <div className="card-footer-row">
        <div>
          <small>مكتمل</small>
          <strong>{khatmah.completedPages}/{khatmah.totalPages}</strong>
        </div>
        <button className="inline-link">
          تفاصيل الختمة
          <ArrowLeft size={16} />
        </button>
      </div>
    </article>
  )
}
