import { Clock, RotateCcw, Eye, CheckCircle, ArrowLeft } from 'lucide-react'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'
import AttentionRequired from '../../components/dashboard/AttentionRequired'
import { buildPipelineStages } from './pipelineConfig'

export default function DGMDashboard({ user, queues, dgmDashboard }) {
  const dd = dgmDashboard || {}
  const metrics = dd.metrics || {}
  const escalated = dd.escalated || []
  const pipeline = dd.pipeline || {}
  const billsToCheck = dd.billingMetrics?.pendingBillCheck || 0

  const pendingReview = metrics.pendingReview || queues.pendingReview || 0
  const revertedToMe = metrics.revertedToMe || queues.reverted || 0
  const postApprovalPending = metrics.postApprovalPending || 0
  const approvedByMe = metrics.approvedByMe || 0
  const returnsSent = metrics.returnsSent || 0
  const totalInScope = metrics.totalInScope || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Review Estimates', desc: 'Open your pending review queue', icon: Eye, to: '/approvals', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400', strong: pendingReview > 0 },
        { label: 'Reverted Estimates', desc: 'Fix and resubmit returned estimates', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Return to GM', desc: 'Return post-approval items for GM rework', icon: ArrowLeft, to: '/approvals', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400', strong: postApprovalPending > 0 },
        { label: 'Approved Estimates', desc: 'View estimates you have approved', icon: CheckCircle, to: qs({ actedBy: 'me', action: 'Approve' }), tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
      ]} />

      <EstimatePipeline
        title="DGM Workflow Position"
        viewLink="/approvals"
        current="DGM"
        stages={buildPipelineStages(pipeline)}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending Review" value={pendingReview} icon={Clock} bg="bg-blue-600" to={qs({ status: 'Submitted', assignedTo: 'me' })} tip={`${fmt(pendingReview)} estimates awaiting review`} />
          <MetricCard label="Reverted" value={revertedToMe} icon={RotateCcw} bg="bg-amber-500" to={qs({ status: 'Reverted', assignedTo: 'me' })} tip={`${fmt(revertedToMe)} estimates reverted`} />
          <MetricCard label="Post-Approval" value={postApprovalPending} icon={Eye} bg="bg-emerald-600" to={qs({ status: 'TSPending,TSApproved', assignedTo: 'me' })} tip={`${fmt(postApprovalPending)} post-approval items`} />
          <MetricCard label="Approved by Me" value={approvedByMe} icon={CheckCircle} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'Approve' })} tip={`${fmt(approvedByMe)} estimates approved`} />
          <MetricCard label="Returns Sent" value={returnsSent} icon={ArrowLeft} bg="bg-amber-600" to={qs({ actedBy: 'me', action: 'ReturnToGM' })} tip={`${fmt(returnsSent)} returned to GM`} />
          <MetricCard label="In My Scope" value={totalInScope} icon={Eye} bg="bg-violet-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(totalInScope)} total estimates in DGM scope`} />
          <MetricCard label="Bills to Check" value={billsToCheck} icon={CheckCircle} bg="bg-purple-600" to="/billing?owner=me" tip={`${fmt(billsToCheck)} bills awaiting your approval`} />
        </div>
      </div>

      <BillingQueueSection
        title="Bills to Check"
        subtitle={`${billsToCheck} bill${billsToCheck !== 1 ? 's' : ''} awaiting your approval`}
        rows={dd.billing || []}
        viewLink="/billing?owner=me"
        me={user}
      />

      <AttentionRequired rows={escalated} />
    </div>
  )
}