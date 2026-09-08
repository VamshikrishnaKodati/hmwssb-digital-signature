import { useRef, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { getWorkflowProgress, getStatusInfo, PHASES, ACTION_LABELS } from '../../utils/workflowMapping'

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

const ACTION_TO_STAGE_KEY = {
  Submit: 'DGM_Verification',
  Approve: 'GM_Recommendation',
  DigitallySign: 'GM_Recommendation',
  SubmitForApproval: 'CGM_Submission',
  ApproveAtDOP: 'DOP_Approval',
  ApproveAtED: 'ED_Approval',
  FinalApprove: 'MD_FinalApproval',
  GenerateFCN: 'FCN_Generation',
  GenerateSanction: 'Admin_Sanction',
  ApproveTS: 'Tech_Sanction',
  PublishTender: 'Tender_Publication',
  CloseTender: 'Bid_Opening',
  TechnicalEval: 'Tech_Evaluation',
  FinancialEval: 'Financial_Evaluation',
  IdentifyL1: 'L1_Identification',
  CreateAward: 'Work_Award',
  IssueWorkOrder: 'Work_Order',
  RecordAgreement: 'Agreement',
  SelectAgency: 'Work_Start',
  StartWork: 'Work_Start',
  CompleteWork: 'Completion',
  SubmitBill: 'Bill_Preparation',
}

/**
 * WorkflowProgress — current-phase-first 6-phase workflow card.
 *
 * Completed phases render as one-line "✓ ESTIMATE Complete" summaries.
 * The CURRENT phase renders as the prominent stage tracker.
 * Future phases are NOT rendered.
 *
 * Props:
 * - status: backend EstimateHeader.Status
 * - context: optional { tenderStatus, billingStatus, financeStatus }
 * - workflow: optional array of workflow history entries [{ Action, DateTime, FromUserName, Remarks }]
 * - onStageClick: optional (stageKey) => void
 * - sla: optional { status: 'Normal'|'Warning'|'Overdue', dueAt, escalationLevel }
 * - showOwner: boolean — show current owner info
 * - ownerName: string — current owner display name
 */
export default function WorkflowProgress({
  status,
  context = {},
  workflow = [],
  onStageClick,
  sla,
  showOwner = false,
  ownerName,
}) {
  const phases = getWorkflowProgress(status, context)
  const info = getStatusInfo(status, context)
  const scrollRef = useRef(null)

  const phaseActionDates = (phaseKey) => workflow
    .filter(w => ACTION_TO_STAGE_KEY[w.Action] && phases.find(p => p.phase === phaseKey)?.stages.find(s => s.key === ACTION_TO_STAGE_KEY[w.Action]))
    .map(w => ({ date: new Date(w.DateTime), name: w.FromUserName, action: w.Action }))
    .sort((a, b) => b.date - a.date)

  const lastPerformed = (stageKey) => {
    const action = Object.entries(ACTION_TO_STAGE_KEY).find(([, k]) => k === stageKey)?.[0]
    if (!action) return null
    return workflow.find(w => w.Action === action) || null
  }

  useEffect(() => {
    if (!scrollRef.current) return
    const active = scrollRef.current.querySelector('[data-current="true"]')
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [status])

  if (info.flatIndex < 0) {
    return (
      <div data-testid="workflow-progress" className="bg-white rounded-lg border border-[#E2E8F0] p-4">
        <p className="text-xs text-[#94A3B8]">Workflow stage not found for status “{status}”.</p>
      </div>
    )
  }

  const currentPhaseIndex = phases.findIndex(p => p.active)
  const currentPhase = currentPhaseIndex >= 0 ? phases[currentPhaseIndex] : null

  const stageLabelFor = (stageKey) => {
    for (const phase of PHASES) {
      const s = phase.stages.find(x => x.key === stageKey)
      if (s) return s.label
    }
    return null
  }

  return (
    <div data-testid="workflow-progress" className="bg-white rounded-lg border border-[#E2E8F0] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">Workflow Progress</h3>
        <span className="text-[10px] font-medium text-[#64748B] capitalize">
          {currentPhase ? currentPhase.phaseLabel : '6-Phase Lifecycle'}
        </span>
      </div>

      {/* Completed phases — compact summary */}
      {phases.filter(p => p.complete).map(phase => {
        const last = phaseActionDates(phase.phase)[0] || null
        return (
          <div key={phase.phase} data-testid={`phase-${phase.phaseIndex}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 mb-1.5">
            <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-green-500 shrink-0">
              <Check className="w-2.5 h-2.5 text-white" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">{phase.phaseLabel} Complete</span>
            {last?.date && (
              <span className="ml-auto text-[10px] text-green-700 font-medium hidden sm:inline">
                {ACTION_LABELS[last.action] || stageLabelFor(ACTION_TO_STAGE_KEY[last.action]) || 'Completed'} · {fmtDate(last.date)}{fmtTime(last.date) && ` · ${fmtTime(last.date)}`}
              </span>
            )}
          </div>
        )
      })}

      {phases.filter(p => p.complete).length > 0 && currentPhase && (
        <div className="flex items-center justify-center my-1 text-[#CBD5E1]">
          <ChevronDown className="w-4 h-4" />
        </div>
      )}

      {/* Current phase — prominent tracker with ONLY its stages */}
      {currentPhase && (
        <div className="rounded-lg border border-[#BFDBFE] bg-gradient-to-b from-[#F8FBFF] to-white overflow-hidden" data-testid={`phase-active-${currentPhase.phaseIndex}`}>
          <div className="flex items-center justify-between flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#0EA5E9]">
                <span className="w-2 h-2 rounded-full bg-white" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F]">{currentPhase.phaseLabel}</p>
                <p className="text-[10px] text-[#64748B]">{PHASES[currentPhase.phaseIndex]?.description}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-[#0EA5E9] bg-[#E0F2FE]">In Progress</span>
          </div>

          <div ref={scrollRef} className="w-full overflow-x-auto pb-1 -mb-1 px-2">
            <div className="flex items-start gap-0.5 min-w-max pt-3 pb-2">
              {currentPhase.stages.map((stage, i) => {
                const meta = lastPerformed(stage.key)
                return (
                  <div key={stage.key} className="contents">
                    <button
                      type="button"
                      disabled={!onStageClick}
                      onClick={() => onStageClick?.(stage.key)}
                      title={meta ? `${stage.label} — ${meta.FromUserName || ''} · ${meta.Remarks || ''}` : stage.label}
                      data-current={stage.current ? 'true' : undefined}
                      className={`relative flex flex-col items-center flex-none min-w-[96px] px-1 pb-1 ${
                        onStageClick ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {i > 0 && (
                        <div className={`absolute top-3 right-1/2 w-full h-0.5 ${
                          stage.complete ? 'bg-[#1E3A5F]' : 'bg-[#E2E8F0]'
                        }`} style={{ zIndex: 0 }} />
                      )}
                      <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                        stage.current
                          ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white shadow-[0_0_0_3px_rgba(14,165,233,0.15)]'
                          : stage.complete
                            ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                            : 'bg-white border-[#E2E8F0] text-[#94A3B8]'
                      }`}>
                        {stage.complete ? <Check className="w-3 h-3" /> : ''}
                      </div>
                      <p className={`text-[9px] mt-1 text-center leading-tight max-w-[88px] ${
                        stage.current ? 'text-[#0EA5E9] font-semibold' :
                        stage.complete ? 'text-[#1E3A5F] font-medium' : 'text-[#94A3B8]'
                      }`}>
                        {stage.label}
                      </p>
                      <p className="text-[8px] text-[#94A3B8] -mt-0.5">{stage.owner}</p>
                      {stage.current && (
                        <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wider text-[#0EA5E9]">● Current</span>
                      )}
                      {stage.complete && meta?.DateTime && (
                        <span className="mt-0.5 text-[7px] font-semibold text-[#1E3A5F]">{fmtDate(meta.DateTime)}</span>
                      )}
                    </button>
                    {i < currentPhase.stages.length - 1 && (
                      <div className="self-stretch flex items-center shrink-0 w-1" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className={`grid gap-1.5 px-4 py-2.5 ${showOwner ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} border-t border-[#E2E8F0] bg-[#F8FAFC]`}>
            {showOwner && (
              <div>
                <span className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">Current Owner</span>
                <p className="text-sm font-semibold text-[#0F172A]">{ownerName || info.owner || '—'}</p>
              </div>
            )}
            <div>
              <span className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">Current Stage</span>
              <p className="text-sm font-semibold text-[#0EA5E9]">{info.stageLabel}</p>
            </div>
            <div>
              <span className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">SLA</span>
              <p className={`text-sm font-semibold ${
                sla?.status === 'Overdue' ? 'text-red-600' :
                sla?.status === 'Warning' ? 'text-amber-600' : 'text-green-600'
              }`}>
                {sla ? (sla.status === 'Overdue' ? 'Overdue' : sla.status === 'Warning' ? 'Due Soon' : 'Within SLA') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-[9px] text-[#CBD5E1] mt-3">
        Legend: <span className="text-[#1E3A5F] font-medium">✓ completed</span> ·{' '}
        <span className="text-[#0EA5E9] font-medium">● current</span> ·{' '}
        <span className="text-[#94A3B8]">○ pending</span>
      </p>
    </div>
  )
}

export { getWorkflowProgress, getStatusInfo, fmtDate, fmtTime }