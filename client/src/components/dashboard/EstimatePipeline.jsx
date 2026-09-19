import { Link } from 'react-router-dom'
import { ArrowRight, ChevronUp } from 'lucide-react'
import { fmt } from './utils'

// Horizontal Estimate Pipeline renderer. The authoritative stage sequence,
// status mapping and per-stage navigation all come from the backend
// (PIPELINE_STAGES / dgmDashboard.pipeline / ?stage=<key>), never from this
// component — it only draws whatever `stages` says. `current` marks the
// logged-in role's stage with an actionable highlight; every other stage
// stays purely informative.
export default function EstimatePipeline({ stages, title, viewLink, current, theme = 'default' }) {
  return (
    <section aria-labelledby="pipeline-heading">
      <div className="flex items-center justify-between mb-2">
        <h2 id="pipeline-heading" className="text-xs font-semibold text-[#475569] uppercase tracking-wider">{title}</h2>
        {viewLink && (
          <Link to={viewLink} className="text-xs text-[#2563EB] hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="overflow-x-auto lg:overflow-visible pt-3 pb-1 -mx-1 px-1">
        <div className="flex items-stretch gap-1.5 lg:gap-1 w-max lg:w-full min-w-max lg:min-w-0">
          {stages.map((s, i) => (
            <div key={s.key} className="contents">
              <StageCard s={s} current={s.key === current} />
              {i < stages.length - 1 && (
                <div className="self-stretch flex items-center shrink-0" aria-hidden="true">
                  <ArrowRight className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-400" strokeWidth={2} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StageCard({ s, current }) {
  const on = s.count > 0
  return (
    <Link to={s.to} title={`${s.label} — ${fmt(s.count)} estimates`} aria-label={`${s.label} — ${fmt(s.count)} estimates`}
      className={`workflow-stage-card relative flex flex-col items-center justify-center w-[134px] lg:w-auto lg:flex-1 lg:min-w-0 h-[112px] lg:h-[104px] px-1.5 lg:px-2 shrink-0 rounded-lg border ${current ? `${s.bgOn} ${s.bdOn} ring-2 ring-offset-1 ring-slate-500 shadow-md current-stage-card` : on ? `${s.bgOn} ${s.bdOn} shadow-sm` : `${s.bg} ${s.bd}`} hover:-translate-y-px hover:shadow-sm cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 min-w-0 ${current ? 'pt-5' : ''}`}>
      {current && (
        <span className="workflow-current-stage-badge absolute left-1/2 top-2 -translate-x-1/2 inline-flex items-center gap-0.5 rounded-full bg-[#0F172A] text-[#F8FAFC] text-[9px] font-bold px-2 py-0.5 shadow-sm tracking-wide whitespace-nowrap z-10">
          <ChevronUp className="w-2.5 h-2.5" /> CURRENT STAGE
        </span>
      )}
      {on && !current && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: s.num }} aria-hidden="true" />}
      <s.icon className="w-5 h-5 mb-1.5 shrink-0" style={{ color: s.num }} strokeWidth={2.2} aria-hidden="true" />
      <p className="workflow-stage-label text-xs font-bold text-[#0F172A] uppercase tracking-wide leading-none">{s.label}</p>
      <p className={`workflow-stage-count text-xl font-bold leading-none mt-1.5 ${on ? '' : 'text-slate-400'}`} style={on ? { color: s.num } : undefined}>{fmt(s.count)}</p>
      <p className="workflow-stage-subtitle text-[10px] text-[#334155] mt-1 leading-tight text-center">{s.sub}</p>
    </Link>
  )
}