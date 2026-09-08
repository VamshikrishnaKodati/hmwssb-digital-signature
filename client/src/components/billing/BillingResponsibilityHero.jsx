import { ShieldCheck, ArrowRight, UserRound, ChevronRight } from 'lucide-react'
import { BILL_STAGES, billStageIndex } from './BillingWorkflowPipeline'
import SlaProgress from './SlaProgress'
import { BillStatusBadge } from '../../utils/billStatus'

// Maps a bill stage to the role responsible and the check level shown.
const STAGE_ROLE = {
  prepared: { role: 'Billing Officer', level: 'Bill Preparation', desc: 'Quantities, measurement and bill accuracy are prepared and submitted for approval.' },
  manager: { role: 'Manager', level: 'Billing Check — Level 1', desc: 'Review quantities, measurements, documents and bill accuracy.' },
  dgm: { role: 'DGM', level: 'Billing Check — Level 2', desc: 'Verify the manager level-1 check and confirm the approved figures.' },
  gm: { role: 'GM', level: 'Billing Check — Level 3', desc: 'Final technical clearance before the bill is forwarded to Finance.' },
  finance: { role: 'Finance', level: 'Finance Processing', desc: 'Inward, verify, recommend, approve and issue the cheque.' },
}

// Pure display hero. Reads responsibility from actual bill state, not role.
export default function BillingResponsibilityHero({ bill, sla, me }) {
  const idx = billStageIndex(bill.Status)
  const current = BILL_STAGES[Math.min(idx, BILL_STAGES.length - 1)].key
  const info = STAGE_ROLE[current] || STAGE_ROLE.prepared
  const isPaid = bill.Status === 'Paid'
  const isMe = me && bill.CurrentOwner === me.UserID && !isPaid
  const nextIdx = idx + 1
  const next = BILL_STAGES[Math.min(nextIdx, BILL_STAGES.length - 1)]

  return (
    <section className="bi-hero" data-testid="billing-responsibility-hero">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="bi-hero-role">
            <ShieldCheck className="w-3.5 h-3.5" />
            Current Responsibility
            {isMe && <span className="bi-hero-tag bg-[#1E3A5F]/10 text-[#1E3A5F]">Your queue</span>}
            {isPaid && <span className="bi-hero-tag bg-emerald-50 text-emerald-700">Settled</span>}
          </div>
          <h2 className="bi-hero-title mt-1.5">
            {isPaid ? 'Bill Settled — Cheque Issued' : `${info.role} · ${info.level}`}
          </h2>
          <p className="text-[12px] text-[#64748B] mt-1 max-w-2xl">{info.desc}</p>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            {isPaid ? (
              <SlaProgress sla={null} compact />
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">SLA</span>
                  <SlaProgress sla={sla} showBar />
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] text-[#64748B]">
                  <span className="h-3 w-px bg-[#E3E8F0]" />
                  <UserRound className="w-3.5 h-3.5" />
                  {bill.CurrentOwnerName || 'Awaiting assignment'}
                </span>
              </>
            )}

            {!isPaid && nextIdx <= BILL_STAGES.length - 1 && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-[#475569]">
                Next: <span className="text-[#1E3A5F] font-semibold">{next.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#1E3A5F]" />
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <BillStatusBadge status={bill.Status} />
          <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]">
            View the full workflow below <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </section>
  )
}
