export default function StatCard({ label, value, icon, change, tone = 'emerald' }) {
  const Icon = icon

  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-header">
        <div className="stat-icon">
          <Icon size={18} />
        </div>
        <span className="stat-change">{change}</span>
      </div>
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
    </div>
  )
}
