import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react'

const navigation = [
  { to: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/my-khatmahs', label: 'ختماتي', icon: BookOpen },
  { to: '/juz-tracking', label: 'تتبع الأجزاء', icon: Target },
  { to: '/statistics', label: 'الإحصاءات', icon: Sparkles },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

export default function Layout({ children, pageTitle, pageSubtitle }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <div className="brand-badge">خ</div>
          <div>
            <div className="brand-name">خَتْمَة</div>
            <div className="brand-tagline">اجعل لك في القرآن نصيبًا</div>
          </div>
        </div>

        <nav className="nav-menu" aria-label="التنقل الرئيسي">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="profile-card">
          <div className="avatar-wrap">
            <CircleUserRound size={18} />
          </div>
          <div>
            <strong>أمينة الحسن</strong>
            <small>مستخدم نشط</small>
          </div>
          <button className="logout-button" aria-label="تسجيل الخروج">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="content-panel">
        <header className="page-header">
          <div>
            <p className="eyebrow">تطبيق الختمة</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="header-actions">
            <button className="ghost-button">إشعارات</button>
            <button className="primary-button">+ قراءة جديدة</button>
          </div>
        </header>

        {pageSubtitle && <p className="page-subtitle">{pageSubtitle}</p>}
        {children}
      </main>
    </div>
  )
}
