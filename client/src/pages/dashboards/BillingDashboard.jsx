import { FileEdit, Send, RotateCcw, BarChart3, Receipt, FilePlus2 } from 'lucide-react'
import { fmt, fmtCurrency } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'
import { buildStages, BILLING_PIPELINE } from './pipelineConfig'

export default function BillingDashboard({ user, queues, billingDashboard }) {
  const bd = billingDashboard || {}
  const metrics = bd.metrics || {}
  const queue = bd.queue || []

  const billsToPrepare = metrics.billsToPrepare || 0
  const draftBills = metrics.draftBills || 0
  const inWorkflow = metrics.submittedBills || 0
  const returnedBills = metrics.returnedBills || 0
  const amountPending = metrics.amountPending || 0

  // A draft / returned bill the Billing Officer should act on next.
  const focusBill = queue.find(b => b.Status === 'ReturnedToBiller') || queue.find(b => b.Status === 'Draft') || queue[0] || null

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Create RA Bill', desc: 'Prepare a new running-account bill', icon: Receipt, to: '/billing', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Draft Bills', desc: 'View and edit draft bills', icon: FileEdit, to: '/billing?status=Draft', tileBg: 'bg-sky-50 hover:bg-sky-100', border: 'border-sky-200 border-l-sky-600', iconBg: 'bg-sky-600', btnBg: 'bg-sky-600 group-hover:bg-sky-700', focusRing: 'focus-visible:ring-sky-400' },
        { label: 'Returned to Me', desc: 'Fix and resubmit returned bills', icon: RotateCcw, to: '/billing?status=ReturnedToBiller', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
      ]} />

      <EstimatePipeline
        title="Billing Workflow Position"
        viewLink="/billing"
        stages={buildStages(BILLING_PIPELINE, {
          WorksReady: billsToPrepare,
          Draft: draftBills,
          InWorkflow: inWorkflow,
          ReturnedBill: returnedBills,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <MetricCard label="Works Ready for Bill" value={billsToPrepare} icon={FilePlus2} bg="bg-blue-600" to="/estimates?status=WorkCompleted&assignedTo=me" tip={`${fmt(billsToPrepare)} Work Completed estimates`} format={fmt} />
          <MetricCard label="Draft Bills" value={draftBills} icon={FileEdit} bg="bg-sky-600" to="/billing?status=Draft" tip={`${fmt(draftBills)} drafts not yet submitted`} format={fmt} />
          <MetricCard label="In Workflow" value={inWorkflow} icon={Send} bg="bg-violet-600" to="/billing?status=SubmittedToManager,ManagerChecked,DGMChecked,SubmittedToFinance" tip={`${fmt(inWorkflow)} bills across the approval ladder`} format={fmt} />
          <MetricCard label="Returned to You" value={returnedBills} icon={RotateCcw} bg="bg-amber-500" to="/billing?status=ReturnedToBiller" tip={`${fmt(returnedBills)} bills need correction`} format={fmt} />
          <MetricCard label="Amount Pending" value={fmtCurrency(amountPending)} icon={BarChart3} bg="bg-emerald-600" format={v => v} to="/billing" tip="Amount tied up in active bills" />
        </div>
      </div>

      {queue.length > 0 && (
        <BillingQueueSection
          title="My Bills"
          subtitle={`${queue.length} bill${queue.length !== 1 ? 's' : ''} in your workspace`}
          rows={queue}
          viewLink="/billing"
          bill={focusBill}
          me={user}
        />
      )}
    </div>
  )
}