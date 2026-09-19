import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function QuickActions({ actions, theme = 'default' }) {
  return (
    <div data-testid="quick-actions">
      <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map(a => (
          <Link key={a.label} to={a.to} aria-label={a.label}
            className={`quick-action-card group flex items-center gap-3 rounded-lg border border-l-4 ${a.border} ${a.tileBg} ${a.strong ? 'shadow-md' : 'shadow-sm'} pl-3 pr-2.5 py-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px focus:outline-none focus-visible:ring-2 ${a.focusRing} focus-visible:ring-offset-1`}>
            <div className={`w-9 h-9 rounded-full ${a.iconBg} flex items-center justify-center shrink-0`}>
              <a.icon className="w-4 h-4 text-white" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="quick-action-title text-sm font-semibold text-[#0F172A] truncate leading-tight">{a.label}</p>
              <p className="quick-action-desc text-[11px] text-[#334155] truncate mt-0.5">{a.desc}</p>
            </div>
            <div className={`w-7 h-7 rounded-full ${a.btnBg} text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:translate-x-0.5`}>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
