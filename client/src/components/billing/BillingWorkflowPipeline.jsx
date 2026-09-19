import { Check } from 'lucide-react'

export const BILL_STAGES = [
  { key: 'prepared', label: 'Bill Prepared', sub: 'Billing Officer', dot: 'bg-[#2563EB]' },
  { key: 'manager', label: 'With Manager', sub: 'Manager' },
  { key: 'dgm', label: 'With DGM', sub: 'DGM' },
  { key: 'gm', label: 'With GM', sub: 'GM' },
  { key: 'finance', label: 'With Finance', sub: 'Finance' },
]

// Pure function: derives how far a bill has advanced from its actual workflow
// status — never from the logged-in role. Returns 0-based index of the stage
// the bill is CURRENTLY at (stages before it are complete).
export function billStageIndex(status) {
  switch (status) {
    case 'SubmittedToManager':
    case 'ReturnedToManager':
      return 1
    case 'ManagerChecked':
    case 'ReturnedToDGM':
      return 2
    case 'DGMChecked':
      return 3
    case 'SubmittedToFinance':
    case 'WithFinance':
      return 4
    case 'Paid':
      return 5
    default:
      return 0 // Draft, ReturnedToBiller, Cancelled, unknown
  }
}

// Visual rail. Implemented purely for display; the backend remains the only
// source of truth for permissions and transitions.
export default function BillingWorkflowPipeline({ status, compact = false }) {
  const current = billStageIndex(status)

  return (
    <div className="bi-pipeline" data-testid="billing-workflow-pipeline">
      {BILL_STAGES.map((stage, i) => {
        const complete = i < current
        const isCurrent = i === current
        return (
          <div key={stage.key} className="contents">
            {i > 0 && (
              <div
                aria-hidden="true"
                className={`bi-pipe-line ${complete ? 'bi-pipe-line-complete' : isCurrent ? 'bi-pipe-line-flow' : 'bi-pipe-line-pending'}`}
              />
            )}
            <div className="bi-pipe-node">
              <span
                className={`bi-pipe-dot ${complete ? 'bi-pipe-dot-complete' : isCurrent ? 'bi-pipe-dot-current' : 'bi-pipe-dot-pending'}`}
                role="img"
                aria-label={`${stage.label} ${complete ? 'complete' : isCurrent ? 'current' : 'pending'}`}
              >
                {complete && <Check className="w-2 h-2 text-white" strokeWidth={4} />}
              </span>
              {!compact && (
                <div className="text-center">
                  <p className={`bi-pipe-label ${isCurrent ? 'bi-pipe-label-current' : complete ? 'bi-pipe-label-complete' : ''}`}>
                    {stage.label}
                  </p>
                  <p className="bi-pipe-sub">{stage.sub}</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
