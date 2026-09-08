import { Check } from 'lucide-react'

const fmtDate = (d) => {
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fmtTime = (d) => {
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// Generic workstage pipeline. Reused by Estimate/Procurement/Tender/Execution/Billing/Finance.
// Props:
//   workflowType : 'estimate' | 'procurement' | 'tender' | 'execution' | 'billing' | 'finance'
//   stages       : [{ key, label, helper }]
//   currentStage : the active stage key (rendered as ● current)
//   completed    : array of stage keys to render as ✓ completed (defaults to all before currentStage)
//   responsibility: { owner, role, task, sla, actions: ['Verify','Return'] } (optional; Part 24)
//   onStageClick : optional callback(key)
//   compact      : smaller inline rendering
export default function WorkStagePipeline({
  title,
  workflowType = 'estimate',
  stages,
  currentStage,
  completed,
  onStageClick,
  responsibility,
  compact = false,
}) {
  const activeIdx = stages.findIndex(s => s.key === currentStage)
  const idx = activeIdx >= 0 ? activeIdx : 0
  const isDone = (s) => completed
    ? completed.includes(s.key)
    : stages.indexOf(s) < idx

  const circles = (s, i, done, current) => (
    done
      ? <Check className="w-4 h-4" />
      : current
        ? <span className="w-2.5 h-2.5 rounded-full bg-white" />
        : i + 1
  )

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#64748B]">
        {stages.map((s, i) => {
          const done = isDone(s)
          const current = i === idx
          return (
            <button key={s.key} type="button" disabled={!onStageClick} onClick={() => onStageClick?.(s.key)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                current ? 'bg-[#1E3A5F] text-white font-semibold'
                : done ? 'bg-[#1E3A5F]/10 text-[#1E3A5F] font-medium'
                : 'text-[#94A3B8]'
              }`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current ? '#fff' : done ? '#1E3A5F' : '#CBD5E1' }} />
              {s.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div data-testid="workstage-pipeline" className="bg-white rounded-lg border border-[#E2E8F0] p-4">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">{title}</h3>
          <span className="text-[10px] font-medium text-[#64748B] capitalize">{workflowType} Workflow</span>
        </div>
      )}

      <div className="w-full overflow-x-auto pb-1 -mb-1">
        <div className="flex min-w-max mx-auto px-1">
          {stages.map((s, i) => {
            const done = isDone(s)
            const current = i === idx
            return (
              <button
                key={s.key}
                type="button"
                disabled={!onStageClick}
                onClick={() => onStageClick?.(s.key)}
                className={`relative flex flex-col items-center flex-none min-w-[110px] px-1 pb-1 ${onStageClick ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {i > 0 && (
                  <div className={`absolute top-4 right-1/2 w-full h-0.5 ${done ? 'bg-[#1E3A5F]' : 'bg-[#E2E8F0]'}`} style={{ zIndex: 0 }} />
                )}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    current
                      ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white shadow-[0_0_0_4px_rgba(14,165,233,0.15)]'
                      : done
                        ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                        : 'bg-white border-[#E2E8F0] text-[#94A3B8]'
                  }`}
                >
                  {circles(s, i, done, current)}
                </div>
                <p className={`text-[10px] mt-1.5 text-center leading-tight ${done ? 'text-[#1E3A5F] font-semibold' : current ? 'text-[#0EA5E9] font-semibold' : 'text-[#94A3B8]'}`}>
                  {s.label}
                </p>
                {s.helper && <p className="text-[8px] text-[#CBD5E1] -mt-0.5">{s.helper}</p>}
                {current && (
                  <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-[#0EA5E9]">● Current</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {responsibility && (
        <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="current-responsibility">
          <div>
            <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">Current Owner</p>
            <p className="text-sm font-semibold text-[#0F172A]">{responsibility.owner || '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">Requirement</p>
            <p className="text-sm text-[#475569]">{responsibility.task || '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">SLA</p>
            <p className="text-sm text-[#475569]">{responsibility.sla || '—'}</p>
          </div>
          {responsibility.actions && responsibility.actions.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">Available Actions</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {responsibility.actions.map(a => (
                  <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1E3A5F]/5 text-[#1E3A5F] border border-[#1E3A5F]/15">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[9px] text-[#CBD5E1] mt-3">Legend: <span className="text-[#1E3A5F] font-medium">✓ completed</span> · <span className="text-[#0EA5E9] font-medium">● current</span> · <span className="text-[#94A3B8]">○ pending</span></p>
    </div>
  )
}

export { fmtDate, fmtTime }
