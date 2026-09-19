import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

const STEPS = [
  { key: 'Draft', label: 'Draft', owner: 'Manager' },
  { key: 'Submitted', label: 'With DGM', owner: 'DGM' },
  { key: 'DGM_Approved', label: 'Verified', owner: 'GM' },
  { key: 'GM_Recommended', label: 'Recommended', owner: 'CGM' },
  { key: 'CGM_Submitted', label: 'With DOP', owner: 'DOP' },
  { key: 'DOP_Approved', label: 'Approved', owner: 'ED' },
  { key: 'ED_Approved', label: 'Approved', owner: 'MD' },
  { key: 'MD_Approved', label: 'Final Approved', owner: 'Tender Officer' },
  { key: 'TenderPublished', label: 'Tender Published', owner: 'Tender Officer' },
  { key: 'AgencySelected', label: 'Agency Selected', owner: 'Site Engineer' },
  { key: 'WorkStarted', label: 'Work Started', owner: 'Site Engineer' },
  { key: 'WorkCompleted', label: 'Work Completed', owner: 'Billing Officer' },
  { key: 'Billing', label: 'Billing', owner: 'Admin' },
  { key: 'Completed', label: 'Completed', owner: 'Closed' },
]

const ACTION_TO_STEP = {
  Submit: 'Submitted',
  Approve: 'DGM_Approved',
  Recommend: 'GM_Recommended',
  SubmitForApproval: 'CGM_Submitted',
  ApproveAtDOP: 'DOP_Approved',
  ApproveAtED: 'ED_Approved',
  FinalApprove: 'MD_Approved',
  PublishTender: 'TenderPublished',
  SelectAgency: 'AgencySelected',
  StartWork: 'WorkStarted',
  CompleteWork: 'WorkCompleted',
  SubmitBill: 'Billing',
  Archive: 'Completed',
}

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

export default function WorkflowStepper({ currentStatus, compact, workflow = [], onStepClick }) {
  const idx = STEPS.findIndex(s => s.key === currentStatus)
  // Unknown/advanced statuses (reverted, TenderDraft, downstream stages, etc.)
  // should not be shown as "Draft". If it's past the last known step, show it
  // as fully complete; otherwise leave no stage highlighted.
  const activeIdx = idx >= 0 ? idx : STEPS.length - 1
  const itemRefs = useRef([])

  const stepMeta = (key) => {
    const entry = workflow.find(w => ACTION_TO_STEP[w.Action] === key)
    return entry || null
  }

  useEffect(() => {
    if (compact) return
    const el = itemRefs.current[activeIdx]
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeIdx, compact])

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-[#475569]">
        {STEPS.map((s, i) => {
          const done = i <= activeIdx
          const isCurrent = i === activeIdx
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onStepClick?.(s.key)}
              className="flex items-center gap-1"
            >
              {i > 0 && <span className={`h-px w-2 ${done ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'}`} />}
              <span className={`px-1.5 py-0.5 rounded ${isCurrent ? 'bg-[#2563EB] text-white font-medium' : done ? 'bg-[#2563EB]/10 text-[#2563EB] font-medium' : 'text-[#94A3B8]'}`}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto pb-1 -mb-1">
      <style>{`
        @keyframes ecStepGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.45); }
          50% { box-shadow: 0 0 0 6px rgba(14, 165, 233, 0); }
        }
      `}</style>
      <div className="flex min-w-max mx-auto px-1">
        {STEPS.map((s, i) => {
          const done = i <= activeIdx
          const isCurrent = i === activeIdx
          const meta = stepMeta(s.key)
          return (
            <button
              key={s.key}
              type="button"
              ref={el => { itemRefs.current[i] = el }}
              onClick={() => onStepClick?.(s.key)}
              title={meta ? `${meta.Remarks || s.label} · ${meta.FromUserName || ''}` : s.label}
              className={`relative flex flex-col items-center flex-none min-w-[118px] px-1 pb-1 group ${
                onStepClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {/* Connector line to previous step */}
              {i > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 ${done ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'}`}
                  style={{ zIndex: 0 }}
                />
              )}
              {/* Circle */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'bg-white border-[#CBD5E1] text-[#94A3B8]'
                } ${isCurrent ? 'ring-2 ring-[#0EA5E9]/40 text-white bg-[#0EA5E9] border-[#0EA5E9] animate-[ecStepGlow_2s_ease-in-out_infinite]' : ''} ${
                  onStepClick && !isCurrent ? 'group-hover:scale-105 group-hover:border-[#2563EB]' : ''
                }`}
                style={isCurrent ? { animation: 'ecStepGlow 2s ease-in-out infinite' } : undefined}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {/* Label */}
              <p className={`text-[10px] mt-1.5 text-center leading-tight ${done ? 'text-[#2563EB] font-semibold' : 'text-[#94A3B8]'}`}>
                {s.label}
              </p>
              <p className="text-[8px] text-[#94A3B8] -mt-0.5">{s.owner}</p>
              {/* Timestamp for completed steps */}
              {done && meta?.DateTime && (
                <div className="mt-1 text-center leading-tight bg-[#F1F5F9] rounded px-1.5 py-0.5">
                  <p className="text-[8px] font-semibold text-[#2563EB]">{fmtDate(meta.DateTime)}</p>
                  <p className="text-[8px] text-[#475569]">{fmtTime(meta.DateTime)}</p>
                </div>
              )}
              {/* Current stage label */}
              {isCurrent && (
                <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-[#0EA5E9]">
                  ● Current Stage
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
