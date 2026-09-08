import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function MetricCard({ label, value, icon: Icon, color, bg, borderHover, bgHover, to, tip, format }) {
  const display = format ? format(value) : value
  const inner = (
    <>
      <div className={`w-11 h-11 rounded-full ${bg} flex items-center justify-center mb-1.5 shrink-0`}>
        <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
      </div>
      <p className="text-[28px] font-bold text-white leading-none tracking-tight">{display}</p>
      <p className="text-[10px] font-semibold text-white/80 uppercase tracking-wide mt-1 leading-tight">{label}</p>
    </>
  )

  return to ? (
    <Link to={to} title={tip} data-testid="dashboard-metric-card"
      className={`group flex flex-col items-center justify-center ${bg} ${bgHover || ''} rounded-lg ${borderHover || 'hover:shadow-lg'} px-2 py-3.5 text-center cursor-pointer transition-all duration-200 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1`}>
      {inner}
    </Link>
  ) : (
    <div data-testid="dashboard-metric-card"
      className={`flex flex-col items-center justify-center ${bg} rounded-lg px-2 py-3.5 text-center`}>
      {inner}
    </div>
  )
}
