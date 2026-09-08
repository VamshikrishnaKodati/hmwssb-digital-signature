import { Clock, AlertTriangle, CircleAlert } from 'lucide-react'

// Visual only — uses the backend SLA values (dueAt / status / escalationLevel).
// Never recalculates a deadline; only formats what the server provides.
export function slaTone(sla) {
  if (!sla || !sla.dueAt) return null
  const min = sla.remainingMinutes ?? Math.max(0, Math.round((new Date(sla.dueAt) - new Date()) / 60000))
  const status = sla.status || ''
  const escalated = Number(sla.escalationLevel) > 0
  if (escalated) return { tone: 'danger', label: `Escalated — L${sla.escalationLevel}`, min }
  if (status === 'Overdue' || min <= 0) return { tone: 'danger', label: 'Overdue', min }
  if (status === 'Warning' || min < 90) return { tone: 'warn', label: `Due soon ${fmtDue(min)}`, min }
  return { tone: 'ok', label: `On track — due in ${fmtDue(min)}`, min }
}

function fmtDue(min) {
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h ${min % 60}m`
  return `${Math.round(min / 1440)}d ${Math.round((min % 1440) / 60)}h`
}

// Subtle progress used when a real SLA timeline is available. Scales elapsed
// time 0→1 across the stage window without inventing a deadline: when a
// warning window exists the fraction reflects "time used so far".
export default function SlaProgress({ sla, showBar = false, showIcon = true, compact = false }) {
  const t = slaTone(sla)
  if (!t) return <span className="text-[11px] text-[#94A3B8]">SLA —</span>

  const toneCls = t.tone === 'danger' ? 'text-red-600' : t.tone === 'warn' ? 'text-amber-600' : 'text-emerald-600'
  const fillCls = t.tone === 'danger' ? 'bi-sla-fill-danger' : t.tone === 'warn' ? 'bi-sla-fill-warn' : 'bi-sla-fill-ok'

  // Display-only fraction from remaining minutes (1 → due soon → 0 overdue).
  const frac = t.tone === 'danger' ? 0.08 : t.min < 90 ? 0.5 : 0.85

  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? '' : 'rounded-full border border-[#E3E8F0] bg-white px-2.5 py-1'}`}>
      {showIcon && (
        t.tone === 'danger'
          ? <CircleAlert className="w-3.5 h-3.5 text-red-500" />
          : t.tone === 'warn'
            ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            : <Clock className="w-3.5 h-3.5 text-emerald-600" />
      )}
      <span className={`text-[11px] font-semibold tabular-nums whitespace-nowrap ${toneCls}`}>{t.label}</span>
      {showBar && (
        <span className="bi-sla-track w-16 ml-0.5">
          <span className={`bi-sla-fill ${fillCls}`} style={{ width: `${frac * 100}%` }} />
        </span>
      )}
    </span>
  )
}
